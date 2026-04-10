import {
  BlockedCommunityAuthorApiDocument,
  StorefrontCommunitySafetyStateApiDocument,
} from '../types';
import { getOptionalFirestoreCollection } from '../firestoreCollections';

const COMMUNITY_SAFETY_STATE_COLLECTION = 'community_safety_state';
const MAX_BLOCKED_REVIEW_AUTHORS = 64;

const communitySafetyStateStore = new Map<string, StorefrontCommunitySafetyStateApiDocument>();

function getCommunitySafetyStateCollection() {
  return getOptionalFirestoreCollection<StorefrontCommunitySafetyStateApiDocument>(
    COMMUNITY_SAFETY_STATE_COLLECTION,
  );
}

function normalizeBlockedReviewAuthors(value: unknown): BlockedCommunityAuthorApiDocument[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const nextAuthors: BlockedCommunityAuthorApiDocument[] = [];
  const seen = new Set<string>();

  for (const entry of value) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }

    const storefrontId =
      typeof (entry as { storefrontId?: unknown }).storefrontId === 'string'
        ? (entry as { storefrontId: string }).storefrontId.trim()
        : '';
    const authorId =
      typeof (entry as { authorId?: unknown }).authorId === 'string'
        ? (entry as { authorId: string }).authorId.trim()
        : '';
    if (!storefrontId || !authorId) {
      continue;
    }

    const storefrontName =
      typeof (entry as { storefrontName?: unknown }).storefrontName === 'string'
        ? (entry as { storefrontName: string }).storefrontName.trim() || null
        : null;
    const dedupeKey = `${storefrontId}::${authorId}`;
    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    nextAuthors.push({
      storefrontId,
      storefrontName,
      authorId,
    });

    if (nextAuthors.length >= MAX_BLOCKED_REVIEW_AUTHORS) {
      break;
    }
  }

  return nextAuthors;
}

function createDefaultCommunitySafetyState(
  profileId: string,
): StorefrontCommunitySafetyStateApiDocument {
  return {
    profileId,
    acceptedGuidelinesVersion: null,
    blockedReviewAuthors: [],
    updatedAt: new Date().toISOString(),
  };
}

function normalizeCommunitySafetyState(
  profileId: string,
  state: Partial<StorefrontCommunitySafetyStateApiDocument> | null | undefined,
): StorefrontCommunitySafetyStateApiDocument {
  return {
    profileId,
    acceptedGuidelinesVersion:
      typeof state?.acceptedGuidelinesVersion === 'string'
        ? state.acceptedGuidelinesVersion.trim() || null
        : null,
    blockedReviewAuthors: normalizeBlockedReviewAuthors(state?.blockedReviewAuthors),
    updatedAt:
      typeof state?.updatedAt === 'string' && state.updatedAt.trim()
        ? state.updatedAt
        : new Date().toISOString(),
  };
}

export async function getCommunitySafetyState(profileId: string) {
  const collectionRef = getCommunitySafetyStateCollection();
  if (collectionRef) {
    const snapshot = await collectionRef.doc(profileId).get();
    if (!snapshot.exists) {
      return createDefaultCommunitySafetyState(profileId);
    }

    return normalizeCommunitySafetyState(
      profileId,
      snapshot.data() as Partial<StorefrontCommunitySafetyStateApiDocument>,
    );
  }

  if (communitySafetyStateStore.has(profileId)) {
    return normalizeCommunitySafetyState(profileId, communitySafetyStateStore.get(profileId));
  }

  return createDefaultCommunitySafetyState(profileId);
}

export async function saveCommunitySafetyState(
  profileId: string,
  state: Partial<StorefrontCommunitySafetyStateApiDocument> | undefined,
) {
  const normalizedState = normalizeCommunitySafetyState(profileId, state);
  const collectionRef = getCommunitySafetyStateCollection();
  if (collectionRef) {
    await collectionRef.doc(profileId).set(normalizedState);
    return normalizedState;
  }

  communitySafetyStateStore.set(profileId, normalizedState);
  return normalizedState;
}

export async function deleteCommunitySafetyState(profileId: string) {
  const collectionRef = getCommunitySafetyStateCollection();
  if (collectionRef) {
    await collectionRef.doc(profileId).delete();
    return true;
  }

  return communitySafetyStateStore.delete(profileId);
}

export function clearCommunitySafetyMemoryStateForTests() {
  communitySafetyStateStore.clear();
}
