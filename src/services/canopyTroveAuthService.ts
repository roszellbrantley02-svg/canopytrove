import type { User } from 'firebase/auth';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  getIdToken,
  getIdTokenResult,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { getFirebaseAuth, hasFirebaseConfig } from '../config/firebase';
import type { CanopyTroveAuthSession } from '../types/identity';

export type CanopyTroveAuthDeletionResult = {
  ok: boolean;
  reason: 'no-user' | 'requires-recent-login' | 'unknown' | null;
  message: string | null;
};

export const CANOPY_TROVE_RECENT_LOGIN_MAX_AGE_SECONDS = 5 * 60;

function createDisabledSession(): CanopyTroveAuthSession {
  return {
    status: 'disabled',
    uid: null,
    isAnonymous: false,
    displayName: null,
    email: null,
  };
}

function mapAuthUser(user: User | null): CanopyTroveAuthSession {
  if (!user) {
    return hasFirebaseConfig
      ? {
          status: 'signed-out',
          uid: null,
          isAnonymous: false,
          displayName: null,
          email: null,
        }
      : createDisabledSession();
  }

  return {
    status: user.isAnonymous ? 'anonymous' : 'authenticated',
    uid: user.uid,
    isAnonymous: user.isAnonymous,
    displayName: user.displayName ?? null,
    email: user.email ?? null,
  };
}

export function getInitialCanopyTroveAuthSession(): CanopyTroveAuthSession {
  return hasFirebaseConfig
    ? {
        status: 'checking',
        uid: null,
        isAnonymous: false,
        displayName: null,
        email: null,
      }
    : createDisabledSession();
}

export function getCanopyTroveAuthCacheKey() {
  const auth = getFirebaseAuth();
  if (!auth) {
    return 'disabled';
  }

  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.isAnonymous) {
    return 'signed-out';
  }

  return `authenticated:${currentUser.uid}`;
}

export function subscribeToCanopyTroveAuthSession(
  listener: (session: CanopyTroveAuthSession) => void,
) {
  const auth = getFirebaseAuth();
  if (!auth) {
    listener(createDisabledSession());
    return () => undefined;
  }

  listener(mapAuthUser(auth.currentUser));
  return onAuthStateChanged(auth, (user) => {
    listener(mapAuthUser(user));
  });
}

export async function startCanopyTroveGuestSession() {
  const auth = getFirebaseAuth();
  if (!auth) {
    return null;
  }

  if (auth.currentUser) {
    return mapAuthUser(auth.currentUser);
  }

  const credential = await signInAnonymously(auth);
  return mapAuthUser(credential.user);
}

export async function signOutCanopyTroveSession() {
  const auth = getFirebaseAuth();
  if (!auth || !auth.currentUser) {
    return false;
  }

  await signOut(auth);
  return true;
}

export async function getCanopyTroveAuthIdToken(options?: {
  failIfAuthenticatedSession?: boolean;
}) {
  const auth = getFirebaseAuth();
  if (!auth?.currentUser || auth.currentUser.isAnonymous) {
    return null;
  }

  try {
    return await getIdToken(auth.currentUser);
  } catch (tokenError) {
    if (__DEV__) {
      console.warn(
        '[canopyTroveAuth] Token refresh failed, retrying with force refresh',
        tokenError,
      );
    }
    try {
      return await getIdToken(auth.currentUser, true);
    } catch (retryError) {
      if (__DEV__) {
        console.warn('[canopyTroveAuth] Force token refresh also failed', retryError);
      }
      if (options?.failIfAuthenticatedSession) {
        throw new Error('Could not refresh the signed-in Canopy Trove session.');
      }

      return null;
    }
  }
}

export async function getCanopyTroveAuthIdTokenResult(options?: { forceRefresh?: boolean }) {
  const auth = getFirebaseAuth();
  if (!auth?.currentUser || auth.currentUser.isAnonymous) {
    return null;
  }

  try {
    return await getIdTokenResult(auth.currentUser, options?.forceRefresh ?? false);
  } catch {
    return null;
  }
}

