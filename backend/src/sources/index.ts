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

function createMissingFirestoreConfigError() {
  return new Error(
    'Storefront backend source is set to firestore, but backend Firebase environment config is missing.',
  );
}

async function failUnavailableFirestoreSource<T>(): Promise<T> {
  throw createMissingFirestoreConfigError();
}

function createUnavailableFirestoreSource(): StorefrontBackendSource {
  return {
    getAllSummaries() {
      return failUnavailableFirestoreSource();
    },
    getSummariesByIds() {
      return failUnavailableFirestoreSource();
    },
    getSummaryPage() {
      return failUnavailableFirestoreSource();
    },
    getSummaries() {
      return failUnavailableFirestoreSource();
    },
    getDetailsById() {
      return failUnavailableFirestoreSource();
    },
  };
}

const requestedMode = readSourceMode();
const hasAvailableSource = requestedMode !== 'firestore' || hasBackendFirebaseConfig;

export const backendStorefrontSource =
  requestedMode === 'firestore'
    ? hasBackendFirebaseConfig
      ? firestoreStorefrontSource
      : createUnavailableFirestoreSource()
    : mockStorefrontSource;

export const backendStorefrontSourceStatus = {
  requestedMode,
  activeMode: requestedMode,
  available: hasAvailableSource,
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

  if (!backendStorefrontSourceStatus.available) {
    throw createMissingFirestoreConfigError();
  }

  try {
    await warmFirestoreStorefrontSource();
  } catch {
    // Startup warming should not block backend availability once Firestore mode is configured.
  }
}
