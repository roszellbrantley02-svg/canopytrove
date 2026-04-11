import React from 'react';
import type { RouteProp } from '@react-navigation/native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { Linking, Platform, Pressable, Text, View } from 'react-native';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { useStorefrontProfileController } from '../context/StorefrontController';
import { useSavedSummaries } from '../hooks/useStorefrontSummaryData';
import type { RootStackParamList } from '../navigation/RootNavigator';

import {
  createOwnerBillingCheckoutSession,
  createOwnerBillingPortalSession,
  hasConfiguredOwnerBillingFlow,
} from '../services/ownerPortalBillingService';
import { getOwnerProfile, getOwnerSubscription } from '../services/ownerPortalService';
import { getRuntimeOpsStatus } from '../services/runtimeOpsService';
import type { OwnerProfileDocument, OwnerPortalSubscriptionDocument } from '../types/ownerPortal';
import type { OwnerSubscriptionTier } from '../types/ownerTiers';
import type { OwnerTierBillingCycle } from '../types/ownerTiers';
import type { RuntimeOpsPublicStatus } from '../types/runtimeOps';
import { ownerPortalStyles as styles } from './ownerPortal/ownerPortalStyles';
import {
  PREMIUM_FEATURE_COUNT,
  OwnerPortalSubscriptionIntroNotes,
  OwnerPortalSubscriptionPlanDetails,
  OwnerPortalSubscriptionReadinessList,
  OwnerPortalTierCards,
  PremiumFeatureList,
  formatPlanValue,
  isVerifiedStatus,
} from './ownerPortal/ownerPortalSubscriptionSections';

type OwnerPortalSubscriptionRoute = RouteProp<RootStackParamList, 'OwnerPortalSubscription'>;

