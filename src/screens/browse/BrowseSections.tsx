import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { CustomerStateCard } from '../../components/CustomerStateCard';
import { MotionInView } from '../../components/MotionInView';
import { StorefrontRouteCard } from '../../components/StorefrontRouteCard';
import { StorefrontRouteCardSkeleton } from '../../components/StorefrontRouteCardSkeleton';
import { StorefrontSummary } from '../../types/storefront';
import { styles } from './browseStyles';

export function BrowseContextBar({ text }: { text: string }) {
  return (
    <View style={styles.contextBar}>
      <Text style={styles.contextBarText}>{text}</Text>
    </View>
  );
}

export function BrowseSkeletonList({
  count,
  delayBase,
}: {
  count: number;
  delayBase: number;
}) {
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
  title,
  body,
  showClearSearch,
  showClearHotDeals,
  onClearSearch,
  onClearHotDeals,
}: {
  title: string;
  body: string;
  showClearSearch: boolean;
  showClearHotDeals: boolean;
  onClearSearch: () => void;
  onClearHotDeals: () => void;
}) {
  return (
    <CustomerStateCard
      title={title}
      body={body}
      tone={showClearHotDeals ? 'warm' : 'info'}
      iconName={showClearHotDeals ? 'pricetag-outline' : 'compass-outline'}
      eyebrow={showClearHotDeals ? 'Hot deals' : 'Browse state'}
      note="Your location and sort settings stay in place, so you can adjust one input without losing the rest of the browse context."
    >
      <View style={styles.emptyActionRow}>
        {showClearSearch ? (
          <Pressable onPress={onClearSearch} style={styles.emptyActionButton}>
            <Text style={styles.emptyActionButtonText}>Clear Search</Text>
          </Pressable>
        ) : null}
        {showClearHotDeals ? (
          <Pressable onPress={onClearHotDeals} style={styles.emptyActionButton}>
            <Text style={styles.emptyActionButtonText}>Show All Stores</Text>
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
            primaryActionLabel="Go Now"
            secondaryActionLabel="View Shop"
            isSaved={isSavedStorefront(item.id)}
            isVisited={visitedStorefrontIds.includes(item.id)}
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
                ? `Loading More (${items.length} of ${total})`
                : `Load More (${items.length} of ${total})`}
            </Text>
          </Pressable>
        </MotionInView>
      ) : null}
    </View>
  );
}
