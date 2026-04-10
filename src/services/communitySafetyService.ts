import AsyncStorage from '@react-native-async-storage/async-storage';
import { brand } from '../config/brand';
import type { BlockedReviewAuthor, CommunitySafetyState } from '../types/storefront';

export const COMMUNITY_GUIDELINES_VERSION = '2026-03-28';

const COMMUNITY_SAFETY_KEY = `${brand.storageNamespace}:community-safety`;
const MAX_BLOCKED_REVIEW_AUTHORS = 64;
const EMPTY_COMMUNITY_SAFETY_STATE: CommunitySafetyState = {
  acceptedGuidelinesVersion: null,
  blockedReviewAuthors: [],
};

let memoryState: CommunitySafetyState = EMPTY_COMMUNITY_SAFETY_STATE;
let initializationPromise: Promise<CommunitySafetyState> | null = null;
let lastMutationAt = 0;
const listeners = new Set<(state: CommunitySafetyState) => void>();

function cloneBlockedReviewAuthor(author: BlockedReviewAuthor): BlockedReviewAuthor {
  return {
    storefrontId: author.storefrontId,
    storefrontName: author.storefrontName ?? null,
    authorId: author.authorId,
  };
}

function cloneState(state: CommunitySafetyState): CommunitySafetyState {
  return {
    acceptedGuidelinesVersion: state.acceptedGuidelinesVersion,
    blockedReviewAuthors: state.blockedReviewAuthors.map(cloneBlockedReviewAuthor),
  };
}

function notifyListeners() {
  const snapshot = cloneState(memoryState);
  listeners.forEach((listener) => {
    listener(snapshot);
  });
}

function normalizeBlockedReviewAuthors(value: unknown): BlockedReviewAuthor[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const nextAuthors: BlockedReviewAuthor[] = [];
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

function normalizeState(
  state: Partial<CommunitySafetyState> | null | undefined,
): CommunitySafetyState {
  return {
    acceptedGuidelinesVersion:
      typeof state?.acceptedGuidelinesVersion === 'string' ? state.acceptedGuidelinesVersion : null,
    blockedReviewAuthors: normalizeBlockedReviewAuthors(state?.blockedReviewAuthors),
  };
}

async function persistState() {
  try {
    await AsyncStorage.setItem(COMMUNITY_SAFETY_KEY, JSON.stringify(memoryState));
  } catch {
    // Community safety persistence should never block the app.
  }
}

async function setState(
  nextState: CommunitySafetyState,
  options?: { persist?: boolean; trackMutation?: boolean },
) {
  memoryState = cloneState(nextState);
  if (options?.trackMutation !== false) {
    lastMutationAt = Date.now();
  }
  if (options?.persist !== false) {
    await persistState();
  }
  notifyListeners();
  return cloneState(memoryState);
}

export async function initializeCommunitySafetyState() {
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      const rawValue = await AsyncStorage.getItem(COMMUNITY_SAFETY_KEY);
      if (!rawValue) {
        memoryState = cloneState(EMPTY_COMMUNITY_SAFETY_STATE);
        return cloneState(memoryState);
      }

      const parsed = JSON.parse(rawValue) as Partial<
        CommunitySafetyState & { blockedAuthorProfileIds?: unknown }
      >;
      const hadLegacyBlockedAuthorIds =
        Array.isArray(parsed.blockedAuthorProfileIds) && parsed.blockedAuthorProfileIds.length > 0;

      memoryState = normalizeState(parsed);
      if (hadLegacyBlockedAuthorIds) {
        await persistState();
      }
      return cloneState(memoryState);
    } catch {
      memoryState = cloneState(EMPTY_COMMUNITY_SAFETY_STATE);
      return cloneState(memoryState);
    }
  })();

  return initializationPromise;
}

export function getCommunitySafetyState() {
  return cloneState(memoryState);
}

export function subscribeToCommunitySafetyState(listener: (state: CommunitySafetyState) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getLastCommunitySafetyMutationAt() {
  return lastMutationAt;
}

export async function replaceCommunitySafetyState(
  nextState: Partial<CommunitySafetyState> | null | undefined,
  options?: { persist?: boolean; trackMutation?: boolean },
) {
  await initializeCommunitySafetyState();
  return setState(normalizeState(nextState), options);
}

export async function acceptCommunityGuidelines() {
  await initializeCommunitySafetyState();
  return setState({
    ...memoryState,
    acceptedGuidelinesVersion: COMMUNITY_GUIDELINES_VERSION,
  });
}

export async function blockCommunityAuthor(input: {
  storefrontId: string;
  storefrontName?: string | null;
  authorId: string;
}) {
  const storefrontId = input.storefrontId.trim();
  const authorId = input.authorId.trim();
  if (!storefrontId || !authorId) {
    return cloneState(memoryState);
  }

  await initializeCommunitySafetyState();
  const storefrontName =
    typeof input.storefrontName === 'string' ? input.storefrontName.trim() || null : null;
  const nextBlockedAuthors = [
    {
      storefrontId,
      storefrontName,
      authorId,
    },
    ...memoryState.blockedReviewAuthors.filter(
      (currentAuthor) =>
        currentAuthor.storefrontId !== storefrontId || currentAuthor.authorId !== authorId,
    ),
  ].slice(0, MAX_BLOCKED_REVIEW_AUTHORS);

  return setState({
    ...memoryState,
    blockedReviewAuthors: nextBlockedAuthors,
  });
}

export async function unblockCommunityAuthor(input: { storefrontId: string; authorId: string }) {
  await initializeCommunitySafetyState();
  return setState({
    ...memoryState,
    blockedReviewAuthors: memoryState.blockedReviewAuthors.filter(
      (currentAuthor) =>
        currentAuthor.storefrontId !== input.storefrontId ||
        currentAuthor.authorId !== input.authorId,
    ),
  });
}

export async function clearBlockedCommunityAuthors() {
  await initializeCommunitySafetyState();
  return setState({
    ...memoryState,
    blockedReviewAuthors: [],
  });
}

export async function clearBlockedCommunityAuthorsForStorefront(storefrontId: string) {
  const normalizedStorefrontId = storefrontId.trim();
  await initializeCommunitySafetyState();
  if (!normalizedStorefrontId) {
    return cloneState(memoryState);
  }

  return setState({
    ...memoryState,
    blockedReviewAuthors: memoryState.blockedReviewAuthors.filter(
      (currentAuthor) => currentAuthor.storefrontId !== normalizedStorefrontId,
    ),
  });
}

export function hasAcceptedCommunityGuidelines() {
  return memoryState.acceptedGuidelinesVersion === COMMUNITY_GUIDELINES_VERSION;
}

export function isCommunityAuthorBlocked(
  storefrontId: string,
  authorId: string | null | undefined,
  state: CommunitySafetyState = memoryState,
) {
  const normalizedStorefrontId = storefrontId.trim();
  const normalizedAuthorId = typeof authorId === 'string' ? authorId.trim() : '';
  if (!normalizedStorefrontId || !normalizedAuthorId) {
    return false;
  }

  return state.blockedReviewAuthors.some(
    (blockedAuthor) =>
      blockedAuthor.storefrontId === normalizedStorefrontId &&
      blockedAuthor.authorId === normalizedAuthorId,
  );
}
