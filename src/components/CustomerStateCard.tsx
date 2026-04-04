import type { PropsWithChildren } from 'react';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { AppUiIconName } from '../icons/AppUiIcon';
import { AppUiIcon } from '../icons/AppUiIcon';
import { colors, radii, spacing, textStyles } from '../theme/tokens';

type CustomerStateTone = 'neutral' | 'warm' | 'info' | 'danger' | 'success';

type CustomerStateCardProps = PropsWithChildren<{
  title: string;
  body: string;
  iconName?: AppUiIconName;
  eyebrow?: string;
  note?: string;
  tone?: CustomerStateTone;
  centered?: boolean;
}>;

const toneStyles: Record<
  CustomerStateTone,
  {
    borderColor: string;
    backgroundColor: string;
    iconColor: string;
    eyebrowColor: string;
    iconBackground: string;
    glowColor: string;
  }
> = {
  neutral: {
    borderColor: colors.borderSoft,
    backgroundColor: 'rgba(8, 14, 19, 0.72)',
    iconColor: colors.accent,
    eyebrowColor: colors.goldSoft,
    iconBackground: 'rgba(143, 255, 209, 0.10)',
    glowColor: 'rgba(143, 255, 209, 0.08)',
  },
  warm: {
    borderColor: 'rgba(245, 200, 106, 0.18)',
    backgroundColor: 'rgba(245, 200, 106, 0.08)',
    iconColor: colors.goldSoft,
    eyebrowColor: colors.goldSoft,
    iconBackground: 'rgba(245, 200, 106, 0.12)',
    glowColor: 'rgba(245, 200, 106, 0.09)',
  },
  info: {
    borderColor: 'rgba(0, 215, 255, 0.18)',
    backgroundColor: 'rgba(0, 215, 255, 0.08)',
    iconColor: colors.cyan,
    eyebrowColor: colors.cyan,
    iconBackground: 'rgba(0, 215, 255, 0.12)',
    glowColor: 'rgba(0, 215, 255, 0.09)',
  },
  danger: {
    borderColor: 'rgba(255, 122, 122, 0.22)',
    backgroundColor: 'rgba(255, 122, 122, 0.08)',
    iconColor: colors.rose,
    eyebrowColor: colors.rose,
    iconBackground: 'rgba(255, 122, 122, 0.12)',
    glowColor: 'rgba(255, 122, 122, 0.08)',
  },
  success: {
    borderColor: 'rgba(0, 245, 140, 0.18)',
    backgroundColor: 'rgba(0, 245, 140, 0.08)',
    iconColor: colors.primary,
    eyebrowColor: colors.primary,
    iconBackground: 'rgba(0, 245, 140, 0.12)',
    glowColor: 'rgba(0, 245, 140, 0.08)',
  },
};

export function CustomerStateCard({
  title,
  body,
  iconName = 'sparkles-outline',
  eyebrow,
  note,
  tone = 'neutral',
  centered = false,
  children,
}: CustomerStateCardProps) {
  const toneStyle = toneStyles[tone];

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: toneStyle.borderColor,
          backgroundColor: toneStyle.backgroundColor,
        },
        centered && styles.cardCentered,
      ]}
    >
      <View
        pointerEvents="none"
        style={[styles.ambientGlow, { backgroundColor: toneStyle.glowColor }]}
      />
      <View style={[styles.header, centered && styles.headerCentered]}>
        <View
          style={[
            styles.iconWrap,
            {
              borderColor: toneStyle.borderColor,
              backgroundColor: toneStyle.iconBackground,
            },
            centered && styles.iconWrapCentered,
          ]}
        >
          <AppUiIcon name={iconName} size={18} color={toneStyle.iconColor} />
        </View>
        <View style={[styles.copy, centered && styles.copyCentered]}>
          {eyebrow ? (
            <Text
              style={[
                styles.eyebrow,
                { color: toneStyle.eyebrowColor },
                centered && styles.textCentered,
              ]}
              maxFontSizeMultiplier={1.1}
            >
              {eyebrow}
            </Text>
          ) : null}
          <Text style={[styles.title, centered && styles.textCentered]} maxFontSizeMultiplier={1.2}>
            {title}
          </Text>
          <Text style={[styles.body, centered && styles.textCentered]} maxFontSizeMultiplier={1.3}>
            {body}
          </Text>
          {note ? (
            <Text
              style={[styles.note, centered && styles.textCentered]}
              maxFontSizeMultiplier={1.3}
            >
              {note}
            </Text>
          ) : null}
        </View>
      </View>
      {children ? <View style={styles.footer}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.xl,
    gap: spacing.lg,
    shadowColor: colors.shadow,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
    overflow: 'hidden',
  },
  ambientGlow: {
    position: 'absolute',
    top: -48,
    right: -18,
    width: 144,
    height: 144,
    borderRadius: 72,
  },
  cardCentered: {
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  headerCentered: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapCentered: {
    width: 52,
    height: 52,
    borderRadius: 18,
  },
  copy: {
    flex: 1,
    gap: spacing.xs,
  },
  copyCentered: {
    alignItems: 'center',
  },
  eyebrow: {
    ...textStyles.labelCaps,
  },
  title: {
    ...textStyles.section,
    color: colors.text,
  },
  body: {
    ...textStyles.body,
    color: colors.textMuted,
    lineHeight: 22,
  },
  note: {
    ...textStyles.caption,
    color: colors.textSoft,
    lineHeight: 18,
  },
  footer: {
    width: '100%',
    gap: spacing.md,
  },
  textCentered: {
    textAlign: 'center',
  },
});
