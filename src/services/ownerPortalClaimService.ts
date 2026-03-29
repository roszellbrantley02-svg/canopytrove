import { doc, getDoc, setDoc } from 'firebase/firestore';
import { OwnerDispensaryClaimDocument } from '../types/ownerPortal';
import { StorefrontSummary } from '../types/storefront';
import {
  createNow,
  createOwnerDispensaryClaimId,
  DISPENSARY_CLAIMS_COLLECTION,
  getOwnerPortalDb,
  OWNER_PROFILES_COLLECTION,
} from './ownerPortalShared';

export async function getOwnerDispensaryClaim(ownerUid: string, dispensaryId: string) {
  const db = getOwnerPortalDb();
  const claimRef = doc(
    db,
    DISPENSARY_CLAIMS_COLLECTION,
    createOwnerDispensaryClaimId(ownerUid, dispensaryId)
  );
  const snapshot = await getDoc(claimRef);
  if (!snapshot.exists()) {
    return null;
  }

  return snapshot.data() as OwnerDispensaryClaimDocument;
}

export async function submitOwnerDispensaryClaim(
  ownerUid: string,
  storefront: Pick<StorefrontSummary, 'id' | 'displayName'>
) {
  const db = getOwnerPortalDb();
  const now = createNow();
  const claimDocument: OwnerDispensaryClaimDocument = {
    ownerUid,
    dispensaryId: storefront.id,
    claimStatus: 'pending',
    submittedAt: now,
    reviewedAt: null,
    reviewNotes: null,
  };

  const claimRef = doc(
    db,
    DISPENSARY_CLAIMS_COLLECTION,
    createOwnerDispensaryClaimId(ownerUid, storefront.id)
  );
  const ownerProfileRef = doc(db, OWNER_PROFILES_COLLECTION, ownerUid);

  await Promise.all([
    setDoc(claimRef, claimDocument, { merge: true }),
    setDoc(
      ownerProfileRef,
      {
        dispensaryId: storefront.id,
        onboardingStep: 'business_verification',
        updatedAt: now,
      },
      { merge: true }
    ),
  ]);

  return claimDocument;
}
