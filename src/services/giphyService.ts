import { giphyApiKey } from '../config/giphy';
import { reactionGifCatalog } from '../data/reactionGifCatalog';

const GIPHY_BASE_URL = 'https://api.giphy.com/v1/gifs';
const GIPHY_LIMIT = 18;

type GiphyApiResponse = {
  data?: Array<{
    id?: string;
    title?: string;
    images?: {
      fixed_width?: {
        url?: string;
      };
      original?: {
        url?: string;
      };
    };
  }>;
};

export type GiphyGifResult = {
  id: string;
  title: string;
  previewUrl: string;
  mediaUrl: string;
};

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase();
}

function searchFallbackCatalog(query: string): GiphyGifResult[] {
  const normalizedQuery = normalizeSearchValue(query);
  const items = !normalizedQuery
    ? reactionGifCatalog
    : reactionGifCatalog.filter((item) => {
        const haystack = [item.title, ...item.keywords].join(' ').toLowerCase();
        return haystack.includes(normalizedQuery);
      });

  return items.map(({ keywords: _keywords, ...item }) => item);
}

function assertConfiguredApiKey() {
  if (!giphyApiKey) {
    throw new Error('GIPHY API key is not configured.');
  }

  return giphyApiKey;
}

function toStringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function mapGiphyResponse(payload: GiphyApiResponse): GiphyGifResult[] {
  const items = payload.data ?? [];
  return items
    .map((item) => {
      const previewUrl = toStringValue(item.images?.fixed_width?.url);
      const mediaUrl = toStringValue(item.images?.original?.url) || previewUrl;
      if (!previewUrl || !mediaUrl) {
        return null;
      }

      return {
        id: toStringValue(item.id) || mediaUrl,
        title: toStringValue(item.title) || 'GIF',
        previewUrl,
        mediaUrl,
      } satisfies GiphyGifResult;
    })
    .filter((item): item is GiphyGifResult => item !== null);
}

async function requestGiphy(path: string, params: Record<string, string> = {}) {
  if (!giphyApiKey) {
    return searchFallbackCatalog(params.q ?? '');
  }

  const apiKey = assertConfiguredApiKey();
  const searchParams = new URLSearchParams({
    api_key: apiKey,
    rating: 'g',
    limit: String(GIPHY_LIMIT),
    bundle: 'messaging_non_clips',
    ...params,
  });
  const response = await fetch(`${GIPHY_BASE_URL}${path}?${searchParams.toString()}`);

  if (!response.ok) {
    throw new Error(`GIPHY request failed with status ${response.status}`);
  }

  return mapGiphyResponse((await response.json()) as GiphyApiResponse);
}

export function getTrendingGifs() {
  if (!giphyApiKey) {
    return Promise.resolve(searchFallbackCatalog(''));
  }

  return requestGiphy('/trending');
}

export function searchGifs(query: string) {
  const normalizedQuery = query.trim().slice(0, 50);
  if (!normalizedQuery) {
    return getTrendingGifs();
  }

  return requestGiphy('/search', {
    q: normalizedQuery,
    lang: 'en',
  });
}
