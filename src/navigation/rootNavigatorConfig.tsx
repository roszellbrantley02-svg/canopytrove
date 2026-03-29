import { Animated, Easing } from 'react-native';
import { NavigatorScreenParams } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BrowseScreen } from '../screens/BrowseScreen';
import { CanopyTroveForgotPasswordScreen } from '../screens/CanopyTroveForgotPasswordScreen';
import { CanopyTroveSignInScreen } from '../screens/CanopyTroveSignInScreen';
import { CanopyTroveSignUpScreen } from '../screens/CanopyTroveSignUpScreen';
import { HotDealsScreen } from '../screens/HotDealsScreen';
import { LegalCenterScreen } from '../screens/LegalCenterScreen';
import { LeaderboardScreen } from '../screens/LeaderboardScreen';
import { NearbyScreen } from '../screens/NearbyScreen';
import { OwnerPortalAccessScreen } from '../screens/OwnerPortalAccessScreen';
import { OwnerPortalBusinessDetailsScreen } from '../screens/OwnerPortalBusinessDetailsScreen';
import { OwnerPortalBusinessVerificationScreen } from '../screens/OwnerPortalBusinessVerificationScreen';
import { OwnerPortalClaimListingScreen } from '../screens/OwnerPortalClaimListingScreen';
import { OwnerPortalForgotPasswordScreen } from '../screens/OwnerPortalForgotPasswordScreen';
import { OwnerPortalHomeScreen } from '../screens/OwnerPortalHomeScreen';
import { OwnerPortalIdentityVerificationScreen } from '../screens/OwnerPortalIdentityVerificationScreen';
import { OwnerPortalProfileToolsScreen } from '../screens/OwnerPortalProfileToolsScreen';
import { OwnerPortalPromotionsScreen } from '../screens/OwnerPortalPromotionsScreen';
import { OwnerPortalReviewInboxScreen } from '../screens/OwnerPortalReviewInboxScreen';
import { OwnerPortalSignInScreen } from '../screens/OwnerPortalSignInScreen';
import { OwnerPortalSignUpScreen } from '../screens/OwnerPortalSignUpScreen';
import { OwnerPortalSubscriptionScreen } from '../screens/OwnerPortalSubscriptionScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { ReportStorefrontScreen } from '../screens/ReportStorefrontScreen';
import { StorefrontDetailScreen } from '../screens/StorefrontDetailScreen';
import { DeleteAccountScreen } from '../screens/DeleteAccountScreen';
import { WriteReviewScreen } from '../screens/WriteReviewScreen';
import { colors, motion } from '../theme/tokens';
import { StorefrontSummary } from '../types/storefront';

export type RootTabParamList = {
  Nearby: undefined;
  Browse: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<RootTabParamList> | undefined;
  StorefrontDetail: {
    storefront: StorefrontSummary;
  };
  WriteReview: {
    storefront: StorefrontSummary;
  };
  ReportStorefront: {
    storefront: StorefrontSummary;
  };
  LegalCenter: undefined;
  DeleteAccount: undefined;
  Leaderboard: {
    highlightProfileId?: string;
  } | undefined;
  HotDeals: undefined;
  CanopyTroveSignIn: undefined;
  CanopyTroveSignUp: undefined;
  CanopyTroveForgotPassword: undefined;
  OwnerPortalAccess:
    | {
        preview?: boolean;
      }
    | undefined;
  OwnerPortalSignIn: undefined;
  OwnerPortalSignUp: undefined;
  OwnerPortalForgotPassword: undefined;
  OwnerPortalHome:
    | {
        preview?: boolean;
      }
    | undefined;
  OwnerPortalReviewInbox:
    | {
        preview?: boolean;
      }
    | undefined;
  OwnerPortalPromotions:
    | {
        preview?: boolean;
      }
    | undefined;
  OwnerPortalProfileTools:
    | {
        preview?: boolean;
      }
    | undefined;
  OwnerPortalBusinessDetails: {
    ownerUid?: string;
    initialLegalName?: string;
    initialCompanyName?: string;
    initialPhone?: string;
    preview?: boolean;
  };
  OwnerPortalClaimListing:
    | {
        preview?: boolean;
      }
    | undefined;
  OwnerPortalBusinessVerification:
    | {
        preview?: boolean;
      }
    | undefined;
  OwnerPortalIdentityVerification:
    | {
        preview?: boolean;
      }
    | undefined;
  OwnerPortalSubscription:
    | {
        preview?: boolean;
      }
    | undefined;
};

