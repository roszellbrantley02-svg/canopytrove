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
      return await signOutCanopyTroveSession();
    } catch {
      return false;
    }
  }, [authSession.status]);

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
    const unsubscribe = subscribeToCanopyTroveAuthSession((nextSession) => {
      setAuthSession(nextSession);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!appProfile || authSession.status === 'disabled' || authSession.status === 'checking') {
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
  }, [appProfile, authSession, getPreferredDisplayName]);

  useEffect(() => {
    const currentProfileId = appProfile?.id ?? null;
    const currentAccountId = authSession.status === 'authenticated' ? authSession.uid : null;

    if (!currentProfileId || !currentAccountId) {
      lastCanonicalResolutionKeyRef.current = null;
      return;
    }

    const resolutionKey = `${currentAccountId}:${currentProfileId}`;
    if (lastCanonicalResolutionKeyRef.current === resolutionKey) {
      return;
    }

    lastCanonicalResolutionKeyRef.current = resolutionKey;
    let cancelled = false;

    void (async () => {
      try {
        const canonicalProfile = await getStorefrontBackendCanonicalProfile();
        if (
          cancelled ||
          !canonicalProfile ||
          canonicalProfile.accountId !== currentAccountId ||
          canonicalProfile.id === currentProfileId
        ) {
          return;
        }

        const nextProfile: AppProfile = {
          ...canonicalProfile,
          kind: 'authenticated',
          accountId: currentAccountId,
          displayName: getPreferredDisplayName(authSession, canonicalProfile.displayName),
        };

        setAppProfile((current) => (areProfilesEquivalent(current, nextProfile) ? current : nextProfile));
        setProfileId((current) => (current === nextProfile.id ? current : nextProfile.id));
        await saveAppProfile(nextProfile);
      } catch {
        // Canonical profile lookup is best-effort. Keep the current profile when unavailable.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    appProfile?.id,
    authSession,
    areProfilesEquivalent,
    getPreferredDisplayName,
  ]);

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

      const nextProfile = await ensureAppProfile();
      if (!alive) {
        return;
      }

      setAppProfile(nextProfile);
      if (nextProfile.id !== profileId) {
        setProfileId(nextProfile.id);
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
    signOutSession,
    updateDisplayName,
    clearDisplayName,
  };
}
