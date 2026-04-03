import { CollectionReference } from 'firebase-admin/firestore';
import { getOptionalFirestoreCollection } from '../firestoreCollections';
import {
  StorefrontDiscoveryCandidateDocument,
  StorefrontDiscoveryRunDocument,
  StorefrontDiscoveryStateDocument,
} from './storefrontDiscoveryModels';

const DISCOVERY_CANDIDATES_COLLECTION = 'storefront_discovery_candidates';
const DISCOVERY_RUNS_COLLECTION = 'storefront_discovery_runs';
const DISCOVERY_STATE_COLLECTION = 'storefront_discovery_state';
const DISCOVERY_STATE_DOC_ID = 'current';

const discoveryCandidateStore = new Map<string, StorefrontDiscoveryCandidateDocument>();
const discoveryRunStore = new Map<string, StorefrontDiscoveryRunDocument>();
let discoveryStateStore: StorefrontDiscoveryStateDocument = {
  lastRunId: null,
  lastRunAt: null,
  lastSuccessfulRunAt: null,
  nextRunAt: null,
  lastRunReason: null,
  lastRunStatus: null,
  lastError: null,
  totalSourceCount: 0,
  candidateCount: 0,
  hiddenCount: 0,
  readyForPublishCount: 0,
  publishedCount: 0,
  suppressedCount: 0,
  lastRunLimit: null,
  lastRunMarketId: null,
};

export function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => stripUndefinedDeep(item)) as T;
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const sanitizedEntries = Object.entries(value)
    .filter(([, entryValue]) => entryValue !== undefined)
    .map(([entryKey, entryValue]) => [entryKey, stripUndefinedDeep(entryValue)]);

  return Object.fromEntries(sanitizedEntries) as T;
}

function getDiscoveryCandidatesCollection():
  | CollectionReference<StorefrontDiscoveryCandidateDocument>
  | null {
  return getOptionalFirestoreCollection<StorefrontDiscoveryCandidateDocument>(
    DISCOVERY_CANDIDATES_COLLECTION
  );
}

function getDiscoveryRunsCollection():
  | CollectionReference<StorefrontDiscoveryRunDocument>
  | null {
  return getOptionalFirestoreCollection<StorefrontDiscoveryRunDocument>(DISCOVERY_RUNS_COLLECTION);
}

function getDiscoveryStateCollection(): CollectionReference<StorefrontDiscoveryStateDocument> | null {
  return getOptionalFirestoreCollection<StorefrontDiscoveryStateDocument>(
    DISCOVERY_STATE_COLLECTION
  );
}

function cloneState(state: StorefrontDiscoveryStateDocument): StorefrontDiscoveryStateDocument {
  return {
    ...state,
  };
}

export function clearStorefrontDiscoveryRepositoryState() {
  discoveryCandidateStore.clear();
  discoveryRunStore.clear();
  discoveryStateStore = cloneState({
    lastRunId: null,
    lastRunAt: null,
    lastSuccessfulRunAt: null,
    nextRunAt: null,
    lastRunReason: null,
    lastRunStatus: null,
    lastError: null,
    totalSourceCount: 0,
    candidateCount: 0,
    hiddenCount: 0,
    readyForPublishCount: 0,
    publishedCount: 0,
    suppressedCount: 0,
    lastRunLimit: null,
    lastRunMarketId: null,
  });
}

export async function getStorefrontDiscoveryCandidate(
  candidateId: string
): Promise<StorefrontDiscoveryCandidateDocument | null> {
  const collectionRef = getDiscoveryCandidatesCollection();
  if (collectionRef) {
    const snapshot = await collectionRef.doc(candidateId).get();
    if (!snapshot.exists) {
      return null;
    }

    return snapshot.data() as StorefrontDiscoveryCandidateDocument;
  }

  return discoveryCandidateStore.get(candidateId) ?? null;
}

export async function listStorefrontDiscoveryCandidates(limit = 100) {
  const normalizedLimit = Math.max(0, Math.floor(limit));
  const collectionRef = getDiscoveryCandidatesCollection();
  if (collectionRef) {
    const snapshot = await collectionRef
      .orderBy('updatedAt', 'desc')
      .limit(normalizedLimit || 100)
      .get();

    return snapshot.docs.map((documentSnapshot) => documentSnapshot.data() as StorefrontDiscoveryCandidateDocument);
  }

  return Array.from(discoveryCandidateStore.values())
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, normalizedLimit || 100);
}

export async function saveStorefrontDiscoveryCandidate(
  candidate: StorefrontDiscoveryCandidateDocument
) {
  discoveryCandidateStore.set(candidate.id, candidate);
  const collectionRef = getDiscoveryCandidatesCollection();
  if (!collectionRef) {
    return candidate;
  }

  await collectionRef.doc(candidate.id).set(stripUndefinedDeep(candidate));
  return candidate;
}

export async function listStorefrontDiscoveryRuns(limit = 20) {
  const normalizedLimit = Math.max(0, Math.floor(limit));
  const collectionRef = getDiscoveryRunsCollection();
  if (collectionRef) {
    const snapshot = await collectionRef
      .orderBy('startedAt', 'desc')
      .limit(normalizedLimit || 20)
      .get();

    return snapshot.docs.map((documentSnapshot) => documentSnapshot.data() as StorefrontDiscoveryRunDocument);
  }

  return Array.from(discoveryRunStore.values())
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
    .slice(0, normalizedLimit || 20);
}

export async function getLatestStorefrontDiscoveryRun() {
  const runs = await listStorefrontDiscoveryRuns(1);
  return runs[0] ?? null;
}

export async function saveStorefrontDiscoveryRun(run: StorefrontDiscoveryRunDocument) {
  discoveryRunStore.set(run.id, run);
  const collectionRef = getDiscoveryRunsCollection();
  if (!collectionRef) {
    return run;
  }

  await collectionRef.doc(run.id).set(stripUndefinedDeep(run));
  return run;
}

export async function loadStorefrontDiscoveryState() {
  const collectionRef = getDiscoveryStateCollection();
  if (collectionRef) {
    const snapshot = await collectionRef.doc(DISCOVERY_STATE_DOC_ID).get();
    if (!snapshot.exists) {
      return cloneState(discoveryStateStore);
    }

    discoveryStateStore = {
      ...discoveryStateStore,
      ...(snapshot.data() as StorefrontDiscoveryStateDocument),
    };
    return cloneState(discoveryStateStore);
  }

  return cloneState(discoveryStateStore);
}

export async function saveStorefrontDiscoveryState(state: StorefrontDiscoveryStateDocument) {
  discoveryStateStore = cloneState(state);
  const collectionRef = getDiscoveryStateCollection();
  if (!collectionRef) {
    return state;
  }

  await collectionRef.doc(DISCOVERY_STATE_DOC_ID).set(stripUndefinedDeep(state));
  return state;
}
