import { BrowseSortKey, Coordinates, StorefrontDetails, StorefrontSummary } from '../types/storefront';
import type { OwnerPromotionPlacementSurface } from '../types/ownerPortal';

export type StorefrontSourceSummaryQuery = {
  areaId?: string;
  searchQuery?: string;
  origin?: Coordinates;
  radiusMiles?: number;
  sortKey?: BrowseSortKey;
  limit?: number;
  offset?: number;
  prioritySurface?: OwnerPromotionPlacementSurface;
};

export type StorefrontSummaryPage = {
  items: StorefrontSummary[];
  total: number;
  limit: number | null;
  offset: number;
};

export type StorefrontSource = {
  getAllSummaries: () => Promise<StorefrontSummary[]>;
  getSummariesByIds: (storefrontIds: string[]) => Promise<StorefrontSummary[]>;
  getSummaryPage: (query?: StorefrontSourceSummaryQuery) => Promise<StorefrontSummaryPage>;
  getSummaries: (query?: StorefrontSourceSummaryQuery) => Promise<StorefrontSummary[]>;
  getDetailsById: (storefrontId: string) => Promise<StorefrontDetails | null>;
};
