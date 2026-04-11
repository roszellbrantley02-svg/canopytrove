import React from 'react';
import type { ReactTestRenderer } from 'react-test-renderer';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const controllerMocks = vi.hoisted(() => ({
  useStorefrontProfileController: vi.fn(),
  useStorefrontQueryController: vi.fn(),
  useStorefrontRewardsController: vi.fn(),
  useStorefrontRouteController: vi.fn(),
}));

const browseSummaryMocks = vi.hoisted(() => ({
  useBrowseSummaries: vi.fn(),
}));

vi.mock('react-native', () => ({
  Platform: {
    OS: 'web' as const,
  },
  View: 'View',
}));

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: vi.fn(),
  }),
}));

vi.mock('../context/StorefrontController', () => ({
  useStorefrontProfileController: controllerMocks.useStorefrontProfileController,
  useStorefrontQueryController: controllerMocks.useStorefrontQueryController,
  useStorefrontRewardsController: controllerMocks.useStorefrontRewardsController,
  useStorefrontRouteController: controllerMocks.useStorefrontRouteController,
}));

vi.mock('../components/ErrorRecoveryCard', () => ({
  ErrorRecoveryCard: (props: Record<string, unknown>) =>
    React.createElement('ErrorRecoveryCard', props),
}));

vi.mock('../components/ScreenShell', () => ({
  ScreenShell: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../components/withScreenErrorBoundary', () => ({
  withScreenErrorBoundary: <T,>(Component: T) => Component,
}));

vi.mock('../hooks/useDebouncedValue', () => ({
  useDebouncedValue: (value: string) => value,
}));

vi.mock('../hooks/useStorefrontSummaryData', () => ({
  useBrowseSummaries: browseSummaryMocks.useBrowseSummaries,
}));

vi.mock('./hotDeals/HotDealsSections', () => ({
  HotDealsEmptyState: () => null,
  HotDealsFilters: () => null,
  HotDealsList: () => null,
  HotDealsMemberGate: () => null,
  HotDealsSkeletonList: () => null,
}));

vi.mock('../services/navigationService', () => ({
  openStorefrontRoute: vi.fn(),
}));

import { HotDealsScreen } from './HotDealsScreen';

describe('HotDealsScreen', () => {
  let renderer: ReactTestRenderer | null = null;

  beforeEach(() => {
    renderer = null;
    vi.clearAllMocks();
    controllerMocks.useStorefrontQueryController.mockReturnValue({
      activeLocationLabel: 'New York',
      activeLocationMode: 'search',
      locationError: null,
      locationQuery: '',
      isResolvingLocation: false,
      storefrontQuery: {
        areaId: 'all',
        searchQuery: '',
        origin: {
          latitude: 40.7128,
          longitude: -74.006,
        },
      },
      setLocationQuery: vi.fn(),
      applyLocationQuery: vi.fn(),
      useDeviceLocation: vi.fn(),
    });
    controllerMocks.useStorefrontProfileController.mockReturnValue({
      authSession: {
        status: 'authenticated',
        uid: 'member-1',
      },
      profileId: 'profile-1',
    });
    controllerMocks.useStorefrontRouteController.mockReturnValue({
      isSavedStorefront: vi.fn(),
    });
    controllerMocks.useStorefrontRewardsController.mockReturnValue({
      trackRouteStartedReward: vi.fn(),
      gamificationState: {
        visitedStorefrontIds: [],
      },
    });
    browseSummaryMocks.useBrowseSummaries.mockReturnValue({
      data: {
        items: [],
        offset: 0,
        hasMore: false,
        total: 0,
      },
      error: 'The backend is unavailable.',
      isLoading: false,
    });
  });

  it('uses the platform label consistently in the empty error state', () => {
    act(() => {
      renderer = create(<HotDealsScreen />);
    });

    const errorCard = renderer!.root.find((node) => String(node.type) === 'ErrorRecoveryCard');

    expect(errorCard.props.title).toBe('Unable to load hot deals');
  });
});
