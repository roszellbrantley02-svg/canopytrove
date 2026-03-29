import React from 'react';
import { storefrontSourceMode } from '../config/storefrontSourceConfig';
import { AppProfile, StorefrontGamificationState } from '../types/storefront';
import { CanopyTroveAuthSession } from '../types/identity';
import { normalizeGamificationState } from '../services/canopyTroveGamificationService';

export type UseStorefrontRemoteProfileSyncArgs = {
  appProfile: AppProfile | null;
  authSession: CanopyTroveAuthSession;
  hasHydratedPreferences: boolean;
  profileId: string;
  recentStorefrontIds: string[];
  savedStorefrontIds: string[];
  gamificationState: StorefrontGamificationState;
  gamificationStateRef: React.MutableRefObject<StorefrontGamificationState>;
  setAppProfile: React.Dispatch<React.SetStateAction<AppProfile | null>>;
  setProfileId: React.Dispatch<React.SetStateAction<string>>;
  setRecentStorefrontIds: React.Dispatch<React.SetStateAction<string[]>>;
  setSavedStorefrontIds: React.Dispatch<React.SetStateAction<string[]>>;
  setGamificationState: React.Dispatch<React.SetStateAction<StorefrontGamificationState>>;
};

export function getShouldSyncRemoteProfileState(authSession: CanopyTroveAuthSession) {
  return storefrontSourceMode === 'api' && authSession.status === 'authenticated';
}

export function createFallbackRemoteProfile(profileId: string) {
  const now = new Date().toISOString();
  return {
    id: profileId,
    kind: 'anonymous' as const,
    accountId: null,
    displayName: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function serializeRemoteProfileState({
  appProfile,
  profileId,
  savedStorefrontIds,
  recentStorefrontIds,
  gamificationState,
}: {
  appProfile: AppProfile | null;
  profileId: string;
  savedStorefrontIds: string[];
  recentStorefrontIds: string[];
  gamificationState: StorefrontGamificationState;
}) {
  return JSON.stringify({
    profile: appProfile ?? createFallbackRemoteProfile(profileId),
    routeState: {
      profileId,
      savedStorefrontIds,
      recentStorefrontIds,
    },
    gamificationState,
  });
}

export function normalizeRemoteGamificationState({
  profileId,
  remoteGamificationState,
  remoteCreatedAt,
  localCreatedAt,
}: {
  profileId: string;
  remoteGamificationState: StorefrontGamificationState | undefined;
  remoteCreatedAt?: string | null;
  localCreatedAt?: string | null;
}) {
  return normalizeGamificationState(
    profileId,
    remoteGamificationState,
    remoteCreatedAt ?? localCreatedAt
  );
}
