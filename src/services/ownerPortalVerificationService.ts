import { doc, setDoc } from 'firebase/firestore';
import { getFirebaseDb } from '../config/firebase';
import type {
  OwnerPortalBusinessVerificationDocument,
  OwnerPortalIdentityIdType,
  OwnerPortalIdentityVerificationDocument,
  OwnerPortalUploadedFile,
} from '../types/ownerPortal';
import type { StorefrontSummary } from '../types/storefront';
import { uploadOwnerPrivateFile } from './ownerPortalStorageService';
import { ensureOwnerPortalSessionReady } from './ownerPortalSessionService';

const OWNER_PROFILES_COLLECTION = 'ownerProfiles';
const BUSINESS_VERIFICATIONS_COLLECTION = 'businessVerifications';
const IDENTITY_VERIFICATIONS_COLLECTION = 'identityVerifications';

function getOwnerVerificationDb() {
  const db = getFirebaseDb();
  if (!db) {
    throw new Error('Firebase is not configured.');
  }

  return db;
}

function createNow() {
  return new Date().toISOString();
}

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ');
}

function calculateBusinessMatchScore(
  storefront: Pick<
    StorefrontSummary,
    'id' | 'displayName' | 'legalName' | 'licenseId' | 'addressLine1' | 'city' | 'state' | 'zip'
  >,
  input: {
    legalBusinessName: string;
    storefrontName: string;
    licenseNumber: string;
    address: string;
  },
) {
  let score = 0;

  if (normalizeText(input.storefrontName) === normalizeText(storefront.displayName)) {
    score += 0.35;
  }
  if (normalizeText(input.legalBusinessName) === normalizeText(storefront.legalName)) {
    score += 0.2;
  }
  if (normalizeText(input.licenseNumber) === normalizeText(storefront.licenseId)) {
    score += 0.2;
  }

  const storefrontAddress = `${storefront.addressLine1} ${storefront.city} ${storefront.state} ${storefront.zip}`;
  if (normalizeText(input.address) === normalizeText(storefrontAddress)) {
    score += 0.25;
  }

  return Number(Math.min(1, score).toFixed(2));
}

export async function submitBusinessVerification(input: {
  ownerUid: string;
  storefront: Pick<
    StorefrontSummary,
    'id' | 'displayName' | 'legalName' | 'licenseId' | 'addressLine1' | 'city' | 'state' | 'zip'
  >;
  legalBusinessName: string;
  storefrontName: string;
  licenseNumber: string;
  licenseType: string;
  state: string;
  address: string;
  licenseFile: OwnerPortalUploadedFile;
  businessDocFile: OwnerPortalUploadedFile;
}) {
  await ensureOwnerPortalSessionReady();
  const db = getOwnerVerificationDb();
  const submittedAt = createNow();
  const uploadedLicenseFilePath = await uploadOwnerPrivateFile(
    input.ownerUid,
    'business',
    'license',
    input.licenseFile,
  );
  const uploadedBusinessDocPath = await uploadOwnerPrivateFile(
    input.ownerUid,
    'business',
    'registration',
    input.businessDocFile,
  );

  const verificationDocument: OwnerPortalBusinessVerificationDocument = {
    ownerUid: input.ownerUid,
    dispensaryId: input.storefront.id,
    legalBusinessName: input.legalBusinessName.trim(),
    storefrontName: input.storefrontName.trim(),
    licenseNumber: input.licenseNumber.trim(),
    licenseType: input.licenseType.trim(),
    state: input.state.trim(),
    address: input.address.trim(),
    uploadedLicenseFilePath,
    uploadedBusinessDocPath,
    verificationStatus: 'pending',
    verificationSource: 'owner_upload',
    matchedRecord: {
      dispensaryId: input.storefront.id,
      matchScore: calculateBusinessMatchScore(input.storefront, input),
    },
    adminNotes: null,
    submittedAt,
    reviewedAt: null,
  };

  await Promise.all([
    setDoc(doc(db, BUSINESS_VERIFICATIONS_COLLECTION, input.ownerUid), verificationDocument),
    setDoc(
      doc(db, OWNER_PROFILES_COLLECTION, input.ownerUid),
      {
        onboardingStep: 'identity_verification',
        updatedAt: submittedAt,
      },
      { merge: true },
    ),
  ]);

  return verificationDocument;
}

export async function submitIdentityVerification(input: {
  ownerUid: string;
  fullName: string;
  idType: OwnerPortalIdentityIdType;
  frontFile: OwnerPortalUploadedFile;
  backFile: OwnerPortalUploadedFile | null;
  selfieFile: OwnerPortalUploadedFile;
}) {
  await ensureOwnerPortalSessionReady();
  const db = getOwnerVerificationDb();
  const submittedAt = createNow();
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const idDocumentFrontPath = await uploadOwnerPrivateFile(
    input.ownerUid,
    'identity',
    'id-front',
    input.frontFile,
  );
  const idDocumentBackPath = input.backFile
    ? await uploadOwnerPrivateFile(input.ownerUid, 'identity', 'id-back', input.backFile)
    : null;
  const selfiePath = await uploadOwnerPrivateFile(
    input.ownerUid,
    'identity',
    'selfie',
    input.selfieFile,
  );

  const verificationDocument: OwnerPortalIdentityVerificationDocument = {
    ownerUid: input.ownerUid,
    fullName: input.fullName.trim(),
    idType: input.idType,
    idDocumentFrontPath,
    idDocumentBackPath,
    selfiePath,
    verificationStatus: 'pending',
    provider: 'manual_review',
    providerReferenceId: null,
    adminNotes: null,
    submittedAt,
    reviewedAt: null,
    expiresAt,
  };

  await Promise.all([
    setDoc(doc(db, IDENTITY_VERIFICATIONS_COLLECTION, input.ownerUid), verificationDocument),
    setDoc(
      doc(db, OWNER_PROFILES_COLLECTION, input.ownerUid),
      {
        onboardingStep: 'subscription',
        updatedAt: submittedAt,
      },
      { merge: true },
    ),
  ]);

  return verificationDocument;
}
