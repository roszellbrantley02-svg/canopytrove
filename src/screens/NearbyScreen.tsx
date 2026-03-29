import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  useStorefrontProfileController,
  useStorefrontQueryController,
  useStorefrontRewardsController,
  useStorefrontRouteController,
} from '../context/StorefrontController';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { useNearbySummaries, useNearbyWarmSnapshot } from '../hooks/useStorefrontData';
import {
  classifyLocationInput,
  trackAnalyticsEvent,
  trackStorefrontPromotionImpressions,
  trackStorefrontImpressions,
} from '../services/analyticsService';
import { storefrontRepository } from '../repositories/storefrontRepository';
import { openStorefrontRoute } from '../services/navigationService';
import { RootStackParamList, RootTabParamList } from '../navigation/RootNavigator';
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

export function NearbyScreen() {
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
    useDeviceLocation,
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
    [activeLocation, activeLocationLabel, hasNearbyOrigin]
  );

  const { data, isLoading } = useNearbySummaries(nearbyQuery);
  const visibleData = React.useMemo(
    () => (data.length ? data : warmNearbyData.slice(0, 3)),
    [data, warmNearbyData]
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
      'Nearby'
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
    void useDeviceLocation().then((didRefresh) => {
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
  }, [useDeviceLocation]);

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
  return (
    <ScreenShell
      eyebrow="Nearby"
      title="Closest dispensaries."
      subtitle={
        hasNearbyOrigin
          ? `Showing the three closest shops near ${activeLocationLabel}.`
          : 'Use your location or enter a ZIP code or address to see the three closest shops.'
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
          onOpenStorefront={(store) => navigation.navigate('StorefrontDetail', { storefront: store })}
          onGoNow={(store) => {
            trackAnalyticsEvent(
              'go_now_tapped',
              {
                sourceScreen: 'Nearby',
              },
              {
                screen: 'Nearby',
                storefrontId: store.id,
                dealId: store.activePromotionId ?? undefined,
              }
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
                }
              );
            }
            void openStorefrontRoute(store, 'verified', {
              profileId,
              accountId: authSession.status === 'authenticated' ? authSession.uid : null,
              isAuthenticated: authSession.status === 'authenticated',
              sourceScreen: 'Nearby',
              storefront: store,
            });
          }}
          delayBase={40}
        />
      ) : (!hasNearbyOrigin && isResolvingLocation) || (hasNearbyOrigin && isLoading) ? (
        <NearbySkeletonList count={3} delayBase={40} />
      ) : !hasNearbyOrigin ? (
        <MotionInView delay={80}>
          <NearbyEmptyState
            title="Location access is required."
            body="Nearby is built around the three closest shops to your current location or a ZIP code or address you enter."
            errorText={locationError}
            primaryLabel="Use My Location"
            secondaryLabel="Enter Location"
            onPrimary={handleUseDeviceLocation}
            onSecondary={handleToggleLocationPanel}
          />
        </MotionInView>
      ) : data.length === 0 ? (
        <MotionInView delay={80}>
            <NearbyEmptyState
              title="No nearby dispensaries found."
              body="Canopy Trove could not find any verified dispensaries close to this location yet."
              primaryLabel="Refresh Location"
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
          onOpenStorefront={(store) => navigation.navigate('StorefrontDetail', { storefront: store })}
          onGoNow={(store) => {
            trackAnalyticsEvent(
              'go_now_tapped',
              {
                sourceScreen: 'Nearby',
              },
              {
                screen: 'Nearby',
                storefrontId: store.id,
                dealId: store.activePromotionId ?? undefined,
              }
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
                }
              );
            }
            void openStorefrontRoute(store, 'verified', {
              profileId,
              accountId: authSession.status === 'authenticated' ? authSession.uid : null,
              isAuthenticated: authSession.status === 'authenticated',
              sourceScreen: 'Nearby',
              storefront: store,
            });
          }}
          delayBase={40}
        />
      )}
    </ScreenShell>
  );
}
