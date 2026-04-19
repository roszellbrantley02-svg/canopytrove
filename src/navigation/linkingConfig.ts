import type { LinkingOptions } from '@react-navigation/native';
import type { RootStackParamList } from './rootNavigatorConfig';

export const linkingConfig: LinkingOptions<RootStackParamList> = {
  prefixes: [
    'canopytrove://',
    'https://canopytrove.com',
    'https://www.canopytrove.com',
    'https://app.canopytrove.com',
    'https://canopytrove-webapp.web.app',
  ],
  config: {
    screens: {
      Tabs: {
        screens: {
          Nearby: 'nearby',
          Browse: 'browse',
          HotDeals: 'hot-deals',
          Verify: 'verify',
          Profile: 'profile',
        },
      },
      StorefrontDetail: 'storefronts/:storefrontId',
      Leaderboard: 'leaderboard',
      LegalCenter: 'legal',
      DeleteAccount: 'account-deletion',

      // Auth — mode picker and entry points
      WelcomeModePicker: 'welcome',
      MemberSignIn: 'member-signin',
      OwnerSignIn: 'owner-signin',

      // Legacy member auth screens (deprecated, kept for backward compat)
      CanopyTroveSignIn: 'signin',
      CanopyTroveSignUp: 'signup',
      CanopyTroveForgotPassword: 'forgot-password',

      // Owner Portal — auth screens
      OwnerPortalAccess: 'owner-portal',
      OwnerPortalSignIn: 'owner-portal/sign-in',
      OwnerPortalSignUp: 'owner-portal/sign-up',
      OwnerPortalForgotPassword: 'owner-portal/forgot-password',

      // Owner Portal — workspace screens
      OwnerPortalHome: 'owner-portal/home',
      OwnerPortalReviewInbox: 'owner-portal/reviews',
      OwnerPortalPromotions: 'owner-portal/promotions',
      OwnerPortalProfileTools: 'owner-portal/profile-tools',
      OwnerPortalBusinessDetails: 'owner-portal/business-details',
      OwnerPortalClaimListing: 'owner-portal/claim-listing',
      OwnerPortalBusinessVerification: 'owner-portal/business-verification',
      OwnerPortalIdentityVerification: 'owner-portal/identity-verification',
      OwnerPortalSubscription: 'owner-portal/subscription',
      OwnerPortalBadges: 'owner-portal/badges',
      OwnerPortalHours: 'owner-portal/hours',
      OwnerPortalPaymentMethods: 'owner-portal/payment-methods',
    },
  },
};
