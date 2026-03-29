import AsyncStorage from '@react-native-async-storage/async-storage';
import { brand } from '../config/brand';
import type { StorefrontSummary } from '../types/storefront';
import { getBestAvailableDeviceLocation } from './locationDeviceService';
import {
  getCachedStorefrontCommunityState,
  loadStorefrontCommunityState,
} from './storefrontCommunityLocalService';
import { markStorefrontAsRecent } from './recentStorefrontService';

const POST_VISIT_FOLLOW_UP_KEY = `${brand.storageNamespace}:post-visit-follow-up:v4`;
const POST_VISIT_ARRIVAL_RADIUS_METERS = 180;

export type PostVisitPromptKind = 'guest_first_visit' | 'return_visit';
export type PostVisitPromptSource = 'foreground_arrival' | 'app_resume_arrival';

export type PendingPostVisitPrompt = {
  id: string;
  profileId: string;
  reviewProfileKey: string;
  source: PostVisitPromptSource;
  promptKind: PostVisitPromptKind;
  storefront: StorefrontSummary;
  createdAt: string;
  journeyId: string;
};

export type ActivePostVisitJourney = {
  id: string;
  profileId: string;
  reviewProfileKey: string;
  isAuthenticated: boolean;
  routeMode: 'preview' | 'verified';
  storefront: StorefrontSummary;
  sourceScreen: string | null;
  startedAt: string;
  arrivalDetectedAt: string | null;
  arrivalRadiusMeters: number;
};

export type PostVisitFollowUpState = {
  pendingPrompt: PendingPostVisitPrompt | null;
  activeJourney: ActivePostVisitJourney | null;
  reviewedStorefrontIdsByProfileKey: Record<string, string[]>;
};

type PassiveLocationGetter = () => Promise<
  | {
      coordinates: {
        latitude: number;
        longitude: number;
      } | null;
    }
  | null
>;

const EMPTY_POST_VISIT_STATE: PostVisitFollowUpState = {
  pendingPrompt: null,
  activeJourney: null,
  reviewedStorefrontIdsByProfileKey: {},
};

let memoryState: PostVisitFollowUpState = EMPTY_POST_VISIT_STATE;
let initializationPromise: Promise<PostVisitFollowUpState> | null = null;
let lastBackgroundedAt: number | null = null;

const subscribers = new Set<(state: PostVisitFollowUpState) => void>();

function cloneStorefrontSummary(storefront: StorefrontSummary): StorefrontSummary {
  return {
    ...storefront,
    coordinates: {
      ...storefront.coordinates,
    },
  };
}

function clonePendingPrompt(prompt: PendingPostVisitPrompt | null): PendingPostVisitPrompt | null {
  if (!prompt) {
    return null;
  }

  return {
    ...prompt,
    storefront: cloneStorefrontSummary(prompt.storefront),
  };
}

function cloneJourney(journey: ActivePostVisitJourney | null): ActivePostVisitJourney | null {
  if (!journey) {
    return null;
  }

  return {
    ...journey,
    storefront: cloneStorefrontSummary(journey.storefront),
  };
}

function cloneState(state: PostVisitFollowUpState): PostVisitFollowUpState {
  return {
    pendingPrompt: clonePendingPrompt(state.pendingPrompt),
    activeJourney: cloneJourney(state.activeJourney),
    reviewedStorefrontIdsByProfileKey: Object.fromEntries(
      Object.entries(state.reviewedStorefrontIdsByProfileKey).map(([profileKey, storefrontIds]) => [
        profileKey,
        [...storefrontIds],
      ])
    ),
  };
}

function notifySubscribers() {
  const snapshot = cloneState(memoryState);
  subscribers.forEach((listener) => {
    listener(snapshot);
  });
}

async function persistState() {
  try {
    await AsyncStorage.setItem(POST_VISIT_FOLLOW_UP_KEY, JSON.stringify(memoryState));
  } catch {
    // Prompt persistence should never block the UI.
  }
}

function setState(nextState: PostVisitFollowUpState) {
  memoryState = cloneState(nextState);
  notifySubscribers();
  void persistState();
  return cloneState(memoryState);
}

