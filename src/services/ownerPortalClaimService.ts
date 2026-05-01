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

  // Auto-fire the merged voice call to the shop's published phone. ONE
  // call delivers BOTH the verification code (so a legit-claimant owner
  // standing at the shop can verify instantly) AND the alert ("someone
  // is trying to claim your shop, email us if not you"). Fires regardless
  // of whether the owner completes verification themselves — the legit
  // operator gets warned no matter what. Fail-soft (the helper swallows
  // errors and cooldown rejections) so a Twilio hiccup never blocks
  // claim creation. The user can always tap "Send another call" from the
  // verification screen to retry with a typed cooldown error.
  void notifyShopOfPendingClaim(storefront.id);

  return claimDocument;
}
