import { CollectionReference } from 'firebase-admin/firestore';
import {
  OwnerLicenseComplianceDocument,
  OwnerStorefrontProfileToolsDocument,
  OwnerStorefrontPromotionDocument,
} from '../../../src/types/ownerPortal';
import { getOptionalFirestoreCollection } from '../firestoreCollections';

export type OwnerProfileRecord = {
  uid: string;
  displayName?: string | null;
  companyName: string;
  dispensaryId: string | null;
  businessVerificationStatus: string;
  identityVerificationStatus: string;
  subscriptionStatus: string;
  onboardingStep: string;
  badgeLevel: number;
  legalName: string;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OwnerClaimRecord = {
  ownerUid: string;
  dispensaryId: string;
  claimStatus: string;
  submittedAt: string;
  reviewedAt: string | null;
  reviewNotes: string | null;
};

export type DailyStorefrontMetricRecord = {
  storefrontId: string;
  date: string;
  impressionCount?: number;
  openCount?: number;
  goNowTapCount?: number;
  websiteTapCount?: number;
  phoneTapCount?: number;
  menuTapCount?: number;
  reviewStartedCount?: number;
  reviewSubmittedCount?: number;
};

export type DailyDealMetricRecord = {
  dealId: string;
  date: string;
  impressionCount?: number;
  openCount?: number;
  saveCount?: number;
  redeemStartCount?: number;
  redeemedCount?: number;
  websiteTapCount?: number;
  phoneTapCount?: number;
  menuTapCount?: number;
};

const OWNER_PROFILES_COLLECTION = 'ownerProfiles';
const DISPENSARY_CLAIMS_COLLECTION = 'dispensaryClaims';
const OWNER_STOREFRONT_PROFILE_TOOLS_COLLECTION = 'owner_storefront_profile_tools';
const OWNER_STOREFRONT_PROMOTIONS_COLLECTION = 'owner_storefront_promotions';
const OWNER_LICENSE_COMPLIANCE_COLLECTION = 'owner_license_compliance';
const DAILY_STOREFRONT_METRICS_COLLECTION = 'analytics_daily_storefront_metrics';
const DAILY_DEAL_METRICS_COLLECTION = 'analytics_daily_deal_metrics';

export function getOwnerProfileCollection(): CollectionReference<OwnerProfileRecord> | null {
  return getOptionalFirestoreCollection<OwnerProfileRecord>(OWNER_PROFILES_COLLECTION);
}

export function getOwnerClaimCollection(): CollectionReference<OwnerClaimRecord> | null {
  return getOptionalFirestoreCollection<OwnerClaimRecord>(DISPENSARY_CLAIMS_COLLECTION);
}

export function getOwnerStorefrontProfileToolsCollection(): CollectionReference<OwnerStorefrontProfileToolsDocument> | null {
  return getOptionalFirestoreCollection<OwnerStorefrontProfileToolsDocument>(
    OWNER_STOREFRONT_PROFILE_TOOLS_COLLECTION,
  );
}

export function getOwnerStorefrontPromotionsCollection(): CollectionReference<OwnerStorefrontPromotionDocument> | null {
  return getOptionalFirestoreCollection<OwnerStorefrontPromotionDocument>(
    OWNER_STOREFRONT_PROMOTIONS_COLLECTION,
  );
}

export function getOwnerLicenseComplianceCollection(): CollectionReference<OwnerLicenseComplianceDocument> | null {
  return getOptionalFirestoreCollection<OwnerLicenseComplianceDocument>(
    OWNER_LICENSE_COMPLIANCE_COLLECTION,
  );
}

export function getDailyStorefrontMetricsCollection(): CollectionReference<DailyStorefrontMetricRecord> | null {
  return getOptionalFirestoreCollection<DailyStorefrontMetricRecord>(
    DAILY_STOREFRONT_METRICS_COLLECTION,
  );
}

export function getDailyDealMetricsCollection(): CollectionReference<DailyDealMetricRecord> | null {
  return getOptionalFirestoreCollection<DailyDealMetricRecord>(DAILY_DEAL_METRICS_COLLECTION);
}
