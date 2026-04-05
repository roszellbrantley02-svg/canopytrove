import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MarketArea } from '../types/storefront';
import { colors, radii, spacing, typography } from '../theme/tokens';

type MarketSelectorProps = {
  areas: MarketArea[];
  selectedAreaId: string;
  onSelect: (areaId: string) => void;
};

function MarketSelectorComponent({ areas, selectedAreaId, onSelect }: MarketSelectorProps) {
  return (
    <View style={styles.row}>
      {areas.map((area) => (
        <Pressable
          key={area.id}
          onPress={() => onSelect(area.id)}
          style={[styles.chip, area.id === selectedAreaId && styles.chipActive]}
          accessibilityRole="radio"
          accessibilityLabel={area.label}
          accessibilityHint="Selects this market area for browsing."
          accessibilityState={{ selected: area.id === selectedAreaId }}
        >
          <Text style={[styles.chipText, area.id === selectedAreaId && styles.chipTextActive]}>
            {area.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export const MarketSelector = React.memo(MarketSelectorComponent);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  chip: {
    minHeight: 40,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '800',
  },
  chipTextActive: {
    color: colors.background,
  },
});
