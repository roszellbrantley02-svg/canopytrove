import React from 'react';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { AppUiIcon } from '../icons/AppUiIcon';
import { signOutCanopyTroveSession } from '../services/canopyTroveAuthService';

import type { RootStackParamList } from '../navigation/RootNavigator';
import { AttentionCard } from '../components/AttentionCard';
import { QuickActionsRow, type QuickAction } from '../components/QuickActionsRow';
import { OwnerPortalLicenseComplianceCard } from './ownerPortal/OwnerPortalLicenseComplianceCard';
import {
  getJourneyItems,
  getOwnerHomeDerivedMetrics,
  getOwnerStatusChips,
} from './ownerPortal/ownerPortalHomeData';
import { OwnerPortalHomeHero } from './ownerPortal/OwnerPortalHomeHero';
import { OwnerPortalHomeRoiSection } from './ownerPortal/OwnerPortalHomeRoiSection';
import { OwnerPortalStageList } from './ownerPortal/OwnerPortalStageList';
import { useOwnerPortalHomeScreenModel } from './ownerPortal/useOwnerPortalHomeScreenModel';
import { useOwnerPortalWorkspace } from './ownerPortal/useOwnerPortalWorkspace';
import { OwnerLocationSwitcher } from '../components/OwnerLocationSwitcher';
import type { OwnerPortalWorkspaceDocument } from '../types/ownerPortal';
import type { AppUiIconName } from '../icons/AppUiIcon';

type OwnerPortalHomeRoute = RouteProp<RootStackParamList, 'OwnerPortalHome'>;

function logSilentError(label: string) {
  return (error: unknown) => {
    if (__DEV__) {
      console.warn(`[OwnerPortalHome] ${label}:`, error);
    }
  };
}

interface AttentionItem {
  key: string;
  title: string;
  body: string;
  iconName: AppUiIconName;
  tone: 'warning' | 'danger' | 'info' | 'success';
}

/**
 * Compute attention items from workspace data.
 */
function getAttentionItems(workspace: OwnerPortalWorkspaceDocument | null): AttentionItem[] {
  const items: AttentionItem[] = [];

  if (!workspace) {
    return items;
  }

  // Unreplied reviews
  const unrepliedCount = workspace?.recentReviews?.filter((r) => !r.ownerReply).length ?? 0;
  if (unrepliedCount > 0) {
    items.push({
      key: 'reviews',
      title: `${unrepliedCount} reviews need replies`,
      body: 'Respond to keep engagement high.',
      iconName: 'chatbubble-ellipses-outline',
      tone: 'warning',
    });
  }

  // License compliance
  const renewalStatus = workspace?.licenseCompliance?.renewalStatus;
  if (renewalStatus === 'urgent' || renewalStatus === 'expired') {
    items.push({
      key: 'license',
      title: 'License needs attention',
      body: `Status: ${renewalStatus}`,
      iconName: 'shield-checkmark-outline',
      tone: 'danger',
    });
  }

  // Follower milestone
  const followers = workspace?.metrics?.followerCount ?? 0;
  if (followers > 0) {
    items.push({
      key: 'followers',
      title: `${followers} ${followers === 1 ? 'follower' : 'followers'}`,
      body: 'Your storefront community is growing.',
      iconName: 'people-outline',
      tone: 'success',
    });
  }

  return items;
}

