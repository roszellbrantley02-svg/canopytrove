import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import type { AppUiIconName } from '../icons/AppUiIcon';
import { AppUiIcon } from '../icons/AppUiIcon';
import { HapticPressable } from './HapticPressable';
import { colors, radii, spacing, textStyles } from '../theme/tokens';

export type QuickAction = {
  key: string;
  label: string;
  iconName: AppUiIconName;
  onPress: () => void;
  badge?: number; // optional notification count
  locked?: boolean; // tier-gated feature
  tone?: string; // optional per-tile accent; otherwise auto-assigned from palette
};

type QuickActionsRowProps = {
  actions: QuickAction[];
};

// Rotating palette so each tile feels like its own collectible sticker.
const PALETTE = [
  colors.accent,
  colors.gold,
  colors.blue,
  colors.purple,
  colors.rose,
  colors.cyan,
  colors.primary,
];

const TILE_WIDTH = 108;
const TILE_HEIGHT = 132;
const TILE_GAP = 12;
const TILE_STRIDE = TILE_WIDTH + TILE_GAP;
const LOOP_COPIES = 5;
const CENTER_COPY = Math.floor(LOOP_COPIES / 2);

/**
 * Horizontal infinite-scroll row of oval capsule tiles. Each tile is a big
 * tinted pill with a circular icon puck on top and a bold label below. The
 * list wraps endlessly — users can keep sliding in either direction and the
 * same collection quietly loops under them.
 */
export function QuickActionsRow({ actions }: QuickActionsRowProps) {
  const scrollRef = React.useRef<ScrollView>(null);
  const [containerWidth, setContainerWidth] = React.useState(0);
  const didInitialScrollRef = React.useRef(false);

  const hasEnoughToLoop = actions.length >= 3;
  const copies = hasEnoughToLoop ? LOOP_COPIES : 1;
  const loopedActions = React.useMemo(() => {
    const result: Array<{ copyIndex: number; action: QuickAction; originalIndex: number }> = [];
    for (let c = 0; c < copies; c += 1) {
      actions.forEach((action, idx) => {
        result.push({ copyIndex: c, action, originalIndex: idx });
      });
    }
    return result;
  }, [actions, copies]);

  const singleCopyWidth = actions.length * TILE_STRIDE;

  const onLayout = React.useCallback((event: LayoutChangeEvent) => {
    setContainerWidth(event.nativeEvent.layout.width);
  }, []);

  // Start the scroll position centered on the middle copy so users can swipe
  // either direction before we need to snap back.
  React.useEffect(() => {
    if (!hasEnoughToLoop || didInitialScrollRef.current || containerWidth === 0) return;
    const startX = CENTER_COPY * singleCopyWidth;
    scrollRef.current?.scrollTo({ x: startX, animated: false });
    didInitialScrollRef.current = true;
  }, [containerWidth, hasEnoughToLoop, singleCopyWidth]);

  const onMomentumScrollEnd = React.useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!hasEnoughToLoop) return;
      const x = event.nativeEvent.contentOffset.x;
      const lowerBound = singleCopyWidth * 1;
      const upperBound = singleCopyWidth * (LOOP_COPIES - 1);
      if (x < lowerBound) {
        scrollRef.current?.scrollTo({ x: x + singleCopyWidth * 2, animated: false });
      } else if (x > upperBound) {
        scrollRef.current?.scrollTo({ x: x - singleCopyWidth * 2, animated: false });
      }
    },
    [hasEnoughToLoop, singleCopyWidth],
  );

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
      onLayout={onLayout}
      onMomentumScrollEnd={onMomentumScrollEnd}
      decelerationRate="fast"
      snapToInterval={TILE_STRIDE}
      snapToAlignment="start"
    >
      {loopedActions.map(({ copyIndex, action, originalIndex }) => {
        const isLocked = Boolean(action.locked);
        const tone = isLocked
          ? colors.textSoft
          : (action.tone ?? PALETTE[originalIndex % PALETTE.length]);
        const tileBg = `${tone}1A`;
        const tileBorder = `${tone}4D`;
        const puckBg = `${tone}33`;
        const puckBorder = `${tone}66`;

        return (
          <HapticPressable
            key={`${copyIndex}-${action.key}`}
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
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: TILE_GAP,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },
  tile: {
    width: TILE_WIDTH,
    height: TILE_HEIGHT,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
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
    height: 80,
    borderBottomLeftRadius: 80,
    borderBottomRightRadius: 80,
  },
  tilePressed: {
    opacity: 0.88,
    transform: [{ scale: 0.96 }],
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
