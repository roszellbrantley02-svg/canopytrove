import React from 'react';
import { BackHandler, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { brand } from '../config/brand';
import { MotionInView } from '../components/MotionInView';
import { HapticPressable } from '../components/HapticPressable';
import { LayeredAppIcon } from '../icons/LayeredAppIcon';
import { MapIcon } from '../icons/AppIcons';
import { colors, radii, spacing, typography } from '../theme/tokens';

type AgeGateScreenProps = {
  onAccept: () => void;
};

export function AgeGateScreen({ onAccept }: AgeGateScreenProps) {
  const [isAccessBlocked, setIsAccessBlocked] = React.useState(false);

  const blockAccess = React.useCallback(() => {
    setIsAccessBlocked(true);
  }, []);

  const closeApp = React.useCallback(() => {
    BackHandler.exitApp();
  }, []);

  return (
    <LinearGradient colors={[colors.backgroundDeep, colors.background, colors.backgroundAlt]} style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <View pointerEvents="none" style={styles.ambientWrap}>
          <View style={[styles.backdropOrb, styles.backdropOrbPrimary]} />
          <View style={[styles.backdropOrb, styles.backdropOrbWarm]} />
        </View>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <MotionInView style={styles.cardWrap} distance={14}>
            <LinearGradient
              colors={['rgba(18, 31, 39, 0.96)', 'rgba(10, 18, 24, 0.92)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.card}
            >
              <View style={styles.cardGlow} />
              <View style={styles.headerRow}>
                <View style={styles.logoWrap}>
                  <LayeredAppIcon icon={MapIcon} size={44} />
                </View>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>Adults 21+</Text>
                </View>
              </View>
              <Text style={styles.eyebrow}>{brand.productName}</Text>
              <Text style={styles.title}>Confirm you are 21 or older.</Text>
              <Text style={styles.body}>
                Canopy Trove is an adults-only cannabis storefront directory. You must be at least 21 to continue.
              </Text>
              <View style={styles.trustRow}>
                <View style={styles.trustChip}>
                  <Text style={styles.trustChipText}>Age-gated access</Text>
                </View>
                <View style={styles.trustChip}>
                  <Text style={styles.trustChipText}>Storefront discovery</Text>
                </View>
                <View style={styles.trustChip}>
                  <Text style={styles.trustChipText}>Member reviews</Text>
                </View>
              </View>
              {isAccessBlocked ? (
                <View style={[styles.noticeWrap, styles.noticeWrapDanger]}>
                  <Text style={styles.noticeTitle}>Access blocked</Text>
                  <Text style={styles.noticeBody}>
                    Canopy Trove is only available to adults 21 and older. Close the app to exit safely.
                  </Text>
                </View>
              ) : (
                <View style={styles.noticeWrap}>
                  <Text style={styles.noticeTitle}>Before you continue</Text>
                  <Text style={styles.noticeBody}>
                    By entering, you confirm you meet the age requirement for this customer directory.
                  </Text>
                </View>
              )}
              <View style={styles.actionColumn}>
                <HapticPressable onPress={onAccept} style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>Yes, I am 21 or older</Text>
                </HapticPressable>
                <HapticPressable onPress={blockAccess} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>No</Text>
                </HapticPressable>
                {isAccessBlocked ? (
                  <HapticPressable disabled={!isAccessBlocked} onPress={closeApp} style={styles.tertiaryButton}>
                    <Text style={styles.tertiaryButtonText}>Close App</Text>
                  </HapticPressable>
                ) : null}
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    justifyContent: 'center',
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
    borderRadius: radii.xl,
    alignSelf: 'stretch',
  },
  card: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(245, 200, 106, 0.18)',
    padding: spacing.xl,
    gap: spacing.md,
    shadowColor: colors.shadow,
    shadowOpacity: 0.3,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 14,
    overflow: 'hidden',
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
  logoWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 245, 140, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(143, 255, 209, 0.22)',
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
    color: colors.goldSoft,
    fontSize: typography.caption,
    fontWeight: '900',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  eyebrow: {
    color: colors.goldSoft,
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 33,
    fontWeight: '900',
  },
  body: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 23,
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
    color: colors.accent,
    fontSize: typography.caption,
    fontWeight: '800',
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
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '800',
  },
  noticeBody: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
  },
  actionColumn: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  primaryButton: {
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: colors.background,
    fontSize: typography.body,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  secondaryButton: {
    borderRadius: radii.lg,
    backgroundColor: 'rgba(8, 14, 19, 0.76)',
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '800',
  },
  tertiaryButton: {
    borderRadius: radii.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8, 14, 19, 0.44)',
  },
  tertiaryButtonText: {
    color: colors.textSoft,
    fontSize: typography.body,
    fontWeight: '700',
  },
});
