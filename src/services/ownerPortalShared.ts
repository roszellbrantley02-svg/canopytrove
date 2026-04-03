import { getFirebaseDb } from '../config/firebase';
import { ownerPortalPrelaunchEnabled } from '../config/ownerPortalConfig';
import type {
  OwnerPortalAccessState,
  OwnerPortalSignUpInput,
  OwnerProfileDocument,
} from '../types/ownerPortal';

export const USERS_COLLECTION = 'users';
export const OWNER_PROFILES_COLLECTION = 'ownerProfiles';
export const DISPENSARY_CLAIMS_COLLECTION = 'dispensaryClaims';

export function getOwnerPortalDb() {
  const db = getFirebaseDb();
  if (!db) {
    throw new Error('Firebase is not configured.');
  }

  return db;
}

export function createNow() {
  return new Date().toISOString();
}

export function createDefaultOwnerProfileDocument(
  uid: string,
  input: Pick<OwnerPortalSignUpInput, 'legalName' | 'companyName'>,
): OwnerProfileDocument {
  const now = createNow();
  return {
    uid,
    legalName: input.legalName.trim(),
    phone: null,
    companyName: input.companyName.trim(),
    identityVerificationStatus: 'unverified',
    businessVerificationStatus: 'unverified',
    dispensaryId: null,
    onboardingStep: 'business_details',
    subscriptionStatus: 'inactive',
    badgeLevel: 0,
    earnedBadgeIds: [],
    selectedBadgeIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function getOwnerPortalAccessState(input?: {
  claimRole?: 'owner' | 'admin' | null;
}): OwnerPortalAccessState {
  const enabled = ownerPortalPrelaunchEnabled;
  const allowlisted = !enabled || input?.claimRole === 'owner' || input?.claimRole === 'admin';

  return {
    enabled,
    restricted: enabled,
    allowlisted,
  };
}

export function createOwnerDispensaryClaimId(ownerUid: string, dispensaryId: string) {
  return `${ownerUid}_${dispensaryId}`;
}
