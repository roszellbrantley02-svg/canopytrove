import React, { PropsWithChildren } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Animated, Easing, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { brand } from '../config/brand';
import { BrandMarkIcon } from '../icons/BrandMarkIcon';
import { HapticPressable } from './HapticPressable';
import { MotionInView } from './MotionInView';
import { colors, motion, radii, spacing, typography } from '../theme/tokens';

type ScreenShellProps = PropsWithChildren<{
  eyebrow: string;
  title: string;
  subtitle: string;
  headerPill?: string;
  onBrandIconPress?: () => void;
  onHeaderPillPress?: () => void;
  showTopBar?: boolean;
  showHero?: boolean;
  resetScrollOnFocus?: boolean;
}>;

export function ScreenShell({
  eyebrow,
  title,
  subtitle,
  headerPill = 'NY',
  onBrandIconPress,
  onHeaderPillPress,
  showTopBar = true,
  showHero = true,
  resetScrollOnFocus = false,
  children,
}: ScreenShellProps) {
  const scrollRef = React.useRef<ScrollView | null>(null);
  const shellProgress = React.useRef(new Animated.Value(0)).current;
  const { width } = useWindowDimensions();
  const compactHeader = width < 412;

  useFocusEffect(
    React.useCallback(() => {
      if (!resetScrollOnFocus) {
        return undefined;
      }

      const timeoutId = setTimeout(() => {
        scrollRef.current?.scrollTo({ x: 0, y: 0, animated: false });
      }, 0);

      return () => {
        clearTimeout(timeoutId);
      };
    }, [resetScrollOnFocus])
  );

  useFocusEffect(
    React.useCallback(() => {
      shellProgress.setValue(0);
      const animation = Animated.timing(shellProgress, {
        toValue: 1,
        duration: motion.ambient,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });

      animation.start();

      return () => {
        animation.stop();
      };
    }, [shellProgress])
  );

  return (
    <LinearGradient
      colors={[colors.backgroundDeep, colors.background, colors.backgroundAlt]}
      style={styles.gradient}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ambientWrap,
          {
            opacity: shellProgress.interpolate({
              inputRange: [0, 1],
              outputRange: [0.72, 1],
            }),
            transform: [
              {
                translateY: shellProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [18, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={[styles.ambientOrb, styles.ambientOrbPrimary]} />
        <View style={[styles.ambientOrb, styles.ambientOrbWarm]} />
        <LinearGradient
          colors={['rgba(143, 255, 209, 0.10)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0.9 }}
          style={styles.ambientBeam}
        />
      </Animated.View>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {showTopBar ? (
            <MotionInView delay={20} distance={10} duration={motion.quick}>
              <View style={styles.topBar}>
                <View style={[styles.brandRow, compactHeader && styles.brandRowCompact]}>
                  {onBrandIconPress ? (
                    <HapticPressable
                      hapticType="selection"
                      onPress={onBrandIconPress}
                      style={({ pressed }) => [styles.brandIcon, pressed && styles.brandIconPressed]}
                    >
                      <BrandMarkIcon size={26} />
                    </HapticPressable>
                  ) : (
                    <View style={styles.brandIcon}>
                      <BrandMarkIcon size={26} />
                    </View>
                  )}
                  <View style={styles.brandTextWrap}>
                    <Text style={[styles.brandTitle, compactHeader && styles.brandTitleCompact]}>
                      {brand.productName}
                    </Text>
                    <Text style={styles.brandSubtitle}>{brand.productTagline}</Text>
                  </View>
                </View>

                {onHeaderPillPress ? (
                  <HapticPressable
                    hapticType="selection"
                    onPress={onHeaderPillPress}
                    style={({ pressed }) => [
                      styles.headerPill,
                      compactHeader && styles.headerPillCompact,
                      pressed && styles.headerPillPressed,
                    ]}
                  >
                    <Ionicons name="location-outline" size={16} color={colors.goldSoft} />
                    <Text style={styles.headerPillText}>{headerPill}</Text>
                    <Ionicons name="chevron-down" size={12} color={colors.textSoft} />
                  </HapticPressable>
                ) : (
                  <View style={[styles.headerPill, compactHeader && styles.headerPillCompact]}>
                    <Ionicons name="location-outline" size={16} color={colors.goldSoft} />
                    <Text style={styles.headerPillText}>{headerPill}</Text>
                  </View>
                )}
              </View>
            </MotionInView>
          ) : null}

          {showHero ? (
            <MotionInView delay={motion.sectionStagger} distance={motion.revealDistance} duration={motion.standard}>
              <LinearGradient
                colors={['rgba(18, 31, 39, 0.96)', 'rgba(10, 18, 24, 0.84)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.hero}
              >
                <View style={styles.heroAccentRow}>
                  <Text style={styles.eyebrow}>{eyebrow}</Text>
                  <View style={styles.heroAccentLine} />
                </View>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.subtitle}>{subtitle}</Text>
              </LinearGradient>
            </MotionInView>
          ) : null}
          {children}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  ambientWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  ambientOrb: {
    position: 'absolute',
    borderRadius: 999,
  },
  ambientOrbPrimary: {
    top: -80,
    right: -40,
    width: 240,
    height: 240,
    backgroundColor: 'rgba(0, 245, 140, 0.08)',
    shadowColor: colors.primary,
    shadowOpacity: 0.24,
    shadowRadius: 48,
    shadowOffset: { width: 0, height: 16 },
  },
  ambientOrbWarm: {
    top: 140,
    left: -70,
    width: 180,
    height: 180,
    backgroundColor: 'rgba(245, 200, 106, 0.08)',
    shadowColor: colors.gold,
    shadowOpacity: 0.22,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 12 },
  },
  ambientBeam: {
    position: 'absolute',
    top: 72,
    left: spacing.lg,
    right: spacing.lg,
    height: 220,
    borderRadius: 40,
    opacity: 0.38,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: 120,
    gap: spacing.lg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: 'rgba(9, 15, 20, 0.74)',
    shadowColor: colors.shadow,
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
    paddingTop: spacing.sm,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
    minWidth: 0,
  },
  brandRowCompact: {
    marginBottom: spacing.sm,
  },
  brandIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: 'rgba(10, 18, 24, 0.98)',
    borderWidth: 1.5,
    borderColor: 'rgba(0, 245, 140, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 9 },
    elevation: 10,
  },
  brandTextWrap: {
    gap: 4,
    flex: 1,
    minWidth: 0,
  },
  brandIconPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
  brandTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 25,
  },
  brandTitleCompact: {
    fontSize: 21,
    lineHeight: 23,
  },
  brandSubtitle: {
    color: colors.goldSoft,
    fontSize: typography.caption,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  headerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(18, 29, 37, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(245, 200, 106, 0.18)',
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    shadowColor: colors.shadow,
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  headerPillCompact: {
    alignSelf: 'flex-start',
  },
  headerPillText: {
    color: colors.goldSoft,
    fontSize: typography.caption,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  headerPillPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.98 }],
  },
  hero: {
    gap: spacing.sm,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    shadowColor: colors.shadow,
    shadowOpacity: 0.28,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  heroAccentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  heroAccentLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(245, 200, 106, 0.22)',
  },
  eyebrow: {
    color: colors.gold,
    fontSize: typography.caption,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 36,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 24,
    maxWidth: 580,
  },
});
