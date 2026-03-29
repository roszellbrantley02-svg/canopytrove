import { hasFirebaseConfig } from '../config/firebase';
import { storefrontApiBaseUrl, storefrontSourceMode } from '../config/storefrontSourceConfig';
import { apiStorefrontSource } from './apiStorefrontSource';
import { firebaseStorefrontSource } from './firebaseStorefrontSource';
import { mockStorefrontSource } from './mockStorefrontSource';
import { StorefrontSource } from './storefrontSource';

const canUseFirebaseSource = storefrontSourceMode === 'firebase' && hasFirebaseConfig;
const canUseApiSource = storefrontSourceMode === 'api' && Boolean(storefrontApiBaseUrl);

function withFallbackSource(primary: StorefrontSource, fallback: StorefrontSource): StorefrontSource {
  return {
    async getAllSummaries() {
      try {
        return await primary.getAllSummaries();
      } catch {
        return fallback.getAllSummaries();
      }
    },
    async getSummariesByIds(storefrontIds) {
      try {
        return await primary.getSummariesByIds(storefrontIds);
      } catch {
        return fallback.getSummariesByIds(storefrontIds);
      }
    },
    async getSummaryPage(query) {
      try {
        return await primary.getSummaryPage(query);
      } catch {
        return fallback.getSummaryPage(query);
      }
    },
    async getSummaries(query) {
      try {
        return await primary.getSummaries(query);
      } catch {
        return fallback.getSummaries(query);
      }
    },
    async getDetailsById(storefrontId) {
      try {
        return await primary.getDetailsById(storefrontId);
      } catch {
        return fallback.getDetailsById(storefrontId);
      }
    },
  };
}

const configuredSource = canUseApiSource
  ? apiStorefrontSource
  : canUseFirebaseSource
    ? firebaseStorefrontSource
    : mockStorefrontSource;

export const storefrontSource =
  configuredSource === mockStorefrontSource
    ? mockStorefrontSource
    : withFallbackSource(configuredSource, mockStorefrontSource);

export const storefrontSourceStatus = {
  requestedMode: storefrontSourceMode,
  activeMode: canUseApiSource ? 'api' : canUseFirebaseSource ? 'firebase' : 'mock',
  fallbackReason:
    storefrontSourceMode === 'api' && !storefrontApiBaseUrl
      ? 'Missing storefront API base URL'
      : storefrontSourceMode === 'firebase' && !hasFirebaseConfig
        ? 'Missing Firebase environment config'
        : null,
} as const;
