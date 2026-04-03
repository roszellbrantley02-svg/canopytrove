import React from 'react';
import {
  getCachedRecentStorefrontIds,
  getLastRecentStorefrontMutationAt,
  saveRecentStorefrontIds,
} from '../services/recentStorefrontService';
import { loadRemoteStorefrontProfileState } from '../services/storefrontProfileStateService';
import { areGamificationStatesEqual, areStringArraysEqual } from './storefrontControllerShared';
import type { UseStorefrontRemoteProfileSyncArgs } from './storefrontRemoteProfileSyncShared';
import {
  areProfilesEquivalent,
  createFallbackRemoteProfile,
  mergeOrderedStringIds,
  mergeRemoteGamificationState,
  normalizeRemoteGamificationState,
  serializeRemoteProfileState,
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
  latestAppProfileRef: React.MutableRefObject<UseStorefrontRemoteProfileSyncArgs['appProfile']>;
  latestRecentStorefrontIdsRef: React.MutableRefObject<string[]>;
  latestSavedStorefrontIdsRef: React.MutableRefObject<string[]>;
  shouldSyncRemoteProfileState: boolean;
  setHasHydratedRemoteProfileState: React.Dispatch<React.SetStateAction<boolean>>;
  currentRemoteHydrationStartedAtRef?: React.MutableRefObject<number>;
  lastSavedRemoteStatePayloadRef: React.MutableRefObject<string | null>;
  lastLocalGamificationMutationAtRef?: React.MutableRefObject<number>;
  lastLocalRouteMutationAtRef?: React.MutableRefObject<number>;
  lastRemoteHydrationAtRef: React.MutableRefObject<number>;
  remoteHydrationInFlightRef: React.MutableRefObject<Promise<void> | null>;
};

