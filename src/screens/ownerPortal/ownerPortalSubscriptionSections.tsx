import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { MotionInView } from '../../components/MotionInView';
import { SectionCard } from '../../components/SectionCard';
import { ScreenShell } from '../../components/ScreenShell';
import { AppUiIcon } from '../../icons/AppUiIcon';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import type {
  OwnerProfileDocument,
  OwnerPortalSubscriptionDocument,
} from '../../types/ownerPortal';
import type { OwnerSubscriptionTier, OwnerTierBillingCycle } from '../../types/ownerTiers';
import {
  OWNER_TIERS,
  OWNER_TIER_ORDER,
  ADDITIONAL_LOCATION_MONTHLY_PRICE,
} from '../../types/ownerTiers';
import { ownerPortalStyles as styles } from './ownerPortalStyles';
import {
  formatDateLabel as formatOwnerDateLabel,
  formatStatusLabel,
  isVerifiedStatus as isOwnerVerifiedStatus,
} from './ownerPortalStatusUtils';
import type { OwnerPortalStageItem } from './OwnerPortalStageList';
import { OwnerPortalStageList } from './OwnerPortalStageList';

const PREMIUM_FEATURES = [
  'Review replies and report inbox',
  Platform.OS === 'android'
    ? 'Owner update scheduling with performance results'
    : 'Promotion scheduling with performance results',
  Platform.OS === 'android'
    ? 'Favorite-follower alerts when updates go live'
    : 'Favorite-follower alerts when deals go live',
  'Premium photos, menu links, and verified-owner card upgrades',
];

const BUSINESS_SERVICE_NOTES = [
  'This plan is for licensed dispensary operators or approved staff managing a claimed storefront.',
  Platform.OS === 'android'
    ? 'Android shows billing status and eligibility only. Live checkout stays outside the Android app.'
    : 'Checkout covers storefront management tools, verification follow-up, review replies, and promotional controls.',
  'Customer discovery stays separate. Canopy Trove does not sell cannabis products inside this billing flow.',
];

export const PREMIUM_FEATURE_COUNT = PREMIUM_FEATURES.length;
export { PREMIUM_FEATURES, BUSINESS_SERVICE_NOTES };

export function formatPlanValue(value: string | null | undefined) {
  return formatStatusLabel(value, 'Inactive');
}

export function isVerifiedStatus(value: string | null | undefined) {
  return isOwnerVerifiedStatus(value);
}

export function formatDateLabel(value: string | null | undefined) {
  return formatOwnerDateLabel(value);
}

export function PremiumFeatureList() {
  return (
    <View style={styles.planFeatureList}>
      {PREMIUM_FEATURES.map((feature) => (
        <View key={feature} style={styles.planFeatureRow}>
          <AppUiIcon name="checkmark-circle" size={18} color="#00F58C" />
          <Text style={styles.planFeatureText}>{feature}</Text>
        </View>
      ))}
    </View>
  );
}

export function OwnerPortalSubscriptionPreview({
  demoStatus,
  storefrontName,
}: {
  demoStatus: string;
  storefrontName: string;
}) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <ScreenShell
      eyebrow="Owner Portal"
      title="Business plan preview."
      subtitle="Review the business billing experience with preview data before turning on live billing."
      headerPill="Preview"
    >
      <MotionInView delay={70}>
        <OwnerPortalSubscriptionDemoHero demoStatus={demoStatus} />
      </MotionInView>

      <MotionInView delay={120}>
        <SectionCard
          title="Preview plan status"
          body="Use this preview screen to review the paid business experience without touching a live subscription."
        >
          <View style={[styles.statusPanel, styles.statusPanelWarm]}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Storefront</Text>
              <Text style={styles.statusValue}>{storefrontName}</Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Current status</Text>
              <Text style={styles.statusValue}>{demoStatus}</Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Mode</Text>
              <Text style={styles.statusValue}>Preview</Text>
            </View>
          </View>
        </SectionCard>
      </MotionInView>

      <MotionInView delay={180}>
        <SectionCard
          title="Premium owner tools"
          body="These are the current paid business features shown in preview mode."
        >
          <View style={styles.planTile}>
            <Text style={styles.sectionEyebrow}>What premium unlocks</Text>
            <PremiumFeatureList />
          </View>
        </SectionCard>
      </MotionInView>

      <MotionInView delay={210}>
        <SectionCard
          title="What preview mode means"
          body="This screen is for reviewing pricing and billing copy only. It does not create a live checkout or subscription."
        >
          <OwnerPortalSubscriptionReadinessList
            items={[
              {
                label: 'Review the plan details',
                body: 'Use this screen to judge pricing language, business value, and overall clarity.',
                tone: 'complete',
              },
              {
                label: 'Keep live billing separate',
                body: 'Real checkout and billing management only happen in the live business dashboard.',
                tone: 'attention',
              },
            ]}
          />
        </SectionCard>
      </MotionInView>

      <MotionInView delay={240}>
        <SectionCard
          title="Keep reviewing"
          body="Return to the preview dashboard any time you want to keep reviewing the paid business flow."
        >
          <View style={styles.form}>
            <Pressable
              onPress={() => navigation.replace('OwnerPortalHome', { preview: true })}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Return To Preview Dashboard</Text>
            </Pressable>
          </View>
        </SectionCard>
      </MotionInView>
    </ScreenShell>
  );
}

