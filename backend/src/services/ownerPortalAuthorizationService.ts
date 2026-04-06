import { getBackendFirebaseDb } from '../firebase';
import { OwnerClaimRecord, OwnerProfileRecord } from './ownerPortalWorkspaceCollections';
import { getOwnerProfile } from './ownerPortalWorkspaceData';

type OwnerVerificationRecord = {
  ownerUid: string;
  dispensaryId?: string | null;
  verificationStatus?: string | null;
};

type OwnerSubscriptionRecord = {
  ownerUid: string;
  dispensaryId?: string | null;
  status?: string | null;
};

type CanonicalStorefrontRecord = {
  storefrontId: string;
  ownerUid: string;
};

export type OwnerAuthorizationState = {
  ownerUid: string;
  ownerProfile: OwnerProfileRecord | null;
  storefrontId: string | null;
  ownerClaim: OwnerClaimRecord | null;
  businessVerificationStatus: string | null;
  identityVerificationStatus: string | null;
  subscription: OwnerSubscriptionRecord | null;
  hasVerifiedBusiness: boolean;
  hasVerifiedIdentity: boolean;
  hasActiveSubscription: boolean;
};

const BUSINESS_VERIFICATIONS_COLLECTION = 'businessVerifications';
const DISPENSARIES_COLLECTION = 'dispensaries';
const DISPENSARY_CLAIMS_COLLECTION = 'dispensaryClaims';
const IDENTITY_VERIFICATIONS_COLLECTION = 'identityVerifications';
const SUBSCRIPTIONS_COLLECTION = 'subscriptions';

function normalizeStatus(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function isVerifiedOwnerStatus(value: unknown) {
  const normalizedValue = normalizeStatus(value);
  return normalizedValue === 'verified' || normalizedValue === 'approved';
}

export function isActiveOwnerSubscriptionStatus(value: unknown) {
  const normalizedValue = normalizeStatus(value);
  return normalizedValue === 'trial' || normalizedValue === 'active';
}

async function getCanonicalStorefrontRecord(ownerUid: string) {
  const db = getBackendFirebaseDb();
  if (!db) {
    return null;
  }

  const snapshot = await db
    .collection(DISPENSARIES_COLLECTION)
    .where('ownerUid', '==', ownerUid)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  return {
    storefrontId: snapshot.docs[0]!.id,
    ownerUid,
  } satisfies CanonicalStorefrontRecord;
}

async function getLatestOwnerClaimRecord(ownerUid: string, storefrontId: string | null) {
  const db = getBackendFirebaseDb();
  if (!db) {
    return null;
  }

  if (storefrontId) {
    const canonicalClaimId = `${ownerUid}_${storefrontId}`;
    const canonicalClaimSnapshot = await db
      .collection(DISPENSARY_CLAIMS_COLLECTION)
      .doc(canonicalClaimId)
      .get();
    if (canonicalClaimSnapshot.exists) {
      return canonicalClaimSnapshot.data() as OwnerClaimRecord;
    }
  }

  const snapshot = await db
    .collection(DISPENSARY_CLAIMS_COLLECTION)
    .where('ownerUid', '==', ownerUid)
    .limit(10)
    .get();

  if (snapshot.empty) {
    return null;
  }

  return snapshot.docs
    .map((documentSnapshot) => documentSnapshot.data() as OwnerClaimRecord)
    .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt))[0]!;
}

async function getOwnerVerificationRecord(collectionName: string, ownerUid: string) {
  const db = getBackendFirebaseDb();
  if (!db) {
    return null;
  }

  const snapshot = await db.collection(collectionName).doc(ownerUid).get();
  if (!snapshot.exists) {
    return null;
  }

  return snapshot.data() as OwnerVerificationRecord;
}

async function getOwnerSubscriptionRecord(ownerUid: string) {
  const db = getBackendFirebaseDb();
  if (!db) {
    return null;
  }

  const snapshot = await db.collection(SUBSCRIPTIONS_COLLECTION).doc(ownerUid).get();
  if (!snapshot.exists) {
    return null;
  }

  return snapshot.data() as OwnerSubscriptionRecord;
}

export async function getCanonicalOwnerUidForStorefront(storefrontId: string) {
  const db = getBackendFirebaseDb();
  if (!db) {
    return null;
  }

  const snapshot = await db.collection(DISPENSARIES_COLLECTION).doc(storefrontId).get();
  if (!snapshot.exists) {
    return null;
  }

  const ownerUid = snapshot.data()?.ownerUid;
  return typeof ownerUid === 'string' && ownerUid.trim() ? ownerUid.trim() : null;
}

export async function getOwnerAuthorizationState(
  ownerUid: string,
): Promise<OwnerAuthorizationState> {
  const hasBackendDb = Boolean(getBackendFirebaseDb());
  const ownerProfile = await getOwnerProfile(ownerUid);

  const [canonicalStorefront, businessVerification, identityVerification, subscription] =
    await Promise.all([
      getCanonicalStorefrontRecord(ownerUid),
      getOwnerVerificationRecord(BUSINESS_VERIFICATIONS_COLLECTION, ownerUid),
      getOwnerVerificationRecord(IDENTITY_VERIFICATIONS_COLLECTION, ownerUid),
      getOwnerSubscriptionRecord(ownerUid),
    ]);

  const storefrontId = hasBackendDb
    ? (canonicalStorefront?.storefrontId ?? null)
    : (canonicalStorefront?.storefrontId ?? ownerProfile?.dispensaryId ?? null);
  const ownerClaim = await getLatestOwnerClaimRecord(ownerUid, storefrontId);
  const businessVerificationStatus =
    businessVerification?.verificationStatus ?? ownerProfile?.businessVerificationStatus ?? null;
  const identityVerificationStatus =
    identityVerification?.verificationStatus ?? ownerProfile?.identityVerificationStatus ?? null;
  const effectiveSubscription =
    subscription ??
    (!hasBackendDb && ownerProfile?.subscriptionStatus
      ? {
          ownerUid,
          dispensaryId: storefrontId,
          status: ownerProfile.subscriptionStatus,
        }
      : null);
  const hasVerifiedBusiness = isVerifiedOwnerStatus(businessVerificationStatus);
  const hasVerifiedIdentity = isVerifiedOwnerStatus(identityVerificationStatus);
  const hasActiveSubscription =
    Boolean(storefrontId) &&
    isActiveOwnerSubscriptionStatus(effectiveSubscription?.status) &&
    effectiveSubscription?.dispensaryId === storefrontId;

  return {
    ownerUid,
    ownerProfile,
    storefrontId,
    ownerClaim,
    businessVerificationStatus,
    identityVerificationStatus,
    subscription: effectiveSubscription,
    hasVerifiedBusiness,
    hasVerifiedIdentity,
    hasActiveSubscription,
  };
}

export async function assertAuthorizedOwnerStorefront(
  ownerUid: string,
  options?: {
    requireVerified?: boolean;
    requireActiveSubscription?: boolean;
    missingStorefrontMessage?: string;
  },
) {
  const state = await getOwnerAuthorizationState(ownerUid);

  if (!state.storefrontId) {
    throw new Error(options?.missingStorefrontMessage ?? 'Owner storefront is not connected yet.');
  }

  if (options?.requireVerified && (!state.hasVerifiedBusiness || !state.hasVerifiedIdentity)) {
    throw new Error(
      'Business and identity verification must be approved before using this feature.',
    );
  }

  if (options?.requireActiveSubscription && !state.hasActiveSubscription) {
    throw new Error('Activate your owner plan before using this feature.');
  }

  return state;
}
