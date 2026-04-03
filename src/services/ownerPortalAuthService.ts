import { doc, setDoc } from 'firebase/firestore';
import { trackAnalyticsEvent } from './analyticsService';
import {
  sendCanopyTrovePasswordReset,
  signInCanopyTroveEmailPassword,
  signUpCanopyTroveEmailPassword,
} from './canopyTroveAuthService';
import type { OwnerPortalSignUpInput, OwnerProfileDocument } from '../types/ownerPortal';
import {
  createDefaultOwnerProfileDocument,
  getOwnerPortalDb,
  OWNER_PROFILES_COLLECTION,
} from './ownerPortalShared';
import { ensureOwnerPortalSessionReady } from './ownerPortalSessionService';
import { sendOwnerWelcomeEmailIfNeeded } from './ownerWelcomeEmailService';
import { reportRuntimeError } from './runtimeReportingService';

async function upsertOwnerProfileDocument(ownerProfile: OwnerProfileDocument) {
  const db = getOwnerPortalDb();
  const ownerProfileRef = doc(db, OWNER_PROFILES_COLLECTION, ownerProfile.uid);
  await setDoc(ownerProfileRef, ownerProfile, { merge: true });
}

async function syncOwnerWelcomeEmail(source: 'signup' | 'signin') {
  try {
    await sendOwnerWelcomeEmailIfNeeded();
  } catch (error) {
    reportRuntimeError(error, {
      source: `owner-welcome-email-${source}`,
    });
  }
}

export async function signUpOwnerPortalAccount(input: OwnerPortalSignUpInput) {
  const normalizedEmail = input.email.trim().toLowerCase();
  trackAnalyticsEvent('signup_started', {
    role: 'owner',
    source: 'owner_portal',
  });

  const authSession = await signUpCanopyTroveEmailPassword(
    normalizedEmail,
    input.password,
    input.displayName,
  );
  if (!authSession?.uid) {
    throw new Error('Unable to create owner account.');
  }

  await ensureOwnerPortalSessionReady();

  const ownerProfile = createDefaultOwnerProfileDocument(authSession.uid, input);
  await upsertOwnerProfileDocument(ownerProfile);
  await syncOwnerWelcomeEmail('signup');

  trackAnalyticsEvent('signup_completed', {
    role: 'owner',
    source: 'owner_portal',
  });

  return {
    authSession,
    ownerProfile,
  };
}

export async function signInOwnerPortalAccount(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const authSession = await signInCanopyTroveEmailPassword(normalizedEmail, password);
  if (!authSession?.uid) {
    throw new Error('Unable to sign in.');
  }

  trackAnalyticsEvent('signin', {
    role: 'owner',
    source: 'owner_portal',
  });

  await ensureOwnerPortalSessionReady();
  await syncOwnerWelcomeEmail('signin');

  return authSession;
}

export async function sendOwnerPortalPasswordReset(email: string) {
  await sendCanopyTrovePasswordReset(email);
  trackAnalyticsEvent('password_reset_requested', {
    role: 'owner',
    source: 'owner_portal',
  });
}
