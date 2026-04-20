import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Platform, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { CustomerStateCard } from '../../components/CustomerStateCard';
import { MotionInView } from '../../components/MotionInView';
import { StorefrontRouteCard } from '../../components/StorefrontRouteCard';
import { StorefrontRouteCardSkeleton } from '../../components/StorefrontRouteCardSkeleton';
import { supportsStorefrontPromotionUi } from '../../config/playStorePolicy';
import { AppUiIcon } from '../../icons/AppUiIcon';
import type { BrowseSortKey, StorefrontSummary } from '../../types/storefront';
import { colors } from '../../theme/tokens';
import { styles } from './browseStyles';

function getSortLabel(sortKey: BrowseSortKey) {
  if (sortKey === 'rating') {
    return 'highest rating';
  }

  if (sortKey === 'reviews') {
    return 'most reviews';
  }

  return 'closest first';
}

function getSortIcon(sortKey: BrowseSortKey) {
  if (sortKey === 'rating') {
    return 'star-outline' as const;
  }

  if (sortKey === 'reviews') {
    return 'chatbubble-ellipses-outline' as const;
  }

  return 'navigate-outline' as const;
}

function BrowseContextPill({
  icon,
  label,
}: {
  icon: React.ComponentProps<typeof AppUiIcon>['name'];
  label: string;
}) {
  return (
    <View style={styles.contextPill}>
      <AppUiIcon name={icon} size={13} color={colors.textSoft} />
      <Text style={styles.contextPillText}>{label}</Text>
    </View>
  );
}

export function BrowseContextBar({
  locationLabel,
  searchQuery,
  sortKey,
}: {
  locationLabel: string;
  searchQuery: string;
  sortKey: BrowseSortKey;
}) {
  const { width } = useWindowDimensions();
  const compactLayout = width < 390;
  const activeSearchQuery = searchQuery.trim();

  return (
    <View style={styles.contextBar}>
      <View style={[styles.contextHeaderRow, compactLayout && styles.contextHeaderRowCompact]}>
        <View style={styles.contextHeaderCopy}>
          <Text style={styles.contextBarEyebrow}>Current filters</Text>
          <Text style={styles.contextBarTitle}>Compare storefronts without losing your place.</Text>
        </View>
        <View style={[styles.contextBadge, compactLayout && styles.contextBadgeCompact]}>
          <Text style={styles.contextBadgeText}>Filters on</Text>
        </View>
      </View>
      <Text style={styles.contextBarText}>
        Your location, search, and sort stay in place until you change them. Saved storefronts stay
        marked so it is easier to compare your options.
      </Text>
      <View style={styles.contextPillRow}>
        <BrowseContextPill icon="navigate-outline" label={`Near ${locationLabel}`} />
        {activeSearchQuery ? (
          <BrowseContextPill icon="search-outline" label={`Search "${activeSearchQuery}"`} />
        ) : null}
        <BrowseContextPill
          icon={getSortIcon(sortKey)}
          label={`Sorted by ${getSortLabel(sortKey)}`}
        />
      </View>
    </View>
  );
}

export function BrowseSkeletonList({ count, delayBase }: { count: number; delayBase: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, index) => (
        <MotionInView key={`browse-skeleton-${index}`} delay={delayBase + index * 60}>
          <StorefrontRouteCardSkeleton variant="feature" />
        </MotionInView>
      ))}
    </View>
  );
}