function createReviewProfileKey(
  profileId: string,
  isAuthenticated: boolean,
  accountId?: string | null
) {
  if (isAuthenticated && accountId?.trim()) {
    return `account:${accountId.trim()}`;
  }

  return `profile:${profileId}`;
}

function getPromptKind(isAuthenticated: boolean): PostVisitPromptKind {
  return isAuthenticated ? 'return_visit' : 'guest_first_visit';
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function getDistanceMeters(
  left: { latitude: number; longitude: number },
  right: { latitude: number; longitude: number }
) {
  const earthRadiusMeters = 6_371_000;
  const latitudeDelta = toRadians(right.latitude - left.latitude);
  const longitudeDelta = toRadians(right.longitude - left.longitude);
  const a =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
    Math.cos(toRadians(left.latitude)) *
      Math.cos(toRadians(right.latitude)) *
      Math.sin(longitudeDelta / 2) *
      Math.sin(longitudeDelta / 2);

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isWithinArrivalRadius(
  coordinates: { latitude: number; longitude: number },
  storefront: StorefrontSummary,
  radiusMeters: number
) {
  return getDistanceMeters(coordinates, storefront.coordinates) <= radiusMeters;
}

function rememberReviewedStorefront(reviewProfileKey: string, storefrontId: string) {
  const previousIds = memoryState.reviewedStorefrontIdsByProfileKey[reviewProfileKey] ?? [];
  const nextIds = [storefrontId, ...previousIds.filter((value) => value !== storefrontId)].slice(
    0,
    256
  );

  memoryState = {
    ...memoryState,
    reviewedStorefrontIdsByProfileKey: {
      ...memoryState.reviewedStorefrontIdsByProfileKey,
      [reviewProfileKey]: nextIds,
    },
  };
}

function getLocalReviewedStorefrontIdsForProfile(
  profileId: string,
  communityState: Awaited<ReturnType<typeof loadStorefrontCommunityState>>
) {
  return new Set(
    Object.entries(communityState.appReviewsByStorefrontId)
      .filter(([, reviews]) => reviews.some((review) => review.profileId === profileId))
      .map(([storefrontId]) => storefrontId)
  );
}

async function isJourneyEligibleForPrompt(journey: ActivePostVisitJourney) {
  if (!journey.isAuthenticated) {
    return true;
  }

  const rememberedReviewedStorefrontIds = new Set(
    memoryState.reviewedStorefrontIdsByProfileKey[journey.reviewProfileKey] ?? []
  );
  if (rememberedReviewedStorefrontIds.has(journey.storefront.id)) {
    return false;
  }

  const communityState =
    getCachedStorefrontCommunityState() ?? (await loadStorefrontCommunityState());
  const localReviewedStorefrontIds = getLocalReviewedStorefrontIdsForProfile(
    journey.profileId,
    communityState
  );

  return !localReviewedStorefrontIds.has(journey.storefront.id);
}

function buildPendingPrompt(
  journey: ActivePostVisitJourney,
  source: PostVisitPromptSource
): PendingPostVisitPrompt {
  return {
    id: `post-visit-${journey.storefront.id}-${Date.now().toString(36)}`,
    profileId: journey.profileId,
    reviewProfileKey: journey.reviewProfileKey,
    source,
    promptKind: getPromptKind(journey.isAuthenticated),
    storefront: cloneStorefrontSummary(journey.storefront),
    createdAt: new Date().toISOString(),
    journeyId: journey.id,
  };
}

function applyJourneyLocation(
  journey: ActivePostVisitJourney,
  coordinates: { latitude: number; longitude: number }
) {
  if (
    journey.arrivalDetectedAt ||
    !isWithinArrivalRadius(coordinates, journey.storefront, journey.arrivalRadiusMeters)
  ) {
    return journey;
  }

  return {
    ...journey,
    arrivalDetectedAt: new Date().toISOString(),
  };
}

export async function initializePostVisitPrompts() {
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      const rawValue = await AsyncStorage.getItem(POST_VISIT_FOLLOW_UP_KEY);
      if (!rawValue) {
        memoryState = cloneState(EMPTY_POST_VISIT_STATE);
        notifySubscribers();
        return cloneState(memoryState);
      }

      const parsed = JSON.parse(rawValue) as Partial<PostVisitFollowUpState>;
      memoryState = cloneState({
        pendingPrompt:
          parsed.pendingPrompt && parsed.pendingPrompt.storefront
            ? {
                ...parsed.pendingPrompt,
                reviewProfileKey:
                  parsed.pendingPrompt.reviewProfileKey ??
                  createReviewProfileKey(
                    parsed.pendingPrompt.profileId,
                    parsed.pendingPrompt.promptKind === 'return_visit'
                  ),
                storefront: cloneStorefrontSummary(parsed.pendingPrompt.storefront),
              }
            : null,
        activeJourney:
          parsed.activeJourney && parsed.activeJourney.storefront
            ? {
                ...parsed.activeJourney,
                sourceScreen: parsed.activeJourney.sourceScreen ?? null,
                arrivalDetectedAt: parsed.activeJourney.arrivalDetectedAt ?? null,
                arrivalRadiusMeters:
                  parsed.activeJourney.arrivalRadiusMeters ?? POST_VISIT_ARRIVAL_RADIUS_METERS,
                reviewProfileKey:
                  parsed.activeJourney.reviewProfileKey ??
                  createReviewProfileKey(
                    parsed.activeJourney.profileId,
                    parsed.activeJourney.isAuthenticated
                  ),
                storefront: cloneStorefrontSummary(parsed.activeJourney.storefront),
              }
            : null,
        reviewedStorefrontIdsByProfileKey: parsed.reviewedStorefrontIdsByProfileKey ?? {},
      });
    } catch {
      memoryState = cloneState(EMPTY_POST_VISIT_STATE);
    }

    notifySubscribers();
    return cloneState(memoryState);
  })();

  return initializationPromise;
}

