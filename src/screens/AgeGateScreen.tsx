import React from 'react';
import {
  BackHandler,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { brand } from '../config/brand';
import { MotionInView } from '../components/MotionInView';
import { HapticPressable } from '../components/HapticPressable';
import { BrandMarkIcon } from '../icons/BrandMarkIcon';
import { colors, fontFamilies, radii, spacing, textStyles } from '../theme/tokens';

// AgeGateScreen is wired from the app entry path rather than the tab/root navigator.
// Keep this screen self-contained so age-gate behavior stays easy to test and swap.
type AgeGateScreenProps = {
  onAccept: () => void;
};

export function AgeGateScreen({ onAccept }: AgeGateScreenProps) {
  const [isAccessBlocked, setIsAccessBlocked] = React.useState(false);
  const { width, height } = useWindowDimensions();
  const compactLayout = width < 390 || height < 780;
  const isWeb = Platform.OS === 'web';

  const blockAccess = React.useCallback(() => {
    setIsAccessBlocked(true);
  }, []);

  const closeApp = React.useCallback(() => {
    BackHandler.exitApp();
  }, []);

  return (
    <LinearGradient
      colors={[colors.backgroundDeep, colors.background, colors.backgroundAlt]}
      style={styles.screen}
    >
      <SafeAreaView style={[styles.safeArea, isWeb && styles.webSafeArea]}>
        <View pointerEvents="none" style={styles.ambientWrap}>
          <View style={[styles.backdropOrb, styles.backdropOrbPrimary]} />
          <View style={[styles.backdropOrb, styles.backdropOrbWarm]} />
        </View>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            compactLayout && styles.scrollContentCompact,
            isWeb && styles.webScrollContent,
          ]}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <MotionInView style={styles.cardWrap} distance={14}>
            <LinearGradient
              colors={['rgba(18, 31, 39, 0.96)', 'rgba(10, 18, 24, 0.92)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.card, compactLayout && styles.cardCompact]}
            >
              <View style={styles.cardGlow} />
              <View style={styles.cardMain}>
                <View style={[styles.headerRow, compactLayout && styles.headerRowCompact]}>
                  <View style={[styles.logoWrap, compactLayout && styles.logoWrapCompact]}>
                    <BrandMarkIcon size={compactLayout ? 52 : 60} />
                  </View>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>Adults 21+</Text>
                  </View>
                </View>
                <View style={styles.heroCopy}>
                  <Text style={styles.eyebrow}>{brand.productDisplayName}</Text>
                  <Text style={[styles.title, compactLayout && styles.titleCompact]}>
                    Confirm you are 21 or older.
                  </Text>
                  <Text style={[styles.body, compactLayout && styles.bodyCompact]}>
                    {brand.productDisplayName} is an adults-only cannabis storefront directory. You
                    must be at least 21 to continue.
                  </Text>
                </View>

                <View style={styles.trustRow}>
                  <View style={styles.trustChip}>
                    <Text style={styles.trustChipText}>21+ only</Text>
                  </View>
                  <View style={styles.trustChip}>
                    <Text style={styles.trustChipText}>Verified storefronts</Text>
                  </View>
                  <View style={styles.trustChip}>
                    <Text style={styles.trustChipText}>Official records</Text>
                  </View>
                </View>

                {isAccessBlocked ? (
                  <View style={[styles.noticeWrap, styles.noticeWrapDanger]}>
                    <Text style={styles.noticeTitle}>Access blocked</Text>
                    <Text style={styles.noticeBody}>
                      {brand.productDisplayName} is only available to adults 21 and older. Close the
                      app to exit safely.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.noticeWrap}>
                    <Text style={styles.noticeTitle}>Before you continue</Text>
                    <Text style={styles.noticeBody}>
                      By entering, you confirm you meet the age requirement for this customer
                      directory.
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.cardFooter}>
                <View style={styles.actionColumn}>
                  <HapticPressable
                    accessibilityRole="button"
                    accessibilityLabel="Confirm you are 21 or older"
                    accessibilityHint="Continues into the Canopy Trove app."
                    onPress={onAccept}
                    style={styles.primaryButton}
                  >
                    <Text style={styles.primaryButtonText}>Yes, I am 21 or older</Text>
                  </HapticPressable>
                  <HapticPressable
                    accessibilityRole="button"
                    accessibilityLabel="Deny age-gate entry"
                    accessibilityHint="Blocks access and shows the close-app option."
                    onPress={blockAccess}
                    style={styles.secondaryButton}
                  >
                    <Text style={styles.secondaryButtonText}>No</Text>
                  </HapticPressable>
                  {isAccessBlocked ? (
                    <HapticPressable
                      accessibilityRole="button"
                      accessibilityLabel="Close the app"
                      accessibilityHint="Exits the app after access has been blocked."
                      disabled={!isAccessBlocked}
                      onPress={closeApp}
                      style={styles.tertiaryButton}
                    >
                      <Text style={styles.tertiaryButtonText}>Close App</Text>
                    </HapticPressable>
                  ) : null}
                </View>
              </View>
            </LinearGradient>
          </MotionInView>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
  },
  webSafeArea: {
    alignItems: 'center' as const,
  },
  webScrollContent: {
    maxWidth: 480,
    width: '100%' as unknown as number,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  scrollContentCompact: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  ambientWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  backdropOrb: {
    position: 'absolute',
    borderRadius: 999,
  },
  backdropOrbPrimary: {
    top: '14%',
    right: -72,
    width: 240,
    height: 240,
    backgroundColor: 'rgba(0, 245, 140, 0.09)',
    shadowColor: colors.primary,
    shadowOpacity: 0.22,
    shadowRadius: 42,
    shadowOffset: { width: 0, height: 18 },
  },
  backdropOrbWarm: {
    bottom: '14%',
    left: -84,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: 'rgba(245, 200, 106, 0.08)',
  },
  cardWrap: {
    flex: 1,
    borderRadius: radii.xl,
    alignSelf: 'stretch',
  },
  card: {
    flex: 1,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(245, 200, 106, 0.18)',
    padding: spacing.xl,
    gap: spacing.lg,
    minHeight: 0,
    shadowColor: colors.shadow,
    shadowOpacity: 0.3,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 14,
    overflow: 'hidden',
  },
  cardCompact: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardGlow: {
    position: 'absolute',
    top: -56,
    right: -24,
    width: 184,
    height: 184,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(245, 200, 106, 0.08)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerRowCompact: {
    marginBottom: spacing.xs,
  },
  logoWrap: {
    width: 88,
    height: 88,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 245, 140, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(143, 255, 209, 0.22)',
  },
  logoWrapCompact: {
    width: 74,
    height: 74,
    borderRadius: 22,
  },
  cardMain: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.lg,
  },
  heroCopy: {
    gap: spacing.sm,
  },
  badge: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(245, 200, 106, 0.2)',
    backgroundColor: 'rgba(245, 200, 106, 0.1)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  badgeText: {
    ...textStyles.labelCaps,
    color: colors.goldSoft,
    letterSpacing: 0.7,
  },
  eyebrow: {
    ...textStyles.labelCaps,
    color: colors.textSoft,
    letterSpacing: 0.9,
  },
  title: {
    ...textStyles.display,
    color: colors.text,
    fontSize: 34,
    lineHeight: 39,
  },
  titleCompact: {
    fontSize: 28,
    lineHeight: 33,
  },
  body: {
    ...textStyles.body,
    color: colors.textMuted,
    lineHeight: 23,
  },
  bodyCompact: {
    lineHeight: 21,
  },
  trustRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  trustChip: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: 'rgba(8, 14, 19, 0.76)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  trustChipText: {
    ...textStyles.caption,
    fontFamily: fontFamilies.bodyBold,
    color: colors.textSoft,
  },
  noticeWrap: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(245, 200, 106, 0.18)',
    backgroundColor: 'rgba(245, 200, 106, 0.08)',
    padding: spacing.md,
    gap: spacing.xs,
  },
  noticeWrapDanger: {
    borderColor: 'rgba(255, 122, 122, 0.24)',
    backgroundColor: 'rgba(255, 122, 122, 0.12)',
  },
  noticeTitle: {
    ...textStyles.bodyStrong,
    color: colors.text,
  },
  noticeBody: {
    ...textStyles.body,
    color: colors.textMuted,
    lineHeight: 22,
  },
  cardFooter: {
    gap: spacing.md,
  },
  actionColumn: {
    gap: spacing.sm,
  },
  primaryButton: {
    borderRadius: radii.lg,
    backgroundColor: colors.gold,
    minHeight: 56,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    ...textStyles.button,
    color: colors.backgroundDeep,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  secondaryButton: {
    borderRadius: radii.lg,
    backgroundColor: 'rgba(8, 14, 19, 0.76)',
    borderWidth: 1,
    borderColor: colors.borderSoft,
    minHeight: 54,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    ...textStyles.button,
    color: colors.text,
  },
  tertiaryButton: {
    borderRadius: radii.lg,
    minHeight: 46,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8, 14, 19, 0.44)',
  },
  tertiaryButtonText: {
    ...textStyles.bodyStrong,
    fontFamily: fontFamilies.bodyMedium,
    color: colors.textSoft,
  },
});