export const Tab = createBottomTabNavigator<RootTabParamList>();
export const Stack = createNativeStackNavigator<RootStackParamList>();
export const tabNavigatorScreenOptions = {
  headerShown: false,
  animation: 'fade' as const,
  lazy: true,
  freezeOnBlur: true,
  tabBarHideOnKeyboard: true,
  transitionSpec: {
    animation: 'timing' as const,
    config: {
      duration: motion.quick,
      easing: Easing.out(Easing.cubic),
    },
  },
  sceneStyleInterpolator: ({ current }: { current: { progress: Animated.Value } }) => ({
    sceneStyle: {
      opacity: current.progress.interpolate({
        inputRange: [-1, 0, 1],
        outputRange: [0.92, 1, 0.92],
      }),
      transform: [
        {
          translateY: current.progress.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: [motion.tabSceneShift, 0, motion.tabSceneShift],
          }),
        },
      ],
    },
  }),
  sceneStyle: {
    backgroundColor: colors.background,
  },
  tabBarShowLabel: false,
} as const;

export const stackNavigatorScreenOptions = {
  headerShown: false,
  animation: 'slide_from_right' as const,
  animationDuration: motion.page,
  animationMatchesGesture: true,
  fullScreenGestureEnabled: true,
  contentStyle: { backgroundColor: colors.background },
};

const customerFlowScreenOptions = {
  animation: 'fade_from_bottom' as const,
  animationDuration: motion.page,
};

export const stackScreens = [
  { name: 'Tabs', component: null, options: undefined },
  { name: 'StorefrontDetail', component: StorefrontDetailScreen, options: customerFlowScreenOptions },
  { name: 'WriteReview', component: WriteReviewScreen, options: customerFlowScreenOptions },
  { name: 'ReportStorefront', component: ReportStorefrontScreen, options: customerFlowScreenOptions },
  { name: 'LegalCenter', component: LegalCenterScreen, options: customerFlowScreenOptions },
  { name: 'DeleteAccount', component: DeleteAccountScreen, options: customerFlowScreenOptions },
  { name: 'Leaderboard', component: LeaderboardScreen, options: customerFlowScreenOptions },
  { name: 'HotDeals', component: HotDealsScreen, options: customerFlowScreenOptions },
  { name: 'CanopyTroveSignIn', component: CanopyTroveSignInScreen, options: customerFlowScreenOptions },
  { name: 'CanopyTroveSignUp', component: CanopyTroveSignUpScreen, options: customerFlowScreenOptions },
  { name: 'CanopyTroveForgotPassword', component: CanopyTroveForgotPasswordScreen, options: customerFlowScreenOptions },
  { name: 'OwnerPortalAccess', component: OwnerPortalAccessScreen, options: { animation: 'slide_from_right' as const } },
  { name: 'OwnerPortalSignIn', component: OwnerPortalSignInScreen, options: { animation: 'slide_from_right' as const } },
  { name: 'OwnerPortalSignUp', component: OwnerPortalSignUpScreen, options: { animation: 'slide_from_right' as const } },
  { name: 'OwnerPortalForgotPassword', component: OwnerPortalForgotPasswordScreen, options: { animation: 'slide_from_right' as const } },
  { name: 'OwnerPortalHome', component: OwnerPortalHomeScreen, options: { animation: 'slide_from_right' as const } },
  { name: 'OwnerPortalReviewInbox', component: OwnerPortalReviewInboxScreen, options: { animation: 'slide_from_right' as const } },
  { name: 'OwnerPortalPromotions', component: OwnerPortalPromotionsScreen, options: { animation: 'slide_from_right' as const } },
  { name: 'OwnerPortalProfileTools', component: OwnerPortalProfileToolsScreen, options: { animation: 'slide_from_right' as const } },
  { name: 'OwnerPortalBusinessDetails', component: OwnerPortalBusinessDetailsScreen, options: { animation: 'slide_from_right' as const } },
  { name: 'OwnerPortalClaimListing', component: OwnerPortalClaimListingScreen, options: { animation: 'slide_from_right' as const } },
  { name: 'OwnerPortalBusinessVerification', component: OwnerPortalBusinessVerificationScreen, options: { animation: 'slide_from_right' as const } },
  { name: 'OwnerPortalIdentityVerification', component: OwnerPortalIdentityVerificationScreen, options: { animation: 'slide_from_right' as const } },
  { name: 'OwnerPortalSubscription', component: OwnerPortalSubscriptionScreen, options: { animation: 'slide_from_right' as const } },
] as const;

export const tabScreens = [
  { name: 'Nearby', component: NearbyScreen },
  { name: 'Browse', component: BrowseScreen },
  { name: 'Profile', component: ProfileScreen },
] as const;
