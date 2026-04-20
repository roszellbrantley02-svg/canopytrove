/**
 * Product Review Service (client)
 *
 * Frontend wrapper around the backend /products/:slug/reviews endpoints.
 * Viewing is gated in Profile → My Products; the HTTP layer here is
 * intentionally generic so the UI can decide when to render.
 *
 * All functions fail-soft — they return a structured error instead of
 * throwing so callers can render a friendly state.
 */

import { storefrontApiBaseUrl } from '../config/storefrontSourceConfig';

export type ProductReviewEffectTag =
  | 'relaxed'
  | 'energetic'
  | 'sleepy'
  | 'creative'
  | 'focused'
  | 'happy'
  | 'hungry';

export const PRODUCT_REVIEW_EFFECT_TAGS: ProductReviewEffectTag[] = [
  'relaxed',
  'energetic',
  'sleepy',
  'creative',
  'focused',
  'happy',
  'hungry',
];

export type ProductReviewSummary = {
  id: string;
  authorName: string;
  rating: number;
  text: string;
  effectTags: ProductReviewEffectTag[];
  photoUrls: string[];
  photoCount: number;
  helpfulCount: number;
  isOwnReview: boolean;
  relativeTime: string;
};

export type ProductReviewAggregate = {
  productSlug: string;
  brandName: string;
  productName: string;
  reviewCount: number;
  averageRating: number;
  ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number>;
  topEffectTags: Array<{ tag: ProductReviewEffectTag; count: number }>;
};

export type MemberProductReviewRecord = {
  id: string;
  productSlug: string;
  brandName: string;
  productName: string;
  rating: number;
  text: string;
  effectTags: ProductReviewEffectTag[];
  photoUrls: string[];
  photoCount: number;
  createdAt: string;
};

export type ProductReviewSubmissionInput = {
  brandName: string;
  productName: string;
  profileId: string;
  authorName: string;
  rating: number;
  text: string;
  effectTags: ProductReviewEffectTag[];
  photoUploadIds?: string[];
  photoCount?: number;
};

export type ProductReviewSubmissionResult =
  | { ok: true; review: ProductReviewSummary }
  | { ok: false; error: string };

const REQUEST_TIMEOUT_MS = 15_000;

function joinUrl(path: string): string | null {
  if (!storefrontApiBaseUrl) return null;
  const base = storefrontApiBaseUrl.endsWith('/')
    ? storefrontApiBaseUrl
    : `${storefrontApiBaseUrl}/`;
  return new URL(path.replace(/^\//, ''), base).toString();
}

async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
): Promise<{ ok: true; value: T } | { ok: false; error: string; status?: number }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      return {
        ok: false,
        error: `Request failed (${response.status})`,
        status: response.status,
      };
    }
    const payload = (await response.json()) as T;
    return { ok: true, value: payload };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Network request failed',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Lower-case kebab slug with NFKD diacritic strip. Shared between the
 * product slug builder and the brand-id canonicalizer so that "Housing
 * Works Cannabis" and "housing-works-cannabis" always resolve to the
 * same backend key.
 */
