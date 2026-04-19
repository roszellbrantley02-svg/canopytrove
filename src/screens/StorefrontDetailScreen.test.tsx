import React from 'react';
import type { ReactTestRenderer } from 'react-test-renderer';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const navigationMocks = vi.hoisted(() => ({
  routeParams: { storefrontId: 'initial-slug' } as Record<string, unknown>,
}));

const storefrontSourceMocks = vi.hoisted(() => ({
  resolveStorefrontSlug: vi.fn(),
}));

const summaryMocks = vi.hoisted(() => ({
  useStorefrontSummariesByIds: vi.fn(),
}));

const analyticsMocks = vi.hoisted(() => ({
  trackAnalyticsEvent: vi.fn(),
}));

vi.mock('react-native', () => ({
  ScrollView: 'ScrollView',
  StyleSheet: {
    create: <T,>(styles: T): T => styles,
  },
}));

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: vi.fn(),
    goBack: vi.fn(),
  }),
  useRoute: () => ({
    params: navigationMocks.routeParams,
  }),
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
}));

vi.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

vi.mock('../components/CustomerStateCard', () => ({
  CustomerStateCard: 'CustomerStateCard',
}));

vi.mock('../components/LicensedBadge', () => ({
  LicensedBadge: 'LicensedBadge',
}));

vi.mock('../components/MapGridPreview', () => ({
  MapGridPreview: 'MapGridPreview',
}));

vi.mock('../components/PaymentMethodsBadge', () => ({
  PaymentMethodsBadge: 'PaymentMethodsBadge',
}));

vi.mock('../components/MotionInView', () => ({
  MotionInView: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../components/withScreenErrorBoundary', () => ({
  withScreenErrorBoundary: <T,>(Component: T) => Component,
}));

vi.mock('../hooks/useStorefrontSummaryData', () => ({
  useStorefrontSummariesByIds: summaryMocks.useStorefrontSummariesByIds,
}));

vi.mock('../services/analyticsService', () => ({
  trackAnalyticsEvent: analyticsMocks.trackAnalyticsEvent,
}));

vi.mock('../sources/apiStorefrontSource', () => ({
  resolveStorefrontSlug: storefrontSourceMocks.resolveStorefrontSlug,
}));

vi.mock('./storefrontDetail/StorefrontDetailSections', () => ({
  DetailComplianceWarningSection: 'DetailComplianceWarningSection',
  DetailHero: 'DetailHero',
  DetailHoursSection: 'DetailHoursSection',
  DetailLiveDealsSection: 'DetailLiveDealsSection',
  DetailLiveUpdateUnavailableCard: 'DetailLiveUpdateUnavailableCard',
  DetailLoadingCard: 'DetailLoadingCard',
  DetailLockedLiveDealsSection: 'DetailLockedLiveDealsSection',
  DetailLockedPhotosSection: 'DetailLockedPhotosSection',
  DetailOfficialRecordCard: 'DetailOfficialRecordCard',
  DetailOperationalSection: 'DetailOperationalSection',
  DetailPhotosSection: 'DetailPhotosSection',
  DetailPrimaryActions: 'DetailPrimaryActions',
  DetailReviewsEmptyCard: 'DetailReviewsEmptyCard',
  DetailReviewsSection: 'DetailReviewsSection',
  DetailSecondaryActions: 'DetailSecondaryActions',
  DetailStoreSummarySection: 'DetailStoreSummarySection',
  DetailTopBar: 'DetailTopBar',
}));

vi.mock('./storefrontDetail/useStorefrontDetailScreenModel', () => ({
  useStorefrontDetailScreenModel: vi.fn(() => ({})),
}));

vi.mock('./storefrontDetail/storefrontDetailStyles', () => ({
  styles: {
    gradient: {},
    safeArea: {},
    content: {},
  },
}));

import { StorefrontDetailScreen } from './StorefrontDetailScreen';

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}

describe('StorefrontDetailScreen', () => {
  let renderer: ReactTestRenderer | null = null;
  let lookupCalls: string[][] = [];

  beforeEach(() => {
    if (renderer) {
      act(() => {
        renderer?.unmount();
      });
    }
    renderer = null;
    lookupCalls = [];
    vi.clearAllMocks();
    navigationMocks.routeParams = { storefrontId: 'slug-old' };

    summaryMocks.useStorefrontSummariesByIds.mockImplementation((storefrontIds: string[]) => {
      lookupCalls.push([...storefrontIds]);
      return {
        data: [],
        isLoading: false,
        error: null,
      };
    });
  });

  afterEach(() => {
    if (renderer) {
      act(() => {
        renderer?.unmount();
      });
    }
    renderer = null;
  });

  it('starts a new slug resolution when the route storefront id changes mid-flight', async () => {
    const oldResolution = createDeferred<string | null>();
    const newResolution = createDeferred<string | null>();

    storefrontSourceMocks.resolveStorefrontSlug.mockImplementation((slug: string) => {
      if (slug === 'slug-old') {
        return oldResolution.promise;
      }
      if (slug === 'slug-new') {
        return newResolution.promise;
      }
      return Promise.resolve(null);
    });

    await act(async () => {
      renderer = create(<StorefrontDetailScreen />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(storefrontSourceMocks.resolveStorefrontSlug).toHaveBeenCalledWith('slug-old');

    navigationMocks.routeParams = { storefrontId: 'slug-new' };

    await act(async () => {
      renderer?.update(<StorefrontDetailScreen />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(storefrontSourceMocks.resolveStorefrontSlug).toHaveBeenCalledWith('slug-new');

    await act(async () => {
      oldResolution.resolve('resolved-old');
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(lookupCalls).not.toContainEqual(['resolved-old']);

    await act(async () => {
      newResolution.resolve('resolved-new');
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(storefrontSourceMocks.resolveStorefrontSlug).toHaveBeenCalledTimes(2);
  });
});
