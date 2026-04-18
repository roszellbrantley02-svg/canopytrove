import React from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  useStorefrontProfileController,
  useStorefrontQueryController,
  useStorefrontRewardsController,
  useStorefrontRouteController,
} from '../context/StorefrontController';
import { BrowseFiltersBar } from '../components/BrowseFiltersBar';
import { ErrorRecoveryCard } from '../components/ErrorRecoveryCard';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import { useBrowseSummaries } from '../hooks/useStorefrontSummaryData';
import { spacing } from '../theme/tokens';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { storefrontRepository } from '../repositories/storefrontRepository';
import {
  classifyLocationInput,
  trackAnalyticsEvent,
  trackStorefrontPromotionImpressions,
  trackStorefrontImpressions,
} from '../services/analyticsService';
import { openStorefrontRoute } from '../services/navigationService';
import type { StorefrontSummary } from '../types/storefront';
import {
  BrowseContextBar,
  BrowseEmptyState,
  BrowseSkeletonList,
  BrowseStoreList,
} from './browse/BrowseSections';

const PAGE_SIZE = 8;

function BrowseScreenInner() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [offset, setOffset] = React.useState(0);
  const [items, setItems] = React.useState<StorefrontSummary[]>([]);
  const [loadMoreRefetchKey, setLoadMoreRefetchKey] = React.useState(0);
  const lastPrefetchedPageKeyRef = React.useRef('');
  const prefetchedDetailIdsRef = React.useRef(new Set<string>());
  const { authSession, profileId } = useStorefrontProfileController();
  const {
    activeLocationLabel,
    locationError,
    locationQuery,
    isResolvingLocation,
    searchQuery,
    browseSortKey,
    browseHotDealsOnly,
    storefrontQuery,
    applyLocationQuery,
    useDeviceLocation: requestDeviceLocation,
    setLocationQuery,
    setSearchQuery,
    setBrowseSortKey,
    setBrowseHotDealsOnly,
  } = useStorefrontQueryController();
  const { isSavedStorefront } = useStorefrontRouteController();
  const {
    trackRouteStartedReward,
    gamificationState: { visitedStorefrontIds },
  } = useStorefrontRewardsController();
  const isMemberAuthenticated = authSession.status === 'authenticated';
  const effectiveBrowseHotDealsOnly = isMemberAuthenticated ? browseHotDealsOnly : false;

  const query = React.useMemo(
    () => ({
      ...storefrontQuery,
      areaId: undefined,
      hotDealsOnly: effectiveBrowseHotDealsOnly,
    }),
    [effectiveBrowseHotDealsOnly, storefrontQuery],
  );

  const { data, error, isLoading } = useBrowseSummaries(query, browseSortKey, PAGE_SIZE, offset, {
    refetchKey: loadMoreRefetchKey,
  });

  const handleLoadMoreRetry = React.useCallback(() => {
    // Bump the refetch key so the hook re-runs the fetch at the same
    // offset without advancing the page — the previous attempt already
    // moved offset forward, so retry should repeat that same call.
    setLoadMoreRefetchKey((current) => current + 1);
  }, []);

  const handleApplyLocationQuery = React.useCallback(() => {
    void applyLocationQuery().then((didApply) => {
      trackAnalyticsEvent(didApply ? 'location_changed' : 'location_denied', {
        source: 'browse',
        locationMode: 'search',
        locationInputKind: classifyLocationInput(locationQuery),
      });
    });
  }, [applyLocationQuery, locationQuery]);

  const handleUseDeviceLocation = React.useCallback(() => {
    void requestDeviceLocation().then((didRefresh) => {
      trackAnalyticsEvent(didRefresh ? 'location_changed' : 'location_denied', {
        source: 'browse',
        locationMode: 'device',
      });
    });
  }, [requestDeviceLocation]);

  const handleToggleHotDeals = React.useCallback(() => {
    if (!isMemberAuthenticated) {
      navigation.navigate('Tabs', { screen: 'HotDeals' });
      return;
    }

    const nextValue = !effectiveBrowseHotDealsOnly;
    setBrowseHotDealsOnly(nextValue);
    trackAnalyticsEvent('hot_deals_toggled', {
      source: 'browse',
      enabled: nextValue,
    });
  }, [effectiveBrowseHotDealsOnly, isMemberAuthenticated, navigation, setBrowseHotDealsOnly]);

  const handleClearHotDeals = React.useCallback(() => {
    setBrowseHotDealsOnly(false);
  }, [setBrowseHotDealsOnly]);

  const handleClearSearch = React.useCallback(() => {
    setSearchQuery('');
  }, [setSearchQuery]);

  const handleRetryError = React.useCallback(() => {
    // Clear items first to ensure error is visible if retry also fails,
    // then reset offset to trigger a fresh data fetch
    React.startTransition(() => {
      setItems([]);
    });
    setOffset(0);
  }, []);

  React.useEffect(() => {
    if (isMemberAuthenticated || !browseHotDealsOnly) {
      return;
    }

    setBrowseHotDealsOnly(false);
  }, [browseHotDealsOnly, isMemberAuthenticated, setBrowseHotDealsOnly]);

  React.useEffect(() => {
    React.startTransition(() => {
      setItems([]);
    });
    setOffset(0);
    lastPrefetchedPageKeyRef.current = '';
    prefetchedDetailIdsRef.current = new Set();
  }, [activeLocationLabel, browseSortKey, effectiveBrowseHotDealsOnly, searchQuery]);

  React.useEffect(() => {
    if (isLoading) {
      return;
    }

    React.startTransition(() => {
      setItems((current) => {
        if (data.offset === 0) {
          return data.items;
        }

        const seen = new Set(current.map((item) => item.id));
        const nextItems = data.items.filter((item) => !seen.has(item.id));
        return current.concat(nextItems);
      });
    });
  }, [data.items, data.offset, isLoading]);

  React.useEffect(() => {
    if (!items.length) {
      return;
    }

    trackStorefrontImpressions(
      items.map((storefront) => storefront.id),
      'Browse',
    );
    trackStorefrontPromotionImpressions(items, 'Browse');
  }, [items]);

  React.useEffect(() => {
    if (!items.length) {
      return;
    }

    const nextCandidates = items.slice(0, PAGE_SIZE);
    const idsToFetch = nextCandidates
      .filter((s) => !prefetchedDetailIdsRef.current.has(s.id))
      .map((s) => s.id);

    if (!idsToFetch.length) {
      return;
    }

    // Mark immediately to avoid duplicate scheduling
    idsToFetch.forEach((id) => prefetchedDetailIdsRef.current.add(id));

    // Defer prefetch until browser is idle so it doesn't compete
    // with the primary data fetch for network connections.
    let cancelled = false;
    const cancel = () => {
      cancelled = true;
    };

    const run = () => {
      if (!cancelled) {
        void storefrontRepository.prefetchStorefrontDetailsBatch(idsToFetch);
      }
    };

    if (typeof requestIdleCallback === 'function') {
      const handle = requestIdleCallback(run);
      return () => {
        cancel();
        cancelIdleCallback(handle);
      };
    }

    const timer = setTimeout(run, 200);
    return () => {
      cancel();
      clearTimeout(timer);
    };
  }, [items]);

  const prepareStorefrontDetail = React.useCallback((storefrontId: string) => {
    void storefrontRepository.prefetchStorefrontDetails(storefrontId);
  }, []);

  React.useEffect(() => {
    if (isLoading || !data.hasMore) {
      return;
    }

    const nextPageKey = `${query.areaId ?? 'all'}:${query.searchQuery}:${query.origin.latitude.toFixed(3)}:${query.origin.longitude.toFixed(3)}:${browseSortKey}:${offset + PAGE_SIZE}`;
    if (nextPageKey === lastPrefetchedPageKeyRef.current) {
      return;
    }

    lastPrefetchedPageKeyRef.current = nextPageKey;
    void storefrontRepository.prefetchBrowseSummaries(
      query,
      browseSortKey,
      PAGE_SIZE,
      offset + PAGE_SIZE,
    );
  }, [browseSortKey, data.hasMore, isLoading, offset, query]);

  return (
    <ScreenShell
      eyebrow="Browse"
      title="Browse storefronts"
      subtitle="Pick a location, then narrow things down by distance, rating, reviews, or live offers."
      showTopBar={false}
      showHero={false}
      resetScrollOnFocus={true}
    >
      <MotionInView delay={120}>
        <BrowseFiltersBar
          locationQuery={locationQuery}
          onLocationQueryChange={setLocationQuery}
          onApplyLocationQuery={handleApplyLocationQuery}
          onUseDeviceLocation={handleUseDeviceLocation}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          onClearSearch={handleClearSearch}
          isResolvingLocation={isResolvingLocation}
          locationError={locationError}
          sortKey={browseSortKey}
          onSelectSort={(nextSortKey) => {
            setBrowseSortKey(nextSortKey);
            trackAnalyticsEvent('browse_sort_changed', {
              source: 'browse',
              sortKey: nextSortKey,
            });
          }}
          hotDealsOnly={effectiveBrowseHotDealsOnly}
          onToggleHotDeals={handleToggleHotDeals}
        />
      </MotionInView>

      <MotionInView delay={160}>
        <BrowseContextBar
          locationLabel={activeLocationLabel}
          searchQuery={searchQuery}
          sortKey={browseSortKey}
        />
      </MotionInView>

      {error && items.length === 0 ? (
        <View style={{ padding: spacing.xl, paddingTop: spacing.xxl }}>
          <ErrorRecoveryCard
            title="Unable to load storefronts"
            message={error}
            onRetry={handleRetryError}
            retryLabel="Refresh"
          />
        </View>
      ) : isLoading && items.length === 0 ? (
        <BrowseSkeletonList count={PAGE_SIZE} delayBase={180} />
      ) : items.length === 0 ? (
        <MotionInView delay={180}>
          <BrowseEmptyState
            searchQuery={searchQuery}
            hotDealsOnly={effectiveBrowseHotDealsOnly}
            locationLabel={activeLocationLabel}
            errorText={error}
            showClearSearch={Boolean(searchQuery.trim())}
            showClearHotDeals={effectiveBrowseHotDealsOnly}
            onClearSearch={handleClearSearch}
            onClearHotDeals={handleClearHotDeals}
          />
        </MotionInView>
      ) : (
        <BrowseStoreList
          items={items}
          isSavedStorefront={isSavedStorefront}
          visitedStorefrontIds={visitedStorefrontIds}
          onPrepareStorefront={prepareStorefrontDetail}
          onOpenStorefront={(item) =>
            navigation.navigate('StorefrontDetail', { storefrontId: item.id, storefront: item })
          }
          onGoNow={(item) => {
            trackAnalyticsEvent(
              'go_now_tapped',
              {
                sourceScreen: 'Browse',
              },
              {
                screen: 'Browse',
                storefrontId: item.id,
                dealId: item.activePromotionId ?? undefined,
              },
            );
            if (item.activePromotionId) {
              trackAnalyticsEvent(
                'deal_redeem_started',
                {
                  sourceScreen: 'Browse',
                },
                {
                  screen: 'Browse',
                  storefrontId: item.id,
                  dealId: item.activePromotionId,
                },
              );
            }
            void openStorefrontRoute(item, 'verified', {
              profileId,
              accountId: authSession.status === 'authenticated' ? authSession.uid : null,
              isAuthenticated: authSession.status === 'authenticated',
              sourceScreen: 'Browse',
              storefront: item,
              onRouteStarted: trackRouteStartedReward,
            });
          }}
          hasMore={data.hasMore}
          isLoading={isLoading}
          total={data.total}
          onLoadMore={() => setOffset((current) => current + PAGE_SIZE)}
          loadMoreError={error}
          onLoadMoreRetry={handleLoadMoreRetry}
        />
      )}
    </ScreenShell>
  );
}

export const BrowseScreen = withScreenErrorBoundary(BrowseScreenInner, 'browse-screen');
