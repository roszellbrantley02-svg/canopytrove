import React from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import { InlineFeedbackPanel } from '../components/InlineFeedbackPanel';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { AppUiIcon } from '../icons/AppUiIcon';
import type { AppUiIconName } from '../icons/AppUiIcon';
import { colors, radii, spacing, textStyles } from '../theme/tokens';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { ownerPortalStyles as sharedStyles } from './ownerPortal/ownerPortalStyles';
import { useOwnerPortalWorkspace } from './ownerPortal/useOwnerPortalWorkspace';
import {
  getOwnerPortalPaymentMethods,
  saveOwnerPortalPaymentMethods,
} from '../services/ownerPortalWorkspaceService';
import { isBackendTierAccessError } from '../services/storefrontBackendHttp';
import { trackAnalyticsEvent, trackScreenView } from '../services/analyticsService';
import type { PaymentMethodId } from '../types/storefrontBaseTypes';

type OwnerPortalPaymentMethodsRoute = RouteProp<RootStackParamList, 'OwnerPortalPaymentMethods'>;

type MethodRow = {
  id: PaymentMethodId;
  label: string;
  hint: string;
  iconName: AppUiIconName;
};

const METHOD_ROWS: MethodRow[] = [
  {
    id: 'cash',
    label: 'Cash',
    hint: 'Works nearly everywhere at dispensaries. Consider listing if ATM is on-site.',
    iconName: 'pricetag-outline',
  },
  {
    id: 'debit',
    label: 'Debit card',
    hint: 'PIN-based debit through compliant processors. Most common cashless option.',
    iconName: 'layers-outline',
  },
  {
    id: 'tap_pay',
    label: 'Apple Pay / tap to pay',
    hint: 'Enable only if your terminal supports contactless cannabis-friendly rails.',
    iconName: 'phone-portrait-outline',
  },
  {
    id: 'ach_app',
    label: 'ACH / pay-by-bank app',
    hint: 'Third-party wallets like Aeropay, Hypur, or Dutchie Pay.',
    iconName: 'globe-outline',
  },
  {
    id: 'credit',
    label: 'Credit card',
    hint: 'Uncommon at dispensaries; enable only if your processor is truly cannabis-compliant.',
    iconName: 'layers-outline',
  },
  {
    id: 'atm_on_site',
    label: 'ATM on site',
    hint: 'Helps buyers who prefer cash but show up without it.',
    iconName: 'pricetag-outline',
  },
  {
    id: 'crypto',
    label: 'Crypto',
    hint: 'Enable only if you formally accept a supported coin at checkout.',
    iconName: 'sparkles-outline',
  },
];

function buildInitialMethods(
  source?: Record<string, boolean> | null,
): Record<PaymentMethodId, boolean> {
  const next: Record<PaymentMethodId, boolean> = {
    cash: false,
    debit: false,
    credit: false,
    tap_pay: false,
    ach_app: false,
    atm_on_site: false,
    crypto: false,
  };
  if (!source) return next;
  for (const row of METHOD_ROWS) {
    if (typeof source[row.id] === 'boolean') {
      next[row.id] = source[row.id];
    }
  }
  return next;
}

