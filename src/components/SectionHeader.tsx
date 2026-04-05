import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppUiIcon } from '../icons/AppUiIcon';
import { HapticPressable } from './HapticPressable';
import { colors, spacing, textStyles } from '../theme/tokens';

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  count?: number;
  onSeeAll?: () => void;
  seeAllLabel?: string;
};

export function SectionHeader({
  title,
  subtitle,
  count,
  onSeeAll,
  seeAllLabel = 'See All',
}: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.titleArea}>
        <View style={styles.titleRow}>
          <Text style={styles.title} maxFontSizeMultiplier={1.2}>
            {title}
          </Text>
          {count != null ? (
            <View style={styles.countBadge}>
              <Text style={styles.countText} maxFontSizeMultiplier={1}>
                {count}
              </Text>
            </View>
          ) : null}
        </View>
        {subtitle ? (
          <Text style={styles.subtitle} maxFontSizeMultiplier={1.3}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {onSeeAll ? (
        <HapticPressable
          onPress={onSeeAll}
          hapticType="selection"
          style={styles.seeAllButton}
          accessible
          accessibilityRole="button"
          accessibilityLabel={`${seeAllLabel} ${title}`}
        >
          <Text style={styles.seeAllText}>{seeAllLabel}</Text>
          <AppUiIcon name="chevron-forward" size={14} color={colors.primary} />
        </HapticPressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  titleArea: {
    flex: 1,
    gap: spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    ...textStyles.section,
    color: colors.text,
  },
  subtitle: {
    ...textStyles.caption,
    color: colors.textMuted,
  },
  countBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0, 245, 140, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 140, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countText: {
    ...textStyles.caption,
    color: colors.accent,
    fontSize: 11,
    lineHeight: 14,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 48,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    justifyContent: 'center',
  },
  seeAllText: {
    ...textStyles.caption,
    color: colors.primary,
  },
});
