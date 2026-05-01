/**
 * Lightweight read-only lookups for shop-ownership verification state.
 *
 * Lives in its own file so other services (e.g. phoneVerificationService)
 * can import only the predicate without pulling in the full Twilio call /
 * cooldown / TwiML payload of shopOwnershipVerificationService.ts.
 *
 * Keeps imports cheap and avoids any risk of a circular dependency
 * between phone verification and shop verification.
 */

import { getBackendFirebaseDb } from '../firebase';

const DISPENSARY_CLAIMS_COLLECTION = 'dispensaryClaims';

/**
 * True if the owner has passed shop-ownership verification on ANY of
 * their dispensary claims. Used as an equivalence signal for personal
 * phone verification: if you proved you control a shop's published
 * phone, you've proven you control a real phone, full stop.
 *
 * Fail-closed on errors (returns false) — the caller may fall back to
 * the stricter personal-phone gate.
 */
export async function hasAnyShopOwnershipVerification(ownerUid: string): Promise<boolean> {
  const db = getBackendFirebaseDb();
  if (!db) return false;
  try {
    const snap = await db
      .collection(DISPENSARY_CLAIMS_COLLECTION)
      .where('ownerUid', '==', ownerUid)
      .where('shopOwnershipVerified', '==', true)
      .limit(1)
      .get();
    return !snap.empty;
  } catch {
    return false;
  }
}
