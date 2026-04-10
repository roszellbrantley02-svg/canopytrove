import { Platform } from 'react-native';
import type { OwnerOnboardingStep } from '../../types/ownerPortal';

export type OwnerPortalNextStepRouteName =
  | 'OwnerPortalBusinessDetails'
  | 'OwnerPortalClaimListing'
  | 'OwnerPortalBusinessVerification'
  | 'OwnerPortalIdentityVerification'
  | 'OwnerPortalSubscription';

export type OwnerPortalNextStepContent = {
  title: string;
  body: string;
  actionLabel: string;
  routeName: OwnerPortalNextStepRouteName | null;
};

export function getNextStepContent(step: OwnerOnboardingStep): OwnerPortalNextStepContent {
  switch (step) {
    case 'business_details':
      return {
        title: 'Business details',
        body: 'Add the business details that customers and reviewers should see.',
        actionLabel: 'Continue Business Details',
        routeName: 'OwnerPortalBusinessDetails',
      };
    case 'claim_listing':
      return {
        title: 'Claim listing',
        body: 'Match your business account to the correct Canopy Trove storefront before verification.',
        actionLabel: 'Claim Dispensary Listing',
        routeName: 'OwnerPortalClaimListing',
      };
    case 'business_verification':
      return {
        title: 'Business verification',
        body: 'Upload your license and business documents so we can verify your storefront.',
        actionLabel: 'Submit Business Verification',
        routeName: 'OwnerPortalBusinessVerification',
      };
    case 'identity_verification':
      return {
        title: 'Identity verification',
        body: 'Upload your ID and a selfie so we can verify the person managing this business account.',
        actionLabel: 'Submit Identity Verification',
        routeName: 'OwnerPortalIdentityVerification',
      };
    case 'subscription':
      return {
        title: 'Subscription',
        body: 'Choose your plan and manage billing for premium storefront tools.',
        actionLabel: 'Open Subscription',
        routeName: 'OwnerPortalSubscription',
      };
    case 'completed':
      return {
        title: 'Owner dashboard',
        body:
          Platform.OS === 'android'
            ? 'Everything is ready. You can manage your storefront, updates, and business details from here.'
            : 'Everything is ready. You can manage your storefront, offers, and business details from here.',
        actionLabel: 'All Set',
        routeName: null,
      };
    case 'account_created':
    default:
      return {
        title: 'Business details',
        body: 'Your account is ready. Start by filling out the business profile.',
        actionLabel: 'Start Business Details',
        routeName: 'OwnerPortalBusinessDetails',
      };
  }
}
