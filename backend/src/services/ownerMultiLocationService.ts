/**
 * Owner Multi-Location Service
 *
 * Manages additional storefront locations for Pro-tier owners.
 *
 * Data model:
 *   - ownerProfile.dispensaryId  → primary location (unchanged)
 *   - ownerProfile.additionalLocationIds → string[] of extra storefront IDs
 *   - dispensaries/{storefrontId}.ownerUid → links storefront back to owner
 *
 * Constraints:
 *   - Requires Pro tier
 *   - $99/month per additional location (tracked via Stripe quantity)
 *   - Primary location cannot be removed (only transferred)
 *   - Additional locations need admin-approved claims like the primary
 */

import { getBackendFirebaseDb } from '../firebase';
import { resolveOwnerTier, getTierLimits, TierAccessError } from './ownerTierGatingService';
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

  // 1. Enforce Pro tier
  const tier = await resolveOwnerTier(ownerUid);
  const tierLimits = getTierLimits(tier);
  if (!tierLimits.multiLocationEnabled) {
    throw new TierAccessError(
      'Multi-location management requires the Pro plan ($249.99/mo launch pricing — regular $499.99/mo). Upgrade to unlock this feature.',
      'pro',
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
