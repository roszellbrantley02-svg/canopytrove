import React from 'react';
import { saveRemoteStorefrontProfileState } from '../services/storefrontProfileStateService';
import type { UseStorefrontRemoteProfileSyncArgs } from './storefrontRemoteProfileSyncShared';
import { serializeRemoteProfileState } from './storefrontRemoteProfileSyncShared';

type UseStorefrontRemoteProfilePersistenceArgs = Pick<
  UseStorefrontRemoteProfileSyncArgs,
  | 'appProfile'
  | 'gamificationState'
  | 'hasHydratedPreferences'
  | 'profileId'
  | 'recentStorefrontIds'
  | 'savedStorefrontIds'
> & {
  hasHydratedRemoteProfileState: boolean;
  shouldSyncRemoteProfileState: boolean;
  lastSavedRemoteStatePayloadRef: React.MutableRefObject<string | null>;
};

export function useStorefrontRemoteProfilePersistence({
  appProfile,
  gamificationState,
  hasHydratedPreferences,
  hasHydratedRemoteProfileState,
  profileId,
  recentStorefrontIds,
  savedStorefrontIds,
  shouldSyncRemoteProfileState,
  lastSavedRemoteStatePayloadRef,
}: UseStorefrontRemoteProfilePersistenceArgs) {
  React.useEffect(() => {
    if (
      !hasHydratedPreferences ||
      !hasHydratedRemoteProfileState ||
      !shouldSyncRemoteProfileState
    ) {
      return;
    }

    const nextProfileState = {
      profile: appProfile ?? {
        id: profileId,
        kind: 'anonymous' as const,
        accountId: null,
        displayName: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      routeState: {
        profileId,
        savedStorefrontIds,
        recentStorefrontIds,
      },
      gamificationState,
    };
    const serializedProfileState = serializeRemoteProfileState({
      appProfile,
      profileId,
      savedStorefrontIds,
      recentStorefrontIds,
      gamificationState,
    });
    if (serializedProfileState === lastSavedRemoteStatePayloadRef.current) {
      return;
    }

    const timeoutId = setTimeout(() => {
      lastSavedRemoteStatePayloadRef.current = serializedProfileState;
      void saveRemoteStorefrontProfileState(nextProfileState);
    }, 750);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [
    appProfile,
    gamificationState,
    hasHydratedPreferences,
    hasHydratedRemoteProfileState,
    lastSavedRemoteStatePayloadRef,
    profileId,
    recentStorefrontIds,
    savedStorefrontIds,
    shouldSyncRemoteProfileState,
  ]);
}
