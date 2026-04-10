import React from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  useStorefrontProfileController,
  useStorefrontQueryController,
  useStorefrontRewardsController,
  useStorefrontRouteController,
} from '../context/StorefrontController';
import { ErrorRecoveryCard } from '../components/ErrorRecoveryCard';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import { useNearbySummaries, useNearbyWarmSnapshot } from '../hooks/useStorefrontSummaryData';
import { spacing } from '../theme/tokens';
import {
  classifyLocationInput,
  trackAnalyticsEvent,
  trackStorefrontPromotionImpressions,
  trackStorefrontImpressions,
} from '../services/analyticsService';
import { storefrontRepository } from '../repositories/storefrontRepository';
import { openStorefrontRoute } from '../services/navigationService';
import type { RootStackParamList, RootTabParamList } from '../navigation/RootNavigator';
import {
  NearbyEmptyState,
  NearbyInfoBanner,
  NearbyLocationPanel,
  NearbySkeletonList,
  NearbyStoreList,
} from './nearby/NearbySections';

type NearbyNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<RootTabParamList, 'Nearby'>,
  NativeStackNavigationProp<RootStackParamList>
>;

function NearbyScreenInner() {
  const navigation = useNavigation<NearbyNavigationProp>();
  const [isLocationPanelOpen, setIsLocationPanelOpen] = React.useState(false);
  const prefetchedDetailIdsRef = React.useRef(new Set<string>());
  const warmNearbyData = useNearbyWarmSnapshot();
  const {
    activeLocation,
    activeLocationLabel,
    activeLocationMode,
    deviceLocation,
    searchLocation,
    locationQuery,
    isResolvingLocation,
    locationError,
    applyLocationQuery,
    setLocationQuery,
    useDeviceLocation: requestDeviceLocation,
  } = useStorefrontQueryController();
  const { authSession, profileId } = useStorefrontProfileController();
  const { isSavedStorefront } = useStorefrontRouteController();
  const {
    gamificationState: { visitedStorefrontIds },
  } = useStorefrontRewardsController();
  const hasNearbyOrigin = Boolean(deviceLocation || searchLocation);
  const currentLocationLabel = hasNearbyOrigin ? activeLocationLabel : 'Set Location';

  const nearbyQuery = React.useMemo(
    () =>
      hasNearbyOrigin
        ? {
            areaId: 'nearby',
            searchQuery: '',
            origin: activeLocation,
            locationLabel: activeLocationLabel,
          }
        : null,
    [activeLocation, activeLocationLabel, hasNearbyOrigin],
  );

  const { data, error, isLoading } = useNearbySummaries(nearbyQuery);
  const visibleData = React.useMemo(
    () => (data.length ? data : warmNearbyData.slice(0, 3)),
    [data, warmNearbyData],
  );
  const isShowingWarmSnapshot =
    visibleData.length > 0 &&
    (!data.length || !hasNearbyOrigin || isResolvingLocation || isLoading);

  React.useEffect(() => {
    if (!visibleData.length) {
      return;
    }

    trackStorefrontImpressions(
      visibleData.map((storefront) => storefront.id),
      'Nearby',
    );
    trackStorefrontPromotionImpressions(visibleData, 'Nearby');
  }, [visibleData]);

  React.useEffect(() => {
    const nextCandidates = visibleData.slice(0, 3);
    nextCandidates.forEach((storefront) => {
      if (prefetchedDetailIdsRef.current.has(storefront.id)) {
        return;
      }

      prefetchedDetailIdsRef.current.add(storefront.id);
      void storefrontRepository.prefetchStorefrontDetails(storefront.id);
    });
  }, [visibleData]);

  const prepareStorefrontDetail = React.useCallback((storefrontId: string) => {
    void storefrontRepository.prefetchStorefrontDetails(storefrontId);
  }, []);

  const handleUseDeviceLocation = React.useCallback(() => {
    void requestDeviceLocation().then((didRefresh) => {
      trackAnalyticsEvent(didRefresh ? 'location_granted' : 'location_denied', {
        source: 'nearby',
        locationMode: 'device',
      });
      if (didRefresh) {
        trackAnalyticsEvent('location_changed', {
          source: 'nearby',
          locationMode: 'device',
        });
      }
      if (didRefresh) {
        setIsLocationPanelOpen(false);
      }
    });
  }, [requestDeviceLocation]);

  const handleApplyLocationQuery = React.useCallback(() => {
    void applyLocationQuery().then((didApply) => {
      trackAnalyticsEvent(didApply ? 'location_changed' : 'location_denied', {
        source: 'nearby',
        locationMode: 'search',
        locationInputKind: classifyLocationInput(locationQuery),
      });
      if (didApply) {
        setIsLocationPanelOpen(false);
      }
    });
  }, [applyLocationQuery, locationQuery]);

  const handleToggleLocationPanel = React.useCallback(() => {
    setIsLocationPanelOpen((current) => !current);
  }, []);

  const handleRetryError = React.useCallback(() => {
    // Retry by re-requesting device location
    void requestDeviceLocation();
  }, [requestDeviceLocation]);

  const handleGoNow = React.useCallback(
    (store: (typeof visibleData)[number]) => {
      trackAnalyticsEvent(
        'go_now_tapped',
        {
          sourceScreen: 'Nearby',
        },
        {
          screen: 'Nearby',
          storefrontId: store.id,
          dealId: store.activePromotionId ?? undefined,
        },
      );
      if (store.activePromotionId) {
        trackAnalyticsEvent(
          'deal_redeem_started',
          {
            sourceScreen: 'Nearby',
          },
          {
            screen: 'Nearby',
            storefrontId: store.id,
            dealId: store.activePromotionId,
          },
        );
      }
      void openStorefrontRoute(store, 'verified', {
        profileId,
        accountId: authSession.status === 'authenticated' ? authSession.uid : null,
        isAuthenticated: authSession.status === 'authenticated',
        sourceScreen: 'Nearby',
        storefront: store,
      });
    },
    [authSession.status, authSession.uid, profileId],
  );

  return (
    <ScreenShell
      eyebrow="Nearby"
      title="Storefronts nearby"
      subtitle={
        hasNearbyOrigin
          ? `Showing storefronts near ${activeLocationLabel}.`
          : 'Use your location or enter a ZIP code, city, or address to see storefronts nearby.'
      }
      headerPill={currentLocationLabel}
      onBrandIconPress={handleUseDeviceLocation}
      onHeaderPillPress={handleToggleLocationPanel}
      resetScrollOnFocus={true}
    >
      {isLocationPanelOpen ? (
        <MotionInView delay={20} distance={8}>
          <NearbyLocationPanel
            activeLocationMode={activeLocationMode}
            locationQuery={locationQuery}
            setLocationQuery={setLocationQuery}
            handleApplyLocationQuery={handleApplyLocationQuery}
            handleUseDeviceLocation={handleUseDeviceLocation}
            handleToggleLocationPanel={handleToggleLocationPanel}
            isResolvingLocation={isResolvingLocation}
            locationError={locationError}
          />
        </MotionInView>
      ) : null}

      {isShowingWarmSnapshot ? (
        <MotionInView delay={30} distance={6}>
          <NearbyInfoBanner />
        </MotionInView>
      ) : null}

      {isShowingWarmSnapshot ? (
        <NearbyStoreList
          storefronts={visibleData}
          isSavedStorefront={isSavedStorefront}
          visitedStorefrontIds={visitedStorefrontIds}
          onPrepareStorefront={prepareStorefrontDetail}
          onOpenStorefront={(store) =>
            navigation.navigate('StorefrontDetail', { storefrontId: store.id, storefront: store })
          }
          onGoNow={handleGoNow}
          delayBase={40}
        />
      ) : error && hasNearbyOrigin && !isLoading ? (
        <View style={{ padding: spacing.xl, paddingTop: spacing.xxl }}>
          <ErrorRecoveryCard
            title="Unable to load nearby storefronts"
            message={error}
            onRetry={handleRetryError}
            retryLabel="Try Again"
          />
        </View>
      ) : (!hasNearbyOrigin && isResolvingLocation) || (hasNearbyOrigin && isLoading) ? (
        <NearbySkeletonList count={3} delayBase={40} />
      ) : !hasNearbyOrigin ? (
        <MotionInView delay={80}>
          <NearbyEmptyState
            title="Set your location"
            body="Use your current location or enter a ZIP code, city, or address to see storefronts nearby."
            errorText={locationError}
            primaryLabel="Use Device Location"
            secondaryLabel="Enter Location"
            onPrimary={handleUseDeviceLocation}
            onSecondary={handleToggleLocationPanel}
          />
        </MotionInView>
      ) : data.length === 0 ? (
        <MotionInView delay={80}>
          <NearbyEmptyState
            title="No storefronts found nearby"
            body="We could not find any storefronts close to this location yet."
            errorText={error}
            primaryLabel={error ? 'Try Again' : 'Refresh Location'}
            secondaryLabel="Change Location"
            onPrimary={handleUseDeviceLocation}
            onSecondary={handleToggleLocationPanel}
          />
        </MotionInView>
      ) : (
        <NearbyStoreList
          storefronts={data}
          isSavedStorefront={isSavedStorefront}
          visitedStorefrontIds={visitedStorefrontIds}
          onPrepareStorefront={prepareStorefrontDetail}
          onOpenStorefront={(store) =>
            navigation.navigate('StorefrontDetail', { storefrontId: store.id, storefront: store })
          }
          onGoNow={handleGoNow}
          delayBase={40}
        />
      )}
    </ScreenShell>
  );
}

export const NearbyScreen = withScreenErrorBoundary(NearbyScreenInner, 'nearby-screen');
