import React from 'react';
import type { ReactTestRenderer } from 'react-test-renderer';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const navigationMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
}));

const controllerMocks = vi.hoisted(() => ({
  useStorefrontProfileController: vi.fn(),
  useStorefrontQueryController: vi.fn(),
  useStorefrontRewardsController: vi.fn(),
  useStorefrontRouteController: vi.fn(),
}));

const nearbySummaryMocks = vi.hoisted(() => ({
  useNearbySummaries: vi.fn(),
  useNearbyWarmSnapshot: vi.fn(),
}));

vi.mock('react-native', () => ({
  View: 'View',
}));

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: navigationMocks.navigate,
  }),
}));

vi.mock('../context/StorefrontController', () => ({
  useStorefrontProfileController: controllerMocks.useStorefrontProfileController,
  useStorefrontQueryController: controllerMocks.useStorefrontQueryController,
  useStorefrontRewardsController: controllerMocks.useStorefrontRewardsController,
  useStorefrontRouteController: controllerMocks.useStorefrontRouteController,
}));

vi.mock('../components/ErrorRecoveryCard', () => ({
  ErrorRecoveryCard: () => null,
}));

vi.mock('../components/MotionInView', () => ({
  MotionInView: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../components/ScreenShell', () => ({
  ScreenShell: ({
    children,
    onHeaderPillPress,
  }: {
    children: React.ReactNode;
    onHeaderPillPress?: () => void;
  }) =>
    React.createElement(
      React.Fragment,
      null,
      onHeaderPillPress
        ? React.createElement('HeaderPillButton', { onPress: onHeaderPillPress })
        : null,
      children,
    ),
}));

vi.mock('../components/withScreenErrorBoundary', () => ({
  withScreenErrorBoundary: <T,>(Component: T) => Component,
}));

vi.mock('../hooks/useStorefrontSummaryData', () => ({
  useNearbySummaries: nearbySummaryMocks.useNearbySummaries,
  useNearbyWarmSnapshot: nearbySummaryMocks.useNearbyWarmSnapshot,
}));

vi.mock('../repositories/storefrontRepository', () => ({
  storefrontRepository: {
    prefetchStorefrontDetails: vi.fn(),
  },
}));

vi.mock('../services/analyticsService', () => ({
  classifyLocationInput: vi.fn(() => 'zip'),
  trackAnalyticsEvent: vi.fn(),
  trackStorefrontPromotionImpressions: vi.fn(),
  trackStorefrontImpressions: vi.fn(),
}));

vi.mock('../services/navigationService', () => ({
  openStorefrontRoute: vi.fn(),
}));

vi.mock('./nearby/NearbySections', () => ({
  NearbyEmptyState: () => null,
  NearbyInfoBanner: () => null,
  NearbyLocationPanel: (props: Record<string, unknown>) =>
    React.createElement('NearbyLocationPanel', props),
  NearbySkeletonList: () => null,
  NearbyStoreList: () => null,
}));

import { NearbyScreen } from './NearbyScreen';

function flushEffects() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('NearbyScreen', () => {
  let renderer: ReactTestRenderer | null = null;
  let requestDeviceLocation: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    renderer = null;
    requestDeviceLocation = vi.fn().mockResolvedValue(true);
    vi.clearAllMocks();
    controllerMocks.useStorefrontQueryController.mockReturnValue({
      activeLocation: {
        latitude: 40.7128,
        longitude: -74.006,
      },
      activeLocationLabel: 'New York',
      activeLocationMode: 'search',
      deviceLocation: {
        latitude: 40.7128,
        longitude: -74.006,
      },
      searchLocation: null,
      locationQuery: '',
      isResolvingLocation: false,
      locationError: null,
      applyLocationQuery: vi.fn().mockResolvedValue(true),
      setLocationQuery: vi.fn(),
      useDeviceLocation: requestDeviceLocation,
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
    nearbySummaryMocks.useNearbySummaries.mockReturnValue({
      data: [],
      error: null,
      isLoading: false,
    });
    nearbySummaryMocks.useNearbyWarmSnapshot.mockReturnValue([]);
  });

  afterEach(() => {
    renderer?.unmount();
  });

  function findAllByTypeName(typeName: string) {
    return renderer!.root.findAll((node) => String(node.type) === typeName);
  }

  function findByTypeName(typeName: string) {
    return renderer!.root.find((node) => String(node.type) === typeName);
  }

  it('closes the location panel after a successful device-location refresh', async () => {
    await act(async () => {
      renderer = create(<NearbyScreen />);
      await flushEffects();
    });

    expect(findAllByTypeName('NearbyLocationPanel')).toHaveLength(0);

    await act(async () => {
      findByTypeName('HeaderPillButton').props.onPress();
      await flushEffects();
    });

    expect(findAllByTypeName('NearbyLocationPanel')).toHaveLength(1);

    await act(async () => {
      findByTypeName('NearbyLocationPanel').props.handleUseDeviceLocation();
      await flushEffects();
      await flushEffects();
    });

    expect(requestDeviceLocation).toHaveBeenCalledTimes(1);
    expect(findAllByTypeName('NearbyLocationPanel')).toHaveLength(0);
  });
});
