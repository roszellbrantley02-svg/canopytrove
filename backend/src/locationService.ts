import { mockAreas } from '../../src/data/mockAreas';
import { getCachedLocationResolution } from './services/storefrontCacheService';
import { backendStorefrontSource } from './sources';
import { Coordinates, LocationResolutionApiResponse, StorefrontSummaryApiDocument } from './types';

function normalizeQuery(value: string) {
  return value.trim().toLowerCase();
}

function isZipQuery(value: string) {
  return /^\d{5}$/.test(value.trim());
}

function scoreSummaryLocation(query: string, summary: StorefrontSummaryApiDocument) {
  const normalizedQuery = normalizeQuery(query);
  if (!normalizedQuery) {
    return 0;
  }

  let score = 0;
  const city = summary.city.trim().toLowerCase();
  const zip = summary.zip.trim().toLowerCase();
  const address = summary.addressLine1.trim().toLowerCase();
  const marketId = summary.marketId.trim().toLowerCase();

  if (isZipQuery(query) && zip === normalizedQuery) {
    score += 8;
  }

  if (city === normalizedQuery) {
    score += 7;
  } else if (city.includes(normalizedQuery) || normalizedQuery.includes(city)) {
    score += 5;
  }

  if (address.includes(normalizedQuery)) {
    score += 3;
  }

  if (marketId.includes(normalizedQuery)) {
    score += 2;
  }

  return score;
}

function averageCoordinates(items: StorefrontSummaryApiDocument[]): Coordinates {
  const total = items.reduce(
    (accumulator, item) => {
      accumulator.latitude += item.latitude;
      accumulator.longitude += item.longitude;
      return accumulator;
    },
    { latitude: 0, longitude: 0 }
  );

  return {
    latitude: total.latitude / items.length,
    longitude: total.longitude / items.length,
  };
}

function buildLocationGroups(summaries: StorefrontSummaryApiDocument[]) {
  const cityGroups = new Map<string, StorefrontSummaryApiDocument[]>();
  const zipGroups = new Map<string, StorefrontSummaryApiDocument[]>();

  summaries.forEach((summary) => {
    const cityKey = normalizeQuery(summary.city);
    const zipKey = normalizeQuery(summary.zip);

    const cityEntries = cityGroups.get(cityKey) ?? [];
    cityEntries.push(summary);
    cityGroups.set(cityKey, cityEntries);

    const zipEntries = zipGroups.get(zipKey) ?? [];
    zipEntries.push(summary);
    zipGroups.set(zipKey, zipEntries);
  });

  return {
    cityGroups,
    zipGroups,
  };
}

function buildLocationResponse(
  label: string,
  summaries: StorefrontSummaryApiDocument[],
  source: 'summary'
): LocationResolutionApiResponse {
  return {
    coordinates: averageCoordinates(summaries),
    label,
    source,
  };
}

function formatSummaryLabel(query: string, summary: StorefrontSummaryApiDocument) {
  if (isZipQuery(query)) {
    return `${summary.zip}, NY`;
  }

  return `${summary.city}, NY`;
}

export async function resolveLocationQuery(rawQuery: string): Promise<LocationResolutionApiResponse> {
  const query = rawQuery.trim();
  if (!query) {
    return {
      coordinates: null,
      label: null,
      source: 'unavailable',
    };
  }

  const normalizedQuery = normalizeQuery(query);
  const areaMatch =
    mockAreas.find((area) => {
      const values = [area.label, area.subtitle].map((value) => normalizeQuery(value));
      return values.some((value) => value.includes(normalizedQuery) || normalizedQuery.includes(value));
    }) ?? null;

  if (areaMatch) {
    return {
      coordinates: areaMatch.center,
      label: areaMatch.label,
      source: 'area',
    };
  }

  return getCachedLocationResolution(query, async () => {
    const summaries = await backendStorefrontSource.getAllSummaries();
    const { cityGroups, zipGroups } = buildLocationGroups(summaries);

    if (isZipQuery(query)) {
      const zipMatches = zipGroups.get(normalizedQuery) ?? [];
      if (zipMatches.length) {
        return buildLocationResponse(`${zipMatches[0].zip}, NY`, zipMatches, 'summary');
      }
    }

    const exactCityMatches = cityGroups.get(normalizedQuery) ?? [];
    if (exactCityMatches.length) {
      return buildLocationResponse(
        `${exactCityMatches[0].city}, NY`,
        exactCityMatches,
        'summary'
      );
    }

    const scored = summaries
      .map((summary) => ({
        summary,
        score: scoreSummaryLocation(query, summary),
      }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        return right.summary.reviewCount - left.summary.reviewCount;
      });

    if (!scored.length) {
      return {
        coordinates: null,
        label: null,
        source: 'unavailable' as const,
      };
    }

    const bestScore = scored[0].score;
    const bestMatches = scored
      .filter((entry) => entry.score === bestScore)
      .map((entry) => entry.summary)
      .slice(0, 6);

    const topSummary = bestMatches[0];

    if (
      bestMatches.length > 1 &&
      bestMatches.every(
        (summary) => normalizeQuery(summary.city) === normalizeQuery(topSummary.city)
      )
    ) {
      return buildLocationResponse(
        `${topSummary.city}, NY`,
        bestMatches,
        'summary'
      );
    }

    return {
      coordinates: {
        latitude: topSummary.latitude,
        longitude: topSummary.longitude,
      },
      label: formatSummaryLabel(query, topSummary),
      source: 'summary',
    };
  });
}
