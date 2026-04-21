import React from 'react';
import { clearStorefrontRepositoryCache } from '../../repositories/storefrontRepository';
import {
  seedMockStorefrontCollections,
  getMockFirestoreSeedCounts,
} from '../../services/firestoreSeedService';
import { getFirebaseDb, hasFirebaseConfig } from '../../config/firebase';
import {
  seedStorefrontBackendFirestore,
  submitUsernameChangeRequest,
  getPendingUsernameRequest,
} from '../../services/storefrontBackendService';
import type { UsernameChangeRequestResponse } from '../../services/storefrontBackendService';
import { storefrontSourceMode } from '../../config/storefrontSourceConfig';
import { getOwnerPortalAccessState } from '../../services/ownerPortalService';
import { isEmailLike } from '../../utils/publicIdentity';
import type { CanopyTroveAuthSession } from '../../types/identity';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type UseProfileActionsArgs = {
  authSession: CanopyTroveAuthSession;
  backendHealth: {
    status: string;
    allowDevSeed: boolean;
  };
  clearDisplayName: () => Promise<boolean>;
  displayNameInput: string;
  navigation: NativeStackNavigationProp<RootStackParamList>;
  profileId: string;
  signOutSession: () => Promise<boolean>;
  startGuestSession: () => Promise<boolean>;
  updateDisplayName: (value: string) => Promise<boolean>;
};

export function useProfileActions({
  authSession: _authSession,
  backendHealth,
  clearDisplayName: _clearDisplayName,
  displayNameInput,
  navigation,
  profileId,
  signOutSession,
  startGuestSession,
  updateDisplayName: _updateDisplayName,
}: UseProfileActionsArgs) {
  const [isSeeding, setIsSeeding] = React.useState(false);
  const [seedStatus, setSeedStatus] = React.useState<string | null>(null);
  const [isSavingDisplayName, setIsSavingDisplayName] = React.useState(false);
  const [profileActionStatus, setProfileActionStatus] = React.useState<string | null>(null);
  const [pendingUsernameRequest, setPendingUsernameRequest] =
    React.useState<UsernameChangeRequestResponse | null>(null);
  const [isLoadingPendingRequest, setIsLoadingPendingRequest] = React.useState(false);

  // Check for existing pending username request on mount and when profileId changes
  React.useEffect(() => {
    let alive = true;
    setIsLoadingPendingRequest(true);
    getPendingUsernameRequest(profileId)
      .then((result) => {
        if (alive) {
          setPendingUsernameRequest(result.request);
        }
      })
      .catch(() => {
        // Silently fail — user can still submit a new request
      })
      .finally(() => {
        if (alive) setIsLoadingPendingRequest(false);
      });
    return () => {
      alive = false;
    };
  }, [profileId]);

  const fallbackSeedCounts = React.useMemo(() => getMockFirestoreSeedCounts(), []);
  const canSeedViaBackend =
    storefrontSourceMode === 'api' &&
    backendHealth.status === 'healthy' &&
    backendHealth.allowDevSeed;
  const canSeedViaFirebase = storefrontSourceMode !== 'api' && hasFirebaseConfig;
  const canSeed = canSeedViaBackend || canSeedViaFirebase;
  const ownerPortalAccess = getOwnerPortalAccessState();

  const handleSeedFirebase = React.useCallback(async () => {
    const db = getFirebaseDb();
    if (!db) {
      setSeedStatus('Firebase config is missing. Seed skipped.');
      return;
    }

    setIsSeeding(true);
    setSeedStatus(null);
    try {
      const result = await seedMockStorefrontCollections(db);
      clearStorefrontRepositoryCache();
      setSeedStatus(`Seeded ${result.summaryCount} summaries and ${result.detailCount} details.`);
    } catch (error) {
      setSeedStatus(
        `Seed failed: ${error instanceof Error ? error.message : 'Unknown seed failure'}`,
      );
    } finally {
      setIsSeeding(false);
    }
  }, []);

  const handleSeedBackend = React.useCallback(async () => {
    setIsSeeding(true);
    setSeedStatus(null);
    try {
      const result = await seedStorefrontBackendFirestore();
      clearStorefrontRepositoryCache();
      setSeedStatus(
        `Seeded ${result.summaryCount} summaries and ${result.detailCount} details through the backend API.`,
      );
    } catch (error) {
      setSeedStatus(
        `Backend seed failed: ${error instanceof Error ? error.message : 'Unknown backend seed failure'}`,
      );
    } finally {
      setIsSeeding(false);
    }
  }, []);

  const handleSubmitUsernameRequest = React.useCallback(async () => {
    const trimmed = displayNameInput.trim();
    if (!trimmed || trimmed.length < 2) {
      setProfileActionStatus('Username must be at least 2 characters.');
      return;
    }
    if (trimmed.length > 30) {
      setProfileActionStatus('Username must be 30 characters or fewer.');
      return;
    }
    if (isEmailLike(trimmed)) {
      setProfileActionStatus('Use a username, not an email address.');
      return;
    }

    setIsSavingDisplayName(true);
    setProfileActionStatus(null);
    try {
      const result = await submitUsernameChangeRequest(profileId, trimmed);
      setPendingUsernameRequest(result.request);
      setProfileActionStatus('Username change request submitted. It will be reviewed shortly.');
    } catch (error) {
      setProfileActionStatus(
        error instanceof Error ? error.message : 'Could not submit username request.',
      );
    } finally {
      setIsSavingDisplayName(false);
    }
  }, [displayNameInput, profileId]);

  const handleSignOut = React.useCallback(async () => {
    setProfileActionStatus(null);
    const didSignOut = await signOutSession();
    setProfileActionStatus(didSignOut ? 'Session signed out.' : 'No active session to sign out.');
  }, [signOutSession]);

  const handleSeed = React.useCallback(() => {
    if (canSeedViaBackend) {
      void handleSeedBackend();
      return;
    }
    if (canSeedViaFirebase) {
      void handleSeedFirebase();
    }
  }, [canSeedViaBackend, canSeedViaFirebase, handleSeedBackend, handleSeedFirebase]);

  return {
    canSeed,
    canSeedViaBackend,
    fallbackSeedCounts,
    isSavingDisplayName,
    isSeeding,
    isLoadingPendingRequest,
    ownerPortalAccess,
    pendingUsernameRequest,
    profileActionStatus,
    seedStatus,
    openLeaderboard: () => navigation.navigate('Leaderboard', { highlightProfileId: profileId }),
    openMemberSignIn: () => navigation.navigate('CanopyTroveSignIn'),
    openMemberSignUp: () => navigation.navigate('CanopyTroveSignUp'),
    openLegalCenter: () => navigation.navigate('LegalCenter'),
    openDeleteAccount: () => navigation.navigate('DeleteAccount'),
    openOwnerSignIn: () => {
      navigation.navigate('OwnerPortalAccess');
    },
    openOwnerPortal: () => navigation.navigate('OwnerPortalAccess'),
    submitUsernameRequest: () => {
      void handleSubmitUsernameRequest();
    },
    seed: handleSeed,
    signOut: () => {
      void handleSignOut();
    },
    startGuestSession: () => {
      void startGuestSession();
    },
  };
}
