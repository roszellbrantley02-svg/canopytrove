import React from 'react';
import { ActivityIndicator, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { CustomerStateCard } from '../../components/CustomerStateCard';
import { InlineFeedbackPanel } from '../../components/InlineFeedbackPanel';
import { MotionInView } from '../../components/MotionInView';
import { SearchField } from '../../components/SearchField';
import { StorefrontRouteCard } from '../../components/StorefrontRouteCard';
import { StorefrontRouteCardSkeleton } from '../../components/StorefrontRouteCardSkeleton';
import { AppUiIcon } from '../../icons/AppUiIcon';
import { colors } from '../../theme/tokens';
import type { BrowseSortKey, StorefrontSummary } from '../../types/storefront';
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
  const { width } = useWindowDimensions();
  const compactHeader = width < 390;
  const activeDealSearchQuery = dealSearchQuery.trim();

  return (
    <MotionInView delay={100}>
      <View style={styles.filters}>
        <View style={[styles.filtersHeader, compactHeader && styles.filtersHeaderCompact]}>
          <View style={styles.filtersHeaderCopy}>
            <Text style={styles.filtersEyebrow}>Offers view</Text>
            <Text style={styles.filtersTitle}>Refine active promotions</Text>
          </View>
          <View style={[styles.filtersPill, compactHeader && styles.filtersPillCompact]}>
            <AppUiIcon name="pricetag-outline" size={14} color={colors.textSoft} />
            <Text style={styles.filtersPillText}>Live offers</Text>
          </View>
        </View>
        <SearchField
          value={locationQuery}
          onChangeText={setLocationQuery}
          onSubmitEditing={handleApplyLocationQuery}
          placeholder="Search area, city, or ZIP"
          isActive={Boolean(locationQuery.trim())}
        />

        <View style={styles.actionRow}>
          <Pressable
            onPress={handleApplyLocationQuery}
            style={styles.locationButton}
            accessibilityRole="button"
            accessibilityLabel="Apply location"
            accessibilityHint="Applies the location to filter hot deals."
          >
            {isResolvingLocation ? <ActivityIndicator size="small" color="#06130c" /> : null}
            <Text style={styles.locationButtonText}>
              {isResolvingLocation ? 'Applying...' : 'Apply Location'}
            </Text>
          </Pressable>
        </View>

        {locationError ? (
          <InlineFeedbackPanel
            tone="danger"
            iconName="location-outline"
            label="Location issue"
            title="Canopy Trove could not apply that offer area."
            body={locationError}
          />
        ) : null}

        <SearchField
          value={dealSearchQuery}
          onChangeText={setDealSearchQuery}
          placeholder="Search deal or storefront"
          isActive={Boolean(activeDealSearchQuery)}
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
          {(
            [
              ['distance', 'Nearest'],
              ['rating', 'Highest rated'],
              ['reviews', 'Most reviewed'],
            ] as const
          ).map(([value, label]) => (
            <Pressable
              key={value}
              onPress={() => setSortKey(value)}
              style={[styles.sortChip, sortKey === value && styles.sortChipActive]}
              accessibilityRole="button"
              accessibilityLabel={`Sort by ${label}`}
              accessibilityHint={`Sorts hot deals by ${label.toLowerCase()}`}
            >
              <Text style={[styles.sortChipText, sortKey === value && styles.sortChipTextActive]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </MotionInView>
  );
}

export function HotDealsEmptyState({ errorText }: { errorText?: string | null }) {
  return (
    <MotionInView delay={180}>
      <CustomerStateCard
        title={errorText ? 'Offers could not refresh right now.' : 'No live offers found.'}
        body={
          errorText ??
          'Active promotions show up here when a storefront in the current area is running something live.'
        }
        tone={errorText ? 'danger' : 'warm'}
        iconName={errorText ? 'alert-circle-outline' : 'pricetag-outline'}
        eyebrow={errorText ? 'Offers issue' : 'Offers state'}
        note={
          errorText
            ? 'The last stable offer state stayed in place. Try again in a moment or widen the area.'
            : 'Widen the area, broaden the search, or check back when the next promotion cycle goes live.'
        }
      />
    </MotionInView>
  );
}

export function HotDealsMemberGate({
  onOpenMemberSignIn,
  onOpenMemberSignUp,
}: {
  onOpenMemberSignIn: () => void;
  onOpenMemberSignUp: () => void;
}) {
  return (
    <MotionInView delay={180}>
      <CustomerStateCard
        title="Member access required for live deals."
        body="Live offers are now member-only. Sign in to view current deals, follow storefronts, and get notified when your favorite legal dispensaries post something new."
        tone="warm"
        iconName="lock-closed-outline"
        eyebrow="Members only"
        note="Storefront discovery stays public. Live deal browsing stays reserved for signed-in members."
      >
        <View style={styles.memberGateActions}>
          <Pressable
            accessibilityLabel="Sign in to view members-only live deals"
            accessibilityRole="button"
            accessibilityHint="Opens the sign in screen."
            onPress={onOpenMemberSignIn}
            style={styles.memberGatePrimaryButton}
          >
            <Text style={styles.memberGatePrimaryButtonText}>Sign In</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Create a Canopy Trove account to unlock members-only live deals"
            accessibilityRole="button"
            accessibilityHint="Opens the account creation screen."
            onPress={onOpenMemberSignUp}
            style={styles.memberGateSecondaryButton}
          >
            <Text style={styles.memberGateSecondaryButtonText}>Create Account</Text>
          </Pressable>
        </View>
      </CustomerStateCard>
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
            primaryActionLabel="Directions"
            secondaryActionLabel="View Storefront"
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
                ? `Loading More Offers (${items.length} of ${dataTotal})`
                : `Load More Offers (${items.length} of ${dataTotal})`}
            </Text>
          </Pressable>
        </MotionInView>
      ) : null}
    </View>
  );
}
