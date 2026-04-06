import { useCallback, useEffect, useState } from 'react';
import type { AppProfile } from '../types/storefront';
import type { CanopyTroveAuthSession } from '../types/identity';
import {
  createAppProfileId,
  ensureAppProfile,
  getCachedAppProfile,
  saveAppProfile,
} from '../services/appProfileService';
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
    const existingDisplayName = appProfile.displayName?.trim() || null;
    const isExistingDisplayNameAnEmail =
      existingDisplayName && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(existingDisplayName);
    const authDisplayName =
      authSession.status === 'authenticated' ? authSession.displayName?.trim() || null : null;
    const authEmail = authSession.status === 'authenticated' ? (authSession.email ?? null) : null;

    let nextDisplayName: string | null;
    if (existingDisplayName && !isExistingDisplayNameAnEmail) {
      // User chose a custom username — always keep it.
      nextDisplayName = existingDisplayName;
    } else if (authDisplayName) {
      // Auth provider has a display name (e.g. from sign-up) — use it.
      nextDisplayName = authDisplayName;
    } else if (authEmail) {
      // No custom username or auth display name — use email as fallback.
      nextDisplayName = authEmail;
    } else {
      nextDisplayName = existingDisplayName;
    }

    const nextProfile: AppProfile = {
      ...appProfile,
      kind: authSession.status === 'authenticated' ? 'authenticated' : 'anonymous',
      accountId:
        authSession.status === 'authenticated' || authSession.status === 'anonymous'
          ? authSession.uid
          : null,
      displayName: nextDisplayName,
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
  }, [appProfile, authSession]);

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
