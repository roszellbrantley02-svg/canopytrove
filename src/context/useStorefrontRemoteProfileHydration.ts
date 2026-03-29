import React from 'react';
import { getCachedRecentStorefrontIds, saveRecentStorefrontIds } from '../services/recentStorefrontService';
import { loadRemoteStorefrontProfileState } from '../services/storefrontProfileStateService';
import { areGamificationStatesEqual, areStringArraysEqual } from './storefrontControllerShared';
import {
  createFallbackRemoteProfile,
  normalizeRemoteGamificationState,
  serializeRemoteProfileState,
  UseStorefrontRemoteProfileSyncArgs,
} from './storefrontRemoteProfileSyncShared';

type UseStorefrontRemoteProfileHydrationArgs = Pick<
  UseStorefrontRemoteProfileSyncArgs,
  | 'appProfile'
  | 'gamificationStateRef'
  | 'hasHydratedPreferences'
  | 'profileId'
  | 'setAppProfile'
  | 'setGamificationState'
  | 'setProfileId'
  | 'setRecentStorefrontIds'
  | 'setSavedStorefrontIds'
> & {
  shouldSyncRemoteProfileState: boolean;
  setHasHydratedRemoteProfileState: React.Dispatch<React.SetStateAction<boolean>>;
  lastSavedRemoteStatePayloadRef: React.MutableRefObject<string | null>;
  lastRemoteHydrationAtRef: React.MutableRefObject<number>;
  remoteHydrationInFlightRef: React.MutableRefObject<Promise<void> | null>;
};

export function useStorefrontRemoteProfileHydration({
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
}: UseStorefrontRemoteProfileHydrationArgs) {
  const hydrateRemoteProfileState = React.useCallback(
    async (force = false) => {
      if (!hasHydratedPreferences || !shouldSyncRemoteProfileState) {
        if (!shouldSyncRemoteProfileState) {
          setHasHydratedRemoteProfileState(true);
        }
        return;
      }

      if (!force && Date.now() - lastRemoteHydrationAtRef.current < 10_000) {
        return;
      }

      if (remoteHydrationInFlightRef.current) {
        return remoteHydrationInFlightRef.current;
      }

      const task = (async () => {
        const remoteProfileState = await loadRemoteStorefrontProfileState(profileId);
        const remoteRouteState = remoteProfileState?.routeState ?? null;

        if (remoteProfileState?.profile) {
          setAppProfile((current) => {
            if (
              current?.id === remoteProfileState.profile?.id &&
              current?.kind === remoteProfileState.profile?.kind &&
              current?.accountId === remoteProfileState.profile?.accountId &&
              current?.displayName === remoteProfileState.profile?.displayName &&
              current?.createdAt === remoteProfileState.profile?.createdAt &&
              current?.updatedAt === remoteProfileState.profile?.updatedAt
            ) {
              return current;
            }

            return remoteProfileState.profile;
          });
          if (remoteProfileState.profile.id !== profileId) {
            setProfileId(remoteProfileState.profile.id);
          }
        }

        if (remoteRouteState) {
          const nextSavedStorefrontIds = remoteRouteState.savedStorefrontIds ?? [];
          const nextRecentStorefrontIds = remoteRouteState.recentStorefrontIds ?? [];

          setSavedStorefrontIds((current) =>
            areStringArraysEqual(current, nextSavedStorefrontIds) ? current : nextSavedStorefrontIds
          );
          setRecentStorefrontIds((current) =>
            areStringArraysEqual(current, nextRecentStorefrontIds)
              ? current
              : nextRecentStorefrontIds
          );

          if (!areStringArraysEqual(getCachedRecentStorefrontIds(), nextRecentStorefrontIds)) {
            void saveRecentStorefrontIds(nextRecentStorefrontIds);
          }
        }

        if (remoteProfileState?.gamificationState) {
          const nextGamificationState = normalizeRemoteGamificationState({
            profileId,
            remoteGamificationState: remoteProfileState.gamificationState,
            remoteCreatedAt: remoteProfileState.profile?.createdAt,
            localCreatedAt: appProfile?.createdAt,
          });
          gamificationStateRef.current = nextGamificationState;
          setGamificationState((current) =>
            areGamificationStatesEqual(current, nextGamificationState)
              ? current
              : nextGamificationState
          );
        }

        if (remoteProfileState) {
          lastSavedRemoteStatePayloadRef.current = serializeRemoteProfileState({
            appProfile: remoteProfileState.profile ?? createFallbackRemoteProfile(profileId),
            profileId,
            savedStorefrontIds: remoteRouteState?.savedStorefrontIds ?? [],
            recentStorefrontIds: remoteRouteState?.recentStorefrontIds ?? [],
            gamificationState:
              remoteProfileState.gamificationState ??
              normalizeRemoteGamificationState({
                profileId,
                remoteGamificationState: undefined,
                remoteCreatedAt: remoteProfileState.profile?.createdAt,
              }),
          });
        }

        lastRemoteHydrationAtRef.current = Date.now();
        setHasHydratedRemoteProfileState(true);
      })();

      remoteHydrationInFlightRef.current = task;

      try {
        await task;
      } finally {
        remoteHydrationInFlightRef.current = null;
      }
    },
    [
      appProfile?.createdAt,
      gamificationStateRef,
      hasHydratedPreferences,
      lastRemoteHydrationAtRef,
      lastSavedRemoteStatePayloadRef,
      profileId,
      remoteHydrationInFlightRef,
      setAppProfile,
      setGamificationState,
      setHasHydratedRemoteProfileState,
      setProfileId,
      setRecentStorefrontIds,
      setSavedStorefrontIds,
      shouldSyncRemoteProfileState,
    ]
  );

  React.useEffect(() => {
    if (
      !shouldSyncRemoteProfileState ||
      !hasHydratedPreferences
    ) {
      return;
    }

    const timeoutId = setTimeout(() => {
      void hydrateRemoteProfileState();
    }, 1000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [hasHydratedPreferences, hydrateRemoteProfileState, shouldSyncRemoteProfileState]);
}