export function OwnerPortalSubscriptionDemoHero({ demoStatus }: { demoStatus: string }) {
  return (
    <View style={styles.portalHeroCard}>
      <View style={styles.portalHeroGlow} />
      <Text style={styles.portalHeroKicker}>Business plan preview</Text>
      <Text style={styles.portalHeroTitle}>
        Review the paid business experience without touching a live subscription.
      </Text>
      <Text style={styles.portalHeroBody}>
        This preview keeps things safe while showing how your business plan, storefront tools, and
        billing details will feel in the live product.
      </Text>
      <View style={styles.portalHeroMetricRow}>
        <View style={styles.portalHeroMetricCard}>
          <Text style={styles.portalHeroMetricValue}>{demoStatus}</Text>
          <Text style={styles.portalHeroMetricLabel}>Preview Status</Text>
        </View>
        <View style={styles.portalHeroMetricCard}>
          <Text style={styles.portalHeroMetricValue}>{PREMIUM_FEATURES.length}</Text>
          <Text style={styles.portalHeroMetricLabel}>Premium Tools</Text>
        </View>
      </View>
    </View>
  );
}

export function OwnerPortalSubscriptionPlanDetails({
  ownerProfile,
  subscription,
  storefrontLabel,
  isBillingEligible,
  billingTemporarilyPaused,
  hasAccess,
}: {
  ownerProfile: OwnerProfileDocument | null;
  subscription: OwnerPortalSubscriptionDocument | null;
  storefrontLabel: string;
  isBillingEligible: boolean;
  billingTemporarilyPaused: boolean;
  hasAccess: boolean;
}) {
  return (
    <View
      style={[styles.statusPanel, hasAccess ? styles.statusPanelSuccess : styles.statusPanelWarm]}
    >
      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>Storefront</Text>
        <Text style={styles.statusValue}>{storefrontLabel}</Text>
      </View>
      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>Current status</Text>
        <Text style={styles.statusValue}>{formatPlanValue(subscription?.status)}</Text>
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
          {subscription?.billingCycle ? formatPlanValue(subscription.billingCycle) : 'Not started'}
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
            {ownerProfile?.dispensaryId ? 'Claimed storefront linked' : 'No storefront linked'}
          </Text>
        </View>
        <View style={styles.metaChip}>
          <Text style={styles.metaChipText}>
            {Platform.OS === 'android'
              ? 'Billing outside Android'
              : billingTemporarilyPaused
                ? 'Billing paused'
                : 'Billing ready'}
          </Text>
        </View>
      </View>
    </View>
  );
}

export function OwnerPortalSubscriptionIntroNotes() {
  return (
    <View style={styles.list}>
      {BUSINESS_SERVICE_NOTES.map((note) => (
        <Text key={note} style={styles.helperText}>{`\u2022 ${note}`}</Text>
      ))}
    </View>
  );
}

export function OwnerPortalSubscriptionReadinessList({ items }: { items: OwnerPortalStageItem[] }) {
  return <OwnerPortalStageList items={items} />;
}

