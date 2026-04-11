import React from 'react';
import type { ReactTestRenderer } from 'react-test-renderer';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigationMocks = vi.hoisted(() => ({
  routeParams: {} as Record<string, unknown>,
}));

const workspaceMocks = vi.hoisted(() => ({
  useOwnerPortalWorkspace: vi.fn(),
}));

const controllerMocks = vi.hoisted(() => ({
  useStorefrontProfileController: vi.fn(),
}));

vi.mock('react-native', () => ({
  Platform: {
    OS: 'web' as const,
  },
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: {
    create: <T,>(styles: T): T => styles,
  },
  Text: 'Text',
  TextInput: 'TextInput',
  View: 'View',
  useWindowDimensions: () => ({ width: 1280, height: 800 }),
}));

vi.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: navigationMocks.routeParams }),
}));

vi.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: vi.fn(),
  requestMediaLibraryPermissionsAsync: vi.fn(),
  launchCameraAsync: vi.fn(),
  launchImageLibraryAsync: vi.fn(),
}));

vi.mock('expo-image', () => ({
  Image: 'Image',
}));

vi.mock('../components/withScreenErrorBoundary', () => ({
  withScreenErrorBoundary: <T,>(Component: T) => Component,
}));

vi.mock('../components/InlineFeedbackPanel', () => ({
  InlineFeedbackPanel: ({ children }: { children?: React.ReactNode }) => children ?? null,
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

vi.mock('../icons/AppUiIcon', () => ({
  AppUiIcon: 'AppUiIcon',
}));

vi.mock('./ownerPortal/OwnerPortalAnalyticsCard', () => ({
  OwnerPortalAnalyticsCard: 'OwnerPortalAnalyticsCard',
}));

vi.mock('./ownerPortal/ownerPortalStyles', () => ({
  ownerPortalStyles: new Proxy(
    {},
    {
      get: () => ({}),
    },
  ),
}));

vi.mock('./ownerPortal/useOwnerPortalWorkspace', () => ({
  useOwnerPortalWorkspace: workspaceMocks.useOwnerPortalWorkspace,
}));

vi.mock('../context/StorefrontController', () => ({
  useStorefrontProfileController: controllerMocks.useStorefrontProfileController,
}));

vi.mock('../services/ownerPortalStorageService', () => ({
  uploadOwnerApprovedStorefrontMediaFile: vi.fn(),
}));

vi.mock('../services/ownerPortalProfileToolsMediaService', () => ({
  mergeUploadedStorefrontMediaIntoProfileTools: vi.fn((_profileTools: unknown) => _profileTools),
}));

import { OwnerPortalHoursScreen } from './OwnerPortalHoursScreen';
import { OwnerPortalProfileToolsScreen } from './OwnerPortalProfileToolsScreen';
import { OwnerPortalPromotionsScreen } from './OwnerPortalPromotionsScreen';
import { OwnerPortalReviewInboxScreen } from './OwnerPortalReviewInboxScreen';

const workspaceReturnValue = {
  workspace: {
    tier: 'growth',
    profileTools: {
      ownerHours: [],
      menuUrl: null,
      cardPhotoUrl: null,
      cardPhotoPath: null,
      verifiedBadgeLabel: null,
      featuredBadges: [],
      cardSummary: null,
      featuredPhotoUrls: [],
      featuredPhotoPaths: [],
    },
    promotions: [],
    promotionPerformance: [],
    metrics: {
      storefrontImpressions7d: 0,
      averageRating: 0,
      replyRate: 0,
      openReportCount: 0,
    },
    recentReviews: [],
    recentReports: [],
    ownerAlertStatus: {
      pushEnabled: false,
    },
  },
  runtimeStatus: {
    policy: {
      safeModeEnabled: false,
      profileToolsWritesEnabled: true,
      promotionWritesEnabled: true,
      reviewRepliesEnabled: true,
    },
  },
  isLoading: false,
  isSaving: false,
  isAiLoading: false,
  errorText: null,
  aiErrorText: null,
  saveProfileTools: vi.fn(),
  suggestProfileToolsWithAi: vi.fn(),
  createPromotion: vi.fn(),
  updatePromotion: vi.fn(),
  deletePromotion: vi.fn(),
  draftPromotionWithAi: vi.fn(),
  enableAlerts: vi.fn(),
  replyToReview: vi.fn(),
  draftReviewReplyWithAi: vi.fn(),
};

function renderScreen(element: React.ReactElement) {
  let renderer!: ReactTestRenderer;

  act(() => {
    renderer = create(element);
  });

  act(() => {
    renderer.unmount();
  });
}

describe('owner portal workspace preview routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigationMocks.routeParams = { preview: true };
    workspaceMocks.useOwnerPortalWorkspace.mockReturnValue(workspaceReturnValue);
    controllerMocks.useStorefrontProfileController.mockReturnValue({
      authSession: {
        status: 'authenticated',
        uid: 'owner-1',
      },
    });
  });

  it('passes preview mode through in the hours screen', () => {
    renderScreen(<OwnerPortalHoursScreen />);

    expect(workspaceMocks.useOwnerPortalWorkspace).toHaveBeenCalledWith(true);
  });

  it('passes preview mode through in the profile tools screen', () => {
    renderScreen(<OwnerPortalProfileToolsScreen />);

    expect(workspaceMocks.useOwnerPortalWorkspace).toHaveBeenCalledWith(true);
  });

  it('passes preview mode through in the promotions screen', () => {
    renderScreen(<OwnerPortalPromotionsScreen />);

    expect(workspaceMocks.useOwnerPortalWorkspace).toHaveBeenCalledWith(true);
  });

  it('passes preview mode through in the review inbox screen', () => {
    renderScreen(<OwnerPortalReviewInboxScreen />);

    expect(workspaceMocks.useOwnerPortalWorkspace).toHaveBeenCalledWith(true);
  });
});
