import { getFirebaseDb } from '../config/firebase';
import { isOwnerPortalEmailAllowlisted, ownerPortalPrelaunchEnabled } from '../config/ownerPortalConfig';
import {
  OwnerPortalAccessState,
  OwnerPortalSignUpInput,
  OwnerProfileDocument,
  OwnerUserDocument,
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

export function createDefaultUserDocument(
  uid: string,
  email: string,
  displayName: string
): OwnerUserDocument {
  const now = createNow();
  return {
    uid,
    email,
    role: 'owner',
    displayName: displayName || null,
    createdAt: now,
    lastLoginAt: now,
    accountStatus: 'active',
  };
}

export function createDefaultOwnerProfileDocument(
  uid: string,
  input: Pick<OwnerPortalSignUpInput, 'legalName' | 'companyName'>
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

export function getOwnerPortalAccessState(email: string | null): OwnerPortalAccessState {
  const enabled = ownerPortalPrelaunchEnabled;
  const allowlisted = isOwnerPortalEmailAllowlisted(email);

  return {
    enabled,
    restricted: enabled,
    allowlisted: enabled && allowlisted,
  };
}

export function assertOwnerPortalEmailAllowed(email: string) {
  if (ownerPortalPrelaunchEnabled && !isOwnerPortalEmailAllowlisted(email)) {
    throw new Error('This email is not allowed to access the prelaunch owner portal.');
  }
}

export function createOwnerDispensaryClaimId(ownerUid: string, dispensaryId: string) {
  return `${ownerUid}_${dispensaryId}`;
}