export function OwnerPortalSubscriptionBillingSummary({
  isBillingEligible,
  billingConfigured,
  premiumFeatureCount,
}: {
  isBillingEligible: boolean;
  billingConfigured: boolean;
  premiumFeatureCount: number;
}) {
  return (
    <View style={styles.summaryStrip}>
      <View style={styles.summaryTile}>
        <Text style={styles.summaryTileValue}>{isBillingEligible ? 'Ready' : 'Waiting'}</Text>
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
          Whether the secure storefront-business billing path is ready in this build.
        </Text>
      </View>
      <View style={styles.summaryTile}>
        <Text style={styles.summaryTileValue}>{premiumFeatureCount}</Text>
        <Text style={styles.summaryTileLabel}>Premium Tools</Text>
        <Text style={styles.summaryTileBody}>
          Core owner capabilities unlocked by the paid plan.
        </Text>
      </View>
    </View>
  );
}

export function OwnerPortalSubscriptionPlanOptions({
  monthlyPriceLabel,
  annualPriceLabel,
  disableButtons,
  onOpenMonthly,
  onOpenAnnual,
  monthlyButtonLabel,
  annualButtonLabel,
}: {
  monthlyPriceLabel: string;
  annualPriceLabel: string;
  disableButtons: boolean;
  onOpenMonthly: () => void;
  onOpenAnnual: () => void;
  monthlyButtonLabel: string;
  annualButtonLabel: string;
}) {
  return (
    <View style={styles.planGrid}>
      <View style={styles.planTile}>
        <Text style={styles.sectionEyebrow}>Monthly</Text>
        <Text style={styles.planPrice}>{monthlyPriceLabel}</Text>
        <Text style={styles.planPriceCaption}>
          Flexible monthly access for private storefront business tools.
        </Text>
        <PremiumFeatureList />
        <Pressable
          disabled={disableButtons}
          onPress={onOpenMonthly}
          style={[styles.primaryButton, disableButtons && styles.buttonDisabled]}
        >
          <Text style={styles.primaryButtonText}>{monthlyButtonLabel}</Text>
        </Pressable>
      </View>

      <View style={[styles.planTile, styles.planTileFeatured]}>
        <Text style={styles.sectionEyebrow}>Annual</Text>
        <Text style={styles.planPrice}>{annualPriceLabel}</Text>
        <Text style={styles.planPriceCaption}>
          Best-value private business path for storefronts planning to stay active all year.
        </Text>
        <PremiumFeatureList />
        <Text style={styles.valueCallout}>Best long-term storefront setup</Text>
        <Pressable
          disabled={disableButtons}
          onPress={onOpenAnnual}
          style={[styles.primaryButton, disableButtons && styles.buttonDisabled]}
        >
          <Text style={styles.primaryButtonText}>{annualButtonLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function TierFeatureList({ features }: { features: string[] }) {
  return (
    <View style={styles.planFeatureList}>
      {features.map((feature) => (
        <View key={feature} style={styles.planFeatureRow}>
          <AppUiIcon name="checkmark-circle" size={18} color="#00F58C" />
          <Text style={styles.planFeatureText}>{feature}</Text>
        </View>
      ))}
    </View>
  );
}

function TierLockedFeature({ label }: { label: string }) {
  return (
    <View style={styles.planFeatureRow}>
      <AppUiIcon name="lock-closed-outline" size={18} color="#666" />
      <Text style={[styles.planFeatureText, styles.planFeatureTextLocked]}>{label}</Text>
    </View>
  );
}

export function OwnerPortalTierCards({
  billingCycle,
  currentTier,
  disableButtons,
  isSubmitting,
  billingTemporarilyPaused,
  onSelectTier,
  onToggleBillingCycle,
  showBillingCycleToggle = true,
}: {
  billingCycle: OwnerTierBillingCycle;
  currentTier: OwnerSubscriptionTier | null;
  disableButtons: boolean;
  isSubmitting: OwnerSubscriptionTier | null;
  billingTemporarilyPaused: boolean;
  onSelectTier: (tier: OwnerSubscriptionTier) => void;
  onToggleBillingCycle: () => void;
  showBillingCycleToggle?: boolean;
}) {
  return (
    <View style={styles.sectionStack}>
      {showBillingCycleToggle ? (
        <View style={styles.billingCycleRow}>
          <Pressable
            onPress={onToggleBillingCycle}
            style={[
              styles.billingCycleTab,
              billingCycle === 'monthly'
                ? styles.billingCycleTabActive
                : styles.billingCycleTabInactive,
            ]}
          >
            <Text
              style={
                billingCycle === 'monthly'
                  ? styles.billingCycleTabTextActive
                  : styles.billingCycleTabTextInactive
              }
            >
              Monthly
            </Text>
          </Pressable>
          <Pressable
            onPress={onToggleBillingCycle}
            style={[
              styles.billingCycleTab,
              billingCycle === 'annual'
                ? styles.billingCycleTabActive
                : styles.billingCycleTabInactive,
            ]}
          >
            <Text
              style={
                billingCycle === 'annual'
                  ? styles.billingCycleTabTextActive
                  : styles.billingCycleTabTextInactive
              }
            >
              Annual (save ~17%)
            </Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.planGrid}>
        {OWNER_TIER_ORDER.map((tierKey) => {
          const tierDef = OWNER_TIERS[tierKey];
          const isCurrentTier = currentTier === tierKey;
          const isFree = tierKey === 'free';
          const isFeatured = tierKey === 'pro';
          const price = isFree
            ? 'Free'
            : billingCycle === 'annual'
              ? `$${Math.round(tierDef.annualPrice / 12)}/mo`
              : `$${tierDef.monthlyPrice}/mo`;
          const billedNote = isFree
            ? 'No credit card required'
            : billingCycle === 'annual'
              ? `Billed $${tierDef.annualPrice}/yr`
              : 'Billed monthly';

          const buttonLabel = isFree
            ? isCurrentTier
              ? 'Current Plan'
              : 'Get Started Free'
            : billingTemporarilyPaused
              ? 'Billing Paused'
              : isSubmitting === tierKey
                ? 'Opening...'
                : isCurrentTier
                  ? 'Current Plan'
                  : `Start ${tierDef.label}`;

          return (
            <View
              key={tierKey}
              style={[
                styles.planTile,
                isFeatured && styles.planTileFeatured,
                isCurrentTier && styles.planTileCurrentTier,
              ]}
            >
              <Text style={styles.sectionEyebrow}>{tierDef.label}</Text>
              <Text style={styles.planPriceCaption}>{tierDef.tagline}</Text>
              <Text style={styles.planPrice}>{price}</Text>
              <Text style={[styles.planPriceCaption, styles.planPriceCaptionSmall]}>
                {billedNote}
              </Text>
              {tierKey === 'pro' ? (
                <Text style={styles.valueCallout}>
                  +${ADDITIONAL_LOCATION_MONTHLY_PRICE}/mo per additional location
                </Text>
              ) : null}
              <TierFeatureList features={tierDef.features} />
              {tierKey === 'free' ? (
                <View style={styles.planFeatureList}>
                  <TierLockedFeature label="Storefront editing (Verified+)" />
                  <TierLockedFeature label="Hours management (Verified+)" />
                  <TierLockedFeature label="Review replies (Verified+)" />
                  <TierLockedFeature label="Analytics (Verified+)" />
                  <TierLockedFeature label="Promotions (Growth+)" />
                  <TierLockedFeature label="AI tools (Pro)" />
                </View>
              ) : null}
              {tierKey === 'verified' ? (
                <View style={styles.planFeatureList}>
                  <TierLockedFeature label="Promotions (Growth+)" />
                  <TierLockedFeature label="Full analytics (Growth+)" />
                  <TierLockedFeature label="AI tools (Pro)" />
                </View>
              ) : null}
              {tierKey === 'growth' ? (
                <View style={styles.planFeatureList}>
                  <TierLockedFeature label="AI tools (Pro)" />
                  <TierLockedFeature label="Multi-location (Pro)" />
                </View>
              ) : null}
              {isFree ? (
                <Pressable
                  disabled={isCurrentTier}
                  onPress={() => {}}
                  style={[
                    styles.secondaryButton,
                    isCurrentTier && styles.buttonDisabled,
                    isCurrentTier && styles.buttonCurrentTier,
                  ]}
                >
                  <Text style={styles.secondaryButtonText}>{buttonLabel}</Text>
                </Pressable>
              ) : (
                <Pressable
                  disabled={disableButtons || isCurrentTier}
                  onPress={() => onSelectTier(tierKey)}
                  style={[
                    styles.primaryButton,
                    (disableButtons || isCurrentTier) && styles.buttonDisabled,
                    isCurrentTier && styles.buttonCurrentTier,
                  ]}
                >
                  <Text style={styles.primaryButtonText}>{buttonLabel}</Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}
