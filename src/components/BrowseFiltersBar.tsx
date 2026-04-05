import React from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type { AppUiIconName } from '../icons/AppUiIcon';
import { AppUiIcon } from '../icons/AppUiIcon';
import { InlineFeedbackPanel } from './InlineFeedbackPanel';
import { SearchField } from './SearchField';
import type { BrowseSortKey } from '../types/storefront';
import { colors, radii, spacing, typography } from '../theme/tokens';

type BrowseFiltersBarProps = {
  locationQuery: string;
  onLocationQueryChange: (value: string) => void;
  onApplyLocationQuery: () => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onClearSearch: () => void;
  isResolvingLocation: boolean;
  locationError: string | null;
  sortKey: BrowseSortKey;
  onSelectSort: (value: BrowseSortKey) => void;
  hotDealsOnly: boolean;
  onToggleHotDeals: () => void;
};

const SORT_OPTIONS: Array<{
  key: BrowseSortKey;
  label: string;
  icon: AppUiIconName;
}> = [
  { key: 'distance', label: 'Distance', icon: 'navigate-outline' },
  { key: 'rating', label: 'Rating', icon: 'star-outline' },
  { key: 'reviews', label: 'Reviews', icon: 'chatbubble-ellipses-outline' },
];

function BrowseFiltersBarComponent({
  locationQuery,
  onLocationQueryChange,
  onApplyLocationQuery,
  searchQuery,
  onSearchQueryChange,
  onClearSearch,
  isResolvingLocation,
  locationError,
  sortKey,
  onSelectSort,
  hotDealsOnly,
  onToggleHotDeals,
}: BrowseFiltersBarProps) {
  const { width } = useWindowDimensions();
  const compactLayout = width < 390;
  const activeSearchQuery = searchQuery.trim();

  return (
    <View style={styles.container}>
      <View style={[styles.headerRow, compactLayout && styles.headerRowCompact]}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>Browse controls</Text>
          <Text style={styles.title}>Refine this view</Text>
        </View>
        <View style={[styles.livePill, compactLayout && styles.livePillCompact]}>
          <AppUiIcon
            name={hotDealsOnly ? 'pricetag-outline' : 'shield-checkmark-outline'}
            size={14}
            color={colors.textSoft}
          />
          <Text style={styles.livePillText}>
            {hotDealsOnly ? 'Live offers only' : 'Verified storefronts'}
          </Text>
        </View>
      </View>

      <SearchField
        value={locationQuery}
        onChangeText={onLocationQueryChange}
        onSubmitEditing={onApplyLocationQuery}
        placeholder="ZIP, city, or address"
        isActive={Boolean(locationQuery.trim())}
      />

      <SearchField
        value={searchQuery}
        onChangeText={onSearchQueryChange}
        placeholder="Store name, neighborhood, or keyword"
        isActive={Boolean(activeSearchQuery)}
      />

      <View style={[styles.searchActionRow, compactLayout && styles.searchActionRowCompact]}>
        <Text style={styles.helperText}>
          Use a New York ZIP code, city, or full address, then narrow the feed by store name or
          keyword.
        </Text>
        <Pressable
          onPress={onApplyLocationQuery}
          style={[styles.searchActionButton, compactLayout && styles.searchActionButtonCompact]}
          accessibilityRole="button"
          accessibilityLabel="Apply location"
          accessibilityHint="Applies the entered location to filter storefronts."
        >
          <AppUiIcon
            name={isResolvingLocation ? 'time-outline' : 'compass-outline'}
            size={15}
            color={colors.backgroundDeep}
          />
          {isResolvingLocation ? (
            <ActivityIndicator size="small" color={colors.backgroundDeep} />
          ) : null}
          <Text style={styles.searchActionButtonText}>
            {isResolvingLocation ? 'Applying...' : 'Apply Location'}
          </Text>
        </Pressable>
      </View>

      {activeSearchQuery ? (
        <View style={[styles.activeSearchRow, compactLayout && styles.activeSearchRowCompact]}>
          <View style={styles.activeSearchChip}>
            <AppUiIcon name="search-outline" size={15} color={colors.goldSoft} />
            <View style={styles.activeSearchCopy}>
              <Text style={styles.activeSearchLabel}>Search active</Text>
              <Text style={styles.activeSearchText} numberOfLines={1}>
                {`"${activeSearchQuery}"`}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={onClearSearch}
            style={styles.activeSearchClearButton}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            accessibilityHint="Removes the search filter."
          >
            <AppUiIcon name="close" size={14} color={colors.text} />
            <Text style={styles.activeSearchClearText}>Clear Search</Text>
          </Pressable>
        </View>
      ) : null}

      {locationError ? (
        <InlineFeedbackPanel
          tone="danger"
          iconName="location-outline"
          label="Location issue"
          title="Canopy Trove could not apply that location."
          body={locationError}
        />
      ) : null}

      <View style={[styles.sortHeaderRow, compactLayout && styles.sortHeaderRowCompact]}>
        <Text style={styles.sortLabel}>Sort storefronts by</Text>
        <Text style={styles.sortCaption}>
          {hotDealsOnly ? 'Live offers view' : 'Verified storefront view'}
        </Text>
      </View>

      <View style={styles.sortRow}>
        {SORT_OPTIONS.map(({ key, label, icon }) => (
          <Pressable
            key={key}
            onPress={() => onSelectSort(key)}
            style={[styles.sortChip, sortKey === key && styles.sortChipActive]}
            accessibilityRole="button"
            accessibilityLabel={`Sort by ${label.toLowerCase()}`}
            accessibilityHint={`Sorts storefronts by ${label.toLowerCase()}`}
            accessibilityState={{ selected: sortKey === key }}
          >
            <AppUiIcon
              name={icon}
              size={14}
              color={sortKey === key ? colors.backgroundDeep : colors.accent}
            />
            <Text style={[styles.sortChipText, sortKey === key && styles.sortChipTextActive]}>
              {label}
            </Text>
          </Pressable>
        ))}
        <Pressable
          onPress={onToggleHotDeals}
          style={[styles.sortChip, hotDealsOnly && styles.hotDealsChipActive]}
          accessibilityRole="button"
          accessibilityLabel={Platform.OS === 'android' ? 'Toggle updates' : 'Toggle specials'}
          accessibilityHint={
            Platform.OS === 'android'
              ? 'Shows only storefronts with recent updates.'
              : 'Shows only storefronts with live specials.'
          }
          accessibilityState={{ selected: hotDealsOnly }}
        >
          <AppUiIcon
            name="flame-outline"
            size={14}
            color={hotDealsOnly ? colors.backgroundDeep : colors.danger}
          />
          <Text style={[styles.sortChipText, hotDealsOnly && styles.hotDealsChipTextActive]}>
            {Platform.OS === 'android' ? 'Updates' : 'Specials'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export const BrowseFiltersBar = React.memo(BrowseFiltersBarComponent);

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surfaceGlass,
    shadowColor: colors.shadow,
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerRowCompact: {
    flexWrap: 'wrap',
  },
  headerCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  eyebrow: {
    color: colors.textSoft,
    fontSize: typography.caption,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: typography.section,
    fontWeight: '800',
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  livePillCompact: {
    alignSelf: 'flex-start',
  },
  livePillText: {
    color: colors.textSoft,
    fontSize: typography.caption,
    fontWeight: '800',
  },
  searchActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  searchActionRowCompact: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  helperText: {
    flex: 1,
    color: colors.textSoft,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  searchActionButton: {
    minHeight: 42,
    borderRadius: radii.pill,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    shadowColor: colors.gold,
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  searchActionButtonCompact: {
    alignSelf: 'stretch',
  },
  searchActionButtonText: {
    color: colors.backgroundDeep,
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  activeSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  activeSearchRowCompact: {
    alignItems: 'stretch',
  },
  activeSearchChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  activeSearchCopy: {
    flex: 1,
    gap: 2,
  },
  activeSearchLabel: {
    color: colors.textSoft,
    fontSize: typography.caption,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  activeSearchText: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: '800',
  },
  activeSearchClearButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.cardMuted,
    paddingHorizontal: spacing.md,
  },
  activeSearchClearText: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  sortHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sortHeaderRowCompact: {
    flexWrap: 'wrap',
  },
  sortLabel: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sortCaption: {
    color: colors.textSoft,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  sortRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(8, 14, 19, 0.82)',
  },
  sortChipActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  sortChipText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '800',
  },
  sortChipTextActive: {
    color: colors.backgroundDeep,
  },
  hotDealsChipActive: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  hotDealsChipTextActive: {
    color: colors.backgroundDeep,
  },
});
