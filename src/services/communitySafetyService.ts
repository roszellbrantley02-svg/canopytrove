import AsyncStorage from '@react-native-async-storage/async-storage';
import { brand } from '../config/brand';

export const COMMUNITY_GUIDELINES_VERSION = '2026-03-28';

type CommunitySafetyState = {
  acceptedGuidelinesVersion: string | null;
  blockedAuthorProfileIds: string[];
};

const COMMUNITY_SAFETY_KEY = `${brand.storageNamespace}:community-safety`;
const EMPTY_COMMUNITY_SAFETY_STATE: CommunitySafetyState = {
  acceptedGuidelinesVersion: null,
  blockedAuthorProfileIds: [],
};

let memoryState: CommunitySafetyState = EMPTY_COMMUNITY_SAFETY_STATE;
let initializationPromise: Promise<CommunitySafetyState> | null = null;

function cloneState(state: CommunitySafetyState): CommunitySafetyState {
  return {
    acceptedGuidelinesVersion: state.acceptedGuidelinesVersion,
    blockedAuthorProfileIds: [...state.blockedAuthorProfileIds],
  };
}

async function persistState() {
  try {
    await AsyncStorage.setItem(COMMUNITY_SAFETY_KEY, JSON.stringify(memoryState));
  } catch {
    // Community safety persistence should never block the app.
  }
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

      const parsed = JSON.parse(rawValue) as Partial<CommunitySafetyState>;
      memoryState = cloneState({
        acceptedGuidelinesVersion:
          typeof parsed.acceptedGuidelinesVersion === 'string'
            ? parsed.acceptedGuidelinesVersion
            : null,
        blockedAuthorProfileIds: Array.isArray(parsed.blockedAuthorProfileIds)
          ? Array.from(
              new Set(
                parsed.blockedAuthorProfileIds.filter(
                  (value): value is string => typeof value === 'string' && value.trim().length > 0
                )
              )
            ).slice(0, 64)
          : [],
      });
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

export async function acceptCommunityGuidelines() {
  await initializeCommunitySafetyState();
  memoryState = cloneState({
    ...memoryState,
    acceptedGuidelinesVersion: COMMUNITY_GUIDELINES_VERSION,
  });
  await persistState();
  return cloneState(memoryState);
}

export async function blockCommunityAuthor(profileId: string) {
  const normalizedProfileId = profileId.trim();
  if (!normalizedProfileId) {
    return cloneState(memoryState);
  }

  await initializeCommunitySafetyState();
  memoryState = cloneState({
    ...memoryState,
    blockedAuthorProfileIds: Array.from(
      new Set([...memoryState.blockedAuthorProfileIds, normalizedProfileId])
    ).slice(0, 64),
  });
  await persistState();
  return cloneState(memoryState);
}

export async function unblockCommunityAuthor(profileId: string) {
  await initializeCommunitySafetyState();
  memoryState = cloneState({
    ...memoryState,
    blockedAuthorProfileIds: memoryState.blockedAuthorProfileIds.filter(
      (currentProfileId) => currentProfileId !== profileId
    ),
  });
  await persistState();
  return cloneState(memoryState);
}

export async function clearBlockedCommunityAuthors() {
  await initializeCommunitySafetyState();
  memoryState = cloneState({
    ...memoryState,
    blockedAuthorProfileIds: [],
  });
  await persistState();
  return cloneState(memoryState);
}

export function hasAcceptedCommunityGuidelines() {
  return memoryState.acceptedGuidelinesVersion === COMMUNITY_GUIDELINES_VERSION;
}
