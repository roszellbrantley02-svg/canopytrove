import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HapticPressable } from '../components/HapticPressable';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import { BrandMarkIcon } from '../icons/BrandMarkIcon';
import { colors, fontFamilies, radii, spacing, textStyles } from '../theme/tokens';

type NotFoundScreenProps = {
  onGoHome: () => void;
};

function NotFoundScreenInner({ onGoHome }: NotFoundScreenProps) {
  const isWeb = Platform.OS === 'web';

  return (
    <LinearGradient
      colors={[colors.backgroundDeep, colors.background, colors.backgroundAlt]}
      style={styles.screen}
    >
      <SafeAreaView style={[styles.safeArea, isWeb && styles.webSafeArea]}>
        <View style={[styles.content, isWeb && styles.webContent]}>
          <View style={styles.logoWrap}>
            <BrandMarkIcon size={48} />
          </View>
          <Text style={styles.code}>404</Text>
          <Text style={styles.title}>Page not found</Text>
          <Text style={styles.body}>
            The page you are looking for does not exist or has been moved.
          </Text>
          <HapticPressable
            accessibilityRole="button"
            accessibilityLabel="Go to home screen"
            onPress={onGoHome}
            style={styles.button}
          >
            <Text style={styles.buttonText}>Go Home</Text>
          </HapticPressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

export const NotFoundScreen = withScreenErrorBoundary(NotFoundScreenInner, 'not-found-screen');

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  webSafeArea: {
    alignItems: 'center' as const,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  webContent: {
    maxWidth: 480,
    width: '100%' as unknown as number,
  },
  logoWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 245, 140, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(143, 255, 209, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  code: {
    fontFamily: fontFamilies.display,
    fontSize: 64,
    color: colors.gold,
    letterSpacing: 2,
  },
  title: {
    ...textStyles.display,
    color: colors.text,
    fontSize: 28,
    textAlign: 'center',
  },
  body: {
    ...textStyles.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 23,
    maxWidth: 320,
  },
  button: {
    marginTop: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.gold,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  buttonText: {
    ...textStyles.button,
    color: colors.backgroundDeep,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
