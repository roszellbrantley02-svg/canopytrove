import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SearchField } from './SearchField';
import { BrowseSortKey } from '../types/storefront';
import { colors, radii, spacing, typography } from '../theme/tokens';

type BrowseFiltersBarProps = {
  locationQuery: string;
  onLocationQueryChange: (value: string) => void;
  onApplyLocationQuery: () => void;
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
  icon: React.ComponentProps<typeof Ionicons>['name'];
}> = [
  { key: 'distance', label: 'Distance', icon: 'navigate-outline' },
  { key: 'rating', label: 'Rating', icon: 'star-outline' },
  { key: 'reviews', label: 'Reviews', icon: 'chatbubble-ellipses-outline' },
];

function BrowseFiltersBarComponent({
  locationQuery,
  onLocationQueryChange,
  onApplyLocationQuery,
  isResolvingLocation,
  locationError,
  sortKey,
  onSelectSort,
  hotDealsOnly,
  onToggleHotDeals,
}: BrowseFiltersBarProps) {
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>Browse filters</Text>
          <Text style={styles.title}>Set your launch point</Text>
        </View>
        <View style={styles.livePill}>
          <Ionicons name="sparkles" size={14} color={colors.goldSoft} />
          <Text style={styles.livePillText}>{hotDealsOnly ? 'Deals focus' : 'Verified only'}</Text>
        </View>
      </View>

      <SearchField
        value={locationQuery}
        onChangeText={onLocationQueryChange}
        onSubmitEditing={onApplyLocationQuery}
        placeholder="ZIP, city, or address"
      />

      <View style={styles.searchActionRow}>
        <Text style={styles.helperText}>Enter any New York ZIP, city, or address.</Text>
        <Pressable onPress={onApplyLocationQuery} style={styles.searchActionButton}>
          <Ionicons
            name={isResolvingLocation ? 'time-outline' : 'compass-outline'}
            size={15}
            color={colors.backgroundDeep}
          />
          {isResolvingLocation ? <ActivityIndicator size="small" color={colors.backgroundDeep} /> : null}
          <Text style={styles.searchActionButtonText}>
            {isResolvingLocation ? 'Applying...' : 'Apply Location'}
          </Text>
        </Pressable>
      </View>

      {locationError ? <Text style={styles.errorText}>{locationError}</Text> : null}

      <View style={styles.sortHeaderRow}>
        <Text style={styles.sortLabel}>Sort storefronts by</Text>
        <Text style={styles.sortCaption}>{hotDealsOnly ? 'Deals emphasized' : 'All storefronts'}</Text>
      </View>

      <View style={styles.sortRow}>
        {SORT_OPTIONS.map(({ key, label, icon }) => (
          <Pressable
            key={key}
            onPress={() => onSelectSort(key)}
            style={[styles.sortChip, sortKey === key && styles.sortChipActive]}
          >
            <Ionicons
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
        >
          <Ionicons
            name="flame-outline"
            size={14}
            color={hotDealsOnly ? colors.backgroundDeep : colors.danger}
          />
          <Text style={[styles.sortChipText, hotDealsOnly && styles.hotDealsChipTextActive]}>
            Hot Deals
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
  headerCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  eyebrow: {
    color: colors.gold,
    fontSize: typography.caption,
    fontWeight: '800',
    letterSpacing: 1,
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
    borderColor: 'rgba(245, 200, 106, 0.20)',
    backgroundColor: 'rgba(245, 200, 106, 0.10)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  livePillText: {
    color: colors.goldSoft,
    fontSize: typography.caption,
    fontWeight: '800',
  },
  searchActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
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
  searchActionButtonText: {
    color: colors.backgroundDeep,
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  errorText: {
    color: colors.rose,
    fontSize: typography.caption,
    lineHeight: 18,
    fontWeight: '700',
  },
  sortHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
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
