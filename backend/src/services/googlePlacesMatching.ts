import { StorefrontSummaryApiDocument } from '../types';
import { requestGoogleJson } from './googlePlacesClient';
import {
  GoogleSearchPlace,
  GOOGLE_MAPS_API_KEY,
  PLACE_ID_TTL_MS,
  googlePlacesCacheLimits,
  persistPlaceId,
  placeIdCache,
  placeIdInFlight,
  resolveCached,
} from './googlePlacesShared';

function normalizeMatchValue(value: string) {
  return value
    .toLowerCase()
    .replace(/\bu\.?\s*s\.?\b/g, 'us')
    .replace(/\bstate route\b/g, 'route')
    .replace(/\bstate rt\b/g, 'route')
    .replace(/\bstate hwy\b/g, 'highway')
    .replace(/\brt\b/g, 'route')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function createSearchQueries(summary: StorefrontSummaryApiDocument) {
  return [
    `${summary.displayName} ${summary.addressLine1}, ${summary.city}, NY ${summary.zip}`,
    `${summary.displayName} ${summary.city}, NY`,
    `${summary.addressLine1}, ${summary.city}, NY ${summary.zip}`,
  ];
}

function isPlausiblePlaceMatch(
  candidate: GoogleSearchPlace,
  summary: StorefrontSummaryApiDocument
) {
  const normalizedName = normalizeMatchValue(summary.displayName);
  const normalizedAddress = normalizeMatchValue(summary.addressLine1);
  const normalizedCity = normalizeMatchValue(summary.city);
  const normalizedDisplay = normalizeMatchValue(candidate.displayName?.text ?? '');
  const normalizedFormattedAddress = normalizeMatchValue(candidate.formattedAddress ?? '');

  const nameMatches =
    normalizedDisplay.includes(normalizedName) ||
    normalizedName.includes(normalizedDisplay) ||
    normalizedFormattedAddress.includes(normalizedName);
  const addressMatches =
    normalizedFormattedAddress.includes(normalizedAddress) ||
    normalizedAddress
      .split(' ')
      .filter((token) => token.length > 3)
      .every((token) => normalizedFormattedAddress.includes(token));
  const cityMatches =
    normalizedFormattedAddress.includes(normalizedCity) ||
    normalizedFormattedAddress.includes(summary.zip.toLowerCase());

  return cityMatches && (addressMatches || nameMatches);
}

export async function matchPlaceId(summary: StorefrontSummaryApiDocument) {
  if (!GOOGLE_MAPS_API_KEY) {
    return null;
  }

  if (summary.placeId?.trim()) {
    return summary.placeId.trim();
  }

  return resolveCached(
    summary.id,
    placeIdCache,
    placeIdInFlight,
    PLACE_ID_TTL_MS,
    googlePlacesCacheLimits.placeId,
    async () => {
    for (const query of createSearchQueries(summary)) {
      const payload = await requestGoogleJson<{ places?: GoogleSearchPlace[] }>(
        'https://places.googleapis.com/v1/places:searchText',
        {
          method: 'POST',
          body: JSON.stringify({
            textQuery: query,
            pageSize: 5,
            languageCode: 'en',
            regionCode: 'US',
            locationBias: {
              circle: {
                center: {
                  latitude: summary.latitude,
                  longitude: summary.longitude,
                },
                radius: 10000,
              },
            },
          }),
        },
        'places.id,places.displayName,places.formattedAddress'
      );

      const match = payload?.places?.find((candidate) => isPlausiblePlaceMatch(candidate, summary));
      if (match?.id) {
        void persistPlaceId(summary.id, match.id);
        return match.id;
      }
    }

    return null;
    }
  );
}
