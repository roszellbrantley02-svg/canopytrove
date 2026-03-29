import React, { PropsWithChildren } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../theme/tokens';

type SectionCardProps = PropsWithChildren<{
  title: string;
  body?: string;
}>;

export function SectionCard({ title, body, children }: SectionCardProps) {
  return (
    <LinearGradient
      colors={[colors.surfaceGlassStrong, 'rgba(10, 17, 23, 0.98)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.headerAccent} />
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {body ? <Text style={styles.body}>{body}</Text> : null}
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
  headerAccent: {
    width: 52,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.gold,
    shadowColor: colors.gold,
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  header: {
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  body: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 23,
  },
});
