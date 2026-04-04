import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radii, spacing } from '../theme/tokens';
import { ShimmerBlock } from './ShimmerBlock';

type SkeletonCardProps = {
  testID?: string;
};

export function SkeletonCard({ testID }: SkeletonCardProps) {
  return (
    <View testID={testID} style={styles.card}>
      <ShimmerBlock style={styles.image} />
      <View style={styles.content}>
        <ShimmerBlock style={styles.title} />
        <ShimmerBlock style={styles.subtitle} />
        <View style={styles.row}>
          <ShimmerBlock style={styles.badge} />
          <ShimmerBlock style={styles.badge} />
        </View>
      </View>
    </View>
  );
}

type SkeletonCardListProps = {
  count?: number;
  testID?: string;
};

export function SkeletonCardList({ count = 4, testID }: SkeletonCardListProps) {
  return (
    <View testID={testID}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} testID={testID ? `${testID}-card-${i}` : undefined} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  image: {
    height: 140,
    borderRadius: 0,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    height: 20,
    width: '70%',
    borderRadius: radii.sm,
  },
  subtitle: {
    height: 16,
    width: '45%',
    borderRadius: radii.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  badge: {
    height: 24,
    width: 72,
    borderRadius: radii.sm,
  },
});