function OwnerPortalHomeScreenInner() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const _route = useRoute<OwnerPortalHomeRoute>();
  const preview = false;
  const scrollViewRef = React.useRef<ScrollView>(null);
  const roiSectionY = React.useRef(0);
  const {
    accessState,
    authSession,
    claimedStorefront: _claimedStorefront,
    isLoading: _isLoading,
    ownerProfile,
  } = useOwnerPortalHomeScreenModel(preview);
  const {
    actionPlan,
    isAiLoading,
    isSaving,
    refreshActionPlan,
    saveLicenseCompliance,
    workspace,
    isLoading: isWorkspaceLoading,
    activeLocationId,
    locations,
    switchLocation,
    tierUpgradePrompt,
    dismissTierUpgradePrompt,
  } = useOwnerPortalWorkspace(preview);
  const ownerTier = workspace?.tier ?? 'verified';
  const isProTier = ownerTier === 'pro';
  const isGrowthOrAbove = ownerTier === 'growth' || ownerTier === 'pro';
  const homeMetrics = getOwnerHomeDerivedMetrics(workspace);
  const attentionItems = getAttentionItems(workspace);

  // Compute quick actions
  const quickActions: QuickAction[] = [
    {
      key: 'reviews',
      label: 'Reviews',
      iconName: 'chatbubble-ellipses-outline',
      onPress: () => {
        navigation.navigate('OwnerPortalReviewInbox', undefined);
      },
      badge: workspace?.recentReviews?.filter((r) => !r.ownerReply).length ?? 0,
    },
    {
      key: 'create-deal',
      label: 'Create Deal',
      iconName: 'megaphone-outline',
      locked: !isGrowthOrAbove,
      onPress: () => {
        if (isGrowthOrAbove) {
          navigation.navigate('OwnerPortalPromotions', undefined);
        } else {
          navigation.navigate('OwnerPortalSubscription', undefined);
        }
      },
    },
    {
      key: 'edit-listing',
      label: 'Edit Listing',
      iconName: 'storefront-outline',
      onPress: () => {
        navigation.navigate('OwnerPortalProfileTools', undefined);
      },
    },
    {
      key: 'badges',
      label: 'Badges',
      iconName: 'ribbon-outline',
      locked: !isGrowthOrAbove,
      onPress: () => {
        if (isGrowthOrAbove) {
          navigation.navigate('OwnerPortalBadges', undefined);
        } else {
          navigation.navigate('OwnerPortalSubscription', undefined);
        }
      },
    },
    {
      key: 'hours',
      label: 'Hours',
      iconName: 'time-outline',
      onPress: () => {
        navigation.navigate('OwnerPortalHours', undefined);
      },
    },
    {
      key: 'metrics',
      label: 'Metrics',
      iconName: 'stats-chart-outline',
      onPress: () => {
        scrollViewRef.current?.scrollTo({ y: roiSectionY.current, animated: true });
      },
    },
  ];

  const ownerStatusChips = getOwnerStatusChips({
    preview,
    allowlisted: accessState.allowlisted,
    ownerProfile,
  });
  const journeyItems = getJourneyItems({
    preview,
    signedIn: authSession.status === 'authenticated',
    hasBusinessDetails: Boolean(
      ownerProfile?.legalName?.trim() && ownerProfile?.companyName?.trim(),
    ),
    hasClaimedListing: Boolean(ownerProfile?.dispensaryId),
    businessVerificationStatus: ownerProfile?.businessVerificationStatus,
    identityVerificationStatus: ownerProfile?.identityVerificationStatus,
    subscriptionStatus: ownerProfile?.subscriptionStatus,
  });

  // Check if onboarding is complete
  const isOnboardingComplete = ownerProfile?.onboardingStep === 'completed';

  // Get first active promotion or null
  const activePromotion = workspace?.promotions?.find((p) => p.status === 'active') ?? null;

  return (
    <ScreenShell
      eyebrow="Owner Portal"
      title="Business dashboard"
      subtitle="Manage your listing, verification, deals, media, and billing."
      headerPill="Business"
    >
      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={localStyles.scrollContent}
      >
        {/* 1. Hero */}
        <MotionInView delay={70}>
          <OwnerPortalHomeHero
            chips={ownerStatusChips}
            managedStorefrontCount={
              locations.length > 0 ? locations.length : ownerProfile?.dispensaryId ? 1 : 0
            }
            preview={preview}
            savedFollowers={workspace?.metrics.followerCount ?? 0}
            trackedActions7d={workspace ? homeMetrics.totalActions7d : 0}
          />
        </MotionInView>

        {/* 1b. Location Switcher (multi-location Pro owners only) */}
        {locations.length > 1 ? (
          <MotionInView delay={80}>
            <OwnerLocationSwitcher
              locations={locations}
              activeLocationId={activeLocationId}
              onSelectLocation={switchLocation}
            />
          </MotionInView>
        ) : null}

        {/* 1c. Tier Upgrade Prompt */}
        {tierUpgradePrompt ? (
          <MotionInView delay={85}>
            <View style={localStyles.tierUpgradeBanner}>
              <View style={localStyles.tierUpgradeContent}>
                <AppUiIcon name="lock-closed-outline" size={20} color="#E8A000" />
                <Text style={localStyles.tierUpgradeText}>{tierUpgradePrompt.message}</Text>
              </View>
              <View style={localStyles.tierUpgradeActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => navigation.navigate('OwnerPortalSubscription', undefined)}
                  style={localStyles.upgradeButton}
                >
                  <Text style={localStyles.upgradeButtonText}>View Plans</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={dismissTierUpgradePrompt}
                  style={localStyles.dismissButton}
                >
                  <Text style={localStyles.dismissButtonText}>Dismiss</Text>
                </Pressable>
              </View>
            </View>
          </MotionInView>
        ) : null}

        {/* 2. Attention Bar - only show if there are items */}
        {attentionItems.length > 0 ? (
          <MotionInView delay={100}>
            <View style={localStyles.sectionSpaced}>
              {attentionItems.map((item) => (
                <AttentionCard
                  key={item.key}
                  title={item.title}
                  body={item.body}
                  iconName={item.iconName}
                  tone={item.tone}
                />
              ))}
            </View>
          </MotionInView>
        ) : null}

        {/* 3. Quick Actions Row */}
        {ownerProfile?.dispensaryId ? (
          <MotionInView delay={130}>
            <View style={localStyles.sectionSpaced}>
              <QuickActionsRow actions={quickActions} />
            </View>
          </MotionInView>
        ) : null}

        {/* 4. Metrics Snapshot */}
        {workspace?.metrics ? (
          <MotionInView delay={160}>
            <SectionCard title="Metrics Snapshot" body="Key performance indicators.">
              <View style={localStyles.metricsGrid}>
                <View style={localStyles.metricTile}>
                  <Text style={localStyles.metricLabel}>Followers</Text>
                  <Text style={localStyles.metricValue}>
                    {workspace?.metrics?.followerCount ?? 0}
                  </Text>
                </View>
                <View style={localStyles.metricTile}>
                  <Text style={localStyles.metricLabel}>Impressions 7d</Text>
                  <Text style={localStyles.metricValue}>{homeMetrics.totalActions7d}</Text>
                </View>
                <View style={localStyles.metricTile}>
                  <Text style={localStyles.metricLabel}>Avg Rating</Text>
                  <Text style={localStyles.metricValue}>
                    {workspace?.metrics?.averageRating?.toFixed(1) ?? 'N/A'}
                  </Text>
                </View>
              </View>
            </SectionCard>
          </MotionInView>
        ) : null}

        {/* 5. Active Promotion Section */}
        {ownerProfile?.dispensaryId ? (
          <MotionInView delay={190}>
            <SectionCard
              title="Active Promotion"
              body={activePromotion ? 'Your current deal.' : 'No active deals.'}
            >
              {activePromotion ? (
                <View style={localStyles.promotionCard}>
                  <Text style={localStyles.promotionTitle}>{activePromotion.title}</Text>
                  <Text style={localStyles.promotionBody}>{activePromotion.description}</Text>
                  <Text style={localStyles.promotionMeta}>
                    Active until{' '}
                    {activePromotion.endsAt
                      ? new Date(activePromotion.endsAt).toLocaleDateString()
                      : 'ongoing'}
                  </Text>
                </View>
              ) : isGrowthOrAbove ? (
                <View style={localStyles.emptyState}>
                  <AppUiIcon name="megaphone-outline" size={32} color="#9CC5B4" />
                  <Text style={localStyles.emptyStateText}>
                    Create your first deal to attract customers
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      navigation.navigate('OwnerPortalPromotions', undefined);
                    }}
                    style={localStyles.primaryButton}
                  >
                    <Text style={localStyles.primaryButtonText}>Create Deal</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={localStyles.lockedFeature}>
                  <AppUiIcon name="lock-closed-outline" size={24} color="#C4B8B0" />
                  <Text style={localStyles.lockedFeatureText}>
                    Deals require the Growth plan or higher.
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => navigation.navigate('OwnerPortalSubscription', undefined)}
                    style={localStyles.upgradeButton}
                  >
                    <Text style={localStyles.upgradeButtonText}>Upgrade to Growth</Text>
                  </Pressable>
                </View>
              )}
            </SectionCard>
          </MotionInView>
        ) : null}

        {/* 6. AI Insights Card */}
        {!preview && ownerProfile?.dispensaryId ? (
          <MotionInView delay={220}>
            {isProTier && actionPlan ? (
              <SectionCard title="AI Insights" body="Weekly priorities.">
                <View style={localStyles.aiCard}>
                  <View style={localStyles.aiCardHeader}>
                    <AppUiIcon name="sparkles-outline" size={20} color="#F5C86A" />
                    <Text style={localStyles.aiCardTitle}>{actionPlan.headline}</Text>
                  </View>
                  {actionPlan.priorities?.[0] ? (
                    <View style={localStyles.aiPriority}>
                      <Text style={localStyles.aiPriorityLabel}>Top priority</Text>
                      <Text style={localStyles.aiPriorityTitle}>
                        {actionPlan.priorities[0].title}
                      </Text>
                      <Text style={localStyles.aiPriorityBody}>
                        {actionPlan.priorities[0].body}
                      </Text>
                    </View>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      void refreshActionPlan().catch(logSilentError('refreshActionPlan'));
                    }}
                    style={localStyles.secondaryButton}
                    disabled={isAiLoading}
                  >
                    <Text style={localStyles.secondaryButtonText}>
                      {isAiLoading ? 'Loading...' : 'View Full Plan'}
                    </Text>
                  </Pressable>
                </View>
              </SectionCard>
            ) : !isProTier ? (
              <SectionCard title="AI Insights" body="Unlock with the Pro plan.">
                <View style={localStyles.lockedFeature}>
                  <AppUiIcon name="lock-closed-outline" size={24} color="#C4B8B0" />
                  <Text style={localStyles.lockedFeatureText}>
                    AI-powered action plans and review replies are available on the Pro plan.
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => navigation.navigate('OwnerPortalSubscription', undefined)}
                    style={localStyles.upgradeButton}
                  >
                    <Text style={localStyles.upgradeButtonText}>Upgrade to Pro</Text>
                  </Pressable>
                </View>
              </SectionCard>
            ) : null}
          </MotionInView>
        ) : null}

        {/* 7. License Compliance */}
        {ownerProfile?.dispensaryId ? (
          <MotionInView delay={250}>
            <SectionCard title="Compliance" body="License number and renewal window.">
              <OwnerPortalLicenseComplianceCard
                workspace={workspace}
                isSaving={isSaving}
                onSave={saveLicenseCompliance}
              />
            </SectionCard>
          </MotionInView>
        ) : null}

        {/* 8. ROI Section */}
        {ownerProfile?.dispensaryId && (workspace?.metrics || isWorkspaceLoading) ? (
          <View
            onLayout={(e) => {
              roiSectionY.current = e.nativeEvent.layout.y;
            }}
          >
            <MotionInView delay={280}>
              <SectionCard
                title="Owner ROI"
                body="Visibility, conversion, and customer action metrics."
              >
                <OwnerPortalHomeRoiSection
                  errorText=""
                  isLoading={isWorkspaceLoading}
                  metrics={homeMetrics}
                  workspace={workspace}
                />
              </SectionCard>
            </MotionInView>
          </View>
        ) : null}

        {/* 9. Onboarding Checklist - only if not complete */}
        {!isOnboardingComplete && ownerProfile?.dispensaryId ? (
          <MotionInView delay={310}>
            <SectionCard title="Journey" body="Your onboarding progress.">
              <OwnerPortalStageList items={journeyItems} />
            </SectionCard>
          </MotionInView>
        ) : null}

        {/* 10. Sign Out */}
        <MotionInView delay={340}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign out of owner portal"
            onPress={() => {
              Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Sign Out',
                  style: 'destructive',
                  onPress: () => {
                    void signOutCanopyTroveSession().then(() => {
                      navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
                    });
                  },
                },
              ]);
            }}
            style={localStyles.signOutButton}
          >
            <AppUiIcon name="log-out-outline" size={18} color="#C4B8B0" />
            <Text style={localStyles.signOutText}>Sign Out</Text>
          </Pressable>
        </MotionInView>
      </ScrollView>
    </ScreenShell>
  );
}

