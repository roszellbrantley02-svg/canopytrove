import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppUiIcon } from '../icons/AppUiIcon';
import { HapticPressable } from './HapticPressable';
import { colors, radii, spacing, textStyles } from '../theme/tokens';
import type { QuickAction } from './QuickActionsRow';

type QuickActionsGridProps = {
  actions: QuickAction[];
  /**
   * Number of columns in the grid. Defaults to 2 — the iOS-native choice for
   * 4–8 action tiles on phone widths.
   */
  columns?: number;
};

// Fallback rotating palette for any action that doesn't declare its own
// semantic `tone`. Ordered so that the first few tones are distinct even
// when only a couple of actions are rendered.
const FALLBACK_PALETTE = [
  colors.primary,
  colors.gold,
  colors.blue,
  colors.purple,
  colors.rose,
  colors.cyan,
  colors.accent,
];

/**
 * Stacked N-column grid of chunky semantic action tiles. Sibling to
 * `QuickActionsRow` — same `QuickAction` shape, different layout. Prefer this
 * on profile-style screens where discoverability and clear color-coding beat
 * the horizontal scroll carousel's "there's more over there" affordance.
 *
 * Each tile is a self-contained category pill:
 *   - tinted background at `tone + '1A'` (~10% opacity)
 *   - accent border at `tone + '4D'` (~30% opacity)
 *   - round icon puck at `tone + '33'` (~20% opacity)
 *   - bold label colored `tone` itself for strong semantic tie
 *
 * Accessibility:
 *   - color is ALWAYS paired with icon + label (never color-alone)
 *   - min touch target comfortably exceeds 48dp / 44pt
 *   - `accessibilityLabel` forwarded with badge / lock context
 *   - Dynamic Type: label scales up to 1.2× and allows 2 lines
 */
export function QuickActionsGrid({ actions, columns = 2 }: QuickActionsGridProps) {
  // Calculate width as a percentage so the grid stays fluid — no magic pixels.
  // We subtract a hair to account for the gap between tiles in the same row.
  const widthPercent = `${100 / columns}%` as const;

  return (
    <View
      style={styles.grid}
      accessibilityRole="menu"
      accessible={false /* let each tile be its own focus target */}
    >
      {actions.map((action, index) => {
        const isLocked = Boolean(action.locked);
        const tone = isLocked
          ? colors.textSoft
          : (action.tone ?? FALLBACK_PALETTE[index % FALLBACK_PALETTE.length]);
        const tileBg = `${tone}1A`;
        const tileBorder = `${tone}4D`;
        const puckBg = `${tone}33`;
        const puckBorder = `${tone}66`;

        return (
          <View key={action.key} style={[styles.cell, { width: widthPercent }]}>
            <HapticPressable
              onPress={action.onPress}
              hapticType="impact"
              style={({ pressed }) => [
                styles.tile,
                { backgroundColor: tileBg, borderColor: tileBorder },
                isLocked && styles.tileLocked,
                pressed && !isLocked && styles.tilePressed,
              ]}
              accessible
              accessibilityRole="button"
              accessibilityLabel={
                isLocked
                  ? `${action.label}, upgrade required`
                  : action.badge
                    ? `${action.label}, ${action.badge} new`
                    : action.label
              }
            >
              <View
                pointerEvents="none"
                style={[styles.topShine, { backgroundColor: `${tone}22` }]}
              />
              <View style={[styles.iconPuck, { backgroundColor: puckBg, borderColor: puckBorder }]}>
                <AppUiIcon
                  name={isLocked ? 'lock-closed-outline' : action.iconName}
                  size={26}
                  color={tone}
                />
                {!isLocked && action.badge != null && action.badge > 0 ? (
                  <View style={styles.badgeDot}>
                    <Text style={styles.badgeText} maxFontSizeMultiplier={1}>
                      {action.badge > 9 ? '9+' : String(action.badge)}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text
                style={[styles.label, { color: tone }, isLocked && styles.labelLocked]}
                maxFontSizeMultiplier={1.2}
                numberOfLines={2}
              >
                {action.label}
              </Text>
            </HapticPressable>
          </View>
        );
      })}
    </View>
  );
}

const TILE_MIN_HEIGHT = 118;

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    // Negative margin trick lets per-cell padding provide gutter without a
    // flexbox gap, which React Native only added in a recent version.
    marginHorizontal: -spacing.xs,
    marginVertical: -spacing.xs,
  },
  cell: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  tile: {
    minHeight: TILE_MIN_HEIGHT,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1.5,
    shadowColor: colors.shadow,
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
    overflow: 'hidden',
  },
  topShine: {
    position: 'absolute',
    top: -30,
    left: -10,
    right: -10,
    height: 70,
    borderBottomLeftRadius: 80,
    borderBottomRightRadius: 80,
  },
  tilePressed: {
    opacity: 0.88,
    transform: [{ scale: 0.97 }],
  },
  tileLocked: {
    opacity: 0.7,
  },
  iconPuck: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    shadowColor: colors.shadow,
    shadowOpacity: 0.22,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  badgeDot: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.background,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 12,
  },
  label: {
    ...textStyles.caption,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 15,
    letterSpacing: 0.2,
  },
  labelLocked: {
    color: colors.textMuted,
    fontWeight: '700',
  },
});

// Re-export the shared type so consumers can import both grid + type from one
// spot without ever importing the legacy row.
export type { QuickAction };
