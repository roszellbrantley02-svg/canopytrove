import {
  Coordinates,
  StorefrontDetailApiDocument,
  StorefrontSummariesApiResponse,
  StorefrontSummaryApiDocument,
  StorefrontSummarySortKey,
} from '../types';

export type StorefrontSummaryQuery = {
  areaId?: string;
  searchQuery?: string;
  origin?: Coordinates;
  radiusMiles?: number;
  sortKey?: StorefrontSummarySortKey;
  limit?: number;
  offset?: number;
};

export type StorefrontSummaryPage = StorefrontSummariesApiResponse;

export type StorefrontBackendSource = {
  getAllSummaries: () => Promise<StorefrontSummaryApiDocument[]>;
  getSummariesByIds: (ids: string[]) => Promise<StorefrontSummaryApiDocument[]>;
  getSummaryPage: (query: StorefrontSummaryQuery) => Promise<StorefrontSummaryPage>;
  getSummaries: (query: StorefrontSummaryQuery) => Promise<StorefrontSummaryApiDocument[]>;
  getDetailsById: (storefrontId: string) => Promise<StorefrontDetailApiDocument | null>;
};
