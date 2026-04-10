import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { OwnerPortalBusinessDetailsInput, OwnerProfileDocument } from '../types/ownerPortal';
import { createNow, getOwnerPortalDb, OWNER_PROFILES_COLLECTION } from './ownerPortalShared';
import { ensureOwnerPortalSessionReady } from './ownerPortalSessionService';

export async function hasOwnerProfileDocument(uid: string) {
  const db = getOwnerPortalDb();
  const ownerProfileRef = doc(db, OWNER_PROFILES_COLLECTION, uid);
  const snapshot = await getDoc(ownerProfileRef);
  return snapshot.exists();
}

export async function getOwnerProfile(uid: string) {
  await ensureOwnerPortalSessionReady();
  const db = getOwnerPortalDb();
  const ownerProfileRef = doc(db, OWNER_PROFILES_COLLECTION, uid);
  const snapshot = await getDoc(ownerProfileRef);
  if (!snapshot.exists()) {
    return null;
  }

  return snapshot.data() as OwnerProfileDocument;
}

export async function saveOwnerBusinessDetails(
  uid: string,
  input: OwnerPortalBusinessDetailsInput,
) {
  await ensureOwnerPortalSessionReady();
  const db = getOwnerPortalDb();
  const ownerProfileRef = doc(db, OWNER_PROFILES_COLLECTION, uid);
  await setDoc(
    ownerProfileRef,
    {
      legalName: input.legalName.trim(),
      phone: input.phone.trim() || null,
      companyName: input.companyName.trim(),
      onboardingStep: 'claim_listing',
      updatedAt: createNow(),
    },
    { merge: true },
  );
}

export async function saveOwnerSelectedBadgeIds(uid: string, selectedBadgeIds: string[]) {
  await ensureOwnerPortalSessionReady();
  const db = getOwnerPortalDb();
  const ownerProfileRef = doc(db, OWNER_PROFILES_COLLECTION, uid);
  await setDoc(
    ownerProfileRef,
    {
      selectedBadgeIds: [...selectedBadgeIds],
      updatedAt: createNow(),
    },
    { merge: true },
  );
}
