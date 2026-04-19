/**
 * Product Slug Service
 *
 * Produces a stable, URL-safe key from a brand + product name so product
 * reviews can aggregate across batches. Two scans of the same named product
 * (different batch IDs, different COA URLs) end up under the same slug.
 *
 * Intentionally permissive — we don't dedupe minor misspellings or casing
 * variants beyond basic normalization. If the slug quality becomes a
 * problem we can tighten it later (or move to a canonical brand/product
 * registry), but for MVP we want contributions to roll up easily.
 */

const MAX_SLUG_LENGTH = 120;

/**
 * Normalize a free-text brand/product string: lowercase, strip diacritics,
 * collapse whitespace, replace non-alphanum with dashes.
 */
function normalize(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Build a stable slug from a brand + product name pair. Returns `null` if
 * there isn't enough signal to form a meaningful slug (both empty or
 * nothing alphanumeric survived normalization).
 */
export function buildProductSlug(
  brandName: string | null | undefined,
  productName: string | null | undefined,
): string | null {
  const brand = typeof brandName === 'string' ? normalize(brandName) : '';
  const product = typeof productName === 'string' ? normalize(productName) : '';

  if (!brand && !product) return null;

  const combined = [brand, product].filter(Boolean).join('--');
  if (!combined) return null;

  return combined.slice(0, MAX_SLUG_LENGTH);
}

/**
 * Validate a slug string (coming in on a path param). Returns the trimmed
 * slug if acceptable, or null if the caller should 400.
 */
export function parseProductSlugParam(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || trimmed.length > MAX_SLUG_LENGTH) return null;
  // Slugs only contain [a-z0-9-]; reject anything else so path-param abuse
  // can't reach Firestore with funky keys.
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trimmed)) return null;
  return trimmed;
}
