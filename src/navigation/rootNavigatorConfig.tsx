import React from 'react';
import type { Animated } from 'react-native';
import { Easing } from 'react-native';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme/tokens';

/* ── Core tab screens — always in the main bundle ── */
import { NearbyScreen } from '../screens/NearbyScreen';
import { BrowseScreen } from '../screens/BrowseScreen';
import { HotDealsScreen } from '../screens/HotDealsScreen';
import { VerifyScreen } from '../screens/VerifyScreen';
import { VerifyManualEntryScreen } from '../screens/VerifyManualEntryScreen';
import { ScanResultScreen } from '../screens/ScanResultScreen';
import { ProfileScreen } from '../screens/ProfileScreen';

/* ── Lazy-loaded helper ──
 * On web, React.lazy splits these into separate chunks loaded on navigation.
 * On native, React.lazy also works (Metro supports it), keeping the same API. */
// React.lazy needs a loose component prop boundary here because the screen
// modules mix prop-less components with navigator-injected props.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lazyScreen<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T } | Record<string, T>>,
  exportName?: string,
): React.LazyExoticComponent<T> {
  return React.lazy(() =>
    factory().then((mod) => {
      if ('default' in mod) return mod as { default: T };
      const namedExports = mod as Record<string, T>;
      const component = exportName ? namedExports[exportName] : Object.values(namedExports)[0];
      if (!component) {
        throw new Error(
          exportName
            ? `Lazy screen export "${exportName}" was not found.`
            : 'Lazy screen module did not expose a component.',
        );
      }
      return { default: component } as { default: T };
    }),
  );
}

/* ── Secondary routes — lazy-loaded for smaller initial bundle ── */
const StorefrontDetailScreen = lazyScreen(
  () => import('../screens/StorefrontDetailScreen'),
  'StorefrontDetailScreen',
);
const WriteReviewScreen = lazyScreen(
  () => import('../screens/WriteReviewScreen'),
  'WriteReviewScreen',
);
const ReportStorefrontScreen = lazyScreen(
  () => import('../screens/ReportStorefrontScreen'),
  'ReportStorefrontScreen',
);
const LegalCenterScreen = lazyScreen(
  () => import('../screens/LegalCenterScreen'),
  'LegalCenterScreen',
);
const DeleteAccountScreen = lazyScreen(
  () => import('../screens/DeleteAccountScreen'),
  'DeleteAccountScreen',
);
const LeaderboardScreen = lazyScreen(
  () => import('../screens/LeaderboardScreen'),
  'LeaderboardScreen',
);
const SettingsScreen = lazyScreen(() => import('../screens/SettingsScreen'), 'SettingsScreen');
const SavedStorefrontsScreen = lazyScreen(
  () => import('../screens/SavedStorefrontsScreen'),
  'SavedStorefrontsScreen',
);
const BadgeGalleryScreen = lazyScreen(
  () => import('../screens/BadgeGalleryScreen'),
  'BadgeGalleryScreen',
);
const MyBrandsScreen = lazyScreen(() => import('../screens/MyBrandsScreen'), 'MyBrandsScreen');
const BrowseBrandsScreen = lazyScreen(
  () => import('../screens/BrowseBrandsScreen'),
  'BrowseBrandsScreen',
);
const BrandDetailScreen = lazyScreen(
  () => import('../screens/BrandDetailScreen'),
  'BrandDetailScreen',
);

/* ── Auth screens — lazy ── */
const WelcomeModePickerScreen = lazyScreen(
  () => import('../screens/WelcomeModePickerScreen'),
  'WelcomeModePickerScreen',
);
const MemberSignInScreen = lazyScreen(
  () => import('../screens/MemberSignInScreen'),
  'MemberSignInScreen',
);
const OwnerSignInScreen = lazyScreen(
  () => import('../screens/OwnerSignInScreen'),
  'OwnerSignInScreen',
);
const CanopyTroveSignInScreen = lazyScreen(
  () => import('../screens/CanopyTroveSignInScreen'),
  'CanopyTroveSignInScreen',
);
const CanopyTroveSignUpScreen = lazyScreen(
  () => import('../screens/CanopyTroveSignUpScreen'),
  'CanopyTroveSignUpScreen',
);
const CanopyTroveForgotPasswordScreen = lazyScreen(
  () => import('../screens/CanopyTroveForgotPasswordScreen'),
  'CanopyTroveForgotPasswordScreen',
);