export function BrowseEmptyState({
  searchQuery,
  hotDealsOnly,
  locationLabel,
  errorText,
  showClearSearch,
  showClearHotDeals,
  onClearSearch,
  onClearHotDeals,
}: {
  searchQuery: string;
  hotDealsOnly: boolean;
  locationLabel: string;
  errorText?: string | null;
  showClearSearch: boolean;
  showClearHotDeals: boolean;
  onClearSearch: () => void;
  onClearHotDeals: () => void;
}) {
  const isAndroid = Platform.OS === 'android';
  const activeSearchQuery = searchQuery.trim();
  const title = activeSearchQuery
    ? hotDealsOnly
      ? isAndroid
        ? `No updates match "${activeSearchQuery}".`
        : `No deals match "${activeSearchQuery}".`
      : `No results for "${activeSearchQuery}".`
    : hotDealsOnly
      ? isAndroid
        ? 'No updates right now.'
        : 'No deals right now.'
      : 'No storefronts found.';
  const body = activeSearchQuery
    ? hotDealsOnly
      ? isAndroid
        ? 'Try a broader search or turn off Updates to see more results.'
        : 'Try a broader search or turn off Hot Deals to see more results.'
      : 'Try a broader search, a different location, or clear the search to see more storefronts.'
    : hotDealsOnly
      ? isAndroid
        ? 'None of these storefronts are showing a recent owner update right now.'
        : 'None of these storefronts are showing a live deal right now.'
      : `Try another location near ${locationLabel}.`;

  return (
    <CustomerStateCard
      title={errorText ? 'Browse could not refresh right now.' : title}
      body={errorText ?? body}
      tone={errorText ? 'danger' : showClearHotDeals ? 'warm' : 'info'}
      iconName={
        errorText
          ? 'alert-circle-outline'
          : showClearHotDeals
            ? 'pricetag-outline'
            : activeSearchQuery
              ? 'search-outline'
              : 'compass-outline'
      }
      eyebrow={
        errorText
          ? 'Browse'
          : showClearHotDeals
            ? isAndroid
              ? 'Updates'
              : 'Hot Deals'
            : activeSearchQuery
              ? 'Search results'
              : 'Browse'
      }
      note={
        errorText
          ? 'Try again in a moment, or switch locations if the list still does not refresh.'
          : activeSearchQuery
            ? 'Clear the search or widen the area without losing the rest of your filters.'
            : 'Change the area or sort order without starting over.'
      }
    >
      <View style={styles.emptyActionRow}>
        {showClearSearch ? (
          <Pressable
            onPress={onClearSearch}
            style={styles.emptyActionButton}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            accessibilityHint="Removes the search filter to show all storefronts"
          >
            <Text style={styles.emptyActionButtonText}>Clear Search</Text>
          </Pressable>
        ) : null}
        {showClearHotDeals ? (
          <Pressable
            onPress={onClearHotDeals}
            style={styles.emptyActionButton}
            accessibilityRole="button"
            accessibilityLabel="Show all storefronts"
            accessibilityHint="Removes the deals filter to show all storefronts"
          >
            <Text style={styles.emptyActionButtonText}>Show All Storefronts</Text>
          </Pressable>
        ) : null}
      </View>
    </CustomerStateCard>
  );
}

/**
 * Progressively reveals items on web to avoid painting all cards in one frame.
 * Renders `initialBatch` items immediately, then adds `batchSize` more per
 * animation frame until all items are visible. Resets when the items array
 * reference changes (new search, filter change, etc.).
 */
function useProgressiveItems<T>(items: T[], initialBatch: number, batchSize: number): T[] {
  const [visibleCount, setVisibleCount] = useState(initialBatch);

  useEffect(() => {
    setVisibleCount(Math.min(initialBatch, items.length));
  }, [items, initialBatch]);

  useEffect(() => {
    if (visibleCount >= items.length) {
      return;
    }

    const frameId = requestAnimationFrame(() => {
      setVisibleCount((current) => Math.min(current + batchSize, items.length));
    });

    return () => cancelAnimationFrame(frameId);
  }, [visibleCount, items.length, batchSize]);

  return items.slice(0, visibleCount);
}