export async function getCanopyTroveAuthSessionAgeSeconds(nowMs = Date.now()) {
  const tokenResult = await getCanopyTroveAuthIdTokenResult({ forceRefresh: true });
  if (!tokenResult) {
    return null;
  }

  const authTimeMs = Date.parse(tokenResult.authTime);
  if (!Number.isFinite(authTimeMs)) {
    return null;
  }

  return Math.max(0, Math.floor((nowMs - authTimeMs) / 1000));
}

export async function hasRecentCanopyTroveAuthSession(
  maxAgeSeconds = CANOPY_TROVE_RECENT_LOGIN_MAX_AGE_SECONDS,
) {
  const sessionAgeSeconds = await getCanopyTroveAuthSessionAgeSeconds();
  return sessionAgeSeconds !== null && sessionAgeSeconds <= maxAgeSeconds;
}

function getCanopyTroveSessionRole(claims: Record<string, unknown> | undefined) {
  if (claims?.admin === true || claims?.role === 'admin') {
    return 'admin';
  }

  if (claims?.role === 'owner') {
    return 'owner';
  }

  return 'member';
}

export async function getCanopyTroveStorefrontReadIdToken() {
  const tokenResult = await getCanopyTroveAuthIdTokenResult();
  if (!tokenResult) {
    return null;
  }

  // Owner/admin sessions should browse public storefront content as guests.
  // That keeps discovery reads on the same safe path instead of opting owners
  // into member-view enhancements and member-only deal visibility.
  const sessionRole = getCanopyTroveSessionRole(tokenResult.claims);
  if (sessionRole === 'owner' || sessionRole === 'admin') {
    return null;
  }

  return tokenResult.token;
}

export async function signInCanopyTroveEmailPassword(email: string, password: string) {
  const auth = getFirebaseAuth();
  if (!auth) {
    return null;
  }

  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  return mapAuthUser(credential.user);
}

export async function signUpCanopyTroveEmailPassword(
  email: string,
  password: string,
  displayName?: string | null,
) {
  const auth = getFirebaseAuth();
  if (!auth) {
    return null;
  }

  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const normalizedDisplayName = displayName?.trim() || null;
  if (normalizedDisplayName) {
    try {
      await updateProfile(credential.user, {
        displayName: normalizedDisplayName,
      });
    } catch {
      // Account was created but display name failed to set.
      // Continue with sign-up — the name can be updated later.
    }
  }

  return mapAuthUser(credential.user);
}

export async function sendCanopyTrovePasswordReset(email: string) {
  const auth = getFirebaseAuth();
  if (!auth) {
    return false;
  }

  await sendPasswordResetEmail(auth, email.trim());
  return true;
}

export async function deleteCanopyTroveAuthAccount() {
  const auth = getFirebaseAuth();
  if (!auth?.currentUser) {
    return {
      ok: false,
      reason: 'no-user',
      message: 'No signed-in account is available to delete.',
    } satisfies CanopyTroveAuthDeletionResult;
  }

  try {
    await deleteUser(auth.currentUser);
    return {
      ok: true,
      reason: null,
      message: null,
    } satisfies CanopyTroveAuthDeletionResult;
  } catch (error) {
    const code =
      typeof error === 'object' && error && 'code' in error
        ? String((error as { code?: unknown }).code)
        : '';

    if (code.includes('requires-recent-login')) {
      return {
        ok: false,
        reason: 'requires-recent-login',
        message: 'Sign in again, then retry account deletion to finish removing the login itself.',
      } satisfies CanopyTroveAuthDeletionResult;
    }

    return {
      ok: false,
      reason: 'unknown',
      message: 'Could not remove the account login right now.',
    } satisfies CanopyTroveAuthDeletionResult;
  }
}
