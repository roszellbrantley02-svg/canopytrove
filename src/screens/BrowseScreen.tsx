import React from 'react';
import { Platform, View } from 'react-native';
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
import { supportsStorefrontPromotionUi } from '../config/playStorePolicy';
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

/**
 * Build a stable identity string for a query. Used to detect stale `data`
 * that belongs to a previous query still being held by the data hook while
 * the new fetch is in flight — without this, a mid-flight query change plus
 * a prior load-more could mix two queries' rows into the visible list.
 */
function buildBrowseQueryIdentity(
  areaId: string | null | undefined,
  searchQuery: string,
  latitude: number,
  longitude: number,
  sortKey: string,
  hotDealsOnly: boolean,
): string {
  return [
    areaId ?? 'all',
    searchQuery,
    latitude.toFixed(3),
    longitude.toFixed(3),
    sortKey,
    hotDealsOnly ? '1' : '0',
  ].join(':');
}

function BrowseScreenInner() {
  const isAndroid = Platform.OS === 'android';
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [offset, setOffset] = React.useState(0);
  const [items, setItems] = React.useState<StorefrontSummary[]>([]);
  const [loadMoreRefetchKey, setLoadMoreRefetchKey] = React.useState(0);
  const lastPrefetchedPageKeyRef = React.useRef('');
  const prefetchedDetailIdsRef = React.useRef(new Set<string>());
  // Which query identity does the current `items` list reflect? Used to drop
  // mid-flight data that belongs to a query the user has already moved on from.
  const itemsQueryIdentityRef = React.useRef<string>('');
  // Per-instance rapid-tap guard for the Get Directions button. Caps
  // the May 3 2026 forensic finding where one user fired 132
  // go_now_tapped events to a single store in 30s while mashing the
  // button. 3-second debounce window per storefront.
  const lastDirectionsTapRef = React.useRef<{ storefrontId: string; at: number } | null>(null);
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
  const effectiveBrowseHotDealsOnly =
    supportsStorefrontPromotionUi && isMemberAuthenticated ? browseHotDealsOnly : false;

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

  // Identity string for the query + sort combination currently being shown.
  // Recomputed each render; cheap (string concat of 6 scalars).
  const currentQueryIdentity = React.useMemo(
    () =>
      buildBrowseQueryIdentity(
        query.areaId,
        query.searchQuery,
        query.origin.latitude,
        query.origin.longitude,
        browseSortKey,
        effectiveBrowseHotDealsOnly,
      ),
    [
      browseSortKey,
      effectiveBrowseHotDealsOnly,
      query.areaId,
      query.origin.latitude,
      query.origin.longitude,
      query.searchQuery,
    ],
  );

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
    if (!supportsStorefrontPromotionUi) {
      navigation.navigate('Tabs', { screen: 'HotDeals' });
      return;
    }

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
    if ((supportsStorefrontPromotionUi && isMemberAuthenticated) || !browseHotDealsOnly) {
      return;
    }

    setBrowseHotDealsOnly(false);
  }, [browseHotDealsOnly, isMemberAuthenticated, setBrowseHotDealsOnly]);

  React.useEffect(() => {
    React.startTransition(() => {
      setItems([]);
    });
    setOffset(0);
    // Reset the "which query does items belong to" tag — we're starting over.
    itemsQueryIdentityRef.current = '';
    lastPrefetchedPageKeyRef.current = '';
    prefetchedDetailIdsRef.current = new Set();
  }, [currentQueryIdentity]);

  React.useEffect(() => {
    if (isLoading) {
      return;
    }

    // Snapshot the identity the current `data` payload was fetched for.
    // The data hook can still be holding the previous query's result during
    // the brief window between a query change and the new fetch resolving.
    // Appending that stale data to a just-cleared items array would leak
    // rows from the old query into the new query's list — visible as
    // ghost-results that don't match the filter the user just applied.
    const incomingIdentity = currentQueryIdentity;

    React.startTransition(() => {
      setItems((current) => {
        // If the incoming page is offset 0, it's a fresh query — always
        // replace + tag items with this query's identity.
        if (data.offset === 0) {
          itemsQueryIdentityRef.current = incomingIdentity;
          return data.items;
        }

        // For subsequent pages, only append when the incoming data is for
        // the same query as the current items. Otherwise drop it on the
        // floor; the hook will refetch for the new query momentarily.
        if (itemsQueryIdentityRef.current !== incomingIdentity) {
          return current;
        }

        const seen = new Set(current.map((item) => item.id));
        const nextItems = data.items.filter((item) => !seen.has(item.id));
        if (!nextItems.length) {
          return current;
        }
        return current.concat(nextItems);
      });
    });
  }, [currentQueryIdentity, data.items, data.offset, isLoading]);

  React.useEffect(() => {
    if (!items.length) {
      return;
    }

    // Pass full summary objects so payment-methods metadata folds into
    // the impression event (ex: paymentMethodsAcceptedCount) instead of
    // firing a separate badge_shown event in lockstep. May 3 2026
    // cleanup — was ~30% of analytics volume with zero added signal.
    trackStorefrontImpressions(items, 'Browse');
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

    // Page key = current query identity + the next offset. Matches the logic
    // used by the merge effect so we stay consistent about what counts as
    // "the same query I already prefetched for".
    const nextPageKey = `${currentQueryIdentity}:${offset + PAGE_SIZE}`;
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
  }, [browseSortKey, currentQueryIdentity, data.hasMore, isLoading, offset, query]);

  return (
    <ScreenShell
      eyebrow="Browse"
      title="Browse storefronts"
      subtitle={
        isAndroid
          ? 'Pick a location, then narrow things down by distance, rating, or reviews.'
          : 'Pick a location, then narrow things down by distance, rating, reviews, or live offers.'
      }
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
            const now = Date.now();
            const last = lastDirectionsTapRef.current;
            if (last && last.storefrontId === item.id && now - last.at < 3000) {
              return;
            }
            lastDirectionsTapRef.current = { storefrontId: item.id, at: now };

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
