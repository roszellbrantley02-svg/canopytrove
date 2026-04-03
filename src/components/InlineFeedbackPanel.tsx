import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { AppUiIconName } from '../icons/AppUiIcon';
import { AppUiIcon } from '../icons/AppUiIcon';
import { colors, radii, spacing, typography } from '../theme/tokens';

type InlineFeedbackTone = 'info' | 'warning' | 'danger' | 'success';

const toneStyles: Record<
  InlineFeedbackTone,
  {
    borderColor: string;
    backgroundColor: string;
    iconColor: string;
    labelColor: string;
  }
> = {
  info: {
    borderColor: 'rgba(0, 215, 255, 0.18)',
    backgroundColor: 'rgba(0, 215, 255, 0.08)',
    iconColor: colors.cyan,
    labelColor: colors.cyan,
  },
  warning: {
    borderColor: 'rgba(245, 200, 106, 0.18)',
    backgroundColor: 'rgba(245, 200, 106, 0.08)',
    iconColor: colors.goldSoft,
    labelColor: colors.goldSoft,
  },
  danger: {
    borderColor: 'rgba(255, 122, 122, 0.22)',
    backgroundColor: 'rgba(255, 122, 122, 0.08)',
    iconColor: colors.rose,
    labelColor: colors.rose,
  },
  success: {
    borderColor: 'rgba(0, 245, 140, 0.18)',
    backgroundColor: 'rgba(0, 245, 140, 0.08)',
    iconColor: colors.primary,
    labelColor: colors.primary,
  },
};

type InlineFeedbackPanelProps = {
  title: string;
  body?: string | null;
  tone?: InlineFeedbackTone;
  iconName?: AppUiIconName;
  label?: string;
};

export function InlineFeedbackPanel({
  title,
  body,
  tone = 'info',
  iconName = 'information-circle-outline',
  label,
}: InlineFeedbackPanelProps) {
  const palette = toneStyles[tone];

  return (
    <View
      style={[
        styles.panel,
        {
          borderColor: palette.borderColor,
          backgroundColor: palette.backgroundColor,
        },
      ]}
    >
      <View style={[styles.iconWrap, { borderColor: palette.borderColor }]}>
        <AppUiIcon name={iconName} size={16} color={palette.iconColor} />
      </View>
      <View style={styles.copy}>
        {label ? <Text style={[styles.label, { color: palette.labelColor }]}>{label}</Text> : null}
        <Text style={styles.title}>{title}</Text>
        {body ? <Text style={styles.body}>{body}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8, 14, 19, 0.66)',
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: typography.caption,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: '800',
    lineHeight: 18,
  },
  body: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18,
  },
});
