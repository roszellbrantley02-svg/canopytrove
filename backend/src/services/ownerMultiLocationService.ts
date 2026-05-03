/**
 * Owner Multi-Location Service
 *
 * Manages additional storefront locations for paid-tier owners.
 *
 * Data model:
 *   - ownerProfile.dispensaryId  → primary location (unchanged)
 *   - ownerProfile.additionalLocationIds → string[] of extra storefront IDs
 *   - dispensaries/{storefrontId}.ownerUid → links storefront back to owner
 *
 * Constraints:
 *   - Requires Verified+ tier (any paid plan)
 *   - $99.99/month per additional location, billed as a quantity-based
 *     seat on the owner's Stripe subscription via
 *     syncAdditionalLocationBilling. Bills pro-rate the partial period.
 *   - Primary location cannot be removed (only transferred)
 *   - Additional locations need admin-approved claims like the primary
 *
 * Add-flow billing safety:
 *   - We write Firestore first, then sync Stripe. If the Stripe sync fails
 *     (and the failure is something other than the owner not having a
 *     Stripe sub), we roll back the Firestore write so the owner is never
 *     left with an unbilled extra location.
 *
 * Remove-flow billing safety:
 *   - We write Firestore first, then sync Stripe. If Stripe sync fails on
 *     remove, we DO NOT roll back the Firestore write — the owner asked
 *     to escape billing for that location and we must honor it. The
 *     Stripe sync failure is logged loudly for admin reconciliation.
 */

import { getBackendFirebaseDb } from '../firebase';
import { logger } from '../observability/logger';
import { resolveOwnerTier, getTierLimits, TierAccessError } from './ownerTierGatingService';
import { syncAdditionalLocationBilling } from './ownerBillingService';
import { getOwnerProfile } from './ownerPortalWorkspaceData';
import { backendStorefrontSource } from '../sources';
import type { OwnerSubscriptionTier } from './ownerTierGatingService';

const OWNER_PROFILES_COLLECTION = 'ownerProfiles';
const DISPENSARIES_COLLECTION = 'dispensaries';
const DISPENSARY_CLAIMS_COLLECTION = 'dispensaryClaims';

export type OwnerLocationSummary = {
  storefrontId: string;
  displayName: string;
  addressLine1: string;
  city: string;
  state: string;
  isPrimary: boolean;
};

export type OwnerMultiLocationState = {
  ownerUid: string;
  tier: OwnerSubscriptionTier;
  primaryLocationId: string | null;
  additionalLocationIds: string[];
  allLocationIds: string[];
  locations: OwnerLocationSummary[];
  canAddLocations: boolean;
};

/**
 * Returns all locations managed by this owner.
 */
export async function getOwnerLocations(ownerUid: string): Promise<OwnerMultiLocationState> {
  const [ownerProfile, tier] = await Promise.all([
    getOwnerProfile(ownerUid),
    resolveOwnerTier(ownerUid),
  ]);

  const tierLimits = getTierLimits(tier);
  const primaryLocationId = ownerProfile?.dispensaryId ?? null;
  const additionalLocationIds = ownerProfile?.additionalLocationIds ?? [];
  const allLocationIds = [
    ...(primaryLocationId ? [primaryLocationId] : []),
    ...additionalLocationIds,
  ];

  // Fetch storefront summaries for all locations
  const locations: OwnerLocationSummary[] = [];
  if (allLocationIds.length > 0) {
    const summaries = await backendStorefrontSource.getSummariesByIds(allLocationIds);
    for (const id of allLocationIds) {
      const summary = summaries.find((s) => s.id === id);
      locations.push({
        storefrontId: id,
        displayName: summary?.displayName ?? id,
        addressLine1: summary?.addressLine1 ?? '',
        city: summary?.city ?? '',
        state: summary?.state ?? '',
        isPrimary: id === primaryLocationId,
      });
    }
  }

  return {
    ownerUid,
    tier,
    primaryLocationId,
    additionalLocationIds,
    allLocationIds,
    locations,
    canAddLocations: tierLimits.multiLocationEnabled,
  };
}

/**
 * Validates that the owner has access to a specific storefront.
 * Returns the storefront ID or throws.
 */