function OwnerPortalPaymentMethodsScreenInner() {
  const route = useRoute<OwnerPortalPaymentMethodsRoute>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const preview = route.params?.preview ?? false;
  const { workspace, activeLocationId } = useOwnerPortalWorkspace(preview);
  const ownerTier = workspace?.tier ?? 'verified';
  const isGrowthOrAbove = ownerTier === 'growth' || ownerTier === 'pro';

  const [methods, setMethods] = React.useState<Record<PaymentMethodId, boolean>>(() =>
    buildInitialMethods(null),
  );
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [errorText, setErrorText] = React.useState<string | null>(null);
  const [noticeText, setNoticeText] = React.useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = React.useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);

  // Fire screen_view analytics once on mount.
  React.useEffect(() => {
    trackScreenView('owner_portal_payment_methods');
    trackAnalyticsEvent('payment_methods_owner_editor_opened', {
      tier: ownerTier,
      preview,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, []);

  // Load existing declaration when the active location resolves.
  React.useEffect(() => {
    if (preview) {
      setIsLoading(false);
      setNoticeText('Preview mode — edits are not saved to the live listing.');
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setErrorText(null);
    getOwnerPortalPaymentMethods(activeLocationId)
      .then((response) => {
        if (cancelled) return;
        setMethods(buildInitialMethods(response.methods));
        setLastSavedAt(response.updatedAt);
        setHasUnsavedChanges(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setErrorText(
          error instanceof Error ? error.message : 'Could not load your payment methods right now.',
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [preview, activeLocationId]);

  const toggleMethod = React.useCallback((id: PaymentMethodId) => {
    setMethods((prev) => ({ ...prev, [id]: !prev[id] }));
    setHasUnsavedChanges(true);
    setNoticeText(null);
  }, []);

  const handleSave = React.useCallback(async () => {
    if (preview) {
      setNoticeText('Preview mode — saving is disabled in preview.');
      return;
    }
    if (!isGrowthOrAbove) {
      navigation.navigate('OwnerPortalSubscription', undefined);
      return;
    }
    setIsSaving(true);
    setErrorText(null);
    setNoticeText(null);
    try {
      const acceptedCount = Object.values(methods).filter(Boolean).length;
      const response = await saveOwnerPortalPaymentMethods(methods, activeLocationId);
      setMethods(buildInitialMethods(response.methods));
      setLastSavedAt(response.updatedAt);
      setHasUnsavedChanges(false);
      setNoticeText('Saved. Your accepted payment methods are now live on your listing.');
      trackAnalyticsEvent('payment_methods_owner_saved', {
        tier: ownerTier,
        acceptedCount,
        totalCount: METHOD_ROWS.length,
      });
    } catch (error: unknown) {
      if (isBackendTierAccessError(error)) {
        setErrorText(error.message);
      } else {
        setErrorText(
          error instanceof Error ? error.message : 'Could not save your payment methods right now.',
        );
      }
    } finally {
      setIsSaving(false);
    }
  }, [preview, isGrowthOrAbove, methods, activeLocationId, ownerTier, navigation]);

  const lastSavedCopy = React.useMemo(() => {
    if (!lastSavedAt) return null;
    try {
      const savedAt = new Date(lastSavedAt);
      if (Number.isNaN(savedAt.getTime())) return null;
      return savedAt.toLocaleString();
    } catch {
      return null;
    }
  }, [lastSavedAt]);

  if (isLoading) {
    return (
      <ScreenShell
        eyebrow="Owner Portal"
        title="Payment methods"
        subtitle="Loading your current declaration..."
        headerPill="Payments"
      />
    );
  }

  return (
    <ScreenShell
      eyebrow="Owner Portal"
      title="Payment methods"
      subtitle="Tell shoppers exactly what you accept. Your declaration overrides automated signals from Google and community reports."
      headerPill="Payments"
    >
      <ScrollView contentContainerStyle={sharedStyles.form}>
        {errorText ? <InlineFeedbackPanel title="Error" tone="danger" body={errorText} /> : null}
        {noticeText ? (
          <InlineFeedbackPanel title="Payment methods" tone="info" body={noticeText} />
        ) : null}

        {!isGrowthOrAbove ? (
          <MotionInView delay={40}>
            <View style={localStyles.upgradeCard}>
              <AppUiIcon name="sparkles-outline" size={20} color={colors.gold} />
              <View style={localStyles.upgradeCopy}>
                <Text style={localStyles.upgradeTitle}>Growth plan unlocks this</Text>
                <Text style={localStyles.upgradeBody}>
                  Self-declaring accepted payment methods is a Growth ($149/mo) feature. Upgrade to
                  override Google Places data and stamp your listing as owner-verified.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Review Growth plan"
                  onPress={() => navigation.navigate('OwnerPortalSubscription', undefined)}
                  style={localStyles.upgradeButton}
                >
                  <Text style={localStyles.upgradeButtonText}>Review Growth plan</Text>
                </Pressable>
              </View>
            </View>
          </MotionInView>
        ) : null}

        <MotionInView delay={70}>
          <SectionCard
            title="What you accept"
            body="Toggle the payment options your checkout actually supports. Leaving everything off hides the badge on your card."
          >
            <View style={localStyles.methodList}>
              {METHOD_ROWS.map((row) => (
                <Pressable
                  key={row.id}
                  accessibilityRole="switch"
                  accessibilityLabel={`${row.label} accepted`}
                  accessibilityState={{ checked: methods[row.id], disabled: !isGrowthOrAbove }}
                  onPress={() => {
                    if (!isGrowthOrAbove) {
                      navigation.navigate('OwnerPortalSubscription', undefined);
                      return;
                    }
                    toggleMethod(row.id);
                  }}
                  style={[
                    localStyles.methodRow,
                    methods[row.id] ? localStyles.methodRowActive : null,
                  ]}
                >
                  <View style={localStyles.methodIcon}>
                    <AppUiIcon name={row.iconName} size={18} color={colors.blue} />
                  </View>
                  <View style={localStyles.methodCopy}>
                    <Text style={localStyles.methodLabel}>{row.label}</Text>
                    <Text style={localStyles.methodHint}>{row.hint}</Text>
                  </View>
                  <View style={methods[row.id] ? localStyles.toggleOn : localStyles.toggleOff}>
                    <View style={localStyles.toggleThumb} />
                  </View>
                </Pressable>
              ))}
            </View>
          </SectionCard>
        </MotionInView>

        {lastSavedCopy ? (
          <Text style={localStyles.metaText}>Last saved {lastSavedCopy}</Text>
        ) : null}

        <MotionInView delay={140}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isGrowthOrAbove ? 'Save payment methods' : 'Upgrade to Growth'}
            accessibilityState={{
              disabled: isSaving || (isGrowthOrAbove && !hasUnsavedChanges),
            }}
            disabled={isSaving || (isGrowthOrAbove && !hasUnsavedChanges)}
            onPress={handleSave}
            style={[
              sharedStyles.primaryButton,
              (isSaving || (isGrowthOrAbove && !hasUnsavedChanges)) && localStyles.buttonDisabled,
            ]}
          >
            <Text style={sharedStyles.primaryButtonText}>
              {isSaving
                ? 'Saving...'
                : isGrowthOrAbove
                  ? 'Save payment methods'
                  : 'Upgrade to Growth'}
            </Text>
          </Pressable>
        </MotionInView>
      </ScrollView>
    </ScreenShell>
  );
}

export const OwnerPortalPaymentMethodsScreen = withScreenErrorBoundary(
  OwnerPortalPaymentMethodsScreenInner,
  'owner-portal-payment-methods',
);

export default OwnerPortalPaymentMethodsScreen;

const BLUE_TINT = 'rgba(77, 156, 255, 0.10)';
const BLUE_TINT_STRONG = 'rgba(77, 156, 255, 0.28)';

const localStyles = StyleSheet.create({
  methodList: {
    gap: spacing.sm,
  },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  methodRowActive: {
    backgroundColor: BLUE_TINT,
    borderColor: BLUE_TINT_STRONG,
  },
  methodIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: BLUE_TINT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodCopy: {
    flex: 1,
    gap: 2,
  },
  methodLabel: {
    ...textStyles.bodyStrong,
    color: colors.text,
  },
  methodHint: {
    ...textStyles.caption,
    color: colors.textMuted,
  },
  toggleOn: {
    width: 36,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.blue,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: 2,
  },
  toggleOff: {
    width: 36,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.surfaceGlass,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: 2,
  },
  toggleThumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.text,
  },
  metaText: {
    ...textStyles.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  upgradeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(232, 160, 0, 0.32)',
    backgroundColor: 'rgba(232, 160, 0, 0.08)',
  },
  upgradeCopy: {
    flex: 1,
    gap: spacing.sm,
  },
  upgradeTitle: {
    ...textStyles.bodyStrong,
    color: colors.text,
  },
  upgradeBody: {
    ...textStyles.body,
    color: colors.textMuted,
  },
  upgradeButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.gold,
  },
  upgradeButtonText: {
    ...textStyles.button,
    color: colors.backgroundDeep,
  },
});