/* ── Owner portal screens — lazy (heaviest chunk, never needed for public browse) ── */
const OwnerPortalAccessScreen = lazyScreen(
  () => import('../screens/OwnerPortalAccessScreen'),
  'OwnerPortalAccessScreen',
);
const OwnerPortalBusinessDetailsScreen = lazyScreen(
  () => import('../screens/OwnerPortalBusinessDetailsScreen'),
  'OwnerPortalBusinessDetailsScreen',
);
const OwnerPortalBusinessVerificationScreen = lazyScreen(
  () => import('../screens/OwnerPortalBusinessVerificationScreen'),
  'OwnerPortalBusinessVerificationScreen',
);
const OwnerPortalClaimListingScreen = lazyScreen(
  () => import('../screens/OwnerPortalClaimListingScreen'),
  'OwnerPortalClaimListingScreen',
);
const OwnerPortalForgotPasswordScreen = lazyScreen(
  () => import('../screens/OwnerPortalForgotPasswordScreen'),
  'OwnerPortalForgotPasswordScreen',
);
const OwnerPortalHomeScreen = lazyScreen(
  () => import('../screens/OwnerPortalHomeScreen'),
  'OwnerPortalHomeScreen',
);
const OwnerPortalIdentityVerificationScreen = lazyScreen(
  () => import('../screens/OwnerPortalIdentityVerificationScreen'),
  'OwnerPortalIdentityVerificationScreen',
);
const OwnerPortalProfileToolsScreen = lazyScreen(
  () => import('../screens/OwnerPortalProfileToolsScreen'),
  'OwnerPortalProfileToolsScreen',
);
const OwnerPortalPromotionsScreen = lazyScreen(
  () => import('../screens/OwnerPortalPromotionsScreen'),
  'OwnerPortalPromotionsScreen',
);
const OwnerPortalReviewInboxScreen = lazyScreen(
  () => import('../screens/OwnerPortalReviewInboxScreen'),
  'OwnerPortalReviewInboxScreen',
);
const OwnerPortalSignInScreen = lazyScreen(
  () => import('../screens/OwnerPortalSignInScreen'),
  'OwnerPortalSignInScreen',
);
const OwnerPortalSignUpScreen = lazyScreen(
  () => import('../screens/OwnerPortalSignUpScreen'),
  'OwnerPortalSignUpScreen',
);
const OwnerPortalSubscriptionScreen = lazyScreen(
  () => import('../screens/OwnerPortalSubscriptionScreen'),
  'OwnerPortalSubscriptionScreen',
);
const OwnerPortalBadgesScreen = lazyScreen(
  () => import('../screens/OwnerPortalBadgesScreen'),
  'OwnerPortalBadgesScreen',
);
const OwnerPortalHoursScreen = lazyScreen(
  () => import('../screens/OwnerPortalHoursScreen'),
  'OwnerPortalHoursScreen',
);
const OwnerPortalBrandRosterScreen = lazyScreen(
  () => import('../screens/OwnerPortalBrandRosterScreen'),
  'OwnerPortalBrandRosterScreen',
);

/* ── Admin screens — lazy ── */
const AdminRuntimePanelScreen = lazyScreen(
  () => import('../screens/AdminRuntimePanelScreen'),
  'AdminRuntimePanelScreen',
);
import type {
  AppReview,
  StorefrontReviewReportContext,
  StorefrontSummary,
} from '../types/storefront';

export type RootTabParamList = {
  Nearby: undefined;
  Browse: undefined;
  HotDeals: undefined;
  Verify: undefined;
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
  VerifyManualEntry: undefined;
  ScanResult: {
    rawCode: string;
  };
  LegalCenter: undefined;
  DeleteAccount: undefined;
  Leaderboard:
    | {
        highlightProfileId?: string;
      }
    | undefined;
  WelcomeModePicker: undefined;
  MemberSignIn: undefined;
  OwnerSignIn: undefined;
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
  OwnerPortalBrandRoster:
    | {
        preview?: boolean;
      }
    | undefined;
  Settings: undefined;
  SavedStorefronts: undefined;
  BadgeGallery: undefined;
  MyBrands: undefined;
  BrowseBrands: undefined;
  BrandDetail: {
    brandId: string;
  };
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
    name: 'VerifyManualEntry',
    component: VerifyManualEntryScreen,
    options: bottomRiseScreenOptions,
  },
  { name: 'ScanResult', component: ScanResultScreen, options: bottomRiseScreenOptions },
  {
    name: 'WelcomeModePicker',
    component: WelcomeModePickerScreen,
    options: bottomRiseScreenOptions,
  },
  {
    name: 'MemberSignIn',
    component: MemberSignInScreen,
    options: bottomRiseScreenOptions,
  },
  {
    name: 'OwnerSignIn',
    component: OwnerSignInScreen,
    options: bottomRiseScreenOptions,
  },
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
    name: 'OwnerPortalBrandRoster',
    component: OwnerPortalBrandRosterScreen,
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
    name: 'MyBrands',
    component: MyBrandsScreen,
    options: detailFlowScreenOptions,
  },
  {
    name: 'BrowseBrands',
    component: BrowseBrandsScreen,
    options: detailFlowScreenOptions,
  },
  {
    name: 'BrandDetail',
    component: BrandDetailScreen,
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
  { name: 'Verify', component: VerifyScreen },
  { name: 'Profile', component: ProfileScreen },
] as const;