function slugifyForCanonicalKey(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Build a stable brand id from a free-text brand name. Mirrors the seed
 * `brandId` format (`housing-works-cannabis`, `matte`, `silly-nice`),
 * which is what `/brands/:brandId` and `/profile/favorite-brands/:brandId`
 * expect. Use this any time you have a brand NAME from a COA/user input
 * and need to talk to the brand backend.
 */
export function buildClientBrandSlug(brandName: string | null | undefined): string | null {
  if (typeof brandName !== 'string') return null;
  const slug = slugifyForCanonicalKey(brandName);
  if (!slug) return null;
  return slug.slice(0, 120);
}

/**
 * Build a stable slug from brand + product name. Mirrors the backend
 * implementation so submits and fetches always land on the same key.
 */
export function buildClientProductSlug(
  brandName: string | null | undefined,
  productName: string | null | undefined,
): string | null {
  const brand = typeof brandName === 'string' ? slugifyForCanonicalKey(brandName) : '';
  const product = typeof productName === 'string' ? slugifyForCanonicalKey(productName) : '';
  if (!brand && !product) return null;
  const combined = [brand, product].filter(Boolean).join('--');
  return combined ? combined.slice(0, 120) : null;
}

/**
 * Fetch reviews + aggregate for a product slug.
 */
export async function fetchProductReviews(
  slug: string,
  viewerProfileId?: string,
): Promise<
  | {
      ok: true;
      reviews: ProductReviewSummary[];
      aggregate: ProductReviewAggregate;
    }
  | { ok: false; error: string }
> {
  const url = joinUrl(`products/${encodeURIComponent(slug)}/reviews`);
  if (!url) return { ok: false, error: 'Review service unavailable' };
  const suffix = viewerProfileId ? `?viewerProfileId=${encodeURIComponent(viewerProfileId)}` : '';
  const result = await fetchJson<{
    ok: boolean;
    reviews: ProductReviewSummary[];
    aggregate: ProductReviewAggregate;
    error?: string;
  }>(`${url}${suffix}`);
  if (!result.ok) return { ok: false, error: result.error };
  if (!result.value.ok) return { ok: false, error: result.value.error ?? 'Request failed' };
  return {
    ok: true,
    reviews: result.value.reviews,
    aggregate: result.value.aggregate,
  };
}

/**
 * Submit a review. Requires a signed-in member profile — the backend will
 * 403 anonymous profiles.
 */
export async function submitProductReviewRequest(
  slug: string,
  input: ProductReviewSubmissionInput,
): Promise<ProductReviewSubmissionResult> {
  const url = joinUrl(`products/${encodeURIComponent(slug)}/reviews`);
  if (!url) return { ok: false, error: 'Review service unavailable' };
  const result = await fetchJson<{
    ok: boolean;
    review?: ProductReviewSummary;
    error?: string;
  }>(url, {
    method: 'POST',
    body: JSON.stringify({
      profileId: input.profileId,
      brandName: input.brandName,
      productName: input.productName,
      authorName: input.authorName,
      rating: input.rating,
      text: input.text,
      effectTags: input.effectTags,
      photoUploadIds: input.photoUploadIds ?? [],
      photoCount: input.photoCount ?? 0,
    }),
  });
  if (!result.ok) return { ok: false, error: result.error };
  if (!result.value.ok || !result.value.review) {
    return { ok: false, error: result.value.error ?? 'Submission failed' };
  }
  return { ok: true, review: result.value.review };
}

/**
 * Fetch the member's own product reviews (powers the MyProductsScreen list).
 */
export async function fetchMyProductReviews(
  profileId: string,
): Promise<{ ok: true; reviews: MemberProductReviewRecord[] } | { ok: false; error: string }> {
  const url = joinUrl(`me/product-reviews?profileId=${encodeURIComponent(profileId)}`);
  if (!url) return { ok: false, error: 'Review service unavailable' };
  const result = await fetchJson<{
    ok: boolean;
    reviews: MemberProductReviewRecord[];
    error?: string;
  }>(url);
  if (!result.ok) return { ok: false, error: result.error };
  if (!result.value.ok) return { ok: false, error: result.value.error ?? 'Request failed' };
  return { ok: true, reviews: result.value.reviews };
}

/**
 * Fetch the top-reviewed products across the community. Powers the
 * "community favorites" chart on MyProductsScreen.
 */
export async function fetchCommunityFavoriteProducts(): Promise<
  { ok: true; favorites: ProductReviewAggregate[] } | { ok: false; error: string }
> {
  const url = joinUrl('products/community-favorites');
  if (!url) return { ok: false, error: 'Review service unavailable' };
  const result = await fetchJson<{
    ok: boolean;
    favorites: ProductReviewAggregate[];
    error?: string;
  }>(url);
  if (!result.ok) return { ok: false, error: result.error };
  if (!result.value.ok) return { ok: false, error: result.value.error ?? 'Request failed' };
  return { ok: true, favorites: result.value.favorites };
}

export async function markProductReviewHelpfulRequest(
  slug: string,
  reviewId: string,
  profileId: string,
): Promise<
  { ok: true; helpfulCount: number; alreadyVoted: boolean } | { ok: false; error: string }
> {
  const url = joinUrl(
    `products/${encodeURIComponent(slug)}/reviews/${encodeURIComponent(reviewId)}/helpful`,
  );
  if (!url) return { ok: false, error: 'Review service unavailable' };
  const result = await fetchJson<{
    ok: boolean;
    helpfulCount?: number;
    alreadyVoted?: boolean;
    error?: string;
  }>(url, { method: 'POST', body: JSON.stringify({ profileId }) });
  if (!result.ok) return { ok: false, error: result.error };
  if (!result.value.ok) return { ok: false, error: result.value.error ?? 'Request failed' };
  return {
    ok: true,
    helpfulCount: result.value.helpfulCount ?? 0,
    alreadyVoted: Boolean(result.value.alreadyVoted),
  };
}
