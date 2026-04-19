/**
 * Brand Types
 *
 * Frontend types for brand profiles, favorites, and related data.
 */

export type BrandSmellTag =
  | 'citrus'
  | 'earthy'
  | 'pine'
  | 'floral'
  | 'peppery'
  | 'fruity'
  | 'hoppy'
  | 'sweet'
  | 'musky'
  | 'woody';

export type BrandTasteTag =
  | 'citrus'
  | 'musky'
  | 'herbal'
  | 'sweet'
  | 'piney'
  | 'sharp'
  | 'floral'
  | 'lavender'
  | 'peppery'
  | 'spicy'
  | 'hoppy'
  | 'woody'
  | 'fruity'
  | 'tropical'
  | 'chamomile';

export type BrandSortKey = 'smell' | 'taste' | 'potency';

export type BrandProfile = {
  brandId: string;
  displayName: string;
  aggregateDominantTerpene?: string;
  smellTags: BrandSmellTag[];
  tasteTags: BrandTasteTag[];
  avgThcPercent: number;
  contaminantPassRate: number; // 0..1
  totalScans: number;
  lastScannedAt?: string;
  description?: string;
  website?: string;
  source: 'seed' | 'scanned' | 'merged';
};

export type BrandProfileSummary = {
  brandId: string;
  displayName: string;
  aggregateDominantTerpene?: string;
  smellTags: BrandSmellTag[];
  avgThcPercent: number;
  contaminantPassRate: number;
  totalScans: number;
};

export type FavoriteBrandEntry = {
  brandId: string;
  savedAt: string;
  displayName: string;
  note?: string;
};

/**
 * Owner-reported brand roster for a storefront ("brands we carry").
 * Powers the "Where to find it" lookup on scan results and product pages.
 */
export type OwnerStorefrontBrandsDocument = {
  storefrontId: string;
  ownerUid: string;
  brandIds: string[];
  updatedAt: string;
};

/** Public summary of which storefronts carry a given brand. */
export type StorefrontBrandCarrierSummary = {
  storefrontId: string;
  displayName: string;
  city: string;
  state: string;
  updatedAt: string;
};
