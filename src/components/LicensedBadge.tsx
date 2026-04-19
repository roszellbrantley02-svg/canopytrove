import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppUiIcon } from '../icons/AppUiIcon';
import { colors, fontFamilies, radii, spacing, typography } from '../theme/tokens';
import type { OcmVerification } from '../types/storefrontBaseTypes';

type LicensedBadgeProps = {
  verification: OcmVerification | null | undefined;
  /** "full" shows the verified record + freshness; "inline" is a compact pill. */
  variant?: 'full' | 'inline';
};

function formatAsOf(asOfIso: string | null | undefined): string | null {
  if (!asOfIso) return null;
  const asOfDate = new Date(asOfIso);
  if (Number.isNaN(asOfDate.getTime())) return null;
  const now = new Date();
  const sameDay =
    asOfDate.getFullYear() === now.getFullYear() &&
    asOfDate.getMonth() === now.getMonth() &&
    asOfDate.getDate() === now.getDate();
  if (sameDay) return 'today';
  return asOfDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function LicensedBadge({ verification, variant = 'full' }: LicensedBadgeProps) {
  if (!verification || !verification.licensed) return null;

  const freshness = formatAsOf(verification.asOf);
  const subtitle = freshness
    ? `Per OCM public records, updated ${freshness}.`
    : 'Per OCM public records.';
  const accessibilityLabel = freshness
    ? `Verified licensed dispensary per OCM public records, updated ${freshness}`
    : 'Verified licensed dispensary per OCM public records';

  if (variant === 'inline') {
    return (
      <View
        accessibilityRole="text"
        accessibilityLabel="Verified licensed per OCM public records"
        style={styles.inlinePill}
      >
        <AppUiIcon name="shield-checkmark-outline" size={12} color={colors.primary} />
        <Text style={styles.inlineText}>Verified licensed</Text>
      </View>
    );
  }

  return (
    <View accessibilityRole="summary" accessibilityLabel={accessibilityLabel} style={styles.card}>
      <View style={styles.row}>
        <View style={styles.iconWell}>
          <AppUiIcon name="shield-checkmark-outline" size={18} color={colors.primary} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>Verified licensed</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>
      {verification.licenseNumber ? (
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>License</Text>
          <Text style={styles.metaValue} numberOfLines={1} ellipsizeMode="middle">
            {verification.licenseNumber}
          </Text>
        </View>
      ) : null}
      {verification.licenseType ? (
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Type</Text>
          <Text style={styles.metaValue} numberOfLines={1}>
            {verification.licenseType}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(0, 245, 140, 0.06)',
    borderColor: colors.borderStrong,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconWell: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(0, 245, 140, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: typography.body,
    color: colors.text,
  },
  subtitle: {
    fontFamily: fontFamilies.body,
    fontSize: typography.caption,
    color: colors.textMuted,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  metaLabel: {
    fontFamily: fontFamilies.bodyMedium,
    fontSize: typography.caption,
    color: colors.textSoft,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  metaValue: {
    fontFamily: fontFamilies.bodyMedium,
    fontSize: typography.caption,
    color: colors.text,
    flexShrink: 1,
    marginLeft: spacing.md,
    maxWidth: '70%',
  },
  inlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0, 245, 140, 0.10)',
    borderColor: 'rgba(0, 245, 140, 0.24)',
    borderWidth: StyleSheet.hairlineWidth,
  },
  inlineText: {
    fontFamily: fontFamilies.bodyMedium,
    fontSize: typography.caption,
    color: colors.primary,
  },
});
