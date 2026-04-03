import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { MotionInView } from '../../components/MotionInView';
import { SectionCard } from '../../components/SectionCard';
import { ScreenShell } from '../../components/ScreenShell';
import { AppUiIcon } from '../../icons/AppUiIcon';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import type {
  OwnerProfileDocument,
  OwnerPortalSubscriptionDocument,
} from '../../types/ownerPortal';
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
  'Promotion scheduling with performance results',
  'Favorite-follower alerts when deals go live',
  'Premium photos, menu links, and verified-owner card upgrades',
];

const BUSINESS_SERVICE_NOTES = [
  'This plan is for licensed dispensary operators or approved staff managing a claimed storefront.',
  'Checkout covers storefront management tools, verification follow-up, review replies, and promotional controls.',
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
      title="Business plan preview workspace."
      subtitle="Review the private dispensary-workspace billing surface with preview data before turning on live billing."
      headerPill="Preview"
    >
      <MotionInView delay={70}>
        <OwnerPortalSubscriptionDemoHero demoStatus={demoStatus} />
      </MotionInView>

      <MotionInView delay={120}>
        <SectionCard
          title="Preview plan status"
          body="Use this preview workspace to review the paid owner experience without touching a live subscription record."
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
              <Text style={styles.statusLabel}>Workspace</Text>
              <Text style={styles.statusValue}>Preview review</Text>
            </View>
          </View>
        </SectionCard>
      </MotionInView>

      <MotionInView delay={180}>
        <SectionCard
          title="Premium owner tools"
          body="These are the current paid owner features exposed in preview mode."
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
          body="This route is for reviewing business-plan messaging only. It does not create a live customer, checkout session, or subscription."
        >
          <OwnerPortalSubscriptionReadinessList
            items={[
              {
                label: 'Review the plan surface',
                body: 'Use this screen to judge pricing language, storefront-tool value, and business-plan framing.',
                tone: 'complete',
              },
              {
                label: 'Keep live billing separate',
                body: 'Real checkout and billing management should only happen in the live dispensary workspace.',
                tone: 'attention',
              },
            ]}
          />
        </SectionCard>
      </MotionInView>

      <MotionInView delay={240}>
        <SectionCard
          title="Keep reviewing"
          body="Return to the owner preview workspace whenever you want to continue reviewing the paid owner flow."
        >
          <View style={styles.form}>
            <Pressable
              onPress={() => navigation.replace('OwnerPortalHome', { preview: true })}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Return To Preview Workspace</Text>
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
      <Text style={styles.portalHeroKicker}>Business plan preview workspace</Text>
      <Text style={styles.portalHeroTitle}>
        Review the paid dispensary-workspace experience without touching a live subscription.
      </Text>
      <Text style={styles.portalHeroBody}>
        This preview workspace keeps the access path safe while showing how the private business
        plan, storefront tools, billing state, and owner messaging will feel in the live product.
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
            {billingTemporarilyPaused ? 'Runtime paused' : 'Runtime ready'}
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
