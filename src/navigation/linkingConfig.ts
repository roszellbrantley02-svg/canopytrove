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
          Profile: 'profile',
        },
      },
      StorefrontDetail: 'storefronts/:storefrontId',
      Leaderboard: 'leaderboard',
      LegalCenter: 'legal',
      DeleteAccount: 'account-deletion',

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
    },
  },
};
