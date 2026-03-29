import React from 'react';
import { getShouldSyncRemoteProfileState, UseStorefrontRemoteProfileSyncArgs } from './storefrontRemoteProfileSyncShared';
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
  setAppProfile,
  setProfileId,
  setRecentStorefrontIds,
  setSavedStorefrontIds,
  setGamificationState,
}: UseStorefrontRemoteProfileSyncArgs) {
  const [hasHydratedRemoteProfileState, setHasHydratedRemoteProfileState] = React.useState(false);
  const lastSavedRemoteStatePayloadRef = React.useRef<string | null>(null);
  const lastRemoteHydrationAtRef = React.useRef(0);
  const remoteHydrationInFlightRef = React.useRef<Promise<void> | null>(null);
  const lastShouldSyncRemoteProfileStateRef = React.useRef(false);
  const shouldSyncRemoteProfileState = getShouldSyncRemoteProfileState(authSession);

  React.useEffect(() => {
    if (lastShouldSyncRemoteProfileStateRef.current === shouldSyncRemoteProfileState) {
      return;
    }

    lastShouldSyncRemoteProfileStateRef.current = shouldSyncRemoteProfileState;
    lastRemoteHydrationAtRef.current = 0;
    remoteHydrationInFlightRef.current = null;
    lastSavedRemoteStatePayloadRef.current = null;
    setHasHydratedRemoteProfileState(!shouldSyncRemoteProfileState);
  }, [shouldSyncRemoteProfileState]);

  useStorefrontRemoteProfileHydration({
    appProfile,
    gamificationStateRef,
    hasHydratedPreferences,
    profileId,
    setAppProfile,
    setGamificationState,
    setHasHydratedRemoteProfileState,
    setProfileId,
    setRecentStorefrontIds,
    setSavedStorefrontIds,
    shouldSyncRemoteProfileState,
    lastSavedRemoteStatePayloadRef,
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
