import React from 'react';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { ownerPortalPreviewEnabled } from '../config/ownerPortalConfig';
import { RootStackParamList } from '../navigation/RootNavigator';
import { OwnerPortalDealBadgeEditor } from './ownerPortal/OwnerPortalDealBadgeEditor';
import { OwnerPortalAnalyticsCard } from './ownerPortal/OwnerPortalAnalyticsCard';
import { OwnerPortalDealOverridePanel } from './ownerPortal/OwnerPortalDealOverridePanel';
import { OwnerPortalStageItem, OwnerPortalStageList } from './ownerPortal/OwnerPortalStageList';
import { ownerPortalStyles as styles } from './ownerPortal/ownerPortalStyles';
import { useOwnerPortalHomeScreenModel } from './ownerPortal/useOwnerPortalHomeScreenModel';
import { useOwnerPortalWorkspace } from './ownerPortal/useOwnerPortalWorkspace';

type OwnerPortalHomeRoute = RouteProp<RootStackParamList, 'OwnerPortalHome'>;

function formatOwnerValue(value: string | null | undefined) {
  if (!value) {
    return 'Not set';
  }

  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatRate(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return '0%';
  }

  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

function formatCount(value: number) {
  return Math.round(value).toLocaleString();
}

function clampProgress(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

function getRelativeProgress(value: number, max: number) {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) {
    return 0;
  }

  return clampProgress(value / max);
}

function getTopPromotion(
  workspace: NonNullable<ReturnType<typeof useOwnerPortalWorkspace>['workspace']>
) {
  return [...workspace.promotionPerformance].sort((left, right) => {
    if (right.metrics.actionRate !== left.metrics.actionRate) {
      return right.metrics.actionRate - left.metrics.actionRate;
    }

    return right.metrics.impressions - left.metrics.impressions;
  })[0] ?? null;
}

function getJourneyItems(input: {
  preview: boolean;
  signedIn: boolean;
  hasBusinessDetails: boolean;
  hasClaimedListing: boolean;
  businessVerificationStatus: string | null | undefined;
  identityVerificationStatus: string | null | undefined;
  subscriptionStatus: string | null | undefined;
}): OwnerPortalStageItem[] {
  const isVerified = (value: string | null | undefined) => {
    const normalized = (value ?? '').trim().toLowerCase();
    return normalized === 'verified' || normalized === 'approved';
  };

  const isPendingReview = (value: string | null | undefined) =>
    (value ?? '').trim().toLowerCase() === 'pending';

  return [
    {
      label: 'Account access',
      body: input.preview
        ? 'Demo mode is open for review only. Live owner access still depends on the approved email path.'
        : input.signedIn
          ? 'The real owner account is signed in and can continue onboarding from this dashboard.'
          : 'Sign in first so the owner workspace can attach to the correct account.',
      tone: input.preview || input.signedIn ? 'complete' : 'current',
    },
    {
      label: 'Business profile',
      body: input.hasBusinessDetails
        ? 'Legal and company details are present and ready for the storefront claim step.'
        : 'Business details still need to be finished before claim and verification feel complete.',
      tone: input.hasBusinessDetails ? 'complete' : 'current',
    },
    {
      label: 'Claimed listing',
      body: input.hasClaimedListing
        ? 'A storefront is linked to the owner workspace.'
        : 'Claim the correct dispensary listing before business verification can be treated as live.',
      tone: input.hasClaimedListing ? 'complete' : 'pending',
    },
    {
      label: 'Business verification',
      body: isVerified(input.businessVerificationStatus)
        ? 'Business review is complete.'
        : isPendingReview(input.businessVerificationStatus)
          ? 'Business documents are in review.'
          : 'Business proof still needs to be submitted and approved.',
      tone: isVerified(input.businessVerificationStatus)
        ? 'complete'
        : isPendingReview(input.businessVerificationStatus)
          ? 'current'
          : input.hasClaimedListing
            ? 'current'
            : 'pending',
    },
    {
      label: 'Identity verification',
      body: isVerified(input.identityVerificationStatus)
        ? 'Identity review is complete.'
        : isPendingReview(input.identityVerificationStatus)
          ? 'Identity package is in review.'
          : 'Identity review still needs to be completed before premium access can go live.',
      tone: isVerified(input.identityVerificationStatus)
        ? 'complete'
        : isPendingReview(input.identityVerificationStatus)
          ? 'current'
          : 'pending',
    },
    {
      label: 'Subscription access',
      body:
        input.subscriptionStatus && input.subscriptionStatus !== 'inactive'
          ? 'Premium owner access is active or in trial.'
          : 'Billing is the final step after claim and verification are complete.',
      tone:
        input.subscriptionStatus && input.subscriptionStatus !== 'inactive' ? 'complete' : 'pending',
    },
  ];
}

export function OwnerPortalHomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<OwnerPortalHomeRoute>();
  const preview = ownerPortalPreviewEnabled && Boolean(route.params?.preview);
  const {
    accessState,
    authSession,
    claimedStorefront,
    errorText,
    handleContinue,
    isLoading,
    nextStep,
    ownerClaim,
    ownerProfile,
  } = useOwnerPortalHomeScreenModel(preview);
  const {
    workspace,
    isLoading: isWorkspaceLoading,
    errorText: workspaceErrorText,
  } = useOwnerPortalWorkspace(preview);
  const topPromotion = workspace ? getTopPromotion(workspace) : null;
  const totalActions7d = workspace
    ? workspace.metrics.routeStarts7d +
      workspace.metrics.websiteTapCount7d +
      workspace.metrics.menuTapCount7d +
      workspace.metrics.phoneTapCount7d
    : 0;
  const activePromotionCount =
    workspace?.promotions.filter((promotion) => promotion.status === 'active').length ?? 0;
  const openRate =
    workspace && workspace.metrics.storefrontImpressions7d > 0
      ? (workspace.metrics.storefrontOpenCount7d / workspace.metrics.storefrontImpressions7d) * 100
      : 0;
  const visibilityMax = workspace
    ? Math.max(
        workspace.metrics.storefrontImpressions7d,
        workspace.metrics.storefrontOpenCount7d,
        workspace.metrics.followerCount,
        workspace.metrics.reviewCount30d,
        1
      )
    : 1;
  const actionMixMax = Math.max(totalActions7d, 1);
  const responseMixMax = workspace
    ? Math.max(
        workspace.metrics.openReportCount,
        activePromotionCount,
        workspace.metrics.reviewCount30d,
        1
      )
    : 1;
  const topPromotionTrackedActions = topPromotion
    ? topPromotion.metrics.redeemStarts +
      topPromotion.metrics.websiteTaps +
      topPromotion.metrics.menuTaps +
      topPromotion.metrics.phoneTaps
    : 0;

  const previewRoutes = [
    {
      label: 'Business Details',
      body: 'Review the business profile and company information collected during onboarding.',
      routeName: 'OwnerPortalBusinessDetails' as const,
      params: {
        ownerUid: ownerProfile?.uid,
        initialLegalName: ownerProfile?.legalName,
        initialCompanyName: ownerProfile?.companyName,
        initialPhone: ownerProfile?.phone ?? '',
        preview: true,
      },
    },
    {
      label: 'Claim Listing',
      body: 'Walk through the storefront claim flow with preview-safe sample data.',
      routeName: 'OwnerPortalClaimListing' as const,
      params: { preview: true },
    },
    {
      label: 'Business Verification',
      body: 'Check the business verification step and supporting-document flow.',
      routeName: 'OwnerPortalBusinessVerification' as const,
      params: { preview: true },
    },
    {
      label: 'Identity Verification',
      body: 'Preview the identity check state, review copy, and approval messaging.',
      routeName: 'OwnerPortalIdentityVerification' as const,
      params: { preview: true },
    },
    {
      label: 'Subscription',
      body: 'Inspect the premium plan experience without touching live billing records.',
      routeName: 'OwnerPortalSubscription' as const,
      params: { preview: true },
    },
  ];
  const workspaceTools = [
    {
      label: 'Review Management',
      body: 'Reply faster, surface low-rating trends, and keep the moderation inbox clean.',
      routeName: 'OwnerPortalReviewInbox' as const,
    },
    {
      label: 'Promotions And Results',
      body: 'Schedule offers, tune placement, and compare which deal themes convert best.',
      routeName: 'OwnerPortalPromotions' as const,
    },
    {
      label: 'Profile Conversion Tools',
      body: 'Improve storefront card presentation with premium photos, copy, and menu links.',
      routeName: 'OwnerPortalProfileTools' as const,
    },
  ];
  const ownerStatusChips = [
    preview ? 'Preview workspace' : accessState.allowlisted ? 'Approved owner' : 'Invite flow',
    ownerProfile?.subscriptionStatus
      ? formatOwnerValue(ownerProfile.subscriptionStatus)
      : 'Plan inactive',
    ownerProfile?.dispensaryId ? 'Storefront connected' : 'No listing claimed',
  ];
  const profileSummaryTiles = ownerProfile
    ? [
        {
          label: 'Badge Level',
          value: `${ownerProfile.badgeLevel}`,
          body: 'Current premium storefront badge level.',
        },
        {
          label: 'Onboarding',
          value: formatOwnerValue(ownerProfile.onboardingStep),
          body: 'Where the owner journey currently resumes.',
        },
        {
          label: 'Plan Access',
          value: formatOwnerValue(ownerProfile.subscriptionStatus),
          body: 'Current premium plan state for this owner account.',
        },
      ]
    : [];
  const journeyItems = getJourneyItems({
    preview,
    signedIn: authSession.status === 'authenticated',
    hasBusinessDetails: Boolean(ownerProfile?.legalName?.trim() && ownerProfile?.companyName?.trim()),
    hasClaimedListing: Boolean(ownerProfile?.dispensaryId),
    businessVerificationStatus: ownerProfile?.businessVerificationStatus,
    identityVerificationStatus: ownerProfile?.identityVerificationStatus,
    subscriptionStatus: ownerProfile?.subscriptionStatus,
  });

  return (
    <ScreenShell
      eyebrow="Owner Portal"
      title={preview ? 'Owner portal demo.' : 'Owner dashboard.'}
      subtitle={
        preview
          ? 'Review the full owner experience with sample data, including listing tools, onboarding, and deal-badge controls.'
          : 'Manage your listing, verification, live deals, badges, and plan access from one private owner workspace.'
      }
      headerPill={preview ? 'Demo' : 'Owner'}
    >
      <MotionInView delay={70}>
        <View style={styles.portalHeroCard}>
          <View style={styles.portalHeroGlow} />
          <Text style={styles.portalHeroKicker}>Owner workspace</Text>
          <Text style={styles.portalHeroTitle}>
            {preview
              ? 'Review the full owner experience with premium polish.'
              : 'Track readiness, visibility, and revenue-driving actions from one dashboard.'}
          </Text>
          <Text style={styles.portalHeroBody}>
            {preview
              ? 'This demo keeps onboarding, plan, and storefront-management behavior intact while presenting the full owner flow with realistic sample data.'
              : 'The owner portal is your private operating layer for storefront health, promotion performance, and the premium tools that raise conversion.'}
          </Text>
          <View style={styles.portalHeroMetricRow}>
            <View style={styles.portalHeroMetricCard}>
              <Text style={styles.portalHeroMetricValue}>
                {ownerProfile?.dispensaryId ? '1' : '0'}
              </Text>
              <Text style={styles.portalHeroMetricLabel}>Managed Storefronts</Text>
            </View>
            <View style={styles.portalHeroMetricCard}>
              <Text style={styles.portalHeroMetricValue}>
                {workspace ? workspace.metrics.followerCount : preview ? '214' : '0'}
              </Text>
              <Text style={styles.portalHeroMetricLabel}>Saved Followers</Text>
            </View>
            <View style={styles.portalHeroMetricCard}>
              <Text style={styles.portalHeroMetricValue}>
                {workspace ? totalActions7d : preview ? '62' : '0'}
              </Text>
              <Text style={styles.portalHeroMetricLabel}>Tracked Actions 7D</Text>
            </View>
          </View>
          <View style={styles.portalHeroMetaRow}>
            {ownerStatusChips.map((chip) => (
              <View key={chip} style={styles.metaChip}>
                <Text style={styles.metaChipText}>{chip}</Text>
              </View>
            ))}
          </View>
        </View>
      </MotionInView>

      <MotionInView delay={120}>
        <SectionCard
          title={preview ? 'Demo workspace' : 'Access status'}
          body={
            preview
              ? 'The demo keeps the live account, claim, upload, and plan paths intact while letting you review the full owner flow safely.'
              : 'Owner access is currently invite-only while billing and review operations are still being finalized.'
          }
        >
          <View style={[styles.statusPanel, preview ? styles.statusPanelWarm : styles.statusPanelSuccess]}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Email</Text>
              <Text style={styles.statusValue}>
                  {preview ? 'preview@canopytrove.com' : authSession.email ?? 'Not signed in'}
              </Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>{preview ? 'Workspace' : 'Account'}</Text>
              <Text style={styles.statusValue}>
                {preview
                  ? 'Demo data'
                  : authSession.status === 'authenticated'
                    ? 'Signed in'
                    : 'Not signed in'}
              </Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Access</Text>
              <Text style={styles.statusValue}>
                {preview
                  ? 'Open demo'
                  : accessState.allowlisted
                    ? 'Approved'
                    : accessState.enabled
                      ? 'Invite required'
                      : 'Open'}
              </Text>
            </View>
            <View style={styles.portalHeroMetaRow}>
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>
                  {preview ? 'Sample owner account' : 'Private workspace'}
                </Text>
              </View>
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>
                  {accessState.enabled ? 'Access controls enabled' : 'Open access build'}
                </Text>
              </View>
            </View>
          </View>
        </SectionCard>
      </MotionInView>

      <MotionInView delay={180}>
        <SectionCard
          title="Owner profile"
          body="Your owner profile tracks onboarding, verification, listing connection, and plan access."
        >
          {isLoading ? (
            <Text style={styles.helperText}>Loading owner profile...</Text>
          ) : errorText ? (
            <Text style={styles.errorText}>{errorText}</Text>
          ) : !ownerProfile ? (
            <View style={styles.emptyStateCard}>
              <Text style={styles.emptyStateTitle}>No owner profile found</Text>
              <Text style={styles.emptyStateBody}>
                This account does not have an owner profile yet, so the deeper workspace sections
                are staying calm until onboarding data exists.
              </Text>
            </View>
          ) : (
            <View style={styles.cardStack}>
              <View style={styles.statusPanel}>
                <View style={styles.splitHeaderRow}>
                  <View style={styles.splitHeaderCopy}>
                    <Text style={styles.sectionEyebrow}>Profile state</Text>
                    <Text style={styles.splitHeaderTitle}>{ownerProfile.companyName}</Text>
                    <Text style={styles.splitHeaderBody}>
                      Badge level {ownerProfile.badgeLevel} owner profile with linked onboarding,
                      verification, and plan-access state.
                    </Text>
                  </View>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>Badge level {ownerProfile.badgeLevel}</Text>
                  </View>
                </View>
                <View style={styles.portalHeroMetaRow}>
                  <View style={styles.metaChip}>
                    <Text style={styles.metaChipText}>
                      Business {formatOwnerValue(ownerProfile.businessVerificationStatus)}
                    </Text>
                  </View>
                  <View style={styles.metaChip}>
                    <Text style={styles.metaChipText}>
                      Identity {formatOwnerValue(ownerProfile.identityVerificationStatus)}
                    </Text>
                  </View>
                  <View style={styles.metaChip}>
                    <Text style={styles.metaChipText}>
                      Plan {formatOwnerValue(ownerProfile.subscriptionStatus)}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.summaryStrip}>
                {profileSummaryTiles.map((tile) => (
                  <View key={tile.label} style={styles.summaryTile}>
                    <Text style={styles.summaryTileValue}>{tile.value}</Text>
                    <Text style={styles.summaryTileLabel}>{tile.label}</Text>
                    <Text style={styles.summaryTileBody}>{tile.body}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.statusPanel}>
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>Company</Text>
                  <Text style={styles.statusValue}>{ownerProfile.companyName}</Text>
                </View>
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>Legal name</Text>
                  <Text style={styles.statusValue}>{ownerProfile.legalName}</Text>
                </View>
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>Business verification</Text>
                  <Text style={styles.statusValue}>
                    {formatOwnerValue(ownerProfile.businessVerificationStatus)}
                  </Text>
                </View>
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>Identity verification</Text>
                  <Text style={styles.statusValue}>
                    {formatOwnerValue(ownerProfile.identityVerificationStatus)}
                  </Text>
                </View>
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>Plan access</Text>
                  <Text style={styles.statusValue}>
                    {formatOwnerValue(ownerProfile.subscriptionStatus)}
                  </Text>
                </View>
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>Onboarding step</Text>
                  <Text style={styles.statusValue}>
                    {formatOwnerValue(ownerProfile.onboardingStep)}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </SectionCard>
      </MotionInView>

      <MotionInView delay={210}>
        <SectionCard
          title="Journey status"
          body="This turns the owner path into one readable sequence instead of making you infer it from multiple sections."
        >
          <OwnerPortalStageList items={journeyItems} />
        </SectionCard>
      </MotionInView>

      {preview ? (
        <MotionInView delay={240}>
          <SectionCard
            title="Explore every owner page"
            body="Jump straight into each owner step with sample data when you want to review the full journey quickly."
          >
            <View style={styles.actionGrid}>
              {previewRoutes.map((item) => (
                <Pressable
                  key={item.label}
                  onPress={() => navigation.navigate(item.routeName, item.params as never)}
                  style={[styles.actionTile, styles.actionTileWarm]}
                >
                  <View style={styles.splitHeaderRow}>
                    <View style={styles.splitHeaderCopy}>
                      <Text style={styles.actionTileMeta}>Preview route</Text>
                      <Text style={styles.actionTileTitle}>{item.label}</Text>
                      <Text style={styles.actionTileBody}>{item.body}</Text>
                    </View>
                    <Ionicons name="arrow-forward-circle-outline" size={20} color="#F5C86A" />
                  </View>
                </Pressable>
              ))}
            </View>
          </SectionCard>
        </MotionInView>
      ) : null}

      {authSession.uid && ownerProfile && nextStep ? (
        <MotionInView delay={preview ? 300 : 240}>
          <SectionCard title="Next step" body="Continue where your owner workspace left off.">
            <View style={styles.ctaPanel}>
              <View style={styles.splitHeaderRow}>
                <View style={styles.splitHeaderCopy}>
                  <Text style={styles.sectionEyebrow}>Continue flow</Text>
                  <Text style={styles.splitHeaderTitle}>{nextStep.title}</Text>
                  <Text style={styles.splitHeaderBody}>{nextStep.body}</Text>
                </View>
                <Ionicons name="sparkles-outline" size={20} color="#F5C86A" />
              </View>
              <Pressable
                disabled={!nextStep.routeName}
                onPress={handleContinue}
                style={[styles.primaryButton, !nextStep.routeName && styles.buttonDisabled]}
              >
                <Text style={styles.primaryButtonText}>{nextStep.actionLabel}</Text>
              </Pressable>
            </View>
          </SectionCard>
        </MotionInView>
      ) : null}

      {ownerProfile?.dispensaryId ? (
        <MotionInView delay={preview ? 360 : 300}>
          <SectionCard
            title="Managed storefront"
            body="This is the listing currently tied to your owner workspace."
          >
            <View style={[styles.statusPanel, styles.statusPanelSuccess]}>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Listing</Text>
                <Text style={styles.statusValue}>
                  {claimedStorefront?.displayName ?? ownerProfile.dispensaryId}
                </Text>
              </View>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Claim review</Text>
                <Text style={styles.statusValue}>
                  {formatOwnerValue(ownerClaim?.claimStatus ?? 'pending')}
                </Text>
              </View>
              {claimedStorefront ? (
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>Location</Text>
                  <Text style={styles.statusValue}>
                    {claimedStorefront.addressLine1}, {claimedStorefront.city}
                  </Text>
                </View>
              ) : null}
              <View style={styles.portalHeroMetaRow}>
                <View style={styles.metaChip}>
                  <Text style={styles.metaChipText}>
                    {ownerClaim?.claimStatus
                      ? formatOwnerValue(ownerClaim.claimStatus)
                      : 'Claim pending'}
                  </Text>
                </View>
                {claimedStorefront?.state ? (
                  <View style={styles.metaChip}>
                    <Text style={styles.metaChipText}>{claimedStorefront.state}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </SectionCard>
        </MotionInView>
      ) : null}

      {(workspace?.metrics || isWorkspaceLoading || workspaceErrorText) && ownerProfile?.dispensaryId ? (
        <MotionInView delay={preview ? 390 : 330}>
          <SectionCard
            title="Owner ROI"
            body="These are the premium owner signals that justify the paid plan: visibility, conversion, and customer action."
          >
            {isWorkspaceLoading ? (
              <Text style={styles.helperText}>Loading owner metrics...</Text>
            ) : workspaceErrorText ? (
              <Text style={styles.errorText}>{workspaceErrorText}</Text>
            ) : workspace ? (
              <View style={styles.list}>
                <View style={styles.summaryStrip}>
                  <View style={styles.summaryTile}>
                    <Text style={styles.summaryTileValue}>
                      {formatCount(workspace.metrics.storefrontImpressions7d)}
                    </Text>
                    <Text style={styles.summaryTileLabel}>Visibility 7D</Text>
                    <Text style={styles.summaryTileBody}>
                      App impressions generated for this storefront in the last week.
                    </Text>
                  </View>
                  <View style={styles.summaryTile}>
                    <Text style={styles.summaryTileValue}>{formatRate(openRate)}</Text>
                    <Text style={styles.summaryTileLabel}>Open Rate</Text>
                    <Text style={styles.summaryTileBody}>
                      Share of storefront views that turned into listing opens.
                    </Text>
                  </View>
                  <View style={styles.summaryTile}>
                    <Text style={styles.summaryTileValue}>{formatCount(totalActions7d)}</Text>
                    <Text style={styles.summaryTileLabel}>Action Intent 7D</Text>
                    <Text style={styles.summaryTileBody}>
                      Route, website, menu, and phone intent combined.
                    </Text>
                  </View>
                  <View style={styles.summaryTile}>
                    <Text style={styles.summaryTileValue}>
                      {workspace.metrics.averageRating?.toFixed(1) ?? 'New'}
                    </Text>
                    <Text style={styles.summaryTileLabel}>Trust Signal</Text>
                    <Text style={styles.summaryTileBody}>
                      Average rating with owner response quality layered in.
                    </Text>
                  </View>
                </View>

                <View style={styles.analyticsSectionCard}>
                  <View style={styles.analyticsSectionHeader}>
                    <Text style={styles.analyticsSectionEyebrow}>Visibility and discovery</Text>
                    <Text style={styles.analyticsSectionTitle}>
                      The premium listing story starts with reach, attention, and retention.
                    </Text>
                    <Text style={styles.analyticsSectionBody}>
                      These KPIs tell you how often the storefront is surfaced and whether
                      customers are staying close enough to act later.
                    </Text>
                  </View>
                  <View style={styles.metricGrid}>
                    <OwnerPortalAnalyticsCard
                        body="How often Canopy Trove surfaced this storefront across customer discovery surfaces."
                      eyebrow="Reach"
                      icon="sparkles-outline"
                      progress={getRelativeProgress(workspace.metrics.storefrontImpressions7d, visibilityMax)}
                      progressLabel="Relative visibility inside this owner KPI set"
                      stats={[
                        { label: 'Store opens', value: formatCount(workspace.metrics.storefrontOpenCount7d) },
                        { label: 'Open rate', value: formatRate(openRate) },
                      ]}
                      title="Impressions 7D"
                      tone="warm"
                      value={formatCount(workspace.metrics.storefrontImpressions7d)}
                    />
                    <OwnerPortalAnalyticsCard
                      body="Customers who opened the storefront after seeing it in the app."
                      eyebrow="Attention"
                      icon="open-outline"
                      progress={clampProgress(openRate / 100)}
                      progressLabel="View-to-open conversion"
                      stats={[
                        { label: 'From views', value: formatCount(workspace.metrics.storefrontImpressions7d) },
                        { label: 'Followers', value: formatCount(workspace.metrics.followerCount) },
                      ]}
                      title="Store Opens 7D"
                      tone="success"
                      value={formatCount(workspace.metrics.storefrontOpenCount7d)}
                    />
                    <OwnerPortalAnalyticsCard
                      body="People ready to hear when a new deal or premium placement goes live."
                      eyebrow="Retention"
                      icon="bookmark-outline"
                      progress={getRelativeProgress(workspace.metrics.followerCount, visibilityMax)}
                      progressLabel="Saved audience depth"
                      stats={[
                        { label: 'Active offers', value: formatCount(activePromotionCount) },
                        { label: 'Reviews 30D', value: formatCount(workspace.metrics.reviewCount30d) },
                      ]}
                      title="Saved Followers"
                      tone="cyan"
                      value={formatCount(workspace.metrics.followerCount)}
                    />
                    <OwnerPortalAnalyticsCard
                      body="Fresh social proof generated from active customer visits in the last month."
                      eyebrow="Proof"
                      icon="chatbubble-ellipses-outline"
                      progress={getRelativeProgress(workspace.metrics.reviewCount30d, visibilityMax)}
                      progressLabel="Recent review activity"
                      stats={[
                        {
                          label: 'Average rating',
                          value: workspace.metrics.averageRating?.toFixed(1) ?? 'New',
                        },
                        { label: 'Reply rate', value: formatRate(workspace.metrics.replyRate * 100) },
                      ]}
                      title="Reviews 30D"
                      tone="rose"
                      value={formatCount(workspace.metrics.reviewCount30d)}
                    />
                  </View>
                </View>

                <View style={styles.analyticsSectionCard}>
                  <View style={styles.analyticsSectionHeader}>
                    <Text style={styles.analyticsSectionEyebrow}>Action mix</Text>
                    <Text style={styles.analyticsSectionTitle}>
                      Customer intent is easier to scan when each action has a role.
                    </Text>
                    <Text style={styles.analyticsSectionBody}>
                      Use the mix below to see whether traffic is leaning toward navigation,
                      website exploration, menu browsing, or direct phone contact.
                    </Text>
                  </View>
                  <View style={styles.metricGrid}>
                    <OwnerPortalAnalyticsCard
                      body="Customers starting directions to visit the storefront."
                      eyebrow="Visit intent"
                      icon="navigate-outline"
                      progress={getRelativeProgress(workspace.metrics.routeStarts7d, actionMixMax)}
                      progressLabel="Share of total action mix"
                      stats={[
                        { label: 'Open to route', value: formatRate(workspace.metrics.openToRouteRate) },
                        { label: '7D total', value: formatCount(totalActions7d) },
                      ]}
                      title="Route Starts 7D"
                      tone="warm"
                      value={formatCount(workspace.metrics.routeStarts7d)}
                    />
                    <OwnerPortalAnalyticsCard
                      body="Outbound taps from the storefront into the business website."
                      eyebrow="Web intent"
                      icon="globe-outline"
                      progress={getRelativeProgress(workspace.metrics.websiteTapCount7d, actionMixMax)}
                      progressLabel="Share of total action mix"
                      stats={[
                        { label: 'Open to site', value: formatRate(workspace.metrics.openToWebsiteRate) },
                        { label: 'Store opens', value: formatCount(workspace.metrics.storefrontOpenCount7d) },
                      ]}
                      title="Website Taps 7D"
                      tone="cyan"
                      value={formatCount(workspace.metrics.websiteTapCount7d)}
                    />
                    <OwnerPortalAnalyticsCard
                      body="Shoppers choosing to inspect live menu inventory from the listing."
                      eyebrow="Menu intent"
                      icon="restaurant-outline"
                      progress={getRelativeProgress(workspace.metrics.menuTapCount7d, actionMixMax)}
                      progressLabel="Share of total action mix"
                      stats={[
                        { label: 'Open to menu', value: formatRate(workspace.metrics.openToMenuRate) },
                        { label: 'Followers', value: formatCount(workspace.metrics.followerCount) },
                      ]}
                      title="Menu Taps 7D"
                      tone="success"
                      value={formatCount(workspace.metrics.menuTapCount7d)}
                    />
                    <OwnerPortalAnalyticsCard
                      body="Customers escalating to direct phone contact from the storefront."
                      eyebrow="Direct contact"
                      icon="call-outline"
                      progress={getRelativeProgress(workspace.metrics.phoneTapCount7d, actionMixMax)}
                      progressLabel="Share of total action mix"
                      stats={[
                        { label: 'Open to phone', value: formatRate(workspace.metrics.openToPhoneRate) },
                        { label: 'Active offers', value: formatCount(activePromotionCount) },
                      ]}
                      title="Phone Taps 7D"
                      tone="rose"
                      value={formatCount(workspace.metrics.phoneTapCount7d)}
                    />
                  </View>
                </View>

                <View style={styles.analyticsSectionCard}>
                  <View style={styles.analyticsSectionHeader}>
                    <Text style={styles.analyticsSectionEyebrow}>Operator signals</Text>
                    <Text style={styles.analyticsSectionTitle}>
                      The paid side feels strongest when trust, responsiveness, and campaign energy
                      stay readable at a glance.
                    </Text>
                    <Text style={styles.analyticsSectionBody}>
                      These signals balance reputation quality, moderation load, and live offer
                      momentum without changing any underlying owner logic.
                    </Text>
                  </View>
                  <View style={styles.metricGrid}>
                    <OwnerPortalAnalyticsCard
                        body="Average customer sentiment across recent Canopy Trove reviews."
                      eyebrow="Reputation"
                      icon="star-outline"
                      progress={clampProgress((workspace.metrics.averageRating ?? 0) / 5)}
                      progressLabel="Five-star scale"
                      stats={[
                        { label: 'Reply rate', value: formatRate(workspace.metrics.replyRate * 100) },
                        { label: 'Reviews 30D', value: formatCount(workspace.metrics.reviewCount30d) },
                      ]}
                      title="Average Rating"
                      tone="warm"
                      value={workspace.metrics.averageRating?.toFixed(1) ?? 'New'}
                    />
                    <OwnerPortalAnalyticsCard
                      body="Recent reviews that already received an owner response."
                      eyebrow="Response quality"
                      icon="send-outline"
                      progress={clampProgress(workspace.metrics.replyRate)}
                      progressLabel="Replied share of recent reviews"
                      stats={[
                        { label: 'Low-rating focus', value: formatCount(workspace.recentReviews.filter((review) => review.isLowRating).length) },
                        { label: 'Open reports', value: formatCount(workspace.metrics.openReportCount) },
                      ]}
                      title="Reply Rate"
                      tone="success"
                      value={formatRate(workspace.metrics.replyRate * 100)}
                    />
                    <OwnerPortalAnalyticsCard
                      body="Moderation issues still waiting on owner follow-up."
                      eyebrow="Risk load"
                      icon="warning-outline"
                      progress={getRelativeProgress(workspace.metrics.openReportCount, responseMixMax)}
                      progressLabel="Relative moderation pressure"
                      stats={[
                        { label: 'Recent reports', value: formatCount(workspace.recentReports.length) },
                        { label: 'Recent reviews', value: formatCount(workspace.recentReviews.length) },
                      ]}
                      title="Open Reports"
                      tone="rose"
                      value={formatCount(workspace.metrics.openReportCount)}
                    />
                    <OwnerPortalAnalyticsCard
                      body="Promotions currently carrying live paid visibility or action opportunity."
                      eyebrow="Campaign pace"
                      icon="pricetags-outline"
                      progress={getRelativeProgress(activePromotionCount, responseMixMax)}
                      progressLabel="Live promotion presence"
                      stats={[
                        { label: 'Tracked offers', value: formatCount(workspace.promotionPerformance.length) },
                        { label: 'Top action', value: topPromotion ? formatRate(topPromotion.metrics.actionRate) : '0%' },
                      ]}
                      title="Active Offers"
                      tone="cyan"
                      value={formatCount(activePromotionCount)}
                    />
                  </View>
                </View>

                {topPromotion ? (
                  <>
                    <View style={styles.analyticsSpotlightCard}>
                      <View style={styles.analyticsSpotlightHeader}>
                        <View style={styles.splitHeaderCopy}>
                          <Text style={styles.sectionEyebrow}>Top offer right now</Text>
                          <Text style={styles.splitHeaderTitle}>{topPromotion.title}</Text>
                          <Text style={styles.analyticsSpotlightBody}>
                            The current leader combines the strongest action rate with the best mix
                            of visibility and downstream storefront intent.
                          </Text>
                        </View>
                        <Ionicons name="trophy-outline" size={22} color="#F5C86A" />
                      </View>
                      <Text style={styles.analyticsSpotlightValue}>
                        {formatRate(topPromotion.metrics.actionRate)}
                      </Text>
                      <View style={styles.metricProgressTrack}>
                        <View
                          style={[
                            styles.metricProgressFill,
                            styles.metricProgressFillWarm,
                            { width: `${Math.max(clampProgress(topPromotion.metrics.actionRate / 100) * 100, topPromotion.metrics.actionRate > 0 ? 12 : 0)}%` },
                          ]}
                        />
                      </View>
                      <Text style={styles.metricProgressLabel}>
                        Action rate across the current promotion set
                      </Text>
                      <View style={styles.analyticsInlineStats}>
                        <View style={styles.analyticsInlineStat}>
                          <Text style={styles.analyticsInlineStatValue}>
                            {formatCount(topPromotion.metrics.impressions)}
                          </Text>
                          <Text style={styles.analyticsInlineStatLabel}>Impressions</Text>
                        </View>
                        <View style={styles.analyticsInlineStat}>
                          <Text style={styles.analyticsInlineStatValue}>
                            {formatCount(topPromotion.metrics.opens)}
                          </Text>
                          <Text style={styles.analyticsInlineStatLabel}>Opens</Text>
                        </View>
                        <View style={styles.analyticsInlineStat}>
                          <Text style={styles.analyticsInlineStatValue}>
                            {formatCount(topPromotionTrackedActions)}
                          </Text>
                          <Text style={styles.analyticsInlineStatLabel}>Tracked Actions</Text>
                        </View>
                        <View style={styles.analyticsInlineStat}>
                          <Text style={styles.analyticsInlineStatValue}>
                            {topPromotion.status.toUpperCase()}
                          </Text>
                          <Text style={styles.analyticsInlineStatLabel}>Status</Text>
                        </View>
                      </View>
                      <Text style={styles.resultMeta}>
                        Route starts {topPromotion.metrics.redeemStarts} | Website taps{' '}
                        {topPromotion.metrics.websiteTaps} | Menu taps {topPromotion.metrics.menuTaps}{' '}
                        | Phone taps {topPromotion.metrics.phoneTaps}
                      </Text>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.emptyStateCard}>
                      <Text style={styles.emptyStateTitle}>No promotion leader yet</Text>
                      <Text style={styles.emptyStateBody}>
                        Once owner offers start receiving meaningful activity, the best-performing
                        promotion will be highlighted here for faster scanning.
                      </Text>
                    </View>
                  </>
                )}

                {workspace.patternFlags.length ? (
                  <View style={styles.analyticsSectionCard}>
                    <View style={styles.analyticsSectionHeader}>
                      <Text style={styles.analyticsSectionEyebrow}>Signals to act on</Text>
                      <Text style={styles.analyticsSectionTitle}>
                        The next owner tasks worth attention surface here first.
                      </Text>
                      <Text style={styles.analyticsSectionBody}>
                        These alerts keep moderation, promotion, and review priorities readable
                        without changing any existing decision logic.
                      </Text>
                    </View>
                    <View style={styles.list}>
                      <Text style={styles.resultTitle}>Signals to act on</Text>
                      {workspace.patternFlags.map((flag) => (
                        <View
                          key={flag.id}
                          style={[
                            styles.resultCard,
                            flag.tone === 'warning'
                              ? styles.resultWarning
                              : flag.tone === 'success'
                                ? styles.resultSuccess
                                : null,
                          ]}
                        >
                          <Text style={styles.resultTitle}>{flag.title}</Text>
                          <Text style={styles.helperText}>{flag.body}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : (
                  <View style={styles.emptyStateCard}>
                    <Text style={styles.emptyStateTitle}>No urgent owner signals</Text>
                    <Text style={styles.emptyStateBody}>
                      Review, moderation, and promotion signals are currently calm. This section
                      will surface the next issues worth acting on first.
                    </Text>
                  </View>
                )}
              </View>
            ) : null}
          </SectionCard>
        </MotionInView>
      ) : null}

      {ownerProfile?.dispensaryId ? (
        <MotionInView delay={preview ? 420 : 360}>
          <SectionCard
            title="Owner workspace tools"
            body="Manage review replies, promotion scheduling, performance, and premium profile upgrades from here."
          >
            <View style={styles.actionGrid}>
              {workspaceTools.map((item) => (
                <Pressable
                  key={item.label}
                  onPress={() =>
                    navigation.navigate(item.routeName, preview ? ({ preview: true } as never) : undefined)
                  }
                  style={styles.actionTile}
                >
                  <View style={styles.splitHeaderRow}>
                    <View style={styles.splitHeaderCopy}>
                      <Text style={styles.actionTileMeta}>Workspace tool</Text>
                      <Text style={styles.actionTileTitle}>{item.label}</Text>
                      <Text style={styles.actionTileBody}>{item.body}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#9CC5B4" />
                  </View>
                </Pressable>
              ))}
            </View>
          </SectionCard>
        </MotionInView>
      ) : null}

      {preview && claimedStorefront ? (
        <MotionInView delay={480}>
          <SectionCard
            title="Card badge editor"
            body="Stage live-looking deal badges on the claimed storefront card without changing production data."
          >
            <OwnerPortalDealBadgeEditor storefront={claimedStorefront} />
          </SectionCard>
        </MotionInView>
      ) : null}

      {preview && claimedStorefront ? (
        <MotionInView delay={540}>
          <SectionCard
            title="Multi-store demo controls"
            body="Apply temporary deal badges across preview cards to review how promotions look at scale."
          >
            <OwnerPortalDealOverridePanel claimedStorefront={claimedStorefront} />
          </SectionCard>
        </MotionInView>
      ) : null}
    </ScreenShell>
  );
}

