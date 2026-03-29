import { doc, getDoc, setDoc } from 'firebase/firestore';
import { OwnerPortalBusinessDetailsInput, OwnerProfileDocument } from '../types/ownerPortal';
import {
  createNow,
  getOwnerPortalDb,
  OWNER_PROFILES_COLLECTION,
} from './ownerPortalShared';

export async function getOwnerProfile(uid: string) {
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
  input: OwnerPortalBusinessDetailsInput
) {
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
    { merge: true }
  );
}
