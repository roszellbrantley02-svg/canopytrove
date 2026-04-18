import React from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
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
  const isAndroid = Platform.OS === 'android';
  const { width } = useWindowDimensions();
  const compactHeader = width < 390;
  const activeDealSearchQuery = dealSearchQuery.trim();

  return (
    <MotionInView delay={100}>
      <View style={styles.filters}>
        <View style={[styles.filtersHeader, compactHeader && styles.filtersHeaderCompact]}>
          <View style={styles.filtersHeaderCopy}>
            <Text style={styles.filtersEyebrow}>{isAndroid ? 'Updates view' : 'Offers view'}</Text>
            <Text style={styles.filtersTitle}>
              {isAndroid ? 'Refine recent storefront updates' : 'Refine active promotions'}
            </Text>
          </View>
          <View style={[styles.filtersPill, compactHeader && styles.filtersPillCompact]}>
            <AppUiIcon name="pricetag-outline" size={14} color={colors.textSoft} />
            <Text style={styles.filtersPillText}>
              {isAndroid ? 'Recent updates' : 'Live offers'}
            </Text>
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
            accessibilityHint={
              isAndroid
                ? 'Applies the location to filter updates.'
                : 'Applies the location to filter deals.'
            }
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
          placeholder={isAndroid ? 'Search update or storefront' : 'Search deal or storefront'}
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
              accessibilityHint={`Sorts deals by ${label.toLowerCase()}`}
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
  const isAndroid = Platform.OS === 'android';

  return (
    <MotionInView delay={180}>
      <CustomerStateCard
        title={
          errorText
            ? isAndroid
              ? 'Updates could not refresh right now.'
              : 'Offers could not refresh right now.'
            : isAndroid
              ? 'No recent updates found.'
              : 'No live offers found.'
        }
        body={
          errorText ??
          (isAndroid
            ? 'Recent owner updates show up here when a storefront in the current area posts something new.'
            : 'Active promotions show up here when a storefront in the current area is running something live.')
        }
        tone={errorText ? 'danger' : 'warm'}
        iconName={errorText ? 'alert-circle-outline' : 'pricetag-outline'}
        eyebrow={
          errorText
            ? isAndroid
              ? 'Updates issue'
              : 'Offers issue'
            : isAndroid
              ? 'Updates state'
              : 'Offers state'
        }
        note={
          errorText
            ? isAndroid
              ? 'The last stable updates state stayed in place. Try again in a moment or widen the area.'
              : 'The last stable offer state stayed in place. Try again in a moment or widen the area.'
            : isAndroid
              ? 'Widen the area, broaden the search, or check back when storefronts publish something new.'
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
  const isAndroid = Platform.OS === 'android';

  return (
    <MotionInView delay={180}>
      <CustomerStateCard
        title={
          isAndroid
            ? 'Member access required for updates.'
            : 'Member access required for live deals.'
        }
        body={
          isAndroid
            ? 'Recent storefront updates are member-only. Sign in to view current owner-posted activity, follow storefronts, and get notified when your favorite licensed dispensaries share something new.'
            : 'Live deals are now member-only. Sign in to view current promotions, follow storefronts, and get notified when your favorite licensed dispensaries post something new.'
        }
        tone="warm"
        iconName="lock-closed-outline"
        eyebrow="Members only"
        note={
          isAndroid
            ? 'Storefront discovery stays public. Updates browsing stays reserved for signed-in members.'
            : 'Live deals browsing stays reserved for signed-in members.'
        }
      >
        <View style={styles.memberGateActions}>
          <Pressable
            accessibilityLabel={
              isAndroid
                ? 'Sign in to view members-only updates'
                : 'Sign in to view members-only live deals'
            }
            accessibilityRole="button"
            accessibilityHint="Opens the sign in screen."
            onPress={onOpenMemberSignIn}
            style={styles.memberGatePrimaryButton}
          >
            <Text style={styles.memberGatePrimaryButtonText}>Sign In</Text>
          </Pressable>
          <Pressable
            accessibilityLabel={
              isAndroid
                ? 'Create a Canopy Trove account to unlock members-only updates'
                : 'Create a Canopy Trove account to unlock members-only live deals'
            }
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
  const isAndroid = Platform.OS === 'android';
  // O(1) lookup per row instead of O(n) Array.includes on every render.
  const visitedStorefrontIdSet = React.useMemo(
    () => new Set(visitedStorefrontIds),
    [visitedStorefrontIds],
  );

  return (
    <View style={styles.list}>
      {items.map((item, index) => (
        <MotionInView key={item.id} delay={180 + index * 55}>
          <StorefrontRouteCard
            storefront={item}
            variant="list"
            primaryActionLabel="Directions"
            secondaryActionLabel="Details"
            isSaved={isSavedStorefront(item.id)}
            isVisited={visitedStorefrontIdSet.has(item.id)}
            showPromotionText={true}
            onPress={() => onOpenDetail(item)}
            onPrimaryActionPress={() => onGoNow(item)}
            onSecondaryActionPress={() => onOpenDetail(item)}
            imagePriority={index < 3 ? 'high' : 'low'}
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
                ? `Loading More ${isAndroid ? 'Updates' : 'Offers'} (${items.length} of ${dataTotal})`
                : `Load More ${isAndroid ? 'Updates' : 'Offers'} (${items.length} of ${dataTotal})`}
            </Text>
          </Pressable>
        </MotionInView>
      ) : null}
    </View>
  );
}
