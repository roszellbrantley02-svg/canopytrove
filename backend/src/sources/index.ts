import { hasBackendFirebaseConfig } from '../firebase';
import {
  clearFirestoreStorefrontSourceCache,
  firestoreStorefrontSource,
  warmFirestoreStorefrontSource,
} from './firestoreStorefrontSource';
import { clearMockStorefrontSourceCache, mockStorefrontSource } from './mockStorefrontSource';
import { StorefrontBackendSource } from './types';

type BackendSourceMode = 'mock' | 'firestore';

function readSourceMode(): BackendSourceMode {
  const rawMode = process.env.STOREFRONT_BACKEND_SOURCE?.trim().toLowerCase();
  return rawMode === 'firestore' ? 'firestore' : 'mock';
}

function withFallbackSource(primary: StorefrontBackendSource, fallback: StorefrontBackendSource): StorefrontBackendSource {
  return {
    async getAllSummaries() {
      try {
        return await primary.getAllSummaries();
      } catch {
        return fallback.getAllSummaries();
      }
    },
    async getSummariesByIds(ids) {
      try {
        return await primary.getSummariesByIds(ids);
      } catch {
        return fallback.getSummariesByIds(ids);
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

const requestedMode = readSourceMode();
const canUseFirestoreSource = requestedMode === 'firestore' && hasBackendFirebaseConfig;
const configuredSource = canUseFirestoreSource ? firestoreStorefrontSource : mockStorefrontSource;

export const backendStorefrontSource =
  configuredSource === mockStorefrontSource
    ? mockStorefrontSource
    : withFallbackSource(configuredSource, mockStorefrontSource);

export const backendStorefrontSourceStatus = {
  requestedMode,
  activeMode: canUseFirestoreSource ? 'firestore' : 'mock',
  fallbackReason:
    requestedMode === 'firestore' && !hasBackendFirebaseConfig
      ? 'Missing backend Firebase environment config'
      : null,
} as const;

export function clearBackendStorefrontSourceCaches() {
  clearMockStorefrontSourceCache();
  clearFirestoreStorefrontSourceCache();
}

export async function warmBackendStorefrontSource() {
  if (backendStorefrontSourceStatus.activeMode !== 'firestore') {
    return;
  }

  try {
    await warmFirestoreStorefrontSource();
  } catch {
    // Startup warming should not block backend availability.
  }
}
