import { brand } from '../config/brand';
import { storefrontApiBaseUrl } from '../config/storefrontSourceConfig';
import type { AnalyticsProfileKind } from '../types/analytics';

export const INSTALL_ID_KEY = `${brand.storageNamespace}:analytics-install-id`;
export const QUEUE_KEY = `${brand.storageNamespace}:analytics-queue`;
export const MAX_QUEUE_SIZE = 250;
export const MAX_BATCH_SIZE = 50;
export const FLUSH_DELAY_MS = 5_000;
export const RETRY_BACKOFF_MS = 15_000;
export const REPORT_TIMEOUT_MS = 4_000;

export type AnalyticsIdentity = {
  profileId: string | null;
  accountId: string | null;
  profileKind: AnalyticsProfileKind;
};

export function createAnalyticsUrl() {
  if (!storefrontApiBaseUrl) {
    return null;
  }

  return `${storefrontApiBaseUrl.replace(/\/+$/, '')}/analytics/events`;
}

export function createAnalyticsId(prefix: string) {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}
