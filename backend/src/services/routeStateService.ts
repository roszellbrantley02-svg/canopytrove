import { getOptionalFirestoreCollection } from '../firestoreCollections';
import { StorefrontRouteStateApiDocument } from '../types';

const ROUTE_STATE_COLLECTION = 'route_state';

const DEFAULT_ROUTE_STATE = (profileId: string): StorefrontRouteStateApiDocument => ({
  profileId,
  savedStorefrontIds: [],
  recentStorefrontIds: [],
  activeRouteSession: null,
  routeSessions: [],
  plannedRouteStorefrontIds: [],
});

const routeStateStore = new Map<string, StorefrontRouteStateApiDocument>();

function getRouteStateCollection() {
  return getOptionalFirestoreCollection<StorefrontRouteStateApiDocument>(ROUTE_STATE_COLLECTION);
}

function normalizeRouteState(routeState: StorefrontRouteStateApiDocument) {
  const normalizedState: StorefrontRouteStateApiDocument = {
    profileId: routeState.profileId,
    savedStorefrontIds: Array.isArray(routeState.savedStorefrontIds)
      ? routeState.savedStorefrontIds.slice(0, 64)
      : [],
    recentStorefrontIds: Array.isArray(routeState.recentStorefrontIds)
      ? routeState.recentStorefrontIds.slice(0, 24)
      : [],
    activeRouteSession: routeState.activeRouteSession ?? null,
    routeSessions: Array.isArray(routeState.routeSessions)
      ? routeState.routeSessions.slice(0, 12)
      : [],
    plannedRouteStorefrontIds: Array.isArray(routeState.plannedRouteStorefrontIds)
      ? routeState.plannedRouteStorefrontIds.slice(0, 12)
      : [],
  };

  return normalizedState;
}

export async function getRouteState(profileId: string) {
  const collectionRef = getRouteStateCollection();
  if (collectionRef) {
    const snapshot = await collectionRef.doc(profileId).get();
    if (!snapshot.exists) {
      return DEFAULT_ROUTE_STATE(profileId);
    }

    return normalizeRouteState(snapshot.data() as StorefrontRouteStateApiDocument);
  }

  return routeStateStore.get(profileId) ?? DEFAULT_ROUTE_STATE(profileId);
}

export async function saveRouteState(routeState: StorefrontRouteStateApiDocument) {
  const normalizedState = normalizeRouteState(routeState);

  const collectionRef = getRouteStateCollection();
  if (collectionRef) {
    await collectionRef.doc(routeState.profileId).set(normalizedState);
    return normalizedState;
  }

  routeStateStore.set(routeState.profileId, normalizedState);
  return normalizedState;
}

export async function isFollowingStorefront(
  profileId: string,
  storefrontId: string,
): Promise<boolean> {
  const routeState = await getRouteState(profileId);
  return routeState.savedStorefrontIds.includes(storefrontId);
}

/**
 * A user counts as a "frequent visitor" if the storefront appears in their
 * recent views OR they have at least one route session with it (meaning they
 * actually navigated there).  This uses the same route_state document that
 * `isFollowingStorefront` reads, so the extra Firestore cost is zero when
 * both checks run in the same request.
 */
export async function isFrequentVisitor(profileId: string, storefrontId: string): Promise<boolean> {
  const routeState = await getRouteState(profileId);

  if (routeState.recentStorefrontIds.includes(storefrontId)) {
    return true;
  }

  if (routeState.routeSessions.some((session) => session.storefrontId === storefrontId)) {
    return true;
  }

  return false;
}

export async function deleteRouteState(profileId: string) {
  const collectionRef = getRouteStateCollection();
  if (collectionRef) {
    await collectionRef.doc(profileId).delete();
    return true;
  }

  return routeStateStore.delete(profileId);
}