export function BrowseStoreList({
  items,
  isSavedStorefront,
  visitedStorefrontIds,
  onPrepareStorefront,
  onOpenStorefront,
  onGoNow,
  hasMore,
  isLoading,
  total,
  onLoadMore,
  loadMoreError,
  onLoadMoreRetry,
}: {
  items: StorefrontSummary[];
  isSavedStorefront: (storefrontId: string) => boolean;
  visitedStorefrontIds: string[];
  onPrepareStorefront: (storefrontId: string) => void;
  onOpenStorefront: (storefront: StorefrontSummary) => void;
  onGoNow: (storefront: StorefrontSummary) => void;
  hasMore: boolean;
  isLoading: boolean;
  total: number;
  onLoadMore: () => void;
  loadMoreError?: string | null;
  onLoadMoreRetry?: () => void;
}) {
  const visitedSet = React.useMemo(() => new Set(visitedStorefrontIds), [visitedStorefrontIds]);

  const renderItem = useCallback(
    ({ item, index }: { item: StorefrontSummary; index: number }) => (
      <MotionInView key={item.id} delay={Math.min(index, 8) * 65}>
        <StorefrontRouteCard
          storefront={item}
          variant="feature"
          primaryActionLabel="Directions"
          secondaryActionLabel="Details"
          isSaved={isSavedStorefront(item.id)}
          isVisited={visitedSet.has(item.id)}
          showPromotionText={supportsStorefrontPromotionUi && Boolean(item.promotionText?.trim())}
          onPressIn={() => onPrepareStorefront(item.id)}
          onPrimaryActionPressIn={() => onPrepareStorefront(item.id)}
          onSecondaryActionPressIn={() => onPrepareStorefront(item.id)}
          onPress={() => onOpenStorefront(item)}
          onPrimaryActionPress={() => onGoNow(item)}
          onSecondaryActionPress={() => onOpenStorefront(item)}
          imagePriority={index < 3 ? 'high' : 'low'}
        />
      </MotionInView>
    ),
    [isSavedStorefront, visitedSet, onPrepareStorefront, onOpenStorefront, onGoNow],
  );

  const keyExtractor = useCallback((item: StorefrontSummary) => item.id, []);

  const showLoadMoreError = Boolean(loadMoreError) && !isLoading && items.length > 0;
  const listFooter = hasMore ? (
    <MotionInView delay={220 + Math.min(items.length, 8) * 20}>
      <Pressable
        disabled={isLoading}
        onPress={showLoadMoreError && onLoadMoreRetry ? onLoadMoreRetry : onLoadMore}
        style={[styles.loadMoreButton, isLoading && styles.loadMoreButtonDisabled]}
        accessibilityRole="button"
        accessibilityLabel={
          showLoadMoreError
            ? 'Retry loading more storefronts'
            : isLoading
              ? 'Loading more storefronts'
              : 'Load more storefronts'
        }
        accessibilityHint={
          showLoadMoreError
            ? (loadMoreError ?? 'More storefronts failed to load. Tap to retry.')
            : `${items.length} of ${total} storefronts loaded`
        }
      >
        <Text style={styles.loadMoreButtonText}>
          {showLoadMoreError
            ? `Retry — couldn't load more (${items.length} of ${total})`
            : isLoading
              ? `Loading More Storefronts (${items.length} of ${total})`
              : `Load More Storefronts (${items.length} of ${total})`}
        </Text>
      </Pressable>
    </MotionInView>
  ) : null;

  // Progressive rendering: paint 3 cards immediately for fast first paint,
  // then add 2 more per animation frame to avoid a single-frame layout spike.
  // On native the hook runs but is unused (FlatList handles virtualization).
  const progressiveItems = useProgressiveItems(items, 3, 2);

  // On web, FlatList's removeClippedSubviews and nested scroll container
  // cause items to vanish permanently and block parent scroll/touch input
  // after navigating back. Plain View rendering avoids both issues and
  // works fine since browsers handle long lists natively.
  if (Platform.OS === 'web') {
    return (
      <View style={styles.list}>
        {progressiveItems.map((item, index) => (
          <React.Fragment key={item.id}>
            {renderItem({ item, index } as { item: StorefrontSummary; index: number })}
          </React.Fragment>
        ))}
        {listFooter}
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      scrollEnabled={false}
      initialNumToRender={8}
      maxToRenderPerBatch={6}
      windowSize={5}
      removeClippedSubviews
      contentContainerStyle={styles.list}
      ListFooterComponent={listFooter}
    />
  );
}