export const OwnerPortalHomeScreen = withScreenErrorBoundary(
  OwnerPortalHomeScreenInner,
  'owner-portal-home',
);

const localStyles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
  },
  sectionSpaced: {
    gap: 12,
    marginBottom: 24,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  metricTile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(46, 204, 113, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(46, 204, 113, 0.18)',
  },
  metricLabel: {
    fontSize: 11,
    color: '#C4B8B0',
    fontWeight: '500',
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFBF7',
  },
  promotionCard: {
    paddingVertical: 12,
    gap: 8,
  },
  promotionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFBF7',
  },
  promotionBody: {
    fontSize: 13,
    color: '#C4B8B0',
    lineHeight: 18,
  },
  promotionMeta: {
    fontSize: 11,
    color: '#9CC5B4',
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 12,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#C4B8B0',
    textAlign: 'center',
  },
  aiCard: {
    gap: 16,
    paddingVertical: 8,
  },
  aiCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  aiCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFBF7',
    flex: 1,
  },
  aiPriority: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(245, 200, 106, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 200, 106, 0.18)',
    gap: 6,
  },
  aiPriorityLabel: {
    fontSize: 11,
    color: '#F5C86A',
    fontWeight: '500',
  },
  aiPriorityTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFBF7',
  },
  aiPriorityBody: {
    fontSize: 12,
    color: '#C4B8B0',
    lineHeight: 16,
  },
  primaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#2ECC71',
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#9CC5B4',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#9CC5B4',
    fontSize: 13,
    fontWeight: '600',
  },
  lockedFeature: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 12,
  },
  lockedFeatureText: {
    fontSize: 13,
    color: '#C4B8B0',
    textAlign: 'center',
    lineHeight: 18,
  },
  upgradeButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#E8A000',
    alignItems: 'center',
  },
  upgradeButtonText: {
    color: '#121614',
    fontSize: 13,
    fontWeight: '700',
  },
  tierUpgradeBanner: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(232, 160, 0, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(232, 160, 0, 0.25)',
    gap: 12,
  },
  tierUpgradeContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  tierUpgradeText: {
    flex: 1,
    fontSize: 13,
    color: '#FFFBF7',
    lineHeight: 18,
  },
  tierUpgradeActions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  dismissButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  dismissButtonText: {
    color: '#C4B8B0',
    fontSize: 13,
    fontWeight: '500',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(196, 184, 176, 0.25)',
  },
  signOutText: {
    color: '#C4B8B0',
    fontSize: 14,
    fontWeight: '500',
  },
});
