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

      const aliveRef = { current: true };
      resolvedRemoteHydrationStartedAtRef.current = Date.now();
      const task = (async () => {
        const hydrationStartedAt = resolvedRemoteHydrationStartedAtRef.current;

        // Capture start snapshots BEFORE the async fetch so we can detect
        // whether local state changed while the network request was in flight.
        const hydrationStartProfile = latestAppProfileRef.current;
        const hydrationStartSavedStorefrontIds = latestSavedStorefrontIdsRef.current;
        const hydrationStartRecentStorefrontIds = latestRecentStorefrontIdsRef.current;
        const hydrationStartGamificationState = gamificationStateRef.current;

        const remoteProfileState = await loadRemoteStorefrontProfileState(profileId);

        if (!aliveRef.current) {
          return;
        }

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
        // BUGFIX (May 2 2026): when remote returns an empty
        // savedStorefrontIds AND the local state has saves, we used to
        // overwrite local with the empty remote — wiping every
        // authenticated user's saved shops on every hydration. Combined
        // with the 750ms debounce on the persistence hook, this also
        // raced with new save taps: remote hydration would land first,
        // reset state to [], cancel the pending save's setTimeout, and
        // the new save would never reach the backend. Result: every
        // authenticated user showed 0 saves in route_state platform-
        // wide, even ones who saved 4-5 shops on device. Fix: when
        // remote is empty but local has data, MERGE (which produces
        // local + [] = local, preserving the saves). The merge path
        // also runs when local mutated during the roundtrip, so this
        // change just extends the merge case to "local has data and
        // remote is empty," fixing the data loss without changing
        // the well-behaved cases (both empty, both equal, etc.).
        function resolveRouteList(
          local: string[],
          localStartSnapshot: string[],
          remote: string[],
        ): string[] {
          if (!canApplyRemoteRouteState) return local;
          // Local mutated during the network call — merge to avoid
          // losing the new mutation.
          if (!areStringArraysEqual(local, localStartSnapshot)) {
            return mergeOrderedStringIds(local, remote);
          }
          // Local has data, remote is empty — never overwrite a
          // populated local list with an empty remote (would wipe the
          // user's saves; backend hasn't been populated yet because of
          // historic sync issues, see the commit referenced above).
          if (local.length > 0 && remote.length === 0) {
            return local;
          }
          // Both equal-or-remote-has-data: trust remote as the latest
          // authoritative state.
          return remote;
        }
        const resolvedSavedStorefrontIds = resolveRouteList(
          currentSavedStorefrontIds,
          hydrationStartSavedStorefrontIds,
          remoteSavedStorefrontIds,
        );
        const resolvedRecentStorefrontIds = resolveRouteList(
          currentRecentStorefrontIds,
          hydrationStartRecentStorefrontIds,
          remoteRecentStorefrontIds,
        );

        if (remoteProfile && shouldApplyRemoteProfile) {
          setAppProfile((current) =>
            areProfilesEquivalent(current, remoteProfile) ? current : remoteProfile,
          );
          // Only update profileId if the current account ID still matches
          // (prevents cross-profile state bleed from stale hydration)
          if (
            remoteProfile.id !== profileId &&
            remoteProfile.id === latestAppProfileRef.current?.id
          ) {
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

        if (aliveRef.current) {
          lastRemoteHydrationAtRef.current = Date.now();
          setHasHydratedRemoteProfileState(true);
        }
      })();

      remoteHydrationInFlightRef.current = task;

      try {
        await task;
      } finally {
        aliveRef.current = false;
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