function OwnerPortalSubscriptionScreenInner() {
  const route = useRoute<OwnerPortalSubscriptionRoute>();
  const { authSession } = useStorefrontProfileController();
  const isAndroid = Platform.OS === 'android';
  const preview = route.params?.preview ?? false;
  const [ownerProfile, setOwnerProfile] = React.useState<OwnerProfileDocument | null>(null);
  const [subscription, setSubscription] = React.useState<OwnerPortalSubscriptionDocument | null>(
    null,
  );
  const [runtimeStatus, setRuntimeStatus] = React.useState<RuntimeOpsPublicStatus | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState<null | OwnerSubscriptionTier | 'manage'>(
    null,
  );
  const [statusText, setStatusText] = React.useState<string | null>(null);
  const [billingCycle, setBillingCycle] = React.useState<OwnerTierBillingCycle>('monthly');

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

  const effectiveStatus = subscription?.status ?? ownerProfile?.subscriptionStatus ?? 'inactive';
  const hasAccess = effectiveStatus === 'trial' || effectiveStatus === 'active';
  const isBillingEligible =
    Boolean(ownerProfile?.dispensaryId) &&
    isVerifiedStatus(ownerProfile?.businessVerificationStatus) &&
    isVerifiedStatus(ownerProfile?.identityVerificationStatus);
  const billingConfigured = hasConfiguredOwnerBillingFlow();
  const billingEnabledInThisBuild = billingConfigured && !isAndroid;
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
      body: isAndroid
        ? 'Android shows billing status only. Checkout and billing management stay outside the Android app.'
        : billingConfigured
          ? 'This build can open the configured billing path.'
          : 'Billing env or fallback checkout links are still incomplete for this build.',
      tone: isAndroid
        ? ('complete' as const)
        : billingConfigured
          ? ('complete' as const)
          : ('attention' as const),
    },
    {
      label: 'Billing safety',
      body: billingTemporarilyPaused
        ? (runtimeStatus?.policy.reason ??
          'Protected mode is active, so live billing changes should wait until the system stabilizes.')
        : 'No billing pause is active right now.',
      tone: billingTemporarilyPaused ? ('attention' as const) : ('complete' as const),
    },
  ];

  const handleOpenCheckout = async (tier: OwnerSubscriptionTier) => {
    if (isAndroid) {
      setStatusText(
        'Android shows owner plan status only. Checkout stays outside the Android app.',
      );
      return;
    }
    if (!authSession.uid || !ownerProfile?.dispensaryId) {
      setStatusText('Sign in and claim a listing before starting a subscription.');
      return;
    }
    if (isSubmitting || billingTemporarilyPaused) {
      return;
    }

    setIsSubmitting(tier);
    setStatusText(null);
    try {
      const session = await createOwnerBillingCheckoutSession(billingCycle, tier);
      if (Platform.OS === 'web') {
        window.open(session.url, '_blank', 'noopener,noreferrer');
      } else {
        await Linking.openURL(session.url);
      }
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
    if (isAndroid) {
      setStatusText(
        'Android keeps billing management outside the app. Use a non-Android channel to manage owner billing.',
      );
      return;
    }
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
      if (Platform.OS === 'web') {
        window.open(session.url, '_blank', 'noopener,noreferrer');
      } else {
        await Linking.openURL(session.url);
      }
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
      subtitle={
        isAndroid
          ? 'Review owner plan status and billing readiness for the Android build.'
          : 'Choose your plan, complete checkout, and manage billing.'
      }
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
                {isAndroid ? 'Outside App' : billingConfigured ? 'Ready' : 'Setup'}
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
          body={
            isAndroid
              ? 'Review available tiers and the Android billing posture.'
              : 'Select your tier and billing cycle, then proceed to checkout.'
          }
        >
          <View style={styles.sectionStack}>
            {statusText ? <Text style={styles.errorText}>{statusText}</Text> : null}
            {!billingConfigured && !isAndroid ? (
              <Text style={styles.errorText}>
                Billing is not configured for this build yet. Add the hosted backend billing env or
                the fallback hosted checkout URLs before release.
              </Text>
            ) : null}
            {isAndroid ? (
              <Text style={styles.helperText}>
                Android keeps owner billing read-only inside the app. Checkout and subscription
                management are intentionally unavailable in this build.
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
            <OwnerPortalTierCards
              billingCycle={billingCycle}
              currentTier={subscription?.tier ?? null}
              disableButtons={
                isLoading ||
                !billingEnabledInThisBuild ||
                !isBillingEligible ||
                billingTemporarilyPaused ||
                Boolean(isSubmitting)
              }
              isSubmitting={
                typeof isSubmitting === 'string' && isSubmitting !== 'manage'
                  ? (isSubmitting as OwnerSubscriptionTier)
                  : null
              }
              billingTemporarilyPaused={billingTemporarilyPaused}
              onSelectTier={(tier) => {
                void handleOpenCheckout(tier);
              }}
              onToggleBillingCycle={() => {
                setBillingCycle((prev) => (prev === 'monthly' ? 'annual' : 'monthly'));
              }}
            />
          </View>
        </SectionCard>
      </MotionInView>

      <MotionInView delay={330}>
        <SectionCard
          title="Manage billing"
          body={
            isAndroid
              ? 'Refresh status only. Billing management stays outside the Android build.'
              : 'Refresh status or manage your active subscription.'
          }
        >
          <View style={[styles.ctaPanel, styles.statusPanelSuccess]}>
            <Text style={styles.helperText}>
              {isAndroid
                ? 'Refresh to see the latest synced subscription state. Billing management is intentionally unavailable in the Android build.'
                : 'Refresh after checkout if you need the latest synced state, or open billing management once a live customer record exists.'}
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
                  isAndroid ||
                  !subscription?.externalCustomerId ||
                  billingTemporarilyPaused ||
                  Boolean(isSubmitting)
                }
                onPress={() => {
                  void handleOpenBillingPortal();
                }}
                style={[
                  styles.primaryButton,
                  (isAndroid ||
                    !subscription?.externalCustomerId ||
                    billingTemporarilyPaused ||
                    Boolean(isSubmitting)) &&
                    styles.buttonDisabled,
                ]}
              >
                <Text style={styles.primaryButtonText}>
                  {isAndroid
                    ? 'Unavailable On Android'
                    : billingTemporarilyPaused
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

export const OwnerPortalSubscriptionScreen = withScreenErrorBoundary(
  OwnerPortalSubscriptionScreenInner,
  'owner-portal-subscription',
);
