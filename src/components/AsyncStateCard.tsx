import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, textStyles } from '../theme/tokens';
import { HapticPressable } from './HapticPressable';
import { MotionInView } from './MotionInView';
import { ShimmerBlock } from './ShimmerBlock';

type AsyncStateVariant = 'loading' | 'empty' | 'error';

type AsyncStateCardProps = {
  variant: AsyncStateVariant;
  title: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
};

/**
 * Unified state card for all async surfaces — loading, empty, and error.
 * Use this instead of ad-hoc inline empty/loading states to keep the app
 * feeling consistent and calm across every screen.
 *
 * - `loading`:  Shimmer skeleton card with message
 * - `empty`:    Informational card (no data to show)
 * - `error`:    Recovery card with retry button
 */
export function AsyncStateCard({
  variant,
  title,
  message,
  onRetry,
  retryLabel = 'Try again',
}: AsyncStateCardProps) {
  return (
    <MotionInView delay={80}>
      <View style={styles.card}>
        {variant === 'loading' ? (
          <View style={styles.shimmerRow}>
            <ShimmerBlock style={styles.shimmerDot} borderRadius={radii.md} shimmerWidth={40} />
            <View style={styles.shimmerLines}>
              <ShimmerBlock style={styles.shimmerLine} borderRadius={radii.sm} shimmerWidth={100} />
              <ShimmerBlock
                style={[styles.shimmerLine, styles.shimmerLineShort]}
                borderRadius={radii.sm}
                shimmerWidth={80}
              />
            </View>
          </View>
        ) : (
          <View style={styles.iconArea}>
            <Text style={styles.icon}>{variant === 'error' ? '\u26A0' : '\u2014'}</Text>
          </View>
        )}

        <Text style={styles.title} maxFontSizeMultiplier={1.2}>
          {title}
        </Text>

        {message ? (
          <Text style={styles.message} maxFontSizeMultiplier={1.3}>
            {message}
          </Text>
        ) : null}

        {variant === 'error' && onRetry ? (
          <HapticPressable
            onPress={onRetry}
            style={styles.retryButton}
            hapticType="impact"
            accessible
            accessibilityRole="button"
            accessibilityLabel={retryLabel}
          >
            <Text style={styles.retryButtonText} maxFontSizeMultiplier={1.2}>
              {retryLabel}
            </Text>
          </HapticPressable>
        ) : null}
      </View>
    </MotionInView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: 'center',
  },
  iconArea: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 22,
    color: colors.textSoft,
  },
  shimmerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    width: '100%',
  },
  shimmerDot: {
    width: 48,
    height: 48,
    backgroundColor: colors.surfaceElevated,
  },
  shimmerLines: {
    flex: 1,
    gap: spacing.sm,
  },
  shimmerLine: {
    height: 14,
    width: '80%',
    backgroundColor: colors.surfaceElevated,
  },
  shimmerLineShort: {
    width: '52%',
  },
  title: {
    ...textStyles.title,
    color: colors.text,
    textAlign: 'center',
    fontSize: 16,
  },
  message: {
    ...textStyles.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  retryButtonText: {
    ...textStyles.button,
    color: colors.backgroundDeep,
  },
});
