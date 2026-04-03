import React from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { CustomerStateCard } from '../../components/CustomerStateCard';
import { MotionInView } from '../../components/MotionInView';
import { StorefrontRouteCard } from '../../components/StorefrontRouteCard';
import { StorefrontRouteCardSkeleton } from '../../components/StorefrontRouteCardSkeleton';
import { AppUiIcon } from '../../icons/AppUiIcon';
import type { BrowseSortKey, StorefrontSummary } from '../../types/storefront';
import { colors } from '../../theme/tokens';
import { styles } from './browseStyles';

function getSortLabel(sortKey: BrowseSortKey) {
  if (sortKey === 'rating') {
    return 'rating';
  }

  if (sortKey === 'reviews') {
    return 'review volume';
  }

  return 'distance';
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
          <Text style={styles.contextBarEyebrow}>Current view</Text>
          <Text style={styles.contextBarTitle}>Browse context stays steady while you compare.</Text>
        </View>
        <View style={[styles.contextBadge, compactLayout && styles.contextBadgeCompact]}>
          <Text style={styles.contextBadgeText}>Live browse</Text>
        </View>
      </View>
      <Text style={styles.contextBarText}>
        Results stay scoped to the current location and search until you change them. Saved
        storefronts stay marked on cards, so comparison still feels anchored.
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
  const activeSearchQuery = searchQuery.trim();
  const title = activeSearchQuery
    ? hotDealsOnly
      ? `No hot deals match "${activeSearchQuery}".`
      : `No results for "${activeSearchQuery}".`
    : hotDealsOnly
      ? 'No hot deals right now.'
      : 'No storefronts found.';
  const body = activeSearchQuery
    ? hotDealsOnly
      ? 'Try a broader search or turn off Hot Deals to widen the result set.'
      : 'Try a broader term, a different location, or clear the search to widen the result set.'
    : hotDealsOnly
      ? 'No dispensaries in this result set are showing a live deal right now.'
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
          ? 'Browse issue'
          : showClearHotDeals
            ? 'Hot deals'
            : activeSearchQuery
              ? 'Search results'
              : 'Browse state'
      }
      note={
        errorText
          ? 'The last stable browse view stayed in place. Try again in a moment or shift the area.'
          : activeSearchQuery
            ? 'Clear the search or widen the area. The rest of the browse context stays intact.'
            : 'Change the area or sort without losing the rest of the browse setup.'
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
            accessibilityHint="Removes the hot deals filter to show all storefronts"
          >
            <Text style={styles.emptyActionButtonText}>Show All Storefronts</Text>
          </Pressable>
        ) : null}
      </View>
    </CustomerStateCard>
  );
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
}) {
  return (
    <View style={styles.list}>
      {items.map((item, index) => (
        <MotionInView key={item.id} delay={180 + index * 65}>
          <StorefrontRouteCard
            storefront={item}
            variant="feature"
            primaryActionLabel="Directions"
            secondaryActionLabel="View Storefront"
            isSaved={isSavedStorefront(item.id)}
            isVisited={visitedStorefrontIds.includes(item.id)}
            showPromotionText={Boolean(item.promotionText?.trim())}
            onPressIn={() => onPrepareStorefront(item.id)}
            onPrimaryActionPressIn={() => onPrepareStorefront(item.id)}
            onSecondaryActionPressIn={() => onPrepareStorefront(item.id)}
            onPress={() => onOpenStorefront(item)}
            onPrimaryActionPress={() => onGoNow(item)}
            onSecondaryActionPress={() => onOpenStorefront(item)}
          />
        </MotionInView>
      ))}

      {hasMore ? (
        <MotionInView delay={220 + items.length * 20}>
          <Pressable
            disabled={isLoading}
            onPress={onLoadMore}
            style={[styles.loadMoreButton, isLoading && styles.loadMoreButtonDisabled]}
          >
            <Text style={styles.loadMoreButtonText}>
              {isLoading
                ? `Loading More Storefronts (${items.length} of ${total})`
                : `Load More Storefronts (${items.length} of ${total})`}
            </Text>
          </Pressable>
        </MotionInView>
      ) : null}
    </View>
  );
}
