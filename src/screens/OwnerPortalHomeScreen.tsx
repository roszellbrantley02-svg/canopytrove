import React from 'react';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, Text, View } from 'react-native';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { AppUiIcon } from '../icons/AppUiIcon';
import { ownerPortalPreviewEnabled } from '../config/ownerPortalConfig';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { OwnerPortalDealBadgeEditor } from './ownerPortal/OwnerPortalDealBadgeEditor';
import { OwnerPortalDealOverridePanel } from './ownerPortal/OwnerPortalDealOverridePanel';
import { OwnerPortalLicenseComplianceCard } from './ownerPortal/OwnerPortalLicenseComplianceCard';
import {
  formatOwnerValue,
  getJourneyItems,
  getOwnerHomeDerivedMetrics,
  getOwnerStatusChips,
  getProfileSummaryTiles,
  getRuntimeStatusMessage,
  getRuntimeStatusTone,
} from './ownerPortal/ownerPortalHomeData';
import { OwnerPortalHomeHero } from './ownerPortal/OwnerPortalHomeHero';
import { OwnerPortalHomeProfileSection } from './ownerPortal/OwnerPortalHomeProfileSection';
import { OwnerPortalHomeRoiSection } from './ownerPortal/OwnerPortalHomeRoiSection';
import { OwnerPortalStageList } from './ownerPortal/OwnerPortalStageList';
import { ownerPortalStyles as styles } from './ownerPortal/ownerPortalStyles';
import { useOwnerPortalHomeScreenModel } from './ownerPortal/useOwnerPortalHomeScreenModel';
import { useOwnerPortalWorkspace } from './ownerPortal/useOwnerPortalWorkspace';

type OwnerPortalHomeRoute = RouteProp<RootStackParamList, 'OwnerPortalHome'>;
type OwnerPortalSurfaceSection = 'overview' | 'workspace' | 'setup';

const ignoreAsyncError = () => undefined;

