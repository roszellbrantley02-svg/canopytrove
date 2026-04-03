import React from 'react';
import type { RouteProp } from '@react-navigation/native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { Linking, Pressable, Text, View } from 'react-native';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { useStorefrontProfileController } from '../context/StorefrontController';
import { useSavedSummaries } from '../hooks/useStorefrontSummaryData';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { ownerPortalPreviewEnabled } from '../config/ownerPortalConfig';
import { ownerBillingConfig } from '../config/ownerBilling';
import {
  createOwnerBillingCheckoutSession,
  createOwnerBillingPortalSession,
  hasConfiguredOwnerBillingFlow,
} from '../services/ownerPortalBillingService';
import { getOwnerProfile, getOwnerSubscription } from '../services/ownerPortalService';
import { getRuntimeOpsStatus } from '../services/runtimeOpsService';
import type { OwnerProfileDocument, OwnerPortalSubscriptionDocument } from '../types/ownerPortal';
import type { RuntimeOpsPublicStatus } from '../types/runtimeOps';
import { ownerPortalStyles as styles } from './ownerPortal/ownerPortalStyles';
import {
  PREMIUM_FEATURE_COUNT,
  OwnerPortalSubscriptionBillingSummary,
  OwnerPortalSubscriptionIntroNotes,
  OwnerPortalSubscriptionPlanDetails,
  OwnerPortalSubscriptionPlanOptions,
  OwnerPortalSubscriptionReadinessList,
  OwnerPortalSubscriptionPreview,
  PremiumFeatureList,
  formatPlanValue,
  isVerifiedStatus,
} from './ownerPortal/ownerPortalSubscriptionSections';
import {
  ownerPortalPreviewProfile,
  ownerPortalPreviewStorefront,
} from './ownerPortal/ownerPortalPreviewData';

type OwnerPortalSubscriptionRoute = RouteProp<RootStackParamList, 'OwnerPortalSubscription'>;

