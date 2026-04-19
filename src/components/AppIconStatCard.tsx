import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { AppIconProps } from '../icons/AppIcons';
import { colors, radii, spacing, textStyles } from '../theme/tokens';

type AppIconStatCardProps = {
  label: string;
  value: string;
  tone?: string;
  icon: React.ComponentType<AppIconProps>;
};

/**
 * Single stat "sticker" — a tinted, softly-glowing card with a chunky number
 * and a rounded icon puck. The tone prop drives the accent color so the grid
 * feels like a row of collectibles rather than a spreadsheet.
 */
export function AppIconStatCard({
  label,
  value,
  tone = colors.primary,
  icon: Icon,
}: AppIconStatCardProps) {
  const borderColor = `${tone}40`;
  const shineColor = `${tone}1F`;
  const iconBackground = `${tone}26`;

  return (
    <View style={[styles.card, { borderColor }]}>
      <LinearGradient
        colors={[shineColor, 'rgba(8, 14, 19, 0.0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View pointerEvents="none" style={[styles.topHighlight, { backgroundColor: `${tone}14` }]} />
      <View style={[styles.iconPuck, { backgroundColor: iconBackground, borderColor }]}>
        <Icon size={22} color={tone} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.value, { color: tone }]} numberOfLines={1} maxFontSizeMultiplier={1.1}>
          {value}
        </Text>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexGrow: 1,
    minWidth: 148,
    backgroundColor: 'rgba(8, 14, 19, 0.72)',
    borderRadius: radii.xl,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    shadowColor: colors.shadow,
    shadowOpacity: 0.24,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
    overflow: 'hidden',
  },
  topHighlight: {
    position: 'absolute',
    top: -40,
    right: -24,
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  iconPuck: {
    width: 54,
    height: 54,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    shadowColor: colors.shadow,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  value: {
    ...textStyles.title,
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '900',
  },
  label: {
    ...textStyles.labelCaps,
    color: colors.textSoft,
    lineHeight: 16,
    letterSpacing: 1,
  },
});
