/**
 * Verify Screen (menu hub)
 *
 * Landing screen for the Verify tab. Shows a menu of four actions so
 * users can pick what they actually want to do *before* the camera
 * opens:
 *   - Scan product   → opens the camera in product-scan mode
 *   - Scan shop QR   → opens the camera in shop-scan mode
 *   - Rate a product → manual brand + product entry → review composer
 *   - Verify OCM     → existing manual OCM license lookup form
 *
 * The camera used to open the instant this tab was focused, which
 * surprised users (and showed an error card when they backed out
 * without a successful scan). The menu-first flow fixes both: users
 * confirm intent before hitting the camera, and bailing out just
 * returns them here.
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { AppUiIcon, type AppUiIconName } from '../icons/AppUiIcon';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import { useStorefrontProfileController } from '../context/StorefrontController';
import { trackAnalyticsEvent } from '../services/analyticsService';
import { colors, radii, spacing, textStyles } from '../theme/tokens';
import type { RootStackParamList } from '../navigation/rootNavigatorConfig';

type VerifyMenuItem = {
  key: 'scan-product' | 'scan-shop' | 'rate-product' | 'verify-ocm';
  title: string;
  subtitle: string;
  iconName: AppUiIconName;
  tone: 'primary' | 'cyan' | 'gold' | 'neutral';
};

const MENU_ITEMS: ReadonlyArray<VerifyMenuItem> = [
  {
    key: 'scan-product',
    title: 'Scan product',
    subtitle: 'Open the camera to scan a product QR, UPC barcode, or lab COA.',
    iconName: 'camera-outline',
    tone: 'primary',
  },
  {
    key: 'scan-shop',
    title: 'Scan shop QR',
    subtitle: "Scan a dispensary's Google, Weedmaps, Leafly, or website QR.",
    iconName: 'storefront-outline',
    tone: 'cyan',
  },
  {
    key: 'rate-product',
    title: 'Rate a product',
    subtitle: 'Review without scanning — type the brand and product name.',
    iconName: 'star-outline',
    tone: 'gold',
  },
  {
    key: 'verify-ocm',
    title: 'Verify OCM license',
    subtitle: "Check a shop's license against the New York OCM registry.",
    iconName: 'shield-checkmark-outline',
    tone: 'neutral',
  },
];

const TONE_STYLES: Record<
  VerifyMenuItem['tone'],
  {
    iconColor: string;
    iconBackground: string;
    iconBorder: string;
    accent: string;
  }
> = {
  primary: {
    iconColor: colors.primary,
    iconBackground: 'rgba(0, 245, 140, 0.12)',
    iconBorder: 'rgba(0, 245, 140, 0.22)',
    accent: colors.primary,
  },
  cyan: {
    iconColor: '#B8F6FF',
    iconBackground: 'rgba(0, 215, 255, 0.12)',
    iconBorder: 'rgba(0, 215, 255, 0.22)',
    accent: '#B8F6FF',
  },
  gold: {
    iconColor: colors.goldSoft,
    iconBackground: 'rgba(245, 200, 106, 0.12)',
    iconBorder: 'rgba(245, 200, 106, 0.22)',
    accent: colors.goldSoft,
  },
  neutral: {
    iconColor: colors.text,
    iconBackground: 'rgba(196, 184, 176, 0.10)',
    iconBorder: colors.borderSoft,
    accent: colors.text,
  },
};

function VerifyScreenInner() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { authSession } = useStorefrontProfileController();
  const isAuthenticated = authSession.status === 'authenticated';

  const handleSelect = React.useCallback(
    (item: VerifyMenuItem) => {
      trackAnalyticsEvent('scan_opened', { entry: item.key });

      switch (item.key) {
        case 'scan-product':
          navigation.navigate('ScanCamera', { mode: 'product' });
          return;
        case 'scan-shop':
          navigation.navigate('ScanCamera', { mode: 'shop' });
          return;
        case 'rate-product':
          if (!isAuthenticated) {
            navigation.navigate('MemberSignIn', {
              redirectTo: { kind: 'navigate', screen: 'RateProductPicker' },
            });
            return;
          }
          navigation.navigate('RateProductPicker');
          return;
        case 'verify-ocm':
          navigation.navigate('VerifyManualEntry');
          return;
      }
    },
    [isAuthenticated, navigation],
  );

  return (
    <ScreenShell
      eyebrow="Verify"
      title="What would you like to do?"
      subtitle="Scan a product or shop, rate something you've tried, or verify a dispensary's OCM license."
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.stack}>
          {MENU_ITEMS.map((item, index) => (
            <MotionInView key={item.key} dense delay={40 + index * 30}>
              <MenuCard
                item={item}
                onPress={() => handleSelect(item)}
                locked={item.key === 'rate-product' && !isAuthenticated}
              />
            </MotionInView>
          ))}

          <MotionInView dense delay={40 + MENU_ITEMS.length * 30}>
            <Text style={styles.footnote}>
              All scans are anonymous by default. OCM data reflects the New York public dispensary
              registry, refreshed hourly.
            </Text>
          </MotionInView>
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

function MenuCard({
  item,
  onPress,
  locked,
}: {
  item: VerifyMenuItem;
  onPress: () => void;
  locked?: boolean;
}) {
  const tone = TONE_STYLES[item.tone];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={locked ? `${item.title} (sign in required)` : item.title}
      accessibilityHint={item.subtitle}
      style={({ pressed }) => [
        styles.card,
        { borderColor: tone.iconBorder },
        pressed && styles.cardPressed,
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: tone.iconBackground, borderColor: tone.iconBorder },
        ]}
      >
        <AppUiIcon name={item.iconName} size={22} color={tone.iconColor} />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTitleRow}>
          <Text style={[styles.cardTitle, { color: tone.accent }]}>{item.title}</Text>
          {locked ? (
            <View style={styles.lockPill}>
              <AppUiIcon name="lock-closed-outline" size={11} color={colors.textSoft} />
              <Text style={styles.lockPillText}>Sign in</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
      </View>
      <AppUiIcon name="chevron-forward" size={16} color={colors.textSoft} />
    </Pressable>
  );
}

export const VerifyScreen = withScreenErrorBoundary(VerifyScreenInner, 'verify-screen');

const styles = StyleSheet.create({
  scrollContent: {
    paddingVertical: spacing.lg,
  },
  stack: {
    gap: spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(196, 184, 176, 0.06)',
    borderWidth: 1,
    minHeight: 88,
  },
  cardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.995 }],
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    gap: 4,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  cardTitle: {
    ...textStyles.bodyStrong,
    fontWeight: '800',
  },
  cardSubtitle: {
    ...textStyles.caption,
    color: colors.textSoft,
    lineHeight: 18,
  },
  lockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(196, 184, 176, 0.08)',
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  lockPillText: {
    ...textStyles.caption,
    color: colors.textSoft,
    fontSize: 10,
    fontWeight: '700',
  },
  footnote: {
    ...textStyles.caption,
    color: colors.textSoft,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    lineHeight: 18,
  },
});
