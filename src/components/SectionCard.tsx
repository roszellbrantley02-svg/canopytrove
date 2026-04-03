import type { PropsWithChildren } from 'react';
import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import type { AppUiIconName } from '../icons/AppUiIcon';
import { AppUiIcon } from '../icons/AppUiIcon';
import { colors, radii, spacing, textStyles } from '../theme/tokens';

type SectionCardTone = 'gold' | 'primary' | 'cyan' | 'neutral';

type SectionCardProps = PropsWithChildren<{
  title: string;
  body?: string;
  eyebrow?: string;
  badgeLabel?: string;
  iconName?: AppUiIconName;
  tone?: SectionCardTone;
}>;

const toneStyles: Record<
  SectionCardTone,
  {
    accent: string;
    badgeBackground: string;
    badgeBorder: string;
    badgeText: string;
    glow: string;
    iconBackground: string;
    iconBorder: string;
    iconColor: string;
  }
> = {
  gold: {
    accent: colors.gold,
    badgeBackground: 'rgba(245, 200, 106, 0.12)',
    badgeBorder: 'rgba(245, 200, 106, 0.24)',
    badgeText: colors.goldSoft,
    glow: 'rgba(245, 200, 106, 0.10)',
    iconBackground: 'rgba(245, 200, 106, 0.12)',
    iconBorder: 'rgba(245, 200, 106, 0.20)',
    iconColor: colors.goldSoft,
  },
  primary: {
    accent: colors.primary,
    badgeBackground: 'rgba(0, 245, 140, 0.12)',
    badgeBorder: 'rgba(0, 245, 140, 0.22)',
    badgeText: colors.accent,
    glow: 'rgba(0, 245, 140, 0.10)',
    iconBackground: 'rgba(0, 245, 140, 0.12)',
    iconBorder: 'rgba(0, 245, 140, 0.20)',
    iconColor: colors.accent,
  },
  cyan: {
    accent: colors.cyan,
    badgeBackground: 'rgba(0, 215, 255, 0.12)',
    badgeBorder: 'rgba(0, 215, 255, 0.22)',
    badgeText: '#B8F6FF',
    glow: 'rgba(0, 215, 255, 0.10)',
    iconBackground: 'rgba(0, 215, 255, 0.12)',
    iconBorder: 'rgba(0, 215, 255, 0.20)',
    iconColor: '#B8F6FF',
  },
  neutral: {
    accent: colors.accent,
    badgeBackground: 'rgba(255, 255, 255, 0.05)',
    badgeBorder: colors.borderSoft,
    badgeText: colors.textSoft,
    glow: 'rgba(143, 255, 209, 0.08)',
    iconBackground: 'rgba(255, 255, 255, 0.04)',
    iconBorder: colors.borderSoft,
    iconColor: colors.textSoft,
  },
};

export function SectionCard({
  title,
  body,
  eyebrow,
  badgeLabel,
  iconName,
  tone = 'gold',
  children,
}: SectionCardProps) {
  const toneStyle = toneStyles[tone];

  return (
    <LinearGradient
      colors={[colors.surfaceGlassStrong, 'rgba(10, 17, 23, 0.98)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View
        pointerEvents="none"
        style={[styles.ambientGlow, { backgroundColor: toneStyle.glow }]}
      />
      <View style={styles.headerAccentRow}>
        <View
          style={[
            styles.headerAccent,
            {
              backgroundColor: toneStyle.accent,
              shadowColor: toneStyle.accent,
            },
          ]}
        />
        {badgeLabel ? (
          <View
            style={[
              styles.badge,
              {
                backgroundColor: toneStyle.badgeBackground,
                borderColor: toneStyle.badgeBorder,
              },
            ]}
          >
            <Text style={[styles.badgeText, { color: toneStyle.badgeText }]}>{badgeLabel}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.header}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <View style={styles.titleRow}>
          {iconName ? (
            <View
              style={[
                styles.iconWrap,
                {
                  backgroundColor: toneStyle.iconBackground,
                  borderColor: toneStyle.iconBorder,
                },
              ]}
            >
              <AppUiIcon name={iconName} size={16} color={toneStyle.iconColor} />
            </View>
          ) : null}
          <View style={styles.titleCopy}>
            <Text style={styles.title}>{title}</Text>
            {body ? <Text style={styles.body}>{body}</Text> : null}
          </View>
        </View>
      </View>
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.lg,
    shadowColor: colors.shadow,
    shadowOpacity: 0.28,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
    overflow: 'hidden',
  },
  ambientGlow: {
    position: 'absolute',
    top: -72,
    right: -36,
    width: 188,
    height: 188,
    borderRadius: 94,
  },
  headerAccentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerAccent: {
    width: 52,
    height: 4,
    borderRadius: radii.pill,
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  badge: {
    minHeight: 32,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  badgeText: {
    ...textStyles.caption,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  header: {
    gap: spacing.md,
  },
  eyebrow: {
    ...textStyles.labelCaps,
    color: colors.textSoft,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  titleCopy: {
    flex: 1,
    gap: spacing.sm,
  },
  title: {
    ...textStyles.title,
    color: colors.text,
    lineHeight: 30,
  },
  body: {
    ...textStyles.body,
    color: colors.textMuted,
    lineHeight: 24,
  },
});