export function OwnerPortalHomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<OwnerPortalHomeRoute>();
  const preview = ownerPortalPreviewEnabled && Boolean(route.params?.preview);
  const [activeSection, setActiveSection] = React.useState<OwnerPortalSurfaceSection>(
    preview ? 'workspace' : 'overview',
  );
  const {
    accessState,
    isCheckingAccess,
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
    actionPlan,
    aiErrorText,
    isAiLoading,
    isSaving,
    refreshActionPlan,
    runtimeStatus,
    saveLicenseCompliance,
    workspace,
    isLoading: isWorkspaceLoading,
    errorText: workspaceErrorText,
  } = useOwnerPortalWorkspace(preview);
  const homeMetrics = getOwnerHomeDerivedMetrics(workspace);

  const previewRoutes = [
    {
      label: 'Business Details',
      body: 'Review business profile and company information.',
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
      body: 'Walk through the storefront claim flow.',
      routeName: 'OwnerPortalClaimListing' as const,
      params: { preview: true },
    },
    {
      label: 'Business Verification',
      body: 'Review the business verification step.',
      routeName: 'OwnerPortalBusinessVerification' as const,
      params: { preview: true },
    },
    {
      label: 'Identity Verification',
      body: 'Review the identity verification step.',
      routeName: 'OwnerPortalIdentityVerification' as const,
      params: { preview: true },
    },
    {
      label: 'Subscription',
      body: 'Review the premium plan experience.',
      routeName: 'OwnerPortalSubscription' as const,
      params: { preview: true },
    },
  ];
  const workspaceTools = [
    {
      label: 'Review Management',
      body: 'Reply faster and track low-rating trends.',
      routeName: 'OwnerPortalReviewInbox' as const,
    },
    {
      label: 'Promotions And Results',
      body: 'Schedule offers and compare deal performance.',
      routeName: 'OwnerPortalPromotions' as const,
    },
    {
      label: 'Profile Conversion Tools',
      body: 'Upgrade storefront card with premium photos and copy.',
      routeName: 'OwnerPortalProfileTools' as const,
    },
  ];
  const ownerStatusChips = getOwnerStatusChips({
    preview,
    allowlisted: accessState.allowlisted,
    ownerProfile,
  });
  const profileSummaryTiles = getProfileSummaryTiles(ownerProfile);
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
  const runtimeStatusMessage = getRuntimeStatusMessage(runtimeStatus);
  const runtimeStatusTone = getRuntimeStatusTone(runtimeStatus);
  const sections: Array<{
    key: OwnerPortalSurfaceSection;
    label: string;
    body: string;
  }> = [
    {
      key: 'overview',
      label: 'Overview',
      body: 'Access and listing status.',
    },
    {
      key: 'workspace',
      label: 'Workspace',
      body: 'Deals, compliance, and media.',
    },
    {
      key: 'setup',
      label: 'Setup',
      body: 'Setup and preview tools.',
    },
  ];

  return (
    <ScreenShell
      eyebrow="Owner Portal"
      title={preview ? 'Demo mode' : 'Business dashboard'}
      subtitle={
        preview
          ? 'Explore business tools with sample data. For internal use only.'
          : 'Manage your listing, verification, deals, media, and billing.'
      }
      headerPill={preview ? 'Demo' : 'Business'}
    >
      <MotionInView delay={70}>
        <OwnerPortalHomeHero
          chips={ownerStatusChips}
          managedStorefrontCount={ownerProfile?.dispensaryId ? 1 : 0}
          preview={preview}
          savedFollowers={workspace?.metrics.followerCount ?? (preview ? 214 : 0)}
          trackedActions7d={workspace ? homeMetrics.totalActions7d : preview ? 62 : 0}
        />
      </MotionInView>

      <MotionInView delay={120}>
        <View style={styles.surfaceSwitcher}>
          {sections.map((section) => {
            const isActive = section.key === activeSection;

            return (
              <Pressable
                key={section.key}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={`Open ${section.label.toLowerCase()} owner section`}
                onPress={() => setActiveSection(section.key)}
                style={[
                  styles.surfaceSwitcherButton,
                  isActive && styles.surfaceSwitcherButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.surfaceSwitcherButtonLabel,
                    isActive && styles.surfaceSwitcherButtonLabelActive,
                  ]}
                >
                  {section.label}
                </Text>
                <Text
                  style={[
                    styles.surfaceSwitcherButtonBody,
                    isActive && styles.surfaceSwitcherButtonBodyActive,
                  ]}
                >
                  {section.body}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </MotionInView>

      {activeSection === 'overview' ? (
        <>
          <MotionInView delay={150}>
            <SectionCard
              title={preview ? 'Preview workspace' : 'Access'}
              body={
                preview
                  ? 'Review owner access safely.'
                  : accessState.enabled
                    ? 'Access controlled.'
                    : 'Owner access is open for this workspace.'
              }
            >
              <View
                style={[
                  styles.statusPanel,
                  preview ? styles.statusPanelWarm : styles.statusPanelSuccess,
                ]}
              >
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>Email</Text>
                  <Text style={styles.statusValue}>
                    {preview ? 'preview@canopytrove.com' : (authSession.email ?? 'Not signed in')}
                  </Text>
                </View>
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>{preview ? 'Workspace' : 'Account'}</Text>
                  <Text style={styles.statusValue}>
                    {preview
                      ? 'Preview data'
                      : authSession.status === 'authenticated'
                        ? 'Signed in'
                        : 'Not signed in'}
                  </Text>
                </View>
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>Access</Text>
                  <Text style={styles.statusValue}>
                    {preview
                      ? 'Preview access'
                      : isCheckingAccess
                        ? 'Checking'
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
                      {preview ? 'Demo mode' : 'Business portal'}
                    </Text>
                  </View>
                  <View style={styles.metaChip}>
                    <Text style={styles.metaChipText}>
                      {accessState.enabled ? 'Access controls enabled' : 'Owner access open'}
                    </Text>
                  </View>
                </View>
              </View>
            </SectionCard>
          </MotionInView>

          <MotionInView delay={180}>
            <SectionCard
              title="Business account"
              body="Onboarding, verification, listing, and subscription."
            >
              <OwnerPortalHomeProfileSection
                errorText={errorText}
                isLoading={isLoading}
                ownerProfile={ownerProfile}
                profileSummaryTiles={profileSummaryTiles}
              />
            </SectionCard>
          </MotionInView>

          {authSession.uid && ownerProfile && nextStep ? (
            <MotionInView delay={210}>
              <SectionCard title="Next step" body="Resume your progress.">
                <View style={styles.ctaPanel}>
                  <View style={styles.splitHeaderRow}>
                    <View style={styles.splitHeaderCopy}>
                      <Text style={styles.sectionEyebrow}>Continue setup</Text>
                      <Text style={styles.splitHeaderTitle}>{nextStep.title}</Text>
                      <Text style={styles.splitHeaderBody}>{nextStep.body}</Text>
                    </View>
                    <AppUiIcon name="sparkles-outline" size={20} color="#F5C86A" />
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={nextStep.actionLabel}
                    accessibilityHint="Opens the next owner onboarding step."
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
            <MotionInView delay={240}>
              <SectionCard title="Managed storefront" body="Your claimed listing.">
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
        </>
      ) : null}

      {activeSection === 'workspace' ? (
        <>
          {ownerProfile?.dispensaryId ? (
            <MotionInView delay={150}>
              <SectionCard
                title="Owner workspace tools"
                body="Manage reviews, promotions, and profile upgrades."
              >
                <View style={styles.actionGrid}>
                  {workspaceTools.map((item) => (
                    <Pressable
                      key={item.label}
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${item.label}`}
                      accessibilityHint={item.body}
                      onPress={() =>
                        navigation.navigate(
                          item.routeName,
                          preview ? ({ preview: true } as never) : undefined,
                        )
                      }
                      style={styles.actionTile}
                    >
                      <View style={styles.splitHeaderRow}>
                        <View style={styles.splitHeaderCopy}>
                          <Text style={styles.actionTileMeta}>Workspace tool</Text>
                          <Text style={styles.actionTileTitle}>{item.label}</Text>
                          <Text style={styles.actionTileBody}>{item.body}</Text>
                        </View>
                        <AppUiIcon name="chevron-forward" size={20} color="#9CC5B4" />
                      </View>
                    </Pressable>
                  ))}
                </View>
              </SectionCard>
            </MotionInView>
          ) : null}

          <MotionInView delay={180}>
            <SectionCard title="Compliance" body="License number and renewal window.">
              <OwnerPortalLicenseComplianceCard
                workspace={workspace}
                isSaving={isSaving}
                onSave={saveLicenseCompliance}
              />
            </SectionCard>
          </MotionInView>

          <MotionInView delay={210}>
            <SectionCard title="System status" body="Operations health and recommendations.">
              <View
                style={[
                  styles.statusPanel,
                  runtimeStatusTone === 'success'
                    ? styles.statusPanelSuccess
                    : styles.statusPanelWarm,
                ]}
              >
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>Runtime mode</Text>
                  <Text style={styles.statusValue}>
                    {runtimeStatus?.policy.safeModeEnabled ? 'Protected mode' : 'Normal'}
                  </Text>
                </View>
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>Critical incidents 24H</Text>
                  <Text style={styles.statusValue}>
                    {runtimeStatus?.incidentCounts.criticalLast24Hours ?? 0}
                  </Text>
                </View>
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>Client incidents 24H</Text>
                  <Text style={styles.statusValue}>
                    {runtimeStatus?.incidentCounts.clientLast24Hours ?? 0}
                  </Text>
                </View>
                <Text style={styles.helperText}>{runtimeStatusMessage}</Text>
              </View>

              {!preview ? (
                <View style={styles.sectionStack}>
                  <View style={styles.plannerPanel}>
                    <View style={styles.splitHeaderRow}>
                      <View style={styles.splitHeaderCopy}>
                        <Text style={styles.sectionEyebrow}>Recommendations</Text>
                        <Text style={styles.splitHeaderTitle}>Weekly priorities</Text>
                        <Text style={styles.splitHeaderBody}>
                          AI-generated next actions for your storefront.
                        </Text>
                      </View>
                      <AppUiIcon name="sparkles-outline" size={20} color="#F5C86A" />
                    </View>
                    {aiErrorText ? <Text style={styles.errorText}>{aiErrorText}</Text> : null}
                    {actionPlan ? (
                      <View style={styles.cardStack}>
                        <View style={styles.actionTile}>
                          <Text style={styles.actionTileMeta}>This week</Text>
                          <Text style={styles.actionTileTitle}>{actionPlan.headline}</Text>
                          <Text style={styles.actionTileBody}>{actionPlan.summary}</Text>
                        </View>
                        {actionPlan.priorities.map((priority) => (
                          <View
                            key={priority.title}
                            style={[
                              styles.actionTile,
                              priority.tone === 'warning'
                                ? styles.resultWarning
                                : priority.tone === 'success'
                                  ? styles.resultSuccess
                                  : null,
                            ]}
                          >
                            <Text style={styles.actionTileMeta}>Priority</Text>
                            <Text style={styles.actionTileTitle}>{priority.title}</Text>
                            <Text style={styles.actionTileBody}>{priority.body}</Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.helperText}>
                        {isAiLoading
                          ? 'Generating the current owner action plan...'
                          : 'Load the current owner action plan once the workspace is ready.'}
                      </Text>
                    )}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Refresh AI action plan"
                      accessibilityHint="Generates a fresh owner action plan from the current workspace state."
                      disabled={isAiLoading}
                      onPress={() => {
                        void refreshActionPlan().catch(ignoreAsyncError);
                      }}
                      style={[styles.secondaryButton, isAiLoading && styles.buttonDisabled]}
                    >
                      <Text style={styles.secondaryButtonText}>
                        {isAiLoading ? 'Refreshing...' : 'Refresh AI Action Plan'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </SectionCard>
          </MotionInView>

          {(workspace?.metrics || isWorkspaceLoading || workspaceErrorText) &&
          ownerProfile?.dispensaryId ? (
            <MotionInView delay={240}>
              <SectionCard
                title="Owner ROI"
                body="Visibility, conversion, and customer action metrics."
              >
                <OwnerPortalHomeRoiSection
                  errorText={workspaceErrorText}
                  isLoading={isWorkspaceLoading}
                  metrics={homeMetrics}
                  workspace={workspace}
                />
              </SectionCard>
            </MotionInView>
          ) : null}

          {preview && claimedStorefront ? (
            <MotionInView delay={270}>
              <SectionCard
                title="Card badge editor"
                body="Stage deal badges on the storefront card."
              >
                <OwnerPortalDealBadgeEditor storefront={claimedStorefront} />
              </SectionCard>
            </MotionInView>
          ) : null}

          {preview && claimedStorefront ? (
            <MotionInView delay={300}>
              <SectionCard
                title="Multi-store preview controls"
                body="Review deal badges across preview cards."
              >
                <OwnerPortalDealOverridePanel claimedStorefront={claimedStorefront} />
              </SectionCard>
            </MotionInView>
          ) : null}
        </>
      ) : null}

      {activeSection === 'setup' ? (
        <>
          <MotionInView delay={150}>
            <SectionCard title="Journey" body="Your onboarding progress.">
              <OwnerPortalStageList items={journeyItems} />
            </SectionCard>
          </MotionInView>

          {preview ? (
            <MotionInView delay={180}>
              <SectionCard
                title="Explore every owner page"
                body="Walk through each step with preview data."
              >
                <View style={styles.actionGrid}>
                  {previewRoutes.map((item) => (
                    <Pressable
                      key={item.label}
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${item.label}`}
                      accessibilityHint={item.body}
                      onPress={() => navigation.navigate(item.routeName, item.params as never)}
                      style={[styles.actionTile, styles.actionTileWarm]}
                    >
                      <View style={styles.splitHeaderRow}>
                        <View style={styles.splitHeaderCopy}>
                          <Text style={styles.actionTileMeta}>Preview route</Text>
                          <Text style={styles.actionTileTitle}>{item.label}</Text>
                          <Text style={styles.actionTileBody}>{item.body}</Text>
                        </View>
                        <AppUiIcon name="arrow-forward-circle-outline" size={20} color="#F5C86A" />
                      </View>
                    </Pressable>
                  ))}
                </View>
              </SectionCard>
            </MotionInView>
          ) : null}
        </>
      ) : null}
    </ScreenShell>
  );
}