export function getPostVisitFollowUpState() {
  return cloneState(memoryState);
}

export function subscribeToPostVisitFollowUpState(
  listener: (state: PostVisitFollowUpState) => void
) {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
}

export async function syncPostVisitPromptForProfile(
  profileId: string,
  isAuthenticated: boolean,
  accountId?: string | null
) {
  await initializePostVisitPrompts();

  if (!profileId) {
    return cloneState(memoryState);
  }

  const reviewProfileKey = createReviewProfileKey(profileId, isAuthenticated, accountId);
  let nextState = cloneState(memoryState);
  let didChange = false;

  if (nextState.activeJourney && nextState.activeJourney.profileId === profileId) {
    if (
      nextState.activeJourney.reviewProfileKey !== reviewProfileKey ||
      nextState.activeJourney.isAuthenticated !== isAuthenticated
    ) {
      nextState.activeJourney = {
        ...nextState.activeJourney,
        reviewProfileKey,
        isAuthenticated,
      };
      didChange = true;
    }
  }

  if (nextState.pendingPrompt && nextState.pendingPrompt.profileId === profileId) {
    const nextPromptKind = getPromptKind(isAuthenticated);
    if (
      nextState.pendingPrompt.reviewProfileKey !== reviewProfileKey ||
      nextState.pendingPrompt.promptKind !== nextPromptKind
    ) {
      nextState.pendingPrompt = {
        ...nextState.pendingPrompt,
        reviewProfileKey,
        promptKind: nextPromptKind,
      };
      didChange = true;
    }
  }

  return didChange ? setState(nextState) : cloneState(memoryState);
}

export async function dismissPostVisitPrompt() {
  await initializePostVisitPrompts();

  if (!memoryState.pendingPrompt) {
    return cloneState(memoryState);
  }

  return setState({
    ...memoryState,
    pendingPrompt: null,
  });
}

export async function markStorefrontReviewed(
  profileId: string,
  storefrontId: string,
  accountId?: string | null
) {
  await initializePostVisitPrompts();

  if (accountId?.trim()) {
    rememberReviewedStorefront(createReviewProfileKey(profileId, true, accountId), storefrontId);
  }

  const shouldClearPrompt =
    memoryState.pendingPrompt?.profileId === profileId &&
    memoryState.pendingPrompt.storefront.id === storefrontId;

  return setState({
    ...memoryState,
    pendingPrompt: shouldClearPrompt ? null : memoryState.pendingPrompt,
  });
}