export function OwnerPortalSubscriptionScreen() {
  const route = useRoute<OwnerPortalSubscriptionRoute>();
  const { authSession } = useStorefrontProfileController();
  const preview = ownerPortalPreviewEnabled && Boolean(route.params?.preview);
  const [ownerProfile, setOwnerProfile] = React.useState<OwnerProfileDocument | null>(null);
  const [subscription, setSubscription] = React.useState<OwnerPortalSubscriptionDocument | null>(
    null,
  );
  const [runtimeStatus, setRuntimeStatus] = React.useState<RuntimeOpsPublicStatus | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState<null | 'monthly' | 'annual' | 'manage'>(
    null,
  );
  const [statusText, setStatusText] = React.useState<string | null>(null);

  const loadBillingState = React.useCallback(async () => {
    if (preview) {
      setIsLoading(false);
      return;
    }

    const ownerUid = authSession.uid;
    if (!ownerUid) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [nextOwnerProfile, nextSubscription, nextRuntimeStatus] = await Promise.all([
        getOwnerProfile(ownerUid),
        getOwnerSubscription(ownerUid),
        getRuntimeOpsStatus(),
      ]);
      setOwnerProfile(nextOwnerProfile);
      setSubscription(nextSubscription);
      setRuntimeStatus(nextRuntimeStatus);
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : 'Unable to load owner billing.');
    } finally {
      setIsLoading(false);
    }
  }, [authSession.uid, preview]);

  React.useEffect(() => {
    void loadBillingState();
  }, [loadBillingState]);

  useFocusEffect(
    React.useCallback(() => {
      void loadBillingState();
    }, [loadBillingState]),
  );

  const claimedStorefrontIds = ownerProfile?.dispensaryId ? [ownerProfile.dispensaryId] : [];
  const { data: claimedStorefronts } = useSavedSummaries(claimedStorefrontIds);
  const claimedStorefront = claimedStorefronts?.[0] ?? null;

  if (preview) {
    return (
      <OwnerPortalSubscriptionPreview
        demoStatus={formatPlanValue(ownerPortalPreviewProfile.subscriptionStatus)}
        storefrontName={ownerPortalPreviewStorefront.displayName}
      />
    );
  }

  const effectiveStatus = subscription?.status ?? ownerProfile?.subscriptionStatus ?? 'inactive';
  const hasAccess = effectiveStatus === 'trial' || effectiveStatus === 'active';
  const isBillingEligible =
    Boolean(ownerProfile?.dispensaryId) &&
    isVerifiedStatus(ownerProfile?.businessVerificationStatus) &&
    isVerifiedStatus(ownerProfile?.identityVerificationStatus);
  const billingConfigured = hasConfiguredOwnerBillingFlow();
  const billingTemporarilyPaused =
    runtimeStatus?.policy.safeModeEnabled === true ||
    runtimeStatus?.policy.ownerPortalWritesEnabled === false;
  const billingReadinessItems = [
    {
      label: 'Claimed storefront linked',
      body: ownerProfile?.dispensaryId
        ? 'The owner profile is linked to a storefront and is ready for paid-owner gating.'
        : 'Billing should stay blocked until a storefront claim exists.',
      tone: ownerProfile?.dispensaryId ? ('complete' as const) : ('pending' as const),
    },
    {
      label: 'Business verification',
      body: isVerifiedStatus(ownerProfile?.businessVerificationStatus)
        ? 'Business review is complete.'
        : 'Business verification must be approved before checkout should be treated as live.',
      tone: isVerifiedStatus(ownerProfile?.businessVerificationStatus)
        ? ('complete' as const)
        : ('current' as const),
    },
    {
      label: 'Identity verification',
      body: isVerifiedStatus(ownerProfile?.identityVerificationStatus)
        ? 'Identity review is complete.'
        : 'Identity verification must be approved before premium access should be granted.',
      tone: isVerifiedStatus(ownerProfile?.identityVerificationStatus)
        ? ('complete' as const)
        : ('current' as const),
    },
    {
      label: 'Billing backend configured',
      body: billingConfigured
        ? 'This build can open the configured billing path.'
        : 'Billing env or fallback checkout links are still incomplete for this build.',
      tone: billingConfigured ? ('complete' as const) : ('attention' as const),
    },
    {
      label: 'Runtime protection',
      body: billingTemporarilyPaused
        ? (runtimeStatus?.policy.reason ??
          'Protected mode is active, so live billing changes should wait until the system stabilizes.')
        : 'No billing pause is active from runtime protection.',
      tone: billingTemporarilyPaused ? ('attention' as const) : ('complete' as const),
    },
  ];

  const handleOpenCheckout = async (billingCycle: 'monthly' | 'annual') => {
    if (!authSession.uid || !ownerProfile?.dispensaryId) {
      setStatusText('Sign in and claim a listing before starting a subscription.');
      return;
    }
    if (isSubmitting || billingTemporarilyPaused) {
      return;
    }

    setIsSubmitting(billingCycle);
    setStatusText(null);
    try {
      const session = await createOwnerBillingCheckoutSession(billingCycle);
      await Linking.openURL(session.url);
      setStatusText(
        'Checkout opened. Complete billing, then return here and tap Refresh Billing Status.',
      );
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : 'Unable to open owner checkout.');
    } finally {
      setIsSubmitting(null);
    }
  };

  const handleOpenBillingPortal = async () => {
    if (isSubmitting || billingTemporarilyPaused) {
      return;
    }
    if (!subscription?.externalCustomerId) {
      setStatusText('No billing account found. Start a subscription first.');
      return;
    }

    setIsSubmitting('manage');
    setStatusText(null);
    try {
      const session = await createOwnerBillingPortalSession();
      await Linking.openURL(session.url);
      setStatusText('Billing management opened in your browser.');
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : 'Unable to open billing management.');
    } finally {
      setIsSubmitting(null);
    }
  };

  return (
    <ScreenShell
      eyebrow="Owner Portal"
      title="Business plan."
      subtitle="Choose your plan, complete checkout, and manage billing."
      headerPill="Owner"
    >
      <MotionInView delay={70}>
        <View style={styles.portalHeroCard}>
          <View style={styles.portalHeroGlow} />
          <Text style={styles.portalHeroKicker}>Licensed storefront tools</Text>
          <Text style={styles.portalHeroTitle}>
            Activate the private business plan for your claimed dispensary workspace.
          </Text>
          <Text style={styles.portalHeroBody}>
            Private business plan for licensed dispensary operators managing claimed storefronts.
          </Text>
          <View style={styles.portalHeroMetricRow}>
            <View style={styles.portalHeroMetricCard}>
              <Text style={styles.portalHeroMetricValue}>{formatPlanValue(effectiveStatus)}</Text>
              <Text style={styles.portalHeroMetricLabel}>Plan Status</Text>
            </View>
            <View style={styles.portalHeroMetricCard}>
              <Text style={styles.portalHeroMetricValue}>
                {billingConfigured ? 'Ready' : 'Setup'}
              </Text>
              <Text style={styles.portalHeroMetricLabel}>Billing Flow</Text>
            </View>
            <View style={styles.portalHeroMetricCard}>
              <Text style={styles.portalHeroMetricValue}>{PREMIUM_FEATURE_COUNT}</Text>
              <Text style={styles.portalHeroMetricLabel}>Premium Tools</Text>
            </View>
          </View>
        </View>
      </MotionInView>

      {billingTemporarilyPaused ? (
        <MotionInView delay={100}>
          <SectionCard title="Protected mode" body="Billing paused while system stabilizes.">
            <View style={[styles.statusPanel, styles.statusPanelWarm]}>
              <Text style={styles.helperText}>
                {runtimeStatus?.policy.reason ??
                  'Protected mode is active, so live checkout and billing management are temporarily paused.'}
              </Text>
            </View>
          </SectionCard>
        </MotionInView>
      ) : null}

      <MotionInView delay={120}>
        <SectionCard
          title="Business service scope"
          body="Private storefront-management service for licensed dispensary teams."
        >
          <OwnerPortalSubscriptionIntroNotes />
        </SectionCard>
      </MotionInView>

      <MotionInView delay={150}>
        <SectionCard
          title="Current plan status"
          body="Access controls your available business tools."
        >
          <OwnerPortalSubscriptionPlanDetails
            billingTemporarilyPaused={billingTemporarilyPaused}
            hasAccess={hasAccess}
            isBillingEligible={isBillingEligible}
            ownerProfile={ownerProfile}
            storefrontLabel={
              claimedStorefront?.displayName ?? ownerProfile?.dispensaryId ?? 'No claimed listing'
            }
            subscription={subscription}
          />
        </SectionCard>
      </MotionInView>

      <MotionInView delay={210}>
        <SectionCard title="Premium owner tools" body="Included with premium plan.">
          <View style={styles.planTile}>
            <Text style={styles.sectionEyebrow}>Included with premium</Text>
            <PremiumFeatureList />
          </View>
        </SectionCard>
      </MotionInView>

      <MotionInView delay={240}>
        <SectionCard title="Before billing can start" body="Complete these verification steps.">
          <OwnerPortalSubscriptionReadinessList items={billingReadinessItems} />
        </SectionCard>
      </MotionInView>

      <MotionInView delay={270}>
        <SectionCard
          title="Choose your plan"
          body="Select your billing cycle and proceed to checkout."
        >
          <View style={styles.sectionStack}>
            {statusText ? <Text style={styles.errorText}>{statusText}</Text> : null}
            {!billingConfigured ? (
              <Text style={styles.errorText}>
                Billing is not configured for this build yet. Add the hosted backend billing env or
                the fallback hosted checkout URLs before release.
              </Text>
            ) : null}
            {!isBillingEligible ? (
              <Text style={styles.helperText}>
                Complete storefront claim, business verification, and identity verification before
                starting billing.
              </Text>
            ) : null}
            {hasAccess ? (
              <Text style={styles.successText}>
                Plan access is active. Use billing management to update or cancel this subscription.
              </Text>
            ) : null}
            <OwnerPortalSubscriptionBillingSummary
              billingConfigured={billingConfigured}
              isBillingEligible={isBillingEligible}
              premiumFeatureCount={PREMIUM_FEATURE_COUNT}
            />
            <OwnerPortalSubscriptionPlanOptions
              annualButtonLabel={
                billingTemporarilyPaused
                  ? 'Billing Paused'
                  : isSubmitting === 'annual'
                    ? 'Opening...'
                    : 'Start Annual Business Plan'
              }
              annualPriceLabel={ownerBillingConfig.annualPriceLabel ?? 'Configured in live billing'}
              disableButtons={
                isLoading ||
                !billingConfigured ||
                !isBillingEligible ||
                billingTemporarilyPaused ||
                Boolean(isSubmitting)
              }
              monthlyButtonLabel={
                billingTemporarilyPaused
                  ? 'Billing Paused'
                  : isSubmitting === 'monthly'
                    ? 'Opening...'
                    : 'Start Monthly Business Plan'
              }
              monthlyPriceLabel={
                ownerBillingConfig.monthlyPriceLabel ?? 'Configured in live billing'
              }
              onOpenAnnual={() => {
                void handleOpenCheckout('annual');
              }}
              onOpenMonthly={() => {
                void handleOpenCheckout('monthly');
              }}
            />
          </View>
        </SectionCard>
      </MotionInView>

      <MotionInView delay={330}>
        <SectionCard
          title="Manage billing"
          body="Refresh status or manage your active subscription."
        >
          <View style={[styles.ctaPanel, styles.statusPanelSuccess]}>
            <Text style={styles.helperText}>
              Refresh after checkout if you need the latest synced state, or open billing management
              once a live customer record exists.
            </Text>
            <View style={styles.buttonRow}>
              <Pressable
                onPress={() => {
                  void loadBillingState();
                }}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Refresh Billing Status</Text>
              </Pressable>
              <Pressable
                disabled={
                  !subscription?.externalCustomerId ||
                  billingTemporarilyPaused ||
                  Boolean(isSubmitting)
                }
                onPress={() => {
                  void handleOpenBillingPortal();
                }}
                style={[
                  styles.primaryButton,
                  (!subscription?.externalCustomerId ||
                    billingTemporarilyPaused ||
                    Boolean(isSubmitting)) &&
                    styles.buttonDisabled,
                ]}
              >
                <Text style={styles.primaryButtonText}>
                  {billingTemporarilyPaused
                    ? 'Billing Paused'
                    : isSubmitting === 'manage'
                      ? 'Opening...'
                      : 'Open Billing Management'}
                </Text>
              </Pressable>
            </View>
          </View>
        </SectionCard>
      </MotionInView>
    </ScreenShell>
  );
}