export async function assertOwnerOwnsLocation(
  ownerUid: string,
  storefrontId: string,
): Promise<void> {
  const ownerProfile = await getOwnerProfile(ownerUid);
  if (!ownerProfile) {
    throw new Error('Owner profile not found.');
  }

  const primaryId = ownerProfile.dispensaryId;
  const additionalIds = ownerProfile.additionalLocationIds ?? [];

  if (storefrontId !== primaryId && !additionalIds.includes(storefrontId)) {
    throw new Error('You do not manage this storefront location.');
  }
}

/**
 * Add an additional location for a Pro-tier owner.
 * The storefront must have an approved claim for this owner.
 */
export async function addOwnerLocation(
  ownerUid: string,
  storefrontId: string,
): Promise<OwnerMultiLocationState> {
  const db = getBackendFirebaseDb();
  if (!db) {
    throw new Error('Database not available.');
  }

  // 1. Enforce paid-tier (any tier above free unlocks multi-location now
  //    that per-location billing is metered separately at $99.99/mo).
  const tier = await resolveOwnerTier(ownerUid);
  const tierLimits = getTierLimits(tier);
  if (!tierLimits.multiLocationEnabled) {
    throw new TierAccessError(
      'Adding additional locations requires an active subscription. Upgrade to Verified ($49/mo) or higher — each extra location is then $99.99/mo on top of your base plan.',
      'verified',
      tier,
    );
  }

  // 2. Load owner profile
  const ownerProfile = await getOwnerProfile(ownerUid);
  if (!ownerProfile) {
    throw new Error('Owner profile not found.');
  }
  if (!ownerProfile.dispensaryId) {
    throw new Error('You must have a primary location before adding additional locations.');
  }

  // 3. Validate not a duplicate
  const currentAdditional = ownerProfile.additionalLocationIds ?? [];
  if (storefrontId === ownerProfile.dispensaryId) {
    throw new Error('This is already your primary location.');
  }
  if (currentAdditional.includes(storefrontId)) {
    throw new Error('This location is already added to your account.');
  }

  // 4. Verify this storefront has an approved claim for this owner
  const claimId = `${ownerUid}_${storefrontId}`;
  const claimDoc = await db.collection(DISPENSARY_CLAIMS_COLLECTION).doc(claimId).get();
  if (!claimDoc.exists || claimDoc.data()?.claimStatus !== 'approved') {
    throw new Error(
      'This storefront must have an approved claim before it can be added. Submit a claim first.',
    );
  }

  // 5. Add the location
  const updatedAdditional = [...currentAdditional, storefrontId];
  const now = new Date().toISOString();

  await Promise.all([
    // Update owner profile
    db.collection(OWNER_PROFILES_COLLECTION).doc(ownerUid).set(
      {
        additionalLocationIds: updatedAdditional,
        updatedAt: now,
      },
      { merge: true },
    ),
    // Mark the dispensary as owned
    db.collection(DISPENSARIES_COLLECTION).doc(storefrontId).set(
      {
        ownerUid,
        claimStatus: 'approved',
        ownerClaimReviewedAt: now,
        isAdditionalLocation: true,
      },
      { merge: true },
    ),
  ]);

  // 6. Sync billing — bump the per-extra-location seat quantity on the
  //    owner's Stripe subscription. Hard-fail with rollback so the owner
  //    is never left with an unbilled extra location.
  const billingResult = await syncAdditionalLocationBilling({
    ownerUid,
    targetCount: updatedAdditional.length,
  });

  // The 'no_subscription' / 'not_stripe' / 'not_active' / 'not_configured'
  // outcomes are EXPECTED for free-tier owners (shouldn't get this far
  // because of the tier gate above), Apple-IAP owners, and dev environments
  // without Stripe configured. We log + proceed — the location is added,
  // billing reconciliation happens out-of-band when the owner upgrades or
  // we manually back-fill. Hard-failing on these would lock out legitimate
  // dev/test flows. The 'stripe_error' branch IS a real failure and rolls
  // back.
  if (!billingResult.ok && billingResult.reason === 'stripe_error') {
    logger.error('[ownerMultiLocation] Billing sync failed — rolling back location add', {
      ownerUid,
      storefrontId,
      billingError: billingResult.message,
    });

    // Roll back both Firestore writes. Best-effort; if the rollback itself
    // fails we log loudly because the owner now has an inconsistent state.
    try {
      await Promise.all([
        db.collection(OWNER_PROFILES_COLLECTION).doc(ownerUid).set(
          {
            additionalLocationIds: currentAdditional,
            updatedAt: new Date().toISOString(),
          },
          { merge: true },
        ),
        db.collection(DISPENSARIES_COLLECTION).doc(storefrontId).set(
          {
            ownerUid: null,
            claimStatus: null,
            isAdditionalLocation: null,
          },
          { merge: true },
        ),
      ]);
    } catch (rollbackError) {
      logger.error(
        '[ownerMultiLocation] CRITICAL: rollback after billing failure also failed — owner state is inconsistent',
        {
          ownerUid,
          storefrontId,
          rollbackError:
            rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
        },
      );
    }

    throw new Error(
      `Could not add this location because billing could not be updated: ${billingResult.message}. Try again, or contact support if the problem persists.`,
    );
  }

  return getOwnerLocations(ownerUid);
}

