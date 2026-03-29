import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { MotionInView } from '../../components/MotionInView';
import { SearchField } from '../../components/SearchField';
import { StorefrontRouteCard } from '../../components/StorefrontRouteCard';
import { StorefrontRouteCardSkeleton } from '../../components/StorefrontRouteCardSkeleton';
import { BrowseSortKey, StorefrontSummary } from '../../types/storefront';
import { styles } from './hotDealsStyles';

export function HotDealsFilters({
  locationQuery,
  setLocationQuery,
  handleApplyLocationQuery,
  isResolvingLocation,
  locationError,
  dealSearchQuery,
  setDealSearchQuery,
  activeLocationMode,
  activeLocationLabel,
  sortKey,
  setSortKey,
}: {
  locationQuery: string;
  setLocationQuery: (value: string) => void;
  handleApplyLocationQuery: () => void;
  isResolvingLocation: boolean;
  locationError: string | null;
  dealSearchQuery: string;
  setDealSearchQuery: (value: string) => void;
  activeLocationMode: string;
  activeLocationLabel: string;
  sortKey: BrowseSortKey;
  setSortKey: (value: BrowseSortKey) => void;
}) {
  return (
    <MotionInView delay={100}>
      <View style={styles.filters}>
        <SearchField
          value={locationQuery}
          onChangeText={setLocationQuery}
          onSubmitEditing={handleApplyLocationQuery}
          placeholder="Search area, city, or ZIP"
        />

        <View style={styles.actionRow}>
          <Pressable onPress={handleApplyLocationQuery} style={styles.locationButton}>
            {isResolvingLocation ? (
              <ActivityIndicator size="small" color="#06130c" />
            ) : null}
            <Text style={styles.locationButtonText}>
              {isResolvingLocation ? 'Applying...' : 'Apply Location'}
            </Text>
          </Pressable>
        </View>

        {locationError ? <Text style={styles.errorText}>{locationError}</Text> : null}

        <SearchField
          value={dealSearchQuery}
          onChangeText={setDealSearchQuery}
          placeholder="Search deal or storefront"
        />

        <View style={styles.locationSummary}>
          <Text style={styles.locationMode}>
            {activeLocationMode === 'device'
              ? 'Current location'
              : activeLocationMode === 'search'
                ? 'Manual location'
                : 'Fallback location'}
          </Text>
          <Text style={styles.locationLabel}>{activeLocationLabel}</Text>
        </View>

        <View style={styles.sortRow}>
          {(['distance', 'rating', 'reviews'] as BrowseSortKey[]).map((value) => (
            <Pressable
              key={value}
              onPress={() => setSortKey(value)}
              style={[styles.sortChip, sortKey === value && styles.sortChipActive]}
            >
              <Text style={[styles.sortChipText, sortKey === value && styles.sortChipTextActive]}>
                {value}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </MotionInView>
  );
}

export function HotDealsEmptyState() {
  return (
    <MotionInView delay={180}>
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>No live deals found.</Text>
        <Text style={styles.emptyText}>
          Deals will show here when a dispensary has an active promotion in the current area.
        </Text>
      </View>
    </MotionInView>
  );
}

export function HotDealsSkeletonList() {
  return (
    <View style={styles.list}>
      {Array.from({ length: 3 }).map((_, index) => (
        <MotionInView key={`hot-deals-skeleton-${index}`} delay={180 + index * 50}>
          <StorefrontRouteCardSkeleton variant="list" />
        </MotionInView>
      ))}
    </View>
  );
}

export function HotDealsList({
  items,
  isSavedStorefront,
  visitedStorefrontIds,
  onOpenDetail,
  onGoNow,
  dataHasMore,
  dataTotal,
  isLoading,
  onLoadMore,
}: {
  items: StorefrontSummary[];
  isSavedStorefront: (storefrontId: string) => boolean;
  visitedStorefrontIds: string[];
  onOpenDetail: (item: StorefrontSummary) => void;
  onGoNow: (item: StorefrontSummary) => void;
  dataHasMore: boolean;
  dataTotal: number;
  isLoading: boolean;
  onLoadMore: () => void;
}) {
  return (
    <View style={styles.list}>
      {items.map((item, index) => (
        <MotionInView key={item.id} delay={180 + index * 55}>
          <StorefrontRouteCard
            storefront={item}
            variant="list"
            primaryActionLabel="Go Now"
            secondaryActionLabel="View Shop"
            isSaved={isSavedStorefront(item.id)}
            isVisited={visitedStorefrontIds.includes(item.id)}
            showPromotionText={true}
            onPress={() => onOpenDetail(item)}
            onPrimaryActionPress={() => onGoNow(item)}
            onSecondaryActionPress={() => onOpenDetail(item)}
          />
        </MotionInView>
      ))}

      {dataHasMore ? (
        <MotionInView delay={220 + items.length * 20}>
          <Pressable
            disabled={isLoading}
            onPress={onLoadMore}
            style={[styles.loadMoreButton, isLoading && styles.loadMoreButtonDisabled]}
          >
            <Text style={styles.loadMoreButtonText}>
              {isLoading
                ? `Loading More Deals (${items.length} of ${dataTotal})`
                : `Load More Deals (${items.length} of ${dataTotal})`}
            </Text>
          </Pressable>
        </MotionInView>
      ) : null}
    </View>
  );
}
