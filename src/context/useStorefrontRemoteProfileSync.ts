import React from 'react';
import type { UseStorefrontRemoteProfileSyncArgs } from './storefrontRemoteProfileSyncShared';
import { getShouldSyncRemoteProfileState } from './storefrontRemoteProfileSyncShared';
import { useStorefrontRemoteProfileHydration } from './useStorefrontRemoteProfileHydration';
import { useStorefrontRemoteProfilePersistence } from './useStorefrontRemoteProfilePersistence';

export function useStorefrontRemoteProfileSync({
  appProfile,
  authSession,
  hasHydratedPreferences,
  profileId,
  recentStorefrontIds,
  savedStorefrontIds,
  gamificationState,
  gamificationStateRef,
  lastLocalRouteMutationAtRef,
  lastLocalGamificationMutationAtRef,
  setAppProfile,
  setProfileId,
  setRecentStorefrontIds,
  setSavedStorefrontIds,
  setGamificationState,
}: UseStorefrontRemoteProfileSyncArgs) {
  const [hasHydratedRemoteProfileState, setHasHydratedRemoteProfileState] = React.useState(false);
  const lastSavedRemoteStatePayloadRef = React.useRef<string | null>(null);
  const lastRemoteHydrationAtRef = React.useRef(0);
  const currentRemoteHydrationStartedAtRef = React.useRef(0);
  const remoteHydrationInFlightRef = React.useRef<Promise<void> | null>(null);
  const lastShouldSyncRemoteProfileStateRef = React.useRef(false);
  const latestAppProfileRef = React.useRef(appProfile);
  const latestRecentStorefrontIdsRef = React.useRef(recentStorefrontIds);
  const latestSavedStorefrontIdsRef = React.useRef(savedStorefrontIds);
  const shouldSyncRemoteProfileState = getShouldSyncRemoteProfileState(authSession);

  latestAppProfileRef.current = appProfile;
  latestRecentStorefrontIdsRef.current = recentStorefrontIds;
  latestSavedStorefrontIdsRef.current = savedStorefrontIds;

  React.useEffect(() => {
    if (lastShouldSyncRemoteProfileStateRef.current === shouldSyncRemoteProfileState) {
      return;
    }

    lastShouldSyncRemoteProfileStateRef.current = shouldSyncRemoteProfileState;
    lastRemoteHydrationAtRef.current = 0;
    currentRemoteHydrationStartedAtRef.current = 0;
    remoteHydrationInFlightRef.current = null;
    lastSavedRemoteStatePayloadRef.current = null;
    setHasHydratedRemoteProfileState(!shouldSyncRemoteProfileState);
  }, [shouldSyncRemoteProfileState]);

  useStorefrontRemoteProfileHydration({
    appProfile,
    gamificationStateRef,
    hasHydratedPreferences,
    latestAppProfileRef,
    latestRecentStorefrontIdsRef,
    latestSavedStorefrontIdsRef,
    profileId,
    setAppProfile,
    setGamificationState,
    setHasHydratedRemoteProfileState,
    setProfileId,
    setRecentStorefrontIds,
    setSavedStorefrontIds,
    shouldSyncRemoteProfileState,
    currentRemoteHydrationStartedAtRef,
    lastSavedRemoteStatePayloadRef,
    lastLocalGamificationMutationAtRef,
    lastLocalRouteMutationAtRef,
    lastRemoteHydrationAtRef,
    remoteHydrationInFlightRef,
  });

  useStorefrontRemoteProfilePersistence({
    appProfile,
    gamificationState,
    hasHydratedPreferences,
    hasHydratedRemoteProfileState,
    profileId,
    recentStorefrontIds,
    savedStorefrontIds,
    shouldSyncRemoteProfileState,
    lastSavedRemoteStatePayloadRef,
  });

  return {
    hasHydratedRemoteProfileState,
    shouldSyncRemoteProfileState,
  };
}
