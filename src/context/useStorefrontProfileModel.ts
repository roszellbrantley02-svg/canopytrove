import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppProfile } from '../types/storefront';
import type { CanopyTroveAuthSession } from '../types/identity';
import {
  createAppProfileId,
  ensureAppProfile,
  getCachedAppProfile,
  saveAppProfile,
} from '../services/appProfileService';
import { getStorefrontBackendCanonicalProfile } from '../services/storefrontBackendService';
import {
  getInitialCanopyTroveAuthSession,
  signOutCanopyTroveSession,
  startCanopyTroveGuestSession,
  subscribeToCanopyTroveAuthSession,
} from '../services/canopyTroveAuthService';

type UseStorefrontProfileModelArgs = {
  cachedProfileId?: string | null;
};

export function useStorefrontProfileModel({ cachedProfileId }: UseStorefrontProfileModelArgs) {
  const cachedAppProfile = getCachedAppProfile();
  const [appProfile, setAppProfile] = useState<AppProfile | null>(cachedAppProfile);
  const [authSession, setAuthSession] = useState<CanopyTroveAuthSession>(
    getInitialCanopyTroveAuthSession(),
  );
  const [isStartingGuestSession, setIsStartingGuestSession] = useState(false);
  const [profileId, setProfileId] = useState<string>(
    cachedAppProfile?.id ?? cachedProfileId ?? createAppProfileId(),
  );
  const lastCanonicalResolutionKeyRef = useRef<string | null>(null);
  const authSessionSubscriberRef = useRef<((session: CanopyTroveAuthSession) => void) | null>(null);

  const areProfilesEquivalent = useCallback(
    (left: AppProfile | null | undefined, right: AppProfile | null | undefined) =>
      (left?.id ?? null) === (right?.id ?? null) &&
      (left?.kind ?? null) === (right?.kind ?? null) &&
      (left?.accountId ?? null) === (right?.accountId ?? null) &&
      (left?.displayName ?? null) === (right?.displayName ?? null) &&
      (left?.createdAt ?? null) === (right?.createdAt ?? null) &&
      (left?.updatedAt ?? null) === (right?.updatedAt ?? null),
    [],
  );

  const getPreferredDisplayName = useCallback(
    (
      session: CanopyTroveAuthSession,
      existingDisplayName: string | null | undefined,
    ): string | null => {
      const normalizedExistingDisplayName = existingDisplayName?.trim() || null;
      const isExistingDisplayNameAnEmail =
        normalizedExistingDisplayName &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedExistingDisplayName);
      const authDisplayName =
        session.status === 'authenticated' ? session.displayName?.trim() || null : null;
      const authEmail = session.status === 'authenticated' ? (session.email ?? null) : null;

      if (normalizedExistingDisplayName && !isExistingDisplayNameAnEmail) {
        return normalizedExistingDisplayName;
      }

      if (authDisplayName) {
        return authDisplayName;
      }

      if (authEmail) {
        return authEmail;
      }

      return normalizedExistingDisplayName;
    },
    [],
  );

  const createProfileForSession = useCallback(
    (
      session: CanopyTroveAuthSession,
      existingDisplayName: string | null | undefined,
    ): AppProfile => {
      const now = new Date().toISOString();

      return {
        id: createAppProfileId(),
        kind: session.status === 'authenticated' ? 'authenticated' : 'anonymous',
        accountId:
          session.status === 'authenticated' || session.status === 'anonymous' ? session.uid : null,
        displayName: getPreferredDisplayName(session, existingDisplayName),
        createdAt: now,
        updatedAt: now,
      };
    },
    [getPreferredDisplayName],
  );

  const persistResolvedProfile = useCallback(
    async (nextProfile: AppProfile) => {
      setAppProfile((current) =>
        areProfilesEquivalent(current, nextProfile) ? current : nextProfile,
      );
      setProfileId((current) => (current === nextProfile.id ? current : nextProfile.id));
      await saveAppProfile(nextProfile);
      return nextProfile;
    },
    [areProfilesEquivalent],
  );

  const resolveCanonicalAuthenticatedProfile = useCallback(
    async (
      session: CanopyTroveAuthSession,
      existingDisplayName: string | null | undefined,
    ): Promise<AppProfile | null> => {
      if (session.status !== 'authenticated') {
        return null;
      }

      try {
        const canonicalProfile = await getStorefrontBackendCanonicalProfile();
        if (!canonicalProfile || canonicalProfile.accountId !== session.uid) {
          return null;
        }

        return {
          ...canonicalProfile,
          kind: 'authenticated',
          accountId: session.uid,
          displayName: getPreferredDisplayName(
            session,
            canonicalProfile.displayName ?? existingDisplayName,
          ),
        };
      } catch {
        return null;
      }
    },
    [getPreferredDisplayName],
  );

  const repairProfileForCurrentSession = useCallback(async () => {
    if (authSession.status === 'checking' || authSession.status === 'disabled') {
      return appProfile;
    }

    const canonicalProfile = await resolveCanonicalAuthenticatedProfile(
      authSession,
      appProfile?.displayName ?? null,
    );

    // If canonical lookup returned null but we already have a profile for this
    // account, keep it rather than minting a duplicate. Only create fresh when
    // there's genuinely no profile to work with.
    const nextProfile =
      canonicalProfile ??
      (appProfile?.accountId === authSession.uid ? appProfile : null) ??
      createProfileForSession(authSession, appProfile?.displayName ?? null);

    if (areProfilesEquivalent(appProfile, nextProfile)) {
      return appProfile;
    }

    return persistResolvedProfile(nextProfile);
  }, [
    appProfile,
    authSession,
    areProfilesEquivalent,
    createProfileForSession,
    persistResolvedProfile,
    resolveCanonicalAuthenticatedProfile,
  ]);

  const reconcileCanonicalProfileForCurrentSession = useCallback(async () => {
    if (authSession.status !== 'authenticated') {
      return appProfile;
    }

    const canonicalProfile = await resolveCanonicalAuthenticatedProfile(
      authSession,
      appProfile?.displayName ?? null,
    );
    if (!canonicalProfile || areProfilesEquivalent(appProfile, canonicalProfile)) {
      return appProfile;
    }

    return persistResolvedProfile(canonicalProfile);
  }, [
    appProfile,
    authSession,
    areProfilesEquivalent,
    persistResolvedProfile,
    resolveCanonicalAuthenticatedProfile,
  ]);

  const startGuestSession = useCallback(async () => {
    if (authSession.status === 'disabled' || authSession.status === 'authenticated') {
      return false;
    }

    setIsStartingGuestSession(true);
    try {
      const nextSession = await startCanopyTroveGuestSession();
      if (nextSession) {
        setAuthSession(nextSession);
        return true;
      }

      return false;
    } catch {
      return false;
    } finally {
      setIsStartingGuestSession(false);
    }
  }, [authSession.status]);

  const signOutSession = useCallback(async () => {
    if (
      authSession.status === 'disabled' ||
      authSession.status === 'checking' ||
      authSession.status === 'signed-out'
    ) {
      return false;
    }

    try {
      const didSignOut = await signOutCanopyTroveSession();
      if (!didSignOut) {
        return false;
      }

      await persistResolvedProfile(
        createProfileForSession(
          {
            status: 'signed-out',
            uid: null,
            isAnonymous: false,
            displayName: null,
            email: null,
          },
          null,
        ),
      );
      return true;
    } catch {
      return false;
    }
  }, [authSession.status, createProfileForSession, persistResolvedProfile]);

  const updateDisplayName = useCallback(
    async (value: string) => {
      if (!appProfile) {
        return false;
      }

      const nextDisplayName = value.trim() || null;
      const nextProfile: AppProfile = {
        ...appProfile,
        displayName: nextDisplayName,
        updatedAt: new Date().toISOString(),
      };

      setAppProfile(nextProfile);
      await saveAppProfile(nextProfile);
      return true;
    },
    [appProfile],
  );

  const clearDisplayName = useCallback(() => updateDisplayName(''), [updateDisplayName]);

  useEffect(() => {
    // Always call through ref to avoid stale closure
    authSessionSubscriberRef.current = (nextSession: CanopyTroveAuthSession) => {
      setAuthSession(nextSession);
    };

    const unsubscribe = subscribeToCanopyTroveAuthSession((nextSession) => {
      authSessionSubscriberRef.current?.(nextSession);
    });

    return () => {
      authSessionSubscriberRef.current = null;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!appProfile || authSession.status === 'disabled' || authSession.status === 'checking') {
      return;
    }

    if (
      authSession.status === 'authenticated' &&
      (appProfile.kind !== 'authenticated' || appProfile.accountId !== authSession.uid)
    ) {
      void repairProfileForCurrentSession();
      return;
    }

    // Display-name resolution priority:
    //   1. Keep the user's explicit username if they chose one (non-email).
    //   2. Use authSession.displayName if the auth provider supplied one.
    //   3. Fall back to the authenticated email so the
    //      leaderboard always shows a real name — never "anonymous".
    //   4. If the user later picks a username it replaces all fallbacks.
    const nextProfile: AppProfile = {
      ...appProfile,
      kind: authSession.status === 'authenticated' ? 'authenticated' : 'anonymous',
      accountId:
        authSession.status === 'authenticated' || authSession.status === 'anonymous'
          ? authSession.uid
          : null,
      displayName: getPreferredDisplayName(authSession, appProfile.displayName),
      updatedAt: new Date().toISOString(),
    };

    if (
      nextProfile.kind === appProfile.kind &&
      nextProfile.accountId === appProfile.accountId &&
      nextProfile.displayName === appProfile.displayName
    ) {
      return;
    }

    setAppProfile(nextProfile);
    void saveAppProfile(nextProfile);
  }, [appProfile, authSession, getPreferredDisplayName, repairProfileForCurrentSession]);

  useEffect(() => {
    if (!appProfile || authSession.status !== 'authenticated') {
      lastCanonicalResolutionKeyRef.current = null;
      return;
    }

    const resolutionKey = `${authSession.uid}:${appProfile.id}`;
    if (lastCanonicalResolutionKeyRef.current === resolutionKey) {
      return;
    }

    lastCanonicalResolutionKeyRef.current = resolutionKey;
    void reconcileCanonicalProfileForCurrentSession();
  }, [appProfile, authSession.status, authSession.uid, reconcileCanonicalProfileForCurrentSession]);

  useEffect(() => {
    let alive = true;

    void (async () => {
      if (cachedAppProfile) {
        setAppProfile(cachedAppProfile);
        if (cachedAppProfile.id !== profileId) {
          setProfileId(cachedAppProfile.id);
        }
        return;
      }

      try {
        const nextProfile = await ensureAppProfile();
        if (!alive) {
          return;
        }

        setAppProfile(nextProfile);
        if (nextProfile.id !== profileId) {
          setProfileId(nextProfile.id);
        }
      } catch (error) {
        if (!alive) {
          return;
        }
        console.error('[useStorefrontProfileModel] Failed to ensure app profile:', error);
        // Fail gracefully — let the app continue with default profile
      }
    })();

    return () => {
      alive = false;
    };
  }, [cachedAppProfile, profileId]);

  return {
    appProfile,
    setAppProfile,
    authSession,
    isStartingGuestSession,
    profileId,
    setProfileId,
    startGuestSession,
    repairProfileForCurrentSession,
    signOutSession,
    updateDisplayName,
    clearDisplayName,
  };
}
