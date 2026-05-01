import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { OwnerDispensaryClaimDocument } from '../types/ownerPortal';
import type { StorefrontSummary } from '../types/storefront';
import {
  createNow,
  createOwnerDispensaryClaimId,
  DISPENSARY_CLAIMS_COLLECTION,
  getOwnerPortalDb,
} from './ownerPortalShared';
import { ensureOwnerPortalSessionReady } from './ownerPortalSessionService';
import { notifyShopOfPendingClaim } from './ownerPortalShopVerificationService';

export async function getOwnerDispensaryClaim(ownerUid: string, dispensaryId: string) {
  await ensureOwnerPortalSessionReady();
  const db = getOwnerPortalDb();
  const claimRef = doc(
    db,
    DISPENSARY_CLAIMS_COLLECTION,
    createOwnerDispensaryClaimId(ownerUid, dispensaryId),
  );
  const snapshot = await getDoc(claimRef);
  if (!snapshot.exists()) {
    return null;
  }

  return snapshot.data() as OwnerDispensaryClaimDocument;
}

export async function submitOwnerDispensaryClaim(
  ownerUid: string,
  storefront: Pick<StorefrontSummary, 'id' | 'displayName'>,
) {
  await ensureOwnerPortalSessionReady();
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
    createOwnerDispensaryClaimId(ownerUid, storefront.id),
  );
  await setDoc(claimRef, claimDocument, { merge: true });

  // Out-of-band alert to the shop's published phone — fires regardless of
  // whether the owner completes Layer 2 verification themselves. The
  // legitimate operator gets warned even when the claimant can't access
  // the shop phone line. Fail-soft (notifyShopOfPendingClaim swallows
  // errors) so a failed alert never blocks claim creation.
  void notifyShopOfPendingClaim(storefront.id);

  return claimDocument;
}
