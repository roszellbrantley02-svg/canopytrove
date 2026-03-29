import React from 'react';
import { RouteProp, useFocusEffect, useRoute } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, Text, View } from 'react-native';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { useStorefrontProfileController } from '../context/StorefrontController';
import { useSavedSummaries } from '../hooks/useStorefrontSummaryData';
import { RootStackParamList } from '../navigation/RootNavigator';
import { ownerPortalPreviewEnabled } from '../config/ownerPortalConfig';
import { ownerBillingConfig } from '../config/ownerBilling';
import {
  createOwnerBillingCheckoutSession,
  createOwnerBillingPortalSession,
  hasConfiguredOwnerBillingFlow,
} from '../services/ownerPortalBillingService';
import { getOwnerProfile, getOwnerSubscription } from '../services/ownerPortalService';
import { OwnerProfileDocument, OwnerPortalSubscriptionDocument } from '../types/ownerPortal';
import { ownerPortalStyles as styles } from './ownerPortal/ownerPortalStyles';
import {
  ownerPortalPreviewProfile,
  ownerPortalPreviewStorefront,
} from './ownerPortal/ownerPortalPreviewData';
import { OwnerPortalStageList } from './ownerPortal/OwnerPortalStageList';

const PREMIUM_FEATURES = [
  'Review replies and report inbox',
  'Promotion scheduling with performance results',
  'Favorite-follower alerts when deals go live',
  'Premium photos, menu links, and verified-owner card upgrades',
];

function formatPlanValue(value: string | null | undefined) {
  if (!value) {
    return 'Inactive';
  }

  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function isVerifiedStatus(value: string | null | undefined) {
  const normalizedValue = (value ?? '').trim().toLowerCase();
  return normalizedValue === 'verified' || normalizedValue === 'approved';
}

function formatDateLabel(value: string | null | undefined) {
  if (!value) {
    return 'Unavailable';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unavailable';
  }

  return date.toLocaleDateString();
}

type OwnerPortalSubscriptionRoute = RouteProp<RootStackParamList, 'OwnerPortalSubscription'>;

function PremiumFeatureList() {
  return (
    <View style={styles.planFeatureList}>
      {PREMIUM_FEATURES.map((feature) => (
        <View key={feature} style={styles.planFeatureRow}>
          <Ionicons name="checkmark-circle" size={18} color="#00F58C" />
          <Text style={styles.planFeatureText}>{feature}</Text>
        </View>
      ))}
    </View>
  );
}

function OwnerPortalSubscriptionPreview() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <ScreenShell
      eyebrow="Owner Portal"
      title="Plan access demo."
      subtitle="Review the premium owner experience with sample data before turning on live billing."
      headerPill="Demo"
    >
      <MotionInView delay={70}>
        <View style={styles.portalHeroCard}>
          <View style={styles.portalHeroGlow} />
          <Text style={styles.portalHeroKicker}>Premium plan preview</Text>
          <Text style={styles.portalHeroTitle}>
            Review the paid owner experience without touching a live subscription.
          </Text>
          <Text style={styles.portalHeroBody}>
            This preview keeps the access path safe while showing how premium storefront tools,
            billing state, and plan messaging will feel in the live product.
          </Text>
          <View style={styles.portalHeroMetricRow}>
            <View style={styles.portalHeroMetricCard}>
              <Text style={styles.portalHeroMetricValue}>
                {formatPlanValue(ownerPortalPreviewProfile.subscriptionStatus)}
              </Text>
              <Text style={styles.portalHeroMetricLabel}>Demo Status</Text>
            </View>
            <View style={styles.portalHeroMetricCard}>
              <Text style={styles.portalHeroMetricValue}>{PREMIUM_FEATURES.length}</Text>
              <Text style={styles.portalHeroMetricLabel}>Premium Tools</Text>
            </View>
          </View>
        </View>
      </MotionInView>

      <MotionInView delay={120}>
        <SectionCard
          title="Demo plan status"
          body="Use this demo to review the paid owner experience without touching a live subscription record."
        >
          <View style={[styles.statusPanel, styles.statusPanelWarm]}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Storefront</Text>
              <Text style={styles.statusValue}>{ownerPortalPreviewStorefront.displayName}</Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Current status</Text>
              <Text style={styles.statusValue}>
                {formatPlanValue(ownerPortalPreviewProfile.subscriptionStatus)}
              </Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Workspace</Text>
              <Text style={styles.statusValue}>Demo review</Text>
            </View>
          </View>
        </SectionCard>
      </MotionInView>

      <MotionInView delay={180}>
        <SectionCard
          title="Premium owner tools"
          body="These are the current paid owner features exposed in demo mode."
        >
          <View style={styles.planTile}>
            <Text style={styles.sectionEyebrow}>What premium unlocks</Text>
            <PremiumFeatureList />
          </View>
        </SectionCard>
      </MotionInView>

      <MotionInView delay={210}>
        <SectionCard
          title="What demo mode means"
          body="This route is for reviewing plan messaging only. It does not create a live customer, checkout session, or subscription."
        >
          <OwnerPortalStageList
            items={[
              {
                label: 'Review the plan surface',
                body: 'Use this screen to judge pricing language, premium value, and owner-plan framing.',
                tone: 'complete',
              },
              {
                label: 'Keep live billing separate',
                body: 'Real checkout and billing management should only happen in the live owner workspace.',
                tone: 'attention',
              },
            ]}
          />
        </SectionCard>
      </MotionInView>

      <MotionInView delay={240}>
        <SectionCard
          title="Keep reviewing"
          body="Return to the owner demo whenever you want to continue reviewing the paid owner flow."
        >
          <View style={styles.form}>
            <Pressable
              onPress={() => navigation.replace('OwnerPortalHome', { preview: true })}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Return To Owner Demo</Text>
            </Pressable>
          </View>
        </SectionCard>
      </MotionInView>
    </ScreenShell>
  );
}

