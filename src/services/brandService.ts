/**
 * Brand Service
 *
 * HTTP client for brand profile and favorite brand endpoints.
 * Mirrors other client services like storefrontService.
 */

import { storefrontApiBaseUrl } from '../config/storefrontSourceConfig';
import type {
  BrandProfile,
  BrandProfileSummary,
  BrandSortKey,
  StorefrontBrandCarrierSummary,
} from '../types/brandTypes';

const BASE_URL = storefrontApiBaseUrl ?? '';

export type ListBrandsOptions = {
  sort?: BrandSortKey;
  filter?: string;
  cursor?: string;
  limit?: number;
};

/**
 * Fetch a single brand profile by ID.
 * Public endpoint (App Check gated).
 */
export async function fetchBrandProfile(brandId: string): Promise<BrandProfile | null> {
  try {
    const response = await fetch(`${BASE_URL}/brands/${encodeURIComponent(brandId)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as BrandProfile;
  } catch (error) {
    console.warn('[brandService] Failed to fetch brand profile', { brandId, error });
    return null;
  }
}

/**
 * List all brands with optional sorting and filtering.
 * Public endpoint (App Check gated).
 */
export async function listBrands(options?: ListBrandsOptions): Promise<{
  brands: BrandProfileSummary[];
  nextCursor?: string;
  filterOptions?: { smell?: string[]; taste?: string[] };
}> {
  try {
    const params = new URLSearchParams();
    if (options?.sort) params.set('sort', options.sort);
    if (options?.filter) params.set('filter', options.filter);
    if (options?.cursor) params.set('cursor', options.cursor);
    if (options?.limit) params.set('limit', String(options.limit));

    const url = `${BASE_URL}/brands${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return { brands: [] };
    }

    return (await response.json()) as {
      brands: BrandProfileSummary[];
      nextCursor?: string;
      filterOptions?: { smell?: string[]; taste?: string[] };
    };
  } catch (error) {
    console.warn('[brandService] Failed to list brands', { error });
    return { brands: [] };
  }
}

/**
 * Add a brand to user's favorites.
 * Authenticated endpoint.
 */
export async function addFavoriteBrand(
  brandId: string,
  options?: { profileId?: string; token?: string },
): Promise<boolean> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (options?.profileId) {
      headers['x-canopy-profile-id'] = options.profileId;
    }

    if (options?.token) {
      headers.Authorization = `Bearer ${options.token}`;
    }

    const response = await fetch(`${BASE_URL}/profile/favorite-brands`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ brandId }),
    });

    return response.ok;
  } catch (error) {
    console.warn('[brandService] Failed to add favorite brand', { brandId, error });
    return false;
  }
}

/**
 * Remove a brand from user's favorites.
 * Authenticated endpoint.
 */
export async function removeFavoriteBrand(
  brandId: string,
  options?: { profileId?: string; token?: string },
): Promise<boolean> {
  try {
    const headers: Record<string, string> = {};

    if (options?.profileId) {
      headers['x-canopy-profile-id'] = options.profileId;
    }

    if (options?.token) {
      headers.Authorization = `Bearer ${options.token}`;
    }

    const response = await fetch(
      `${BASE_URL}/profile/favorite-brands/${encodeURIComponent(brandId)}`,
      {
        method: 'DELETE',
        headers,
      },
    );

    return response.ok;
  } catch (error) {
    console.warn('[brandService] Failed to remove favorite brand', { brandId, error });
    return false;
  }
}

/**
 * List user's favorite brands.
 * Authenticated endpoint.
 */
export async function listFavoriteBrands(options?: {
  profileId?: string;
  token?: string;
}): Promise<BrandProfile[]> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (options?.profileId) {
      headers['x-canopy-profile-id'] = options.profileId;
    }

    if (options?.token) {
      headers.Authorization = `Bearer ${options.token}`;
    }

    const response = await fetch(`${BASE_URL}/profile/favorite-brands`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as { brands: BrandProfile[] };
    return data.brands || [];
  } catch (error) {
    console.warn('[brandService] Failed to list favorite brands', { error });
    return [];
  }
}

/**
 * Check if a brand is in user's favorites.
 */
export async function isFavoriteBrand(
  brandId: string,
  options?: { profileId?: string; token?: string },
): Promise<boolean> {
  try {
    const favorites = await listFavoriteBrands(options);
    return favorites.some((b) => b.brandId === brandId);
  } catch (error) {
    console.warn('[brandService] Failed to check favorite status', { brandId, error });
    return false;
  }
}

/**
 * List storefronts that self-report carrying this brand.
 * Public endpoint backed by `owner_storefront_brands`.
 */
export async function listBrandCarriers(
  brandId: string,
  options?: { limit?: number },
): Promise<StorefrontBrandCarrierSummary[]> {
  try {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(
      `${BASE_URL}/brands/${encodeURIComponent(brandId)}/carriers${query}`,
      { method: 'GET', headers: { 'Content-Type': 'application/json' } },
    );
    if (!response.ok) {
      return [];
    }
    const payload = (await response.json()) as { carriers?: StorefrontBrandCarrierSummary[] };
    return Array.isArray(payload.carriers) ? payload.carriers : [];
  } catch (error) {
    console.warn('[brandService] Failed to list brand carriers', { brandId, error });
    return [];
  }
}