/**
 * Remove an additional location. Cannot remove the primary.
 */
export async function removeOwnerLocation(
  ownerUid: string,
  storefrontId: string,
): Promise<OwnerMultiLocationState> {
  const db = getBackendFirebaseDb();
  if (!db) {
    throw new Error('Database not available.');
  }

  const ownerProfile = await getOwnerProfile(ownerUid);
  if (!ownerProfile) {
    throw new Error('Owner profile not found.');
  }

  if (storefrontId === ownerProfile.dispensaryId) {
    throw new Error('Cannot remove your primary location. Transfer it first or contact support.');
  }

  const currentAdditional = ownerProfile.additionalLocationIds ?? [];
  if (!currentAdditional.includes(storefrontId)) {
    throw new Error('This location is not in your additional locations.');
  }

  const updatedAdditional = currentAdditional.filter((id) => id !== storefrontId);
  const now = new Date().toISOString();

  await Promise.all([
    db.collection(OWNER_PROFILES_COLLECTION).doc(ownerUid).set(
      {
        additionalLocationIds: updatedAdditional,
        updatedAt: now,
      },
      { merge: true },
    ),
    // Remove ownerUid from the dispensary doc
    db.collection(DISPENSARIES_COLLECTION).doc(storefrontId).set(
      {
        ownerUid: null,
        claimStatus: null,
        isAdditionalLocation: null,
      },
      { merge: true },
    ),
  ]);

  // Sync billing — decrement the per-extra-location seat quantity. Best-effort
  // by design: if Stripe sync fails, we still complete the removal because the
  // owner asked to escape billing for that location and we must honor it.
  // The Stripe sync error is logged loudly so admin can manually reconcile
  // (worst case: owner keeps being billed for one extra location until next
  // billing cycle when reconciliation catches up).
  const billingResult = await syncAdditionalLocationBilling({
    ownerUid,
    targetCount: updatedAdditional.length,
  });
  if (!billingResult.ok && billingResult.reason === 'stripe_error') {
    logger.error(
      '[ownerMultiLocation] Billing sync failed on remove — owner may be over-billed until reconciliation',
      {
        ownerUid,
        storefrontId,
        targetCount: updatedAdditional.length,
        billingError: billingResult.message,
      },
    );
  }

  return getOwnerLocations(ownerUid);
}

/**
 * Check if a given locationId is valid for this owner (primary or additional).
 * Returns the resolved storefrontId (falls back to primary).
 */
export async function resolveOwnerActiveLocation(
  ownerUid: string,
  requestedLocationId: string | null | undefined,
): Promise<string | null> {
  const ownerProfile = await getOwnerProfile(ownerUid);
  if (!ownerProfile) {
    return null;
  }

  const primaryId = ownerProfile.dispensaryId;
  if (!requestedLocationId || requestedLocationId === primaryId) {
    return primaryId;
  }

  const additionalIds = ownerProfile.additionalLocationIds ?? [];
  if (additionalIds.includes(requestedLocationId)) {
    return requestedLocationId;
  }

  // Requested ID not found — fall back to primary
  return primaryId;
}
