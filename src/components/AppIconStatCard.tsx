import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { AppIconProps } from '../icons/AppIcons';
import { colors, radii, spacing, textStyles } from '../theme/tokens';

type AppIconStatCardProps = {
  label: string;
  value: string;
  tone?: string;
  icon: React.ComponentType<AppIconProps>;
};

export function AppIconStatCard({
  label,
  value,
  tone = colors.primary,
  icon: Icon,
}: AppIconStatCardProps) {
  const borderColor = `${tone}33`;

  return (
    <View style={[styles.card, { borderColor }]}>
      <View pointerEvents="none" style={[styles.ambientGlow, { backgroundColor: `${tone}12` }]} />
      <View style={[styles.iconWrap, { backgroundColor: `${tone}16`, borderColor }]}>
        <Icon size={24} color={tone} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.value}>{value}</Text>
        <Text style={styles.label}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexGrow: 1,
    minWidth: 148,
    backgroundColor: colors.surfaceGlassStrong,
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    shadowColor: colors.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 7,
    overflow: 'hidden',
  },
  ambientGlow: {
    position: 'absolute',
    top: -36,
    right: -16,
    width: 112,
    height: 112,
    borderRadius: 56,
  },
  iconWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    shadowColor: colors.shadow,
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  value: {
    ...textStyles.title,
    color: colors.text,
    lineHeight: 30,
  },
  label: {
    ...textStyles.labelCaps,
    color: colors.textSoft,
    lineHeight: 18,
  },
});
