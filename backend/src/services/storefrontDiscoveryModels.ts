import type { GooglePlacesEnrichment } from './googlePlacesShared';
import type { StorefrontRecord } from '../../../src/types/storefrontRecord';

export type StorefrontDiscoverySourceKind = 'ocm_verified_seed';

export type StorefrontDiscoveryRunReason = 'scheduled' | 'manual' | 'publish';

export type StorefrontDiscoveryRunStatus = 'running' | 'completed' | 'failed';

export type StorefrontDiscoveryPublicationStatus =
  | 'hidden'
  | 'ready_for_publish'
  | 'published'
  | 'suppressed';

export type StorefrontDiscoveryCandidateDocument = {
  id: string;
  sourceKind: StorefrontDiscoverySourceKind;
  source: StorefrontRecord;
  googlePlaceId: string | null;
  googleEnrichment: GooglePlacesEnrichment | null;
  publicationStatus: StorefrontDiscoveryPublicationStatus;
  publicationReason: string;
  discoveredAt: string;
  lastCheckedAt: string;
  publishedAt: string | null;
  publishedSummaryId: string | null;
  publishedDetailId: string | null;
  updatedAt: string;
};

export type StorefrontDiscoveryRunDocument = {
  id: string;
  reason: StorefrontDiscoveryRunReason;
  status: StorefrontDiscoveryRunStatus;
  startedAt: string;
  finishedAt: string | null;
  sourceCount: number;
  candidateCount: number;
  hiddenCount: number;
  readyForPublishCount: number;
  publishedCount: number;
  suppressedCount: number;
  failedCount: number;
  limit: number | null;
  marketId: string | null;
  lastError: string | null;
};

export type StorefrontDiscoveryStateDocument = {
  lastRunId: string | null;
  lastRunAt: string | null;
  lastSuccessfulRunAt: string | null;
  nextRunAt: string | null;
  lastRunReason: StorefrontDiscoveryRunReason | null;
  lastRunStatus: StorefrontDiscoveryRunStatus | null;
  lastError: string | null;
  totalSourceCount: number;
  candidateCount: number;
  hiddenCount: number;
  readyForPublishCount: number;
  publishedCount: number;
  suppressedCount: number;
  lastRunLimit: number | null;
  lastRunMarketId: string | null;
};

export type StorefrontDiscoveryStatusDocument = {
  configured: boolean;
  schedulerEnabled: boolean;
  intervalHours: number;
  nextRunAt: string | null;
  latestRun: StorefrontDiscoveryRunDocument | null;
  state: StorefrontDiscoveryStateDocument;
  apiBudget?: {
    used: number;
    limit: number;
    remaining: number;
    resetsAt: string;
  };
};
