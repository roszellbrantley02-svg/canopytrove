import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, motion, radii, spacing, textStyles } from '../theme/tokens';
import { HapticPressable } from './HapticPressable';
import { MotionInView } from './MotionInView';

export type ErrorRecoveryCardProps = {
  title: string;
  message: string;
  onRetry: () => void;
  retryLabel?: string;
};

export function ErrorRecoveryCard({
  title,
  message,
  onRetry,
  retryLabel = 'Try again',
}: ErrorRecoveryCardProps) {
  return (
    <MotionInView delay={motion.quick}>
      <View style={styles.container}>
        <View style={styles.iconArea}>
          <Text style={styles.icon}>⚠</Text>
        </View>

        <Text style={styles.title} maxFontSizeMultiplier={1.2}>
          {title}
        </Text>
        <Text style={styles.message} maxFontSizeMultiplier={1.3}>
          {message}
        </Text>

        <HapticPressable
          onPress={onRetry}
          style={styles.button}
          hapticType="impact"
          accessible
          accessibilityRole="button"
          accessibilityLabel={retryLabel}
        >
          <Text style={styles.buttonText} maxFontSizeMultiplier={1.2}>
            {retryLabel}
          </Text>
        </HapticPressable>
      </View>
    </MotionInView>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    gap: spacing.lg,
    alignItems: 'center',
  },
  iconArea: {
    width: 56,
    height: 56,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 28,
  },
  title: {
    ...textStyles.title,
    color: colors.text,
    textAlign: 'center',
  },
  message: {
    ...textStyles.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  button: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  buttonText: {
    ...textStyles.button,
    color: colors.backgroundDeep,
  },
});
