import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radii, spacing } from '../theme/tokens';
import { ShimmerBlock } from './ShimmerBlock';

type StorefrontRouteCardSkeletonProps = {
  variant?: 'feature' | 'list';
};

function StorefrontRouteCardSkeletonComponent({
  variant = 'feature',
}: StorefrontRouteCardSkeletonProps) {
  const compact = variant === 'list';

  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <View style={[styles.mapShell, compact ? styles.mapShellCompact : styles.mapShellFeature]}>
        <ShimmerBlock style={styles.mapGlow} borderRadius={0} shimmerWidth={220} />
        <ShimmerBlock
          style={[styles.pill, styles.pillTopLeft]}
          borderRadius={radii.pill}
          shimmerWidth={90}
        />
        <ShimmerBlock
          style={[styles.pill, styles.pillBottomRight]}
          borderRadius={radii.pill}
          shimmerWidth={84}
        />
      </View>

      <View style={styles.body}>
        <View style={styles.badgeRow}>
          <ShimmerBlock
            style={[styles.chip, styles.chipWide]}
            borderRadius={radii.pill}
            shimmerWidth={76}
          />
          <ShimmerBlock
            style={[styles.chip, styles.chipNarrow]}
            borderRadius={radii.pill}
            shimmerWidth={66}
          />
        </View>

        <View style={styles.titleBlock}>
          <ShimmerBlock
            style={[styles.line, styles.titleLine]}
            borderRadius={radii.sm}
            shimmerWidth={118}
          />
          <ShimmerBlock
            style={[styles.line, styles.subtitleLine]}
            borderRadius={radii.sm}
            shimmerWidth={94}
          />
        </View>

        <View style={styles.metaRow}>
          <ShimmerBlock
            style={[styles.chip, styles.metaChip]}
            borderRadius={radii.pill}
            shimmerWidth={72}
          />
          <ShimmerBlock
            style={[styles.chip, styles.metaChip]}
            borderRadius={radii.pill}
            shimmerWidth={72}
          />
        </View>

        <ShimmerBlock style={styles.primaryButton} borderRadius={radii.md} shimmerWidth={128} />
        <ShimmerBlock style={styles.secondaryStrip} borderRadius={radii.md} shimmerWidth={118} />
      </View>
    </View>
  );
}

export const StorefrontRouteCardSkeleton = React.memo(StorefrontRouteCardSkeletonComponent);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    gap: spacing.md,
  },
  cardCompact: {
    gap: spacing.sm,
  },
  mapShell: {
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  mapShellFeature: {
    height: 182,
  },
  mapShellCompact: {
    height: 146,
  },
  mapGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 245, 140, 0.08)',
  },
  pill: {
    position: 'absolute',
    height: 28,
    backgroundColor: colors.overlay,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillTopLeft: {
    top: spacing.md,
    left: spacing.md,
    width: 118,
  },
  pillBottomRight: {
    right: spacing.md,
    bottom: spacing.md,
    width: 92,
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  chip: {
    minHeight: 30,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipWide: {
    width: 116,
  },
  chipNarrow: {
    width: 84,
  },
  titleBlock: {
    gap: spacing.sm,
  },
  line: {
    backgroundColor: colors.surfaceElevated,
  },
  titleLine: {
    height: 18,
    width: '78%',
  },
  subtitleLine: {
    height: 14,
    width: '48%',
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  metaChip: {
    width: 96,
  },
  primaryButton: {
    minHeight: 46,
    borderRadius: radii.md,
    backgroundColor: 'rgba(0, 245, 140, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 140, 0.18)',
  },
  secondaryStrip: {
    minHeight: 30,
    borderRadius: radii.md,
    backgroundColor: 'rgba(140, 59, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(140, 59, 255, 0.18)',
  },
});
