import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  useStorefrontProfileController,
  useStorefrontQueryController,
  useStorefrontRewardsController,
  useStorefrontRouteController,
} from '../context/StorefrontController';
import { BrowseFiltersBar } from '../components/BrowseFiltersBar';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { useBrowseSummaries } from '../hooks/useStorefrontData';
import { RootStackParamList } from '../navigation/RootNavigator';
import { storefrontRepository } from '../repositories/storefrontRepository';
import {
  classifyLocationInput,
  trackAnalyticsEvent,
  trackStorefrontPromotionImpressions,
  trackStorefrontImpressions,
} from '../services/analyticsService';
import { openStorefrontRoute } from '../services/navigationService';
import { StorefrontSummary } from '../types/storefront';
import {
  BrowseContextBar,
  BrowseEmptyState,
  BrowseSkeletonList,
  BrowseStoreList,
} from './browse/BrowseSections';

const PAGE_SIZE = 4;

export function BrowseScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [offset, setOffset] = React.useState(0);
  const [items, setItems] = React.useState<StorefrontSummary[]>([]);
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
    setLocationQuery,
    setSearchQuery,
    setBrowseSortKey,
    setBrowseHotDealsOnly,
  } = useStorefrontQueryController();
  const { isSavedStorefront } = useStorefrontRouteController();
  const {
    gamificationState: { visitedStorefrontIds },
  } = useStorefrontRewardsController();

  const query = React.useMemo(
    () => ({
      ...storefrontQuery,
      areaId: 'all',
      searchQuery: '',
    }),
    [storefrontQuery]
  );

  const { data, isLoading } = useBrowseSummaries(query, browseSortKey, PAGE_SIZE, offset);

  const handleApplyLocationQuery = React.useCallback(() => {
    void applyLocationQuery().then((didApply) => {
      trackAnalyticsEvent(didApply ? 'location_changed' : 'location_denied', {
        source: 'browse',
        locationMode: 'search',
        locationInputKind: classifyLocationInput(locationQuery),
      });
    });
  }, [applyLocationQuery, locationQuery]);

  const handleToggleHotDeals = React.useCallback(() => {
    const nextValue = !browseHotDealsOnly;
    setBrowseHotDealsOnly(nextValue);
    trackAnalyticsEvent('hot_deals_toggled', {
      source: 'browse',
      enabled: nextValue,
    });
  }, [browseHotDealsOnly, setBrowseHotDealsOnly]);

  const handleClearHotDeals = React.useCallback(() => {
    setBrowseHotDealsOnly(false);
  }, [setBrowseHotDealsOnly]);

  React.useEffect(() => {
    if (!searchQuery) {
      return;
    }

    setSearchQuery('');
  }, [searchQuery, setSearchQuery]);

  React.useEffect(() => {
    setOffset(0);
  }, [activeLocationLabel, browseHotDealsOnly, browseSortKey]);

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
      'Browse'
    );
    trackStorefrontPromotionImpressions(items, 'Browse');
  }, [items]);

  React.useEffect(() => {
    const nextCandidates = items.slice(0, PAGE_SIZE);
    nextCandidates.forEach((storefront) => {
      if (prefetchedDetailIdsRef.current.has(storefront.id)) {
        return;
      }

      prefetchedDetailIdsRef.current.add(storefront.id);
      void storefrontRepository.prefetchStorefrontDetails(storefront.id);
    });
  }, [items]);

  const prepareStorefrontDetail = React.useCallback((storefrontId: string) => {
    void storefrontRepository.prefetchStorefrontDetails(storefrontId);
  }, []);

  React.useEffect(() => {
    if (isLoading || !data.hasMore) {
      return;
    }

    const nextPageKey = `${query.areaId}:${query.searchQuery}:${query.origin.latitude.toFixed(3)}:${query.origin.longitude.toFixed(3)}:${browseSortKey}:${offset + PAGE_SIZE}`;
    if (nextPageKey === lastPrefetchedPageKeyRef.current) {
      return;
    }

    lastPrefetchedPageKeyRef.current = nextPageKey;
    void storefrontRepository.prefetchBrowseSummaries(
      query,
      browseSortKey,
      PAGE_SIZE,
      offset + PAGE_SIZE
    );
  }, [browseSortKey, data.hasMore, isLoading, offset, query]);

  const browseContextText = React.useMemo(() => {
    const scopeLabel = browseHotDealsOnly ? 'Hot deals only' : 'All verified storefronts';
    const sortLabel =
      browseSortKey === 'distance'
        ? 'distance'
        : browseSortKey === 'rating'
          ? 'rating'
          : 'review volume';

    return `${scopeLabel} | Sorted by ${sortLabel} near ${activeLocationLabel}`;
  }, [activeLocationLabel, browseHotDealsOnly, browseSortKey]);

  return (
    <ScreenShell
      eyebrow="Discovery"
      title="Browse verified New York dispensaries."
      subtitle="Set a location, then sort by distance, rating, reviews, or hot deals."
      showTopBar={false}
      showHero={false}
      resetScrollOnFocus={true}
    >
      <MotionInView delay={120}>
        <BrowseFiltersBar
          locationQuery={locationQuery}
          onLocationQueryChange={setLocationQuery}
          onApplyLocationQuery={handleApplyLocationQuery}
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
          hotDealsOnly={browseHotDealsOnly}
          onToggleHotDeals={handleToggleHotDeals}
        />
      </MotionInView>

      <MotionInView delay={160}>
        <BrowseContextBar text={browseContextText} />
      </MotionInView>

      {isLoading && items.length === 0 ? (
        <BrowseSkeletonList count={PAGE_SIZE} delayBase={180} />
      ) : items.length === 0 ? (
        <MotionInView delay={180}>
          <BrowseEmptyState
            title={browseHotDealsOnly ? 'No hot deals right now.' : 'No storefronts found.'}
            body={
              browseHotDealsOnly
                ? 'No dispensaries in this result set are showing a live deal right now.'
                : 'Try another location.'
            }
            showClearSearch={false}
            showClearHotDeals={browseHotDealsOnly}
            onClearSearch={() => undefined}
            onClearHotDeals={handleClearHotDeals}
          />
        </MotionInView>
      ) : (
        <BrowseStoreList
          items={items}
          isSavedStorefront={isSavedStorefront}
          visitedStorefrontIds={visitedStorefrontIds}
          onPrepareStorefront={prepareStorefrontDetail}
          onOpenStorefront={(item) => navigation.navigate('StorefrontDetail', { storefront: item })}
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
              }
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
                }
              );
            }
            void openStorefrontRoute(item, 'verified', {
              profileId,
              accountId: authSession.status === 'authenticated' ? authSession.uid : null,
              isAuthenticated: authSession.status === 'authenticated',
              sourceScreen: 'Browse',
              storefront: item,
            });
          }}
          hasMore={data.hasMore}
          isLoading={isLoading}
          total={data.total}
          onLoadMore={() => setOffset((current) => current + PAGE_SIZE)}
        />
      )}
    </ScreenShell>
  );
}
