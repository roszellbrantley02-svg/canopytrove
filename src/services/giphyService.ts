import { hasGiphyConfig } from '../config/giphy';
import { reactionGifCatalog } from '../data/reactionGifCatalog';
import { storefrontApiBaseUrl } from '../config/storefrontSourceConfig';

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

function createGatewayUrl(pathname: string) {
  if (!storefrontApiBaseUrl) {
    throw new Error('Storefront API base URL is not configured.');
  }
  return `${storefrontApiBaseUrl.replace(/\/+$/, '')}${pathname}`;
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

async function requestGiphyGateway(gatewayPath: string, params: Record<string, string> = {}) {
  if (!storefrontApiBaseUrl) {
    return searchFallbackCatalog(params.q ?? '');
  }

  const searchParams = new URLSearchParams(params);
  const url = createGatewayUrl(
    `${gatewayPath}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`,
  );
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`GIPHY gateway request failed with status ${response.status}`);
  }

  return mapGiphyResponse((await response.json()) as GiphyApiResponse);
}

export function getTrendingGifs() {
  if (!hasGiphyConfig && !storefrontApiBaseUrl) {
    return Promise.resolve(searchFallbackCatalog(''));
  }

  return requestGiphyGateway('/giphy/trending');
}

export function searchGifs(query: string) {
  const normalizedQuery = query.trim().slice(0, 50);
  if (!normalizedQuery) {
    return getTrendingGifs();
  }

  return requestGiphyGateway('/giphy/search', {
    q: normalizedQuery,
  });
}
