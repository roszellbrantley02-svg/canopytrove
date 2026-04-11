import React from 'react';
import type { ReactTestRenderer } from 'react-test-renderer';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const navigationMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  reset: vi.fn(),
  routeParams: {} as Record<string, unknown>,
}));

const homeScreenModelMocks = vi.hoisted(() => ({
  useOwnerPortalHomeScreenModel: vi.fn(),
}));

const workspaceMocks = vi.hoisted(() => ({
  useOwnerPortalWorkspace: vi.fn(),
}));

const monitoringMocks = vi.hoisted(() => ({
  captureMonitoringException: vi.fn(),
}));

const authMocks = vi.hoisted(() => ({
  signOutCanopyTroveSession: vi.fn(),
}));

vi.mock('react-native', () => ({
  Alert: {
    alert: vi.fn(),
  },
  Platform: {
    OS: 'web' as const,
  },
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: {
    create: <T,>(styles: T): T => styles,
  },
  Text: 'Text',
  View: 'View',
}));

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: navigationMocks.navigate,
    reset: navigationMocks.reset,
  }),
  useRoute: () => ({ params: navigationMocks.routeParams }),
}));

vi.mock('../components/withScreenErrorBoundary', () => ({
  withScreenErrorBoundary: <T,>(Component: T) => Component,
}));

vi.mock('../components/MotionInView', () => ({
  MotionInView: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../components/ScreenShell', () => ({
  ScreenShell: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../components/SectionCard', () => ({
  SectionCard: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../components/AttentionCard', () => ({
  AttentionCard: () => null,
}));

vi.mock('../components/QuickActionsRow', () => ({
  QuickActionsRow: () => null,
}));

vi.mock('../components/OwnerLocationSwitcher', () => ({
  OwnerLocationSwitcher: () => null,
}));

vi.mock('../icons/AppUiIcon', () => ({
  AppUiIcon: 'AppUiIcon',
}));

vi.mock('./ownerPortal/OwnerPortalLicenseComplianceCard', () => ({
  OwnerPortalLicenseComplianceCard: () => null,
}));

vi.mock('./ownerPortal/ownerPortalHomeData', () => ({
  getJourneyItems: () => [],
  getOwnerHomeDerivedMetrics: () => ({
    totalActions7d: 0,
  }),
  getOwnerStatusChips: () => [],
}));

vi.mock('./ownerPortal/OwnerPortalHomeHero', () => ({
  OwnerPortalHomeHero: () => null,
}));

vi.mock('./ownerPortal/OwnerPortalHomeRoiSection', () => ({
  OwnerPortalHomeRoiSection: () => null,
}));

vi.mock('./ownerPortal/OwnerPortalStageList', () => ({
  OwnerPortalStageList: () => null,
}));

vi.mock('./ownerPortal/useOwnerPortalHomeScreenModel', () => ({
  useOwnerPortalHomeScreenModel: homeScreenModelMocks.useOwnerPortalHomeScreenModel,
}));

vi.mock('./ownerPortal/useOwnerPortalWorkspace', () => ({
  useOwnerPortalWorkspace: workspaceMocks.useOwnerPortalWorkspace,
}));

vi.mock('../services/canopyTroveAuthService', () => ({
  signOutCanopyTroveSession: authMocks.signOutCanopyTroveSession,
}));

vi.mock('../services/sentryMonitoringService', () => ({
  captureMonitoringException: monitoringMocks.captureMonitoringException,
}));

import { OwnerPortalHomeScreen } from './OwnerPortalHomeScreen';

function flushEffects() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function createOwnerProfile() {
  return {
    uid: 'owner-1',
    legalName: 'Owner Legal',
    phone: null,
    companyName: 'Owner Company',
    identityVerificationStatus: 'verified' as const,
    businessVerificationStatus: 'verified' as const,
    dispensaryId: 'store-1',
    onboardingStep: 'completed' as const,
    subscriptionStatus: 'active' as const,
    badgeLevel: 1,
    earnedBadgeIds: [],
    selectedBadgeIds: [],
    createdAt: '2026-04-10T00:00:00.000Z',
    updatedAt: '2026-04-10T00:00:00.000Z',
  };
}

function createWorkspace(tier: 'verified' | 'growth' | 'pro' = 'verified') {
  return {
    ownerProfile: createOwnerProfile(),
    ownerClaim: null,
    storefrontSummary: {
      id: 'store-1',
      displayName: 'Store 1',
      addressLine1: '123 Main St',
      city: 'New York',
      state: 'NY',
      zip: '10001',
    },
    metrics: {
      followerCount: 0,
      storefrontImpressions7d: 0,
      storefrontOpenCount7d: 0,
      routeStarts7d: 0,
      websiteTapCount7d: 0,
      phoneTapCount7d: 0,
      menuTapCount7d: 0,
      reviewCount30d: 0,
      openReportCount: 0,
      averageRating: 4.5,
      replyRate: 0,
      openToRouteRate: 0,
      openToWebsiteRate: 0,
      openToPhoneRate: 0,
      openToMenuRate: 0,
    },
    patternFlags: [],
    recentReviews: [],
    recentReports: [],
    promotions: [],
    promotionPerformance: [],
    profileTools: null,
    licenseCompliance: null,
    ownerAlertStatus: {
      pushEnabled: false,
      updatedAt: null,
    },
    runtimeStatus: null,
    tier,
    activeLocationId: null,
    locations: [],
  };
}

