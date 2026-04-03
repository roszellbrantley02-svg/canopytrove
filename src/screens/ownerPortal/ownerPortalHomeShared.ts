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
        body: 'Add the legal and public business details for your owner workspace.',
        actionLabel: 'Continue Business Details',
        routeName: 'OwnerPortalBusinessDetails',
      };
    case 'claim_listing':
      return {
        title: 'Claim listing',
        body: 'Match your owner account to the correct Canopy Trove listing before verification.',
        actionLabel: 'Claim Dispensary Listing',
        routeName: 'OwnerPortalClaimListing',
      };
    case 'business_verification':
      return {
        title: 'Business verification',
        body: 'Upload your license and business documents for manual review.',
        actionLabel: 'Submit Business Verification',
        routeName: 'OwnerPortalBusinessVerification',
      };
    case 'identity_verification':
      return {
        title: 'Identity verification',
        body: 'Upload government ID images and a selfie to complete owner review.',
        actionLabel: 'Submit Identity Verification',
        routeName: 'OwnerPortalIdentityVerification',
      };
    case 'subscription':
      return {
        title: 'Plan access',
        body: 'Choose your live owner plan and manage billing access for premium storefront tools.',
        actionLabel: 'Open Plan Access',
        routeName: 'OwnerPortalSubscription',
      };
    case 'completed':
      return {
        title: 'Owner dashboard',
        body: 'Onboarding is complete. You can manage your storefront, deal badges, and owner tools from here.',
        actionLabel: 'Onboarding Complete',
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
