import React from 'react';
import type { ReactTestRenderer } from 'react-test-renderer';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigationMocks = vi.hoisted(() => ({
  routeParams: {} as Record<string, unknown>,
}));

const controllerMocks = vi.hoisted(() => ({
  useStorefrontProfileController: vi.fn(),
}));

const summaryMocks = vi.hoisted(() => ({
  useSavedSummaries: vi.fn(),
}));

const billingServiceMocks = vi.hoisted(() => ({
  createOwnerBillingCheckoutSession: vi.fn(),
  createOwnerBillingPortalSession: vi.fn(),
  hasConfiguredOwnerBillingFlow: vi.fn(),
}));

const ownerServiceMocks = vi.hoisted(() => ({
  getOwnerProfile: vi.fn(),
  getOwnerSubscription: vi.fn(),
}));

const runtimeServiceMocks = vi.hoisted(() => ({
  getRuntimeOpsStatus: vi.fn(),
}));

vi.mock('react-native', () => ({
  Linking: {
    openURL: vi.fn(),
  },
  Platform: {
    OS: 'web' as const,
  },
  Pressable: 'Pressable',
  Text: 'Text',
  View: 'View',
}));

vi.mock('@react-navigation/native', () => ({
  useFocusEffect: vi.fn(),
  useRoute: () => ({
    params: navigationMocks.routeParams,
  }),
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

vi.mock('../context/StorefrontController', () => ({
  useStorefrontProfileController: controllerMocks.useStorefrontProfileController,
}));

vi.mock('../hooks/useStorefrontSummaryData', () => ({
  useSavedSummaries: summaryMocks.useSavedSummaries,
}));

vi.mock('../services/ownerPortalBillingService', () => ({
  createOwnerBillingCheckoutSession: billingServiceMocks.createOwnerBillingCheckoutSession,
  createOwnerBillingPortalSession: billingServiceMocks.createOwnerBillingPortalSession,
  hasConfiguredOwnerBillingFlow: billingServiceMocks.hasConfiguredOwnerBillingFlow,
}));

vi.mock('../services/ownerPortalService', () => ({
  getOwnerProfile: ownerServiceMocks.getOwnerProfile,
  getOwnerSubscription: ownerServiceMocks.getOwnerSubscription,
}));

vi.mock('../services/runtimeOpsService', () => ({
  getRuntimeOpsStatus: runtimeServiceMocks.getRuntimeOpsStatus,
}));

vi.mock('./ownerPortal/ownerPortalStyles', () => ({
  ownerPortalStyles: new Proxy(
    {},
    {
      get: () => ({}),
    },
  ),
}));

vi.mock('./ownerPortal/ownerPortalSubscriptionSections', () => ({
  PREMIUM_FEATURE_COUNT: 6,
  OwnerPortalSubscriptionIntroNotes: 'OwnerPortalSubscriptionIntroNotes',
  OwnerPortalSubscriptionPlanDetails: 'OwnerPortalSubscriptionPlanDetails',
  OwnerPortalSubscriptionReadinessList: 'OwnerPortalSubscriptionReadinessList',
  OwnerPortalTierCards: 'OwnerPortalTierCards',
  PremiumFeatureList: 'PremiumFeatureList',
  formatPlanValue: (value: string) => value,
  isVerifiedStatus: (value: string | null | undefined) => value === 'verified',
}));

import { OwnerPortalSubscriptionScreen } from './OwnerPortalSubscriptionScreen';

describe('OwnerPortalSubscriptionScreen', () => {
  let renderer: ReactTestRenderer | null = null;

  beforeEach(() => {
    if (renderer) {
      act(() => {
        renderer?.unmount();
      });
    }
    renderer = null;
    vi.clearAllMocks();
    navigationMocks.routeParams = { preview: true };
    controllerMocks.useStorefrontProfileController.mockReturnValue({
      authSession: {
        uid: 'owner-1',
        status: 'authenticated',
      },
    });
    summaryMocks.useSavedSummaries.mockReturnValue({
      data: [],
    });
    billingServiceMocks.hasConfiguredOwnerBillingFlow.mockReturnValue(true);
  });

  it('does not load live billing state in preview mode', async () => {
    await act(async () => {
      renderer = create(<OwnerPortalSubscriptionScreen />);
      await Promise.resolve();
    });

    expect(ownerServiceMocks.getOwnerProfile).not.toHaveBeenCalled();
    expect(ownerServiceMocks.getOwnerSubscription).not.toHaveBeenCalled();
    expect(runtimeServiceMocks.getRuntimeOpsStatus).not.toHaveBeenCalled();
  });
});
