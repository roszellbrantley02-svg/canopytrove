import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppUiIcon } from '../../icons/AppUiIcon';
import { colors, radii, spacing, textStyles } from '../../theme/tokens';

/**
 * OCM Part 129 compliant rotating warnings.
 * Required on cannabis advertisements: primary 21+ warning, one rotating
 * health warning (cycled across storefronts), and HOPEline info.
 *
 * Only rendered for claimed/verified storefronts.
 */

const ROTATING_WARNINGS = [
  'Cannabis can impair concentration and coordination. Do not operate a vehicle or machinery under the influence of cannabis.',
  'There may be health risks associated with consumption of this product.',
  'Cannabis is not recommended for use by persons who are pregnant or nursing.',
  'Cannabis can be addictive.',
] as const;

const PRIMARY_WARNING =
  'For use only by adults 21 years of age and older. Keep out of reach of children and pets. In case of accidental ingestion or overconsumption, contact the Poison Center at 1-800-222-1222 or call 9-1-1.';

const HOPELINE_TEXT =
  'Need help? Call the NY HOPEline: 1-877-8-HOPENY · Text HOPENY (467369) · oasas.ny.gov/HOPELine';

/**
 * Deterministic warning index based on storefront ID.
 * Each storefront always shows the same warning at a given time,
 * but different storefronts show different warnings.
 */
function getRotatingWarningIndex(storefrontId: string): number {
  let hash = 0;
  for (let i = 0; i < storefrontId.length; i++) {
    hash = (hash * 31 + storefrontId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % ROTATING_WARNINGS.length;
}

type DetailComplianceWarningSectionProps = {
  storefrontId: string;
};

export function DetailComplianceWarningSection({
  storefrontId,
}: DetailComplianceWarningSectionProps) {
  const warningIndex = getRotatingWarningIndex(storefrontId);
  const rotatingWarning = ROTATING_WARNINGS[warningIndex];

  return (
    <LinearGradient
      colors={[styles_warningCardGradientStart, styles_warningCardGradientEnd]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
      accessible={true}
      accessibilityRole="summary"
      accessibilityLabel="Compliance notice with required cannabis warnings"
    >
      {/* Ambient glow */}
      <View pointerEvents="none" style={styles.ambientGlow} />

      {/* Header accent bar + badge */}
      <View style={styles.headerAccentRow}>
        <View style={styles.headerAccent} />
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Compliance</Text>
        </View>
      </View>

      {/* Title row with icon */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.iconWrap}>
            <AppUiIcon name="shield-checkmark-outline" size={16} color={warningYellowSoft} />
          </View>
          <View style={styles.titleCopy}>
            <Text style={styles.title}>Compliance Notice</Text>
            <Text style={styles.body}>Required disclosures for this verified storefront.</Text>
          </View>
        </View>
      </View>

      {/* Primary 21+ warning */}
      <View style={styles.primaryWarningRow}>
        <View style={styles.ageBadge}>
          <Text style={styles.ageBadgeText}>21+</Text>
        </View>
        <Text style={styles.primaryWarningText} accessibilityRole="text">
          {PRIMARY_WARNING}
        </Text>
      </View>

      {/* Rotating health warning */}
      <View style={styles.rotatingWarningBox}>
        <AppUiIcon name="warning-outline" size={14} color={warningYellow} />
        <Text style={styles.rotatingWarningText} accessibilityRole="text">
          {rotatingWarning}
        </Text>
      </View>

      {/* HOPEline */}
      <View style={styles.hopelineRow}>
        <Text style={styles.hopelineText} accessibilityRole="text">
          {HOPELINE_TEXT}
        </Text>
      </View>
    </LinearGradient>
  );
}

// ─── Color constants ───
const warningYellow = '#FFFF00';
const warningYellowSoft = '#FFFFA6';
const warningYellowMuted = 'rgba(255, 255, 0, 0.55)';
const warningGlassBackground = 'rgba(255, 255, 0, 0.05)';
const warningBorderSoft = 'rgba(255, 255, 0, 0.12)';
const warningBorder = 'rgba(255, 255, 0, 0.18)';

// Gradient start/end used outside StyleSheet (LinearGradient colors prop)
const styles_warningCardGradientStart = 'rgba(18, 32, 42, 0.94)';
const styles_warningCardGradientEnd = 'rgba(10, 17, 23, 0.98)';

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: warningBorderSoft,
    borderRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.lg,
    shadowColor: '#02060A',
    shadowOpacity: 0.28,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
    overflow: 'hidden',
  },
  ambientGlow: {
    position: 'absolute',
    top: -72,
    right: -36,
    width: 188,
    height: 188,
    borderRadius: 94,
    backgroundColor: 'rgba(255, 255, 0, 0.04)',
  },
  headerAccentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerAccent: {
    width: 52,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: warningYellow,
    shadowColor: warningYellow,
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  badge: {
    minHeight: 32,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(255, 255, 0, 0.08)',
    borderColor: 'rgba(255, 255, 0, 0.18)',
  },
  badgeText: {
    ...textStyles.caption,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: warningYellowSoft,
  },
  header: {
    gap: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 0, 0.06)',
    borderColor: warningBorderSoft,
  },
  titleCopy: {
    flex: 1,
    gap: spacing.sm,
  },
  title: {
    ...textStyles.title,
    color: colors.text,
    lineHeight: 30,
  },
  body: {
    ...textStyles.body,
    color: colors.textMuted,
    lineHeight: 24,
  },
  primaryWarningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  ageBadge: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(255, 255, 0, 0.10)',
    borderWidth: 1,
    borderColor: warningBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ageBadgeText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
    fontWeight: '800',
    color: warningYellow,
    letterSpacing: -0.3,
  },
  primaryWarningText: {
    flex: 1,
    fontFamily: 'DMSans_700Bold',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
    color: warningYellow,
    opacity: 0.88,
  },
  rotatingWarningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: warningGlassBackground,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: warningBorderSoft,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rotatingWarningText: {
    flex: 1,
    fontFamily: 'DMSans_700Bold',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
    color: warningYellow,
    opacity: 0.75,
  },
  hopelineRow: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 0, 0.07)',
    paddingTop: spacing.md,
  },
  hopelineText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 10,
    lineHeight: 15,
    color: warningYellowMuted,
  },
});
