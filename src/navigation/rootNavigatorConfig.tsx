import type { Animated } from 'react-native';
import { Easing } from 'react-native';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BrowseScreen } from '../screens/BrowseScreen';
import { AdminRuntimePanelScreen } from '../screens/AdminRuntimePanelScreen';
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
import { OwnerPortalBadgesScreen } from '../screens/OwnerPortalBadgesScreen';
import { OwnerPortalHoursScreen } from '../screens/OwnerPortalHoursScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { ReportStorefrontScreen } from '../screens/ReportStorefrontScreen';
import { StorefrontDetailScreen } from '../screens/StorefrontDetailScreen';
import { DeleteAccountScreen } from '../screens/DeleteAccountScreen';
import { WriteReviewScreen } from '../screens/WriteReviewScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { SavedStorefrontsScreen } from '../screens/SavedStorefrontsScreen';
import { BadgeGalleryScreen } from '../screens/BadgeGalleryScreen';
import { colors } from '../theme/tokens';
import type {
  AppReview,
  StorefrontReviewReportContext,
  StorefrontSummary,
} from '../types/storefront';

export type RootTabParamList = {
  Nearby: undefined;
  Browse: undefined;
  HotDeals: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<RootTabParamList> | undefined;
  StorefrontDetail: {
    storefront?: StorefrontSummary;
    storefrontId?: string;
  };
  WriteReview: {
    storefront: StorefrontSummary;
    existingReview?: AppReview;
  };
  ReportStorefront: {
    storefront: StorefrontSummary;
    reviewContext?: StorefrontReviewReportContext;
    initialReason?: string;
    initialDescription?: string;
    entryMode?: 'general_report' | 'suggest_edit' | 'report_closed';
  };
  LegalCenter: undefined;
  DeleteAccount: undefined;
  Leaderboard:
    | {
        highlightProfileId?: string;
      }
    | undefined;
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
  OwnerPortalBadges:
    | {
        preview?: boolean;
      }
    | undefined;
  OwnerPortalHours:
    | {
        preview?: boolean;
      }
    | undefined;
  Settings: undefined;
  SavedStorefronts: undefined;
  BadgeGallery: undefined;
  AdminRuntimePanel: undefined;
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
      duration: 200,
      easing: Easing.out(Easing.ease),
    },
  },
  sceneStyleInterpolator: ({ current }: { current: { progress: Animated.Value } }) => ({
    sceneStyle: {
      opacity: current.progress.interpolate({
        inputRange: [-1, 0, 1],
        outputRange: [0, 1, 0],
      }),
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
  animationDuration: 280,
  animationMatchesGesture: true,
  fullScreenGestureEnabled: true,
  contentStyle: { backgroundColor: colors.background },
};

const detailFlowScreenOptions = {
  animation: 'simple_push' as const,
  animationDuration: 300,
};

const bottomRiseScreenOptions = {
  animation: 'slide_from_bottom' as const,
  animationDuration: 300,
};

const workspaceFlowScreenOptions = {
  animation: 'slide_from_right' as const,
  animationDuration: 280,
};

export const stackScreens = [
  { name: 'Tabs', component: null, options: undefined },
  { name: 'StorefrontDetail', component: StorefrontDetailScreen, options: detailFlowScreenOptions },
  { name: 'WriteReview', component: WriteReviewScreen, options: bottomRiseScreenOptions },
  { name: 'ReportStorefront', component: ReportStorefrontScreen, options: bottomRiseScreenOptions },
  { name: 'LegalCenter', component: LegalCenterScreen, options: bottomRiseScreenOptions },
  { name: 'DeleteAccount', component: DeleteAccountScreen, options: bottomRiseScreenOptions },
  { name: 'Leaderboard', component: LeaderboardScreen, options: detailFlowScreenOptions },
  {
    name: 'CanopyTroveSignIn',
    component: CanopyTroveSignInScreen,
    options: bottomRiseScreenOptions,
  },
  {
    name: 'CanopyTroveSignUp',
    component: CanopyTroveSignUpScreen,
    options: bottomRiseScreenOptions,
  },
  {
    name: 'CanopyTroveForgotPassword',
    component: CanopyTroveForgotPasswordScreen,
    options: bottomRiseScreenOptions,
  },
  {
    name: 'OwnerPortalAccess',
    component: OwnerPortalAccessScreen,
    options: workspaceFlowScreenOptions,
  },
  {
    name: 'OwnerPortalSignIn',
    component: OwnerPortalSignInScreen,
    options: workspaceFlowScreenOptions,
  },
  {
    name: 'OwnerPortalSignUp',
    component: OwnerPortalSignUpScreen,
    options: workspaceFlowScreenOptions,
  },
  {
    name: 'OwnerPortalForgotPassword',
    component: OwnerPortalForgotPasswordScreen,
    options: workspaceFlowScreenOptions,
  },
  {
    name: 'OwnerPortalHome',
    component: OwnerPortalHomeScreen,
    options: workspaceFlowScreenOptions,
  },
  {
    name: 'OwnerPortalReviewInbox',
    component: OwnerPortalReviewInboxScreen,
    options: workspaceFlowScreenOptions,
  },
  {
    name: 'OwnerPortalPromotions',
    component: OwnerPortalPromotionsScreen,
    options: workspaceFlowScreenOptions,
  },
  {
    name: 'OwnerPortalProfileTools',
    component: OwnerPortalProfileToolsScreen,
    options: workspaceFlowScreenOptions,
  },
  {
    name: 'OwnerPortalBusinessDetails',
    component: OwnerPortalBusinessDetailsScreen,
    options: workspaceFlowScreenOptions,
  },
  {
    name: 'OwnerPortalClaimListing',
    component: OwnerPortalClaimListingScreen,
    options: workspaceFlowScreenOptions,
  },
  {
    name: 'OwnerPortalBusinessVerification',
    component: OwnerPortalBusinessVerificationScreen,
    options: workspaceFlowScreenOptions,
  },
  {
    name: 'OwnerPortalIdentityVerification',
    component: OwnerPortalIdentityVerificationScreen,
    options: workspaceFlowScreenOptions,
  },
  {
    name: 'OwnerPortalSubscription',
    component: OwnerPortalSubscriptionScreen,
    options: workspaceFlowScreenOptions,
  },
  {
    name: 'OwnerPortalBadges',
    component: OwnerPortalBadgesScreen,
    options: workspaceFlowScreenOptions,
  },
  {
    name: 'OwnerPortalHours',
    component: OwnerPortalHoursScreen,
    options: workspaceFlowScreenOptions,
  },
  {
    name: 'Settings',
    component: SettingsScreen,
    options: bottomRiseScreenOptions,
  },
  {
    name: 'SavedStorefronts',
    component: SavedStorefrontsScreen,
    options: detailFlowScreenOptions,
  },
  {
    name: 'BadgeGallery',
    component: BadgeGalleryScreen,
    options: detailFlowScreenOptions,
  },
  {
    name: 'AdminRuntimePanel',
    component: AdminRuntimePanelScreen,
    options: workspaceFlowScreenOptions,
  },
] as const;

export const tabScreens = [
  { name: 'Nearby', component: NearbyScreen },
  { name: 'Browse', component: BrowseScreen },
  { name: 'HotDeals', component: HotDealsScreen },
  { name: 'Profile', component: ProfileScreen },
] as const;