export function useStorefrontRemoteProfileHydration({
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
}: UseStorefrontRemoteProfileHydrationArgs) {
  const fallbackRemoteHydrationStartedAtRef = React.useRef(0);
  const fallbackLocalGamificationMutationAtRef = React.useRef(0);
  const fallbackLocalRouteMutationAtRef = React.useRef(0);
  const resolvedRemoteHydrationStartedAtRef =
    currentRemoteHydrationStartedAtRef ?? fallbackRemoteHydrationStartedAtRef;
  const resolvedLocalGamificationMutationAtRef =
    lastLocalGamificationMutationAtRef ?? fallbackLocalGamificationMutationAtRef;
  const resolvedLocalRouteMutationAtRef =
    lastLocalRouteMutationAtRef ?? fallbackLocalRouteMutationAtRef;

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

      resolvedRemoteHydrationStartedAtRef.current = Date.now();
      const task = (async () => {
        const hydrationStartProfile = latestAppProfileRef.current;
        const hydrationStartSavedStorefrontIds = latestSavedStorefrontIdsRef.current;
        const hydrationStartRecentStorefrontIds = latestRecentStorefrontIdsRef.current;
        const hydrationStartGamificationState = gamificationStateRef.current;
        const hydrationStartedAt = resolvedRemoteHydrationStartedAtRef.current;
        const remoteProfileState = await loadRemoteStorefrontProfileState(profileId);
        const remoteProfile = remoteProfileState?.profile ?? null;
        const remoteRouteState = remoteProfileState?.routeState ?? null;
        const remoteSavedStorefrontIds = remoteRouteState?.savedStorefrontIds ?? [];
        const remoteRecentStorefrontIds = remoteRouteState?.recentStorefrontIds ?? [];
        const currentProfile = latestAppProfileRef.current;
        const currentSavedStorefrontIds = latestSavedStorefrontIdsRef.current;
        const currentRecentStorefrontIds = latestRecentStorefrontIdsRef.current;
        const currentGamificationState = gamificationStateRef.current;
        const canApplyRemoteRouteState =
          Math.max(resolvedLocalRouteMutationAtRef.current, getLastRecentStorefrontMutationAt()) <=
          hydrationStartedAt;
        const canApplyRemoteGamificationState =
          resolvedLocalGamificationMutationAtRef.current <= hydrationStartedAt;
        const shouldApplyRemoteProfile = areProfilesEquivalent(
          currentProfile,
          hydrationStartProfile,
        );
        const resolvedSavedStorefrontIds = canApplyRemoteRouteState
          ? areStringArraysEqual(currentSavedStorefrontIds, hydrationStartSavedStorefrontIds)
            ? remoteSavedStorefrontIds
            : mergeOrderedStringIds(currentSavedStorefrontIds, remoteSavedStorefrontIds)
          : currentSavedStorefrontIds;
        const resolvedRecentStorefrontIds = canApplyRemoteRouteState
          ? areStringArraysEqual(currentRecentStorefrontIds, hydrationStartRecentStorefrontIds)
            ? remoteRecentStorefrontIds
            : mergeOrderedStringIds(currentRecentStorefrontIds, remoteRecentStorefrontIds)
          : currentRecentStorefrontIds;

        if (remoteProfile && shouldApplyRemoteProfile) {
          setAppProfile((current) =>
            areProfilesEquivalent(current, remoteProfile) ? current : remoteProfile,
          );
          if (remoteProfile.id !== profileId) {
            setProfileId(remoteProfile.id);
          }
        }

        if (remoteRouteState && canApplyRemoteRouteState) {
          setSavedStorefrontIds((current) =>
            areStringArraysEqual(current, resolvedSavedStorefrontIds)
              ? current
              : resolvedSavedStorefrontIds,
          );
          setRecentStorefrontIds((current) =>
            areStringArraysEqual(current, resolvedRecentStorefrontIds)
              ? current
              : resolvedRecentStorefrontIds,
          );

          if (!areStringArraysEqual(getCachedRecentStorefrontIds(), resolvedRecentStorefrontIds)) {
            void saveRecentStorefrontIds(resolvedRecentStorefrontIds, {
              trackMutation: false,
            });
          }
        }

        if (remoteProfileState?.gamificationState && canApplyRemoteGamificationState) {
          const nextGamificationState = areGamificationStatesEqual(
            currentGamificationState,
            hydrationStartGamificationState,
          )
            ? normalizeRemoteGamificationState({
                profileId,
                remoteGamificationState: remoteProfileState.gamificationState,
                remoteCreatedAt: remoteProfile?.createdAt,
                localCreatedAt: appProfile?.createdAt,
              })
            : mergeRemoteGamificationState({
                profileId,
                remoteGamificationState: remoteProfileState.gamificationState,
                localGamificationState: currentGamificationState,
                remoteCreatedAt: remoteProfile?.createdAt,
                localCreatedAt:
                  currentProfile?.createdAt ??
                  hydrationStartProfile?.createdAt ??
                  appProfile?.createdAt,
              });

          gamificationStateRef.current = nextGamificationState;
          setGamificationState((current) =>
            areGamificationStatesEqual(current, nextGamificationState)
              ? current
              : nextGamificationState,
          );
        }

        if (remoteProfileState) {
          lastSavedRemoteStatePayloadRef.current = serializeRemoteProfileState({
            appProfile:
              (shouldApplyRemoteProfile ? remoteProfile : currentProfile) ??
              createFallbackRemoteProfile(profileId),
            profileId,
            savedStorefrontIds: resolvedSavedStorefrontIds,
            recentStorefrontIds: resolvedRecentStorefrontIds,
            gamificationState:
              remoteProfileState.gamificationState && canApplyRemoteGamificationState
                ? gamificationStateRef.current
                : normalizeRemoteGamificationState({
                    profileId,
                    remoteGamificationState: undefined,
                    remoteCreatedAt: remoteProfile?.createdAt,
                    localCreatedAt:
                      currentProfile?.createdAt ??
                      hydrationStartProfile?.createdAt ??
                      appProfile?.createdAt,
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
      resolvedLocalGamificationMutationAtRef,
      resolvedLocalRouteMutationAtRef,
      resolvedRemoteHydrationStartedAtRef,
      gamificationStateRef,
      hasHydratedPreferences,
      lastRemoteHydrationAtRef,
      lastSavedRemoteStatePayloadRef,
      latestAppProfileRef,
      latestRecentStorefrontIdsRef,
      latestSavedStorefrontIdsRef,
      profileId,
      remoteHydrationInFlightRef,
      setAppProfile,
      setGamificationState,
      setHasHydratedRemoteProfileState,
      setProfileId,
      setRecentStorefrontIds,
      setSavedStorefrontIds,
      shouldSyncRemoteProfileState,
    ],
  );

  React.useEffect(() => {
    if (!shouldSyncRemoteProfileState || !hasHydratedPreferences) {
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
