import {
  createUserWithEmailAndPassword,
  deleteUser,
  getIdToken,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  User,
} from 'firebase/auth';
import { getFirebaseAuth, hasFirebaseConfig } from '../config/firebase';
import { CanopyTroveAuthSession } from '../types/identity';

export type CanopyTroveAuthDeletionResult = {
  ok: boolean;
  reason: 'no-user' | 'requires-recent-login' | 'unknown' | null;
  message: string | null;
};

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
  listener: (session: CanopyTroveAuthSession) => void
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

export async function getCanopyTroveAuthIdToken() {
  const auth = getFirebaseAuth();
  if (!auth?.currentUser || auth.currentUser.isAnonymous) {
    return null;
  }

  try {
    return await getIdToken(auth.currentUser);
  } catch {
    return null;
  }
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
  displayName?: string | null
) {
  const auth = getFirebaseAuth();
  if (!auth) {
    return null;
  }

  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const normalizedDisplayName = displayName?.trim() || null;
  if (normalizedDisplayName) {
    await updateProfile(credential.user, {
      displayName: normalizedDisplayName,
    });
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