export async function clearPostVisitJourney() {
  await initializePostVisitPrompts();

  return setState({
    ...memoryState,
    activeJourney: null,
    pendingPrompt: null,
  });
}

export async function startPostVisitJourney(options: {
  profileId: string;
  accountId?: string | null;
  isAuthenticated: boolean;
  routeMode: 'preview' | 'verified';
  sourceScreen?: string | null;
  storefront: StorefrontSummary;
}) {
  await initializePostVisitPrompts();
  await markStorefrontAsRecent(options.storefront.id);

  const nextJourneyBase: ActivePostVisitJourney = {
    id: `journey-${options.storefront.id}-${Date.now().toString(36)}`,
    profileId: options.profileId,
    reviewProfileKey: createReviewProfileKey(
      options.profileId,
      options.isAuthenticated,
      options.accountId
    ),
    isAuthenticated: options.isAuthenticated,
    routeMode: options.routeMode,
    storefront: cloneStorefrontSummary(options.storefront),
    sourceScreen: options.sourceScreen?.trim() || null,
    startedAt: new Date().toISOString(),
    arrivalDetectedAt: null,
    arrivalRadiusMeters: POST_VISIT_ARRIVAL_RADIUS_METERS,
  };

  let nextJourney = nextJourneyBase;
  try {
    const locationResult = await getBestAvailableDeviceLocation();
    if (locationResult.coordinates) {
      nextJourney = applyJourneyLocation(nextJourneyBase, locationResult.coordinates);
    }
  } catch {
    nextJourney = nextJourneyBase;
  }

  let nextState: PostVisitFollowUpState = {
    ...memoryState,
    activeJourney: nextJourney,
    pendingPrompt: null,
  };

  if (nextJourney.arrivalDetectedAt && (await isJourneyEligibleForPrompt(nextJourney))) {
    nextState = {
      ...nextState,
      activeJourney: null,
      pendingPrompt: buildPendingPrompt(nextJourney, 'foreground_arrival'),
    };
  }

  return setState(nextState);
}

export async function markPostVisitJourneyBackgrounded() {
  lastBackgroundedAt = Date.now();
  return cloneState(memoryState);
}

export async function evaluatePostVisitJourney(getPassiveDeviceLocation?: PassiveLocationGetter) {
  await initializePostVisitPrompts();

  if (lastBackgroundedAt && Date.now() - lastBackgroundedAt < 1_000) {
    return cloneState(memoryState);
  }

  const activeJourney = memoryState.activeJourney;
  if (!activeJourney) {
    return cloneState(memoryState);
  }

  const locationResult =
    (await getPassiveDeviceLocation?.()) ?? (await getBestAvailableDeviceLocation());
  const coordinates = locationResult?.coordinates ?? null;
  if (!coordinates) {
    return cloneState(memoryState);
  }

  const nextJourney = applyJourneyLocation(activeJourney, coordinates);
  const didJourneyChange = nextJourney.arrivalDetectedAt !== activeJourney.arrivalDetectedAt;

  if (nextJourney.arrivalDetectedAt) {
    if (await isJourneyEligibleForPrompt(nextJourney)) {
      return setState({
        ...memoryState,
        activeJourney: null,
        pendingPrompt:
          memoryState.pendingPrompt?.journeyId === nextJourney.id
            ? memoryState.pendingPrompt
            : buildPendingPrompt(nextJourney, 'app_resume_arrival'),
      });
    }

    return setState({
      ...memoryState,
      activeJourney: null,
    });
  }

  if (didJourneyChange) {
    return setState({
      ...memoryState,
      activeJourney: nextJourney,
    });
  }

  return cloneState(memoryState);
}

export async function recordPostVisitGeofenceEntry() {
  return cloneState(memoryState);
}

export async function finalizePostVisitJourneyFromGeofenceExit() {
  return cloneState(memoryState);
}
