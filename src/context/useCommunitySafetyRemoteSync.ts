import React from 'react';
import type { CanopyTroveAuthSession } from '../types/identity';
import type { CommunitySafetyState } from '../types/storefront';
import {
  getCommunitySafetyState,
  getLastCommunitySafetyMutationAt,
  initializeCommunitySafetyState,
  replaceCommunitySafetyState,
  subscribeToCommunitySafetyState,
} from '../services/communitySafetyService';
import {
  loadRemoteCommunitySafetyState,
  saveRemoteCommunitySafetyState,
} from '../services/storefrontCommunitySafetyRemoteService';
import { getShouldSyncRemoteProfileState } from './storefrontRemoteProfileSyncShared';

function serializeCommunitySafetyState(state: CommunitySafetyState) {
  return JSON.stringify(state);
}

export function useCommunitySafetyRemoteSync(args: {
  authSession: CanopyTroveAuthSession;
  profileId: string;
}) {
  const { authSession, profileId } = args;
  const shouldSyncRemoteCommunitySafety = getShouldSyncRemoteProfileState(authSession);
  const [hasHydratedRemoteCommunitySafety, setHasHydratedRemoteCommunitySafety] = React.useState(
    !shouldSyncRemoteCommunitySafety,
  );
  const lastSavedPayloadRef = React.useRef<string | null>(null);
  const hydrationRequestIdRef = React.useRef(0);
  const isApplyingRemoteStateRef = React.useRef(false);

  React.useEffect(() => {
    hydrationRequestIdRef.current += 1;
    lastSavedPayloadRef.current = null;
    isApplyingRemoteStateRef.current = false;
    setHasHydratedRemoteCommunitySafety(!shouldSyncRemoteCommunitySafety);
  }, [profileId, shouldSyncRemoteCommunitySafety]);

  React.useEffect(() => {
    if (!shouldSyncRemoteCommunitySafety) {
      return;
    }

    const hydrationRequestId = hydrationRequestIdRef.current;

    void (async () => {
      await initializeCommunitySafetyState();
      const hydrationStartedAt = Date.now();
      const remoteState = await loadRemoteCommunitySafetyState(profileId);
      if (hydrationRequestIdRef.current !== hydrationRequestId) {
        return;
      }

      if (remoteState && getLastCommunitySafetyMutationAt() <= hydrationStartedAt) {
        isApplyingRemoteStateRef.current = true;
        try {
          await replaceCommunitySafetyState(remoteState, {
            trackMutation: false,
          });
        } finally {
          isApplyingRemoteStateRef.current = false;
        }
        lastSavedPayloadRef.current = serializeCommunitySafetyState(remoteState);
      }

      setHasHydratedRemoteCommunitySafety(true);
    })();
  }, [profileId, shouldSyncRemoteCommunitySafety]);

  React.useEffect(() => {
    if (!shouldSyncRemoteCommunitySafety || !hasHydratedRemoteCommunitySafety) {
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const schedulePersist = (state: CommunitySafetyState) => {
      if (isApplyingRemoteStateRef.current) {
        return;
      }

      const payload = serializeCommunitySafetyState(state);
      if (payload === lastSavedPayloadRef.current) {
        return;
      }

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        lastSavedPayloadRef.current = payload;
        void saveRemoteCommunitySafetyState(profileId, state);
      }, 750);
    };

    schedulePersist(getCommunitySafetyState());
    const unsubscribe = subscribeToCommunitySafetyState(schedulePersist);

    return () => {
      unsubscribe();
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [hasHydratedRemoteCommunitySafety, profileId, shouldSyncRemoteCommunitySafety]);

  return {
    hasHydratedRemoteCommunitySafety,
    shouldSyncRemoteCommunitySafety,
  };
}