export function OwnerPortalSubscriptionScreen() {
  const route = useRoute<OwnerPortalSubscriptionRoute>();
  const { authSession } = useStorefrontProfileController();
  const preview = ownerPortalPreviewEnabled && Boolean(route.params?.preview);
  const [ownerProfile, setOwnerProfile] = React.useState<OwnerProfileDocument | null>(null);
  const [subscription, setSubscription] = React.useState<OwnerPortalSubscriptionDocument | null>(
    null
  );
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState<null | 'monthly' | 'annual' | 'manage'>(
    null
  );
  const [statusText, setStatusText] = React.useState<string | null>(null);

  if (preview) {
    return <OwnerPortalSubscriptionPreview />;
  }

  const loadBillingState = React.useCallback(async () => {
    const ownerUid = authSession.uid;
    if (!ownerUid) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [nextOwnerProfile, nextSubscription] = await Promise.all([
        getOwnerProfile(ownerUid),
        getOwnerSubscription(ownerUid),
      ]);
      setOwnerProfile(nextOwnerProfile);
      setSubscription(nextSubscription);
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : 'Unable to load owner billing.');
    } finally {
      setIsLoading(false);
    }
  }, [authSession.uid]);

  React.useEffect(() => {
    void loadBillingState();
  }, [loadBillingState]);

  useFocusEffect(
    React.useCallback(() => {
      void loadBillingState();
    }, [loadBillingState])
  );

  const claimedStorefrontIds = ownerProfile?.dispensaryId ? [ownerProfile.dispensaryId] : [];
  const { data: claimedStorefronts } = useSavedSummaries(claimedStorefrontIds);
  const claimedStorefront = claimedStorefronts[0] ?? null;
  const effectiveStatus = subscription?.status ?? ownerProfile?.subscriptionStatus ?? 'inactive';
  const hasAccess = effectiveStatus === 'trial' || effectiveStatus === 'active';
  const isBillingEligible =
    Boolean(ownerProfile?.dispensaryId) &&
    isVerifiedStatus(ownerProfile?.businessVerificationStatus) &&
    isVerifiedStatus(ownerProfile?.identityVerificationStatus);
  const billingConfigured = hasConfiguredOwnerBillingFlow();
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
  ];

  const handleOpenCheckout = async (billingCycle: 'monthly' | 'annual') => {
    if (!authSession.uid || !ownerProfile?.dispensaryId || isSubmitting) {
      return;
    }

    setIsSubmitting(billingCycle);
    setStatusText(null);
    try {
      const session = await createOwnerBillingCheckoutSession(billingCycle);
      await Linking.openURL(session.url);
      setStatusText(
        'Checkout opened. Complete billing, then return here and tap Refresh Billing Status.'
      );
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : 'Unable to open owner checkout.');
    } finally {
      setIsSubmitting(null);
    }
  };

  const handleOpenBillingPortal = async () => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting('manage');
    setStatusText(null);
    try {
      const session = await createOwnerBillingPortalSession();
      await Linking.openURL(session.url);
      setStatusText('Billing management opened in your browser.');
    } catch (error) {
      setStatusText(
        error instanceof Error ? error.message : 'Unable to open billing management.'
      );
    } finally {
      setIsSubmitting(null);
    }
  };

  return (
    <ScreenShell
      eyebrow="Owner Portal"
      title="Plan access."
      subtitle="Choose the live owner plan, finish checkout securely, and manage billing for premium storefront tools."
      headerPill="Owner"
    >
      <MotionInView delay={70}>
        <View style={styles.portalHeroCard}>
          <View style={styles.portalHeroGlow} />
          <Text style={styles.portalHeroKicker}>Owner subscription</Text>
          <Text style={styles.portalHeroTitle}>
            Frame billing as a premium storefront upgrade, not a raw settings page.
          </Text>
          <Text style={styles.portalHeroBody}>
            The live plan flow is unchanged. This pass only improves plan clarity, visual
            hierarchy, and the confidence of the premium upgrade surface.
          </Text>
          <View style={styles.portalHeroMetricRow}>
            <View style={styles.portalHeroMetricCard}>
              <Text style={styles.portalHeroMetricValue}>{formatPlanValue(effectiveStatus)}</Text>
              <Text style={styles.portalHeroMetricLabel}>Plan Status</Text>
            </View>
            <View style={styles.portalHeroMetricCard}>
              <Text style={styles.portalHeroMetricValue}>{billingConfigured ? 'Ready' : 'Setup'}</Text>
              <Text style={styles.portalHeroMetricLabel}>Billing Flow</Text>
            </View>
            <View style={styles.portalHeroMetricCard}>
              <Text style={styles.portalHeroMetricValue}>{PREMIUM_FEATURES.length}</Text>
              <Text style={styles.portalHeroMetricLabel}>Premium Tools</Text>
            </View>
          </View>
        </View>
      </MotionInView>

      <MotionInView delay={120}>
        <SectionCard
          title="Current plan status"
          body="Plan access is tied to your claimed storefront and controls the premium owner tools available in the owner dashboard."
        >
          <View style={[styles.statusPanel, hasAccess ? styles.statusPanelSuccess : styles.statusPanelWarm]}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Storefront</Text>
              <Text style={styles.statusValue}>
                {claimedStorefront?.displayName ?? ownerProfile?.dispensaryId ?? 'No claimed listing'}
              </Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Current status</Text>
              <Text style={styles.statusValue}>{formatPlanValue(effectiveStatus)}</Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Provider</Text>
              <Text style={styles.statusValue}>
                {subscription?.provider ? formatPlanValue(subscription.provider) : 'Pending setup'}
              </Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Cycle</Text>
              <Text style={styles.statusValue}>
                {subscription?.billingCycle
                  ? formatPlanValue(subscription.billingCycle)
                  : 'Not started'}
              </Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Renews until</Text>
              <Text style={styles.statusValue}>
                {formatDateLabel(subscription?.currentPeriodEnd ?? null)}
              </Text>
            </View>
            <View style={styles.portalHeroMetaRow}>
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>
                  {isBillingEligible ? 'Verification complete' : 'Verification required'}
                </Text>
              </View>
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>
                  {claimedStorefront ? 'Claimed storefront linked' : 'No storefront linked'}
                </Text>
              </View>
            </View>
          </View>
        </SectionCard>
      </MotionInView>

      <MotionInView delay={180}>
        <SectionCard
          title="Premium owner tools"
          body="These are the capabilities unlocked once owner access is active."
        >
          <View style={styles.planTile}>
            <Text style={styles.sectionEyebrow}>Included with premium</Text>
            <PremiumFeatureList />
          </View>
        </SectionCard>
      </MotionInView>

      <MotionInView delay={210}>
        <SectionCard
          title="Before billing can start"
          body="This checklist makes the subscription step read as part of the owner journey instead of an isolated billing page."
        >
          <OwnerPortalStageList items={billingReadinessItems} />
        </SectionCard>
      </MotionInView>

      <MotionInView delay={240}>
        <SectionCard
          title="Choose your plan"
          body="Billing opens in a secure checkout flow and syncs back to your owner profile once payment completes."
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

            <View style={styles.summaryStrip}>
              <View style={styles.summaryTile}>
                <Text style={styles.summaryTileValue}>
                  {isBillingEligible ? 'Ready' : 'Waiting'}
                </Text>
                <Text style={styles.summaryTileLabel}>Eligibility</Text>
                <Text style={styles.summaryTileBody}>
                  Verification and storefront claim requirements for checkout.
                </Text>
              </View>
              <View style={styles.summaryTile}>
                <Text style={styles.summaryTileValue}>
                  {billingConfigured ? 'Configured' : 'Not Configured'}
                </Text>
                <Text style={styles.summaryTileLabel}>Checkout Flow</Text>
                <Text style={styles.summaryTileBody}>
                  Whether the secure billing path is ready in this build.
                </Text>
              </View>
              <View style={styles.summaryTile}>
                <Text style={styles.summaryTileValue}>{PREMIUM_FEATURES.length}</Text>
                <Text style={styles.summaryTileLabel}>Premium Tools</Text>
                <Text style={styles.summaryTileBody}>
                  Core owner capabilities unlocked by the paid plan.
                </Text>
              </View>
            </View>

            <View style={styles.planGrid}>
              <View style={styles.planTile}>
                <Text style={styles.sectionEyebrow}>Monthly</Text>
                <Text style={styles.planPrice}>
                  {ownerBillingConfig.monthlyPriceLabel ?? 'Configured in live billing'}
                </Text>
                <Text style={styles.planPriceCaption}>Flexible monthly access for premium owner tools.</Text>
                <PremiumFeatureList />
                <Pressable
                  disabled={
                    isLoading || !billingConfigured || !isBillingEligible || Boolean(isSubmitting)
                  }
                  onPress={() => {
                    void handleOpenCheckout('monthly');
                  }}
                  style={[
                    styles.primaryButton,
                    (isLoading || !billingConfigured || !isBillingEligible || Boolean(isSubmitting)) &&
                      styles.buttonDisabled,
                  ]}
                >
                  <Text style={styles.primaryButtonText}>
                    {isSubmitting === 'monthly' ? 'Opening...' : 'Start Monthly Plan'}
                  </Text>
                </Pressable>
              </View>

              <View style={[styles.planTile, styles.planTileFeatured]}>
                <Text style={styles.sectionEyebrow}>Annual</Text>
                <Text style={styles.planPrice}>
                  {ownerBillingConfig.annualPriceLabel ?? 'Configured in live billing'}
                </Text>
                <Text style={styles.planPriceCaption}>
                  Best-looking premium path for storefronts planning to stay active all year.
                </Text>
                <PremiumFeatureList />
                <Text style={styles.valueCallout}>Best long-term owner setup</Text>
                <Pressable
                  disabled={
                    isLoading || !billingConfigured || !isBillingEligible || Boolean(isSubmitting)
                  }
                  onPress={() => {
                    void handleOpenCheckout('annual');
                  }}
                  style={[
                    styles.primaryButton,
                    (isLoading || !billingConfigured || !isBillingEligible || Boolean(isSubmitting)) &&
                      styles.buttonDisabled,
                  ]}
                >
                  <Text style={styles.primaryButtonText}>
                    {isSubmitting === 'annual' ? 'Opening...' : 'Start Annual Plan'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </SectionCard>
      </MotionInView>

      <MotionInView delay={300}>
        <SectionCard
          title="Manage billing"
          body="Refresh your billing state after checkout or open the billing portal to manage an active Stripe subscription."
        >
          <View style={[styles.ctaPanel, styles.statusPanelSuccess]}>
            <Text style={styles.helperText}>
              Refresh after checkout if you need the latest synced state, or open billing
              management once a live customer record exists.
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
                disabled={!subscription?.externalCustomerId || Boolean(isSubmitting)}
                onPress={() => {
                  void handleOpenBillingPortal();
                }}
                style={[
                  styles.primaryButton,
                  (!subscription?.externalCustomerId || Boolean(isSubmitting)) &&
                    styles.buttonDisabled,
                ]}
              >
                <Text style={styles.primaryButtonText}>
                  {isSubmitting === 'manage' ? 'Opening...' : 'Open Billing Management'}
                </Text>
              </Pressable>
            </View>
          </View>
        </SectionCard>
      </MotionInView>
    </ScreenShell>
  );
}
