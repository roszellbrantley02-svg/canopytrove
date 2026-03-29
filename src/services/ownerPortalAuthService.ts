import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { trackAnalyticsEvent } from './analyticsService';
import {
  sendCanopyTrovePasswordReset,
  signInCanopyTroveEmailPassword,
  signUpCanopyTroveEmailPassword,
} from './canopyTroveAuthService';
import {
  OwnerPortalSignUpInput,
  OwnerProfileDocument,
  OwnerUserDocument,
} from '../types/ownerPortal';
import {
  assertOwnerPortalEmailAllowed,
  createDefaultOwnerProfileDocument,
  createDefaultUserDocument,
  createNow,
  getOwnerPortalDb,
  OWNER_PROFILES_COLLECTION,
  USERS_COLLECTION,
} from './ownerPortalShared';

async function upsertOwnerUserDocument(userDocument: OwnerUserDocument) {
  const db = getOwnerPortalDb();
  const userRef = doc(db, USERS_COLLECTION, userDocument.uid);
  await setDoc(
    userRef,
    {
      ...userDocument,
      updatedAt: userDocument.lastLoginAt,
    },
    { merge: true }
  );
}

async function upsertOwnerProfileDocument(ownerProfile: OwnerProfileDocument) {
  const db = getOwnerPortalDb();
  const ownerProfileRef = doc(db, OWNER_PROFILES_COLLECTION, ownerProfile.uid);
  await setDoc(ownerProfileRef, ownerProfile, { merge: true });
}

export async function signUpOwnerPortalAccount(input: OwnerPortalSignUpInput) {
  const normalizedEmail = input.email.trim().toLowerCase();
  trackAnalyticsEvent('signup_started', {
    role: 'owner',
    source: 'owner_portal',
  });

  assertOwnerPortalEmailAllowed(normalizedEmail);

  const authSession = await signUpCanopyTroveEmailPassword(
    normalizedEmail,
    input.password,
    input.displayName
  );
  if (!authSession?.uid) {
    throw new Error('Unable to create owner account.');
  }

  const userDocument = createDefaultUserDocument(
    authSession.uid,
    normalizedEmail,
    input.displayName.trim()
  );
  const ownerProfile = createDefaultOwnerProfileDocument(authSession.uid, input);

  await upsertOwnerUserDocument(userDocument);
  await upsertOwnerProfileDocument(ownerProfile);

  trackAnalyticsEvent('signup_completed', {
    role: 'owner',
    source: 'owner_portal',
  });

  return {
    authSession,
    userDocument,
    ownerProfile,
  };
}

export async function signInOwnerPortalAccount(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  assertOwnerPortalEmailAllowed(normalizedEmail);

  const authSession = await signInCanopyTroveEmailPassword(normalizedEmail, password);
  if (!authSession?.uid) {
    throw new Error('Unable to sign in.');
  }

  trackAnalyticsEvent('signin', {
    role: 'owner',
    source: 'owner_portal',
  });

  const db = getOwnerPortalDb();
  const userRef = doc(db, USERS_COLLECTION, authSession.uid);
  const userSnapshot = await getDoc(userRef);
  if (!userSnapshot.exists()) {
    await upsertOwnerUserDocument(
      createDefaultUserDocument(
        authSession.uid,
        normalizedEmail,
        authSession.displayName ?? ''
      )
    );
  } else {
    await updateDoc(userRef, {
      lastLoginAt: createNow(),
    });
  }

  return authSession;
}

export async function sendOwnerPortalPasswordReset(email: string) {
  await sendCanopyTrovePasswordReset(email);
  trackAnalyticsEvent('password_reset_requested', {
    role: 'owner',
    source: 'owner_portal',
  });
}
