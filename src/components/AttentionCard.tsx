import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { AppUiIconName } from '../icons/AppUiIcon';
import { AppUiIcon } from '../icons/AppUiIcon';
import { HapticPressable } from './HapticPressable';
import { colors, radii, spacing, textStyles } from '../theme/tokens';

type AttentionTone = 'warning' | 'danger' | 'info' | 'success';

type AttentionCardProps = {
  title: string;
  body: string;
  iconName: AppUiIconName;
  tone?: AttentionTone;
  actionLabel?: string;
  onPress?: () => void;
};

const toneConfig: Record<
  AttentionTone,
  { borderColor: string; bgColor: string; iconColor: string }
> = {
  warning: {
    borderColor: 'rgba(245, 200, 106, 0.22)',
    bgColor: 'rgba(245, 200, 106, 0.08)',
    iconColor: colors.goldSoft,
  },
  danger: {
    borderColor: 'rgba(255, 122, 122, 0.22)',
    bgColor: 'rgba(255, 122, 122, 0.08)',
    iconColor: colors.danger,
  },
  info: {
    borderColor: 'rgba(0, 215, 255, 0.18)',
    bgColor: 'rgba(0, 215, 255, 0.08)',
    iconColor: colors.cyan,
  },
  success: {
    borderColor: 'rgba(0, 245, 140, 0.18)',
    bgColor: 'rgba(0, 245, 140, 0.08)',
    iconColor: colors.primary,
  },
};

export function AttentionCard({
  title,
  body,
  iconName,
  tone = 'info',
  actionLabel,
  onPress,
}: AttentionCardProps) {
  const config = toneConfig[tone];
  const content = (
    <View
      style={[styles.card, { borderColor: config.borderColor, backgroundColor: config.bgColor }]}
    >
      <View style={[styles.iconWrap, { borderColor: config.borderColor }]}>
        <AppUiIcon name={iconName} size={18} color={config.iconColor} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title} maxFontSizeMultiplier={1.2} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.body} maxFontSizeMultiplier={1.3} numberOfLines={2}>
          {body}
        </Text>
      </View>
      {actionLabel ? (
        <View style={styles.actionArea}>
          <Text style={[styles.actionText, { color: config.iconColor }]}>{actionLabel}</Text>
          <AppUiIcon name="chevron-forward" size={14} color={config.iconColor} />
        </View>
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <HapticPressable
        onPress={onPress}
        hapticType="impact"
        accessible
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${body}`}
        accessibilityHint={actionLabel ? `Opens ${actionLabel}` : undefined}
      >
        {content}
      </HapticPressable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    borderWidth: 1,
    backgroundColor: 'rgba(8, 14, 19, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...textStyles.bodyStrong,
    color: colors.text,
    fontSize: 14,
  },
  body: {
    ...textStyles.caption,
    color: colors.textMuted,
  },
  actionArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionText: {
    ...textStyles.caption,
    fontWeight: '600',
  },
});
