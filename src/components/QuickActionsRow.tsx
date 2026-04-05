import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { AppUiIconName } from '../icons/AppUiIcon';
import { AppUiIcon } from '../icons/AppUiIcon';
import { HapticPressable } from './HapticPressable';
import { colors, spacing, textStyles } from '../theme/tokens';

export type QuickAction = {
  key: string;
  label: string;
  iconName: AppUiIconName;
  onPress: () => void;
  badge?: number; // optional notification count
  locked?: boolean; // tier-gated feature
};

type QuickActionsRowProps = {
  actions: QuickAction[];
};

export function QuickActionsRow({ actions }: QuickActionsRowProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {actions.map((action) => (
        <HapticPressable
          key={action.key}
          onPress={action.onPress}
          hapticType="impact"
          style={[styles.actionButton, action.locked && styles.actionButtonLocked]}
          accessible
          accessibilityRole="button"
          accessibilityLabel={
            action.locked
              ? `${action.label}, upgrade required`
              : action.badge
                ? `${action.label}, ${action.badge} new`
                : action.label
          }
        >
          <View style={[styles.iconCircle, action.locked && styles.iconCircleLocked]}>
            <AppUiIcon
              name={action.locked ? 'lock-closed-outline' : action.iconName}
              size={22}
              color={action.locked ? colors.textMuted : colors.accent}
            />
            {!action.locked && action.badge != null && action.badge > 0 ? (
              <View style={styles.badgeDot}>
                <Text style={styles.badgeText} maxFontSizeMultiplier={1}>
                  {action.badge > 9 ? '9+' : String(action.badge)}
                </Text>
              </View>
            ) : null}
          </View>
          <Text
            style={[styles.label, action.locked && styles.labelLocked]}
            maxFontSizeMultiplier={1.2}
            numberOfLines={1}
          >
            {action.label}
          </Text>
        </HapticPressable>
      ))}
    </ScrollView>
  );
}

const BUTTON_WIDTH = 76;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  actionButton: {
    width: BUTTON_WIDTH,
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
  label: {
    ...textStyles.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  actionButtonLocked: {
    opacity: 0.5,
  },
  iconCircleLocked: {
    borderColor: 'rgba(196, 184, 176, 0.2)',
  },
  labelLocked: {
    color: colors.textMuted,
  },
});