describe('OwnerPortalHomeScreen', () => {
  let renderer: ReactTestRenderer | null = null;

  beforeEach(() => {
    renderer = null;
    vi.clearAllMocks();
    navigationMocks.routeParams = {};
    homeScreenModelMocks.useOwnerPortalHomeScreenModel.mockReturnValue({
      accessState: {
        enabled: true,
        restricted: false,
        allowlisted: true,
      },
      authSession: {
        status: 'authenticated',
        uid: 'owner-1',
      },
      claimedStorefront: null,
      errorText: null,
      handleContinue: vi.fn(),
      isLoading: false,
      nextStep: null,
      ownerClaim: null,
      ownerProfile: createOwnerProfile(),
    });
    workspaceMocks.useOwnerPortalWorkspace.mockReturnValue({
      actionPlan: null,
      activeLocationId: null,
      aiErrorText: null,
      createPromotion: vi.fn(),
      deletePromotion: vi.fn(),
      dismissTierUpgradePrompt: vi.fn(),
      draftPromotionWithAi: vi.fn(),
      draftReviewReplyWithAi: vi.fn(),
      enableAlerts: vi.fn(),
      errorText: null,
      isAiLoading: false,
      isLoading: false,
      isSaving: false,
      locations: [],
      refresh: vi.fn(),
      refreshActionPlan: vi.fn(),
      replyToReview: vi.fn(),
      runtimeStatus: null,
      saveBadgeDisplaySettings: vi.fn(),
      saveLicenseCompliance: vi.fn(),
      saveProfileTools: vi.fn(),
      suggestProfileToolsWithAi: vi.fn(),
      switchLocation: vi.fn(),
      tierUpgradePrompt: null,
      updatePromotion: vi.fn(),
      workspace: createWorkspace(),
    });
  });

  afterEach(() => {
    renderer?.unmount();
    vi.unstubAllGlobals();
  });

  it('passes preview mode through to the home screen hooks', () => {
    navigationMocks.routeParams = { preview: true };

    act(() => {
      renderer = create(<OwnerPortalHomeScreen />);
    });

    expect(homeScreenModelMocks.useOwnerPortalHomeScreenModel).toHaveBeenCalledWith(true);
    expect(workspaceMocks.useOwnerPortalWorkspace).toHaveBeenCalledWith(true);
  });

  it('reports action-plan refresh failures to monitoring in production', async () => {
    const refreshActionPlan = vi.fn().mockRejectedValue(new Error('refresh failed'));

    vi.stubGlobal('__DEV__', false);
    workspaceMocks.useOwnerPortalWorkspace.mockReturnValue({
      actionPlan: {
        headline: 'Next steps',
        summary: 'Focus on engagement.',
        priorities: [
          {
            title: 'Reply to reviews',
            body: 'Keep response times tight.',
            tone: 'info' as const,
          },
        ],
        generatedAt: '2026-04-11T00:00:00.000Z',
        usedFallback: false,
      },
      activeLocationId: null,
      aiErrorText: null,
      createPromotion: vi.fn(),
      deletePromotion: vi.fn(),
      dismissTierUpgradePrompt: vi.fn(),
      draftPromotionWithAi: vi.fn(),
      draftReviewReplyWithAi: vi.fn(),
      enableAlerts: vi.fn(),
      errorText: null,
      isAiLoading: false,
      isLoading: false,
      isSaving: false,
      locations: [],
      refresh: vi.fn(),
      refreshActionPlan,
      replyToReview: vi.fn(),
      runtimeStatus: null,
      saveBadgeDisplaySettings: vi.fn(),
      saveLicenseCompliance: vi.fn(),
      saveProfileTools: vi.fn(),
      suggestProfileToolsWithAi: vi.fn(),
      switchLocation: vi.fn(),
      tierUpgradePrompt: null,
      updatePromotion: vi.fn(),
      workspace: createWorkspace('pro'),
    });

    await act(async () => {
      renderer = create(<OwnerPortalHomeScreen />);
      await flushEffects();
    });

    const refreshButtonText = renderer?.root.findByProps({ children: 'See All Suggestions' });

    expect(refreshButtonText).toBeDefined();

    await act(async () => {
      refreshButtonText?.parent?.props.onPress();
      await flushEffects();
      await flushEffects();
    });

    expect(refreshActionPlan).toHaveBeenCalledTimes(1);
    expect(monitoringMocks.captureMonitoringException).toHaveBeenCalledTimes(1);
    expect(monitoringMocks.captureMonitoringException).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'refresh failed' }),
      {
        source: 'OwnerPortalHome',
        tags: { errorContext: 'refreshActionPlan' },
      },
    );
  });
});
