import type { PropsWithChildren } from 'react';
import React from 'react';
import { CommonActions, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import {
  Animated,
  Easing,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { brand } from '../config/brand';
import { BrandMarkIcon } from '../icons/BrandMarkIcon';
import { AppUiIcon } from '../icons/AppUiIcon';
import { HapticPressable } from './HapticPressable';
import { MotionInView } from './MotionInView';
import { buildWebBackResetState, getWebBackLabel } from './screenShellNavigation';
import { colors, fontFamilies, motion, radii, spacing, textStyles } from '../theme/tokens';
import { useAdaptiveMotion } from '../hooks/useAdaptiveMotion';

type ScreenShellProps = PropsWithChildren<{
  eyebrow: string;
  title: string;
  subtitle?: string;
  headerPill?: string;
  onBrandIconPress?: () => void;
  onHeaderPillPress?: () => void;
  showTopBar?: boolean;
  showHero?: boolean;
  resetScrollOnFocus?: boolean;
}>;

const TAB_ROUTE_NAMES = new Set(['Nearby', 'Browse', 'HotDeals', 'Verify', 'Profile']);
const MANUAL_BACK_ROUTES = new Set(['Leaderboard']);
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
  const navigation = useNavigation();
  const route = useRoute();
  const scrollRef = React.useRef<ScrollView | null>(null);
  const shellProgress = React.useRef(new Animated.Value(0)).current;
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const adaptiveMotion = useAdaptiveMotion();
  const isAndroid = Platform.OS === 'android';
  const compactHeader = width < 412;
  const compactHero = width < 390 || height < 780;
  const contentContainerStyle = React.useMemo(
    () => [
      styles.content,
      compactHero && styles.contentCompact,
      {
        paddingBottom: (compactHero ? 128 : 144) + insets.bottom,
      },
    ],
    [compactHero, insets.bottom],
  );

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
    }, [resetScrollOnFocus]),
  );

  const isWeb = Platform.OS === 'web';
  const routeName = typeof route.name === 'string' ? route.name : '';
  // Back pill renders on every platform. iOS natively supports an edge-swipe
  // back gesture, but it fails silently when the stack has been replaced
  // (e.g. auth flows routed in via navigation.replace). A visible affordance
  // keeps every non-tab screen reversible for App Store review.
  const shouldShowAutoBackButton =
    showTopBar &&
    Boolean(routeName) &&
    !TAB_ROUTE_NAMES.has(routeName) &&
    !MANUAL_BACK_ROUTES.has(routeName);
  const webBackLabel = React.useMemo(() => getWebBackLabel(routeName), [routeName]);

  const handleAutoBackPress = React.useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.dispatch(CommonActions.reset(buildWebBackResetState(routeName)));
  }, [navigation, routeName]);

  React.useEffect(() => {
    if (isWeb) {
      // Skip JS-driven ambient animation on web — avoids jank on mobile browsers.
      shellProgress.setValue(1);
      return;
    }
    shellProgress.setValue(0);
    const animation = Animated.timing(shellProgress, {
      toValue: 1,
      duration: adaptiveMotion.duration(motion.ambient),
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    animation.start();

    return () => {
      animation.stop();
    };
  }, [adaptiveMotion, isWeb, shellProgress]);

  return (
    <LinearGradient
      colors={[colors.backgroundDeep, colors.background, colors.backgroundAlt]}
      style={styles.gradient}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ambientWrap,
          isWeb
            ? undefined
            : {
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
        {isAndroid ? <View style={[styles.ambientHalo, styles.ambientHaloPrimary]} /> : null}
        {isAndroid ? <View style={[styles.ambientHalo, styles.ambientHaloWarm]} /> : null}
        <View style={[styles.ambientOrb, styles.ambientOrbPrimary]} />
        <View style={[styles.ambientOrb, styles.ambientOrbWarm]} />
        <LinearGradient
          colors={['rgba(143, 255, 209, 0.10)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0.9 }}
          style={styles.ambientBeam}
        />
      </Animated.View>
      <SafeAreaView
        edges={isWeb ? ['left', 'right', 'bottom'] : undefined}
        style={[styles.safeArea, isWeb && styles.webSafeArea]}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[contentContainerStyle, isWeb && styles.webScrollContent]}
          showsVerticalScrollIndicator={false}
        >
          {showTopBar ? (
            <MotionInView delay={20} distance={10} duration={motion.quick}>
              <View>
                {shouldShowAutoBackButton ? (
                  <HapticPressable
                    hapticType="selection"
                    onPress={handleAutoBackPress}
                    style={({ pressed }) => [
                      styles.backButton,
                      pressed && styles.backButtonPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Go back"
                    accessibilityHint="Returns to the previous screen or the closest safe destination."
                  >
                    <View style={styles.backButtonIconWrap}>
                      <AppUiIcon name="arrow-back" size={14} color={colors.text} />
                    </View>
                    <Text style={styles.backButtonText}>{webBackLabel}</Text>
                  </HapticPressable>
                ) : null}

                <View style={[styles.topBar, compactHeader && styles.topBarCompact]}>
                  <View pointerEvents="none" style={styles.topBarTone} />
                  <View style={[styles.brandRow, compactHeader && styles.brandRowCompact]}>
                    {onBrandIconPress ? (
                      <HapticPressable
                        hapticType="selection"
                        onPress={onBrandIconPress}
                        style={({ pressed }) => [
                          styles.brandIcon,
                          compactHeader && styles.brandIconCompact,
                          pressed && styles.brandIconPressed,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel="Canopy Trove home"
                        accessibilityHint="Returns to the home screen."
                      >
                        <BrandMarkIcon size={compactHeader ? 22 : 26} />
                      </HapticPressable>
                    ) : (
                      <View style={[styles.brandIcon, compactHeader && styles.brandIconCompact]}>
                        <BrandMarkIcon size={compactHeader ? 22 : 26} />
                      </View>
                    )}
                    <View style={styles.brandTextWrap}>
                      <Text style={[styles.brandTitle, compactHeader && styles.brandTitleCompact]}>
                        {brand.productDisplayName}
                      </Text>
                      <Text numberOfLines={1} ellipsizeMode="tail" style={styles.brandSubtitle}>
                        {brand.productTagline}
                      </Text>
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
                      accessibilityRole="button"
                      accessibilityLabel="Change location"
                      accessibilityHint={`Current location is ${headerPill}. Press to change.`}
                    >
                      <AppUiIcon name="location-outline" size={16} color={colors.goldSoft} />
                      <Text style={styles.headerPillText}>{headerPill}</Text>
                      <AppUiIcon name="chevron-down" size={12} color={colors.textSoft} />
                    </HapticPressable>
                  ) : (
                    <View style={[styles.headerPill, compactHeader && styles.headerPillCompact]}>
                      <AppUiIcon name="location-outline" size={16} color={colors.goldSoft} />
                      <Text style={styles.headerPillText}>{headerPill}</Text>
                    </View>
                  )}
                </View>
              </View>
            </MotionInView>
          ) : null}

          {showHero ? (
            <MotionInView
              delay={motion.sectionStagger}
              distance={motion.revealDistance}
              duration={motion.standard}
            >
              <LinearGradient
                colors={['rgba(18, 31, 39, 0.96)', 'rgba(10, 18, 24, 0.84)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.hero, compactHero && styles.heroCompact]}
              >
                <View pointerEvents="none" style={styles.heroTone} />
                <View style={styles.heroAccentRow}>
                  <Text style={styles.eyebrow}>{eyebrow}</Text>
                  <View style={styles.heroAccentLine} />
                </View>
                <Text
                  style={[styles.title, compactHero && styles.titleCompact]}
                  accessibilityRole="header"
                >
                  {title}
                </Text>
                {subtitle ? (
                  <Text style={[styles.subtitle, compactHero && styles.subtitleCompact]}>
                    {subtitle}
                  </Text>
                ) : null}
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
  ambientHalo: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
  },
  ambientHaloPrimary: {
    top: -100,
    right: -58,
    width: 284,
    height: 284,
    backgroundColor: 'rgba(0, 245, 140, 0.06)',
    borderColor: 'rgba(0, 245, 140, 0.10)',
  },
  ambientHaloWarm: {
    top: 124,
    left: -86,
    width: 212,
    height: 212,
    backgroundColor: 'rgba(245, 200, 106, 0.06)',
    borderColor: 'rgba(245, 200, 106, 0.10)',
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
    elevation: 18,
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
    elevation: 14,
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
  webSafeArea: {
    alignItems: 'center',
  },
  webScrollContent: {
    maxWidth: 480,
    width: '100%',
  },
  content: {
    padding: spacing.xl,
    paddingBottom: 144,
    gap: spacing.lg,
  },
  contentCompact: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 128,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    position: 'relative',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: 'rgba(9, 15, 20, 0.68)',
    shadowColor: colors.shadow,
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 7,
    overflow: 'hidden',
  },
  backButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    marginLeft: -4,
    minHeight: 44,
    paddingVertical: 6,
    paddingLeft: 4,
    paddingRight: 12,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(143, 255, 209, 0.12)',
    backgroundColor: 'rgba(8, 15, 21, 0.62)',
    shadowColor: colors.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  backButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  backButtonIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(143, 255, 209, 0.10)',
  },
  backButtonText: {
    ...textStyles.bodyStrong,
    color: colors.text,
    fontSize: 13,
    letterSpacing: 0.15,
  },
  topBarCompact: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  topBarTone: {
    position: 'absolute',
    top: -54,
    right: -12,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(245, 200, 106, 0.08)',
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
    width: 48,
    height: 48,
    borderRadius: 17,
    backgroundColor: 'rgba(10, 18, 24, 0.94)',
    borderWidth: 1.25,
    borderColor: 'rgba(0, 245, 140, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  brandIconCompact: {
    width: 44,
    height: 44,
    borderRadius: 15,
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
    ...textStyles.section,
    color: colors.text,
    fontFamily: fontFamilies.displayMedium,
  },
  brandTitleCompact: {
    fontSize: 17,
    lineHeight: 21,
  },
  brandSubtitle: {
    ...textStyles.caption,
    color: colors.textSoft,
    fontSize: 12,
    flexShrink: 1,
  },
  headerPill: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(14, 23, 30, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(245, 200, 106, 0.14)',
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    shadowColor: colors.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  headerPillCompact: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  headerPillText: {
    ...textStyles.caption,
    color: colors.goldSoft,
    fontSize: 12,
  },
  headerPillPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.98 }],
  },
  hero: {
    gap: spacing.sm,
    position: 'relative',
    minHeight: 120,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    shadowColor: colors.shadow,
    shadowOpacity: 0.28,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
    overflow: 'hidden',
  },
  heroCompact: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  heroAccentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  heroTone: {
    position: 'absolute',
    top: -56,
    right: -26,
    width: 184,
    height: 184,
    borderRadius: 92,
    backgroundColor: 'rgba(245, 200, 106, 0.10)',
  },
  heroAccentLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(245, 200, 106, 0.22)',
  },
  eyebrow: {
    ...textStyles.labelCaps,
    color: colors.gold,
    letterSpacing: 0.95,
  },
  title: {
    ...textStyles.display,
    color: colors.text,
    fontSize: 30,
    lineHeight: 36,
  },
  titleCompact: {
    fontSize: 25,
    lineHeight: 30,
  },
  subtitle: {
    ...textStyles.body,
    color: colors.textMuted,
    lineHeight: 23,
    maxWidth: 560,
  },
  subtitleCompact: {
    lineHeight: 22,
  },
});
