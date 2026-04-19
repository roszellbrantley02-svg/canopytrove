import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppUiIcon } from '../icons/AppUiIcon';
import type { AppUiIconName } from '../icons/AppUiIcon';
import { colors, fontFamilies, radii, spacing } from '../theme/tokens';
import type {
  PaymentMethodId,
  PaymentMethods,
  PaymentMethodRecord,
} from '../types/storefrontBaseTypes';

type PaymentMethodsBadgeProps = {
  paymentMethods: PaymentMethods | null | undefined;
  /**
   * `inline` is a compact blue pill for card rows (under open/closed).
   * `detail` renders the full chip list with sources for the detail screen.
   */
  variant?: 'inline' | 'detail';
};

type AcceptedMethodDisplay = {
  methodId: PaymentMethodId;
  label: string;
  iconName: AppUiIconName;
  source: PaymentMethodRecord['source'];
};

const METHOD_COPY: Record<
  PaymentMethodId,
  { short: string; full: string; iconName: AppUiIconName }
> = {
  cash: { short: 'Cash', full: 'Cash', iconName: 'pricetag-outline' },
  debit: { short: 'Debit', full: 'Debit card', iconName: 'layers-outline' },
  credit: { short: 'Credit', full: 'Credit card', iconName: 'layers-outline' },
  tap_pay: {
    short: 'Tap pay',
    full: 'Apple Pay / tap to pay',
    iconName: 'phone-portrait-outline',
  },
  ach_app: { short: 'ACH app', full: 'ACH / pay-by-bank app', iconName: 'globe-outline' },
  atm_on_site: { short: 'ATM', full: 'ATM on site', iconName: 'pricetag-outline' },
  crypto: { short: 'Crypto', full: 'Crypto', iconName: 'sparkles-outline' },
};

/**
 * Render order for accepted methods. Keeps the badge predictable:
 * cash and debit lead because they're most common at dispensaries.
 */
const DISPLAY_ORDER: PaymentMethodId[] = [
  'cash',
  'debit',
  'tap_pay',
  'ach_app',
  'credit',
  'atm_on_site',
  'crypto',
];

function acceptedOnly(methods: PaymentMethodRecord[]): AcceptedMethodDisplay[] {
  const byId = new Map<PaymentMethodId, PaymentMethodRecord>();
  for (const record of methods) {
    byId.set(record.methodId, record);
  }
  const out: AcceptedMethodDisplay[] = [];
  for (const id of DISPLAY_ORDER) {
    const record = byId.get(id);
    if (!record || !record.accepted) continue;
    out.push({
      methodId: id,
      label: METHOD_COPY[id].short,
      iconName: METHOD_COPY[id].iconName,
      source: record.source,
    });
  }
  return out;
}

function summarizeInline(accepted: AcceptedMethodDisplay[]): string {
  if (!accepted.length) return '';
  if (accepted.length <= 2) return accepted.map((m) => m.label).join(' • ');
  return `${accepted[0].label} • ${accepted[1].label} +${accepted.length - 2}`;
}

export function PaymentMethodsBadge({
  paymentMethods,
  variant = 'inline',
}: PaymentMethodsBadgeProps) {
  const accepted = useMemo(
    () => (paymentMethods ? acceptedOnly(paymentMethods.methods) : []),
    [paymentMethods],
  );

  if (!accepted.length) return null;

  if (variant === 'inline') {
    const summary = summarizeInline(accepted);
    return (
      <View
        accessibilityRole="text"
        accessibilityLabel={`Accepts: ${accepted.map((m) => m.label).join(', ')}`}
        style={styles.inlinePill}
      >
        <AppUiIcon name="pricetag-outline" size={12} color={colors.blue} />
        <Text style={styles.inlineText} numberOfLines={1}>
          {summary}
        </Text>
      </View>
    );
  }

  const hasOwner = Boolean(paymentMethods?.hasOwnerDeclaration);
  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={`Accepts: ${accepted.map((m) => m.label).join(', ')}`}
      style={styles.detailCard}
    >
      <View style={styles.detailHeader}>
        <View style={styles.detailIconWell}>
          <AppUiIcon name="layers-outline" size={18} color={colors.blue} />
        </View>
        <View style={styles.detailCopy}>
          <Text style={styles.detailTitle}>Accepted here</Text>
          <Text style={styles.detailSubtitle}>
            {hasOwner
              ? 'Confirmed by the verified owner.'
              : 'Based on public data and community reports.'}
          </Text>
        </View>
      </View>
      <View style={styles.chipWrap}>
        {accepted.map((method) => (
          <View key={method.methodId} style={styles.chip}>
            <AppUiIcon name={method.iconName} size={12} color={colors.blue} />
            <Text style={styles.chipText}>{METHOD_COPY[method.methodId].full}</Text>
            {method.source === 'owner' ? (
              <View style={styles.ownerFlag}>
                <Text style={styles.ownerFlagText}>Owner</Text>
              </View>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const BLUE_TINT_SOFT = 'rgba(77, 156, 255, 0.12)';
const BLUE_TINT_STRONG = 'rgba(77, 156, 255, 0.28)';

const styles = StyleSheet.create({
  inlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: BLUE_TINT_SOFT,
    borderColor: BLUE_TINT_STRONG,
    borderWidth: 1,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  inlineText: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 11,
    letterSpacing: 0.3,
    color: colors.blue,
    flexShrink: 1,
  },
  detailCard: {
    backgroundColor: BLUE_TINT_SOFT,
    borderColor: BLUE_TINT_STRONG,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  detailIconWell: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: BLUE_TINT_STRONG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailCopy: {
    flex: 1,
    gap: 2,
  },
  detailTitle: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 15,
    color: colors.text,
  },
  detailSubtitle: {
    fontFamily: fontFamilies.body,
    fontSize: 12,
    color: colors.textMuted,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(77, 156, 255, 0.08)',
    borderColor: BLUE_TINT_STRONG,
    borderWidth: 1,
  },
  chipText: {
    fontFamily: fontFamilies.bodyMedium,
    fontSize: 12,
    color: colors.text,
  },
  ownerFlag: {
    marginLeft: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0, 245, 140, 0.14)',
  },
  ownerFlagText: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 9,
    letterSpacing: 0.4,
    color: colors.primary,
    textTransform: 'uppercase',
  },
});
