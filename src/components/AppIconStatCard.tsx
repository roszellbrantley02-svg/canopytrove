import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { AppIconProps } from '../icons/AppIcons';
import { LayeredAppIcon } from '../icons/LayeredAppIcon';
import { colors, radii, spacing, typography } from '../theme/tokens';

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
      <View style={[styles.iconWrap, { backgroundColor: `${tone}16`, borderColor }]}>
        <LayeredAppIcon icon={Icon} size={22} />
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
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '900',
  },
  label: {
    color: colors.accent,
    fontSize: typography.caption,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
