import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { brand } from '../config/brand';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { motion } from '../theme/tokens';
import {
  AccountEnvironmentSection,
  ProfileAccountSection,
  ProfileEmailUpdatesSection,
  ProfileHeroCard,
  ProfileRewardsSection,
  ProfileSafetySection,
  ProfileStatsSection,
  StorefrontCollectionSection,
} from './profile/ProfileSections';
import { styles } from './profile/profileStyles';
import { useProfileScreenModel } from './profile/useProfileScreenModel';

type ProfileSurfaceSection = 'overview' | 'activity' | 'safety';

export function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const model = useProfileScreenModel(navigation);
  const [activeSection, setActiveSection] = React.useState<ProfileSurfaceSection>('overview');
  const revealDelay = React.useCallback(
    (order: number) => Math.min(order, 5) * Math.round(motion.denseSectionStagger * 0.7),
    [],
  );
  const sections: Array<{
    key: ProfileSurfaceSection;
    label: string;
    body: string;
  }> = [
    {
      key: 'overview',
      label: 'Overview',
      body: 'Account and stats.',
    },
    {
      key: 'activity',
      label: 'Activity',
      body: 'Saved, recent, rewards.',
    },
    {
      key: 'safety',
      label: 'Safety',
      body: 'Privacy and controls.',
    },
  ];

  return (
    <ScreenShell
      eyebrow={`${brand.productDisplayName} profile`}
      title={model.displayName}
      subtitle={`Level ${model.gamificationState.level} ${model.levelTitle} \u2022 ${model.gamificationState.totalPoints} points`}
      headerPill={model.appProfile?.kind === 'authenticated' ? 'Member' : 'Guest'}
      showHero={false}
    >
      <MotionInView dense delay={revealDelay(0)}>
        <ProfileHeroCard
          appProfile={model.appProfile}
          displayName={model.displayName}
          profileInitials={model.profileInitials}
          rank={model.rank}
          visitedCount={model.gamificationState.dispensariesVisited}
          joinedDays={model.joinedDays}
          level={model.gamificationState.level}
          levelTitle={model.levelTitle}
          levelProgress={model.levelProgress}
          isStartingGuestSession={model.isStartingGuestSession}
          authSessionStatus={model.authSession.status}
          onOpenLeaderboard={model.openLeaderboard}
          onStartGuestSession={model.startGuestSession}
        />
      </MotionInView>

      <MotionInView dense delay={revealDelay(1)}>
        <View style={styles.surfaceSwitcher}>
          {sections.map((section) => {
            const isActive = section.key === activeSection;

            return (
              <Pressable
                key={section.key}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={`Open ${section.label.toLowerCase()} section`}
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
          <MotionInView dense delay={revealDelay(2)}>
            <ProfileAccountSection
              displayNameInput={model.displayNameInput}
              setDisplayNameInput={model.setDisplayNameInput}
              isSavingDisplayName={model.isSavingDisplayName}
              hasDisplayName={Boolean(model.appProfile?.displayName)}
              profileActionStatus={model.profileActionStatus}
              authSessionStatus={model.authSession.status}
              memberEmail={model.authSession.email}
              ownerPortalEnabled={model.ownerPortalAccessAvailable}
              ownerPortalPreviewEnabled={model.ownerPortalPreviewEnabled}
              onSaveDisplayName={model.saveDisplayName}
              onClearDisplayName={model.clearDisplayName}
              onSignOut={model.signOut}
              onOpenMemberSignIn={model.openMemberSignIn}
              onOpenMemberSignUp={model.openMemberSignUp}
              onOpenOwnerSignIn={model.openOwnerSignIn}
              onOpenOwnerPreviewPortal={model.openOwnerPortal}
              showOwnerPreview={model.showOwnerPreview}
              onDismissOwnerPreview={model.dismissOwnerPreview}
            />
          </MotionInView>

          <MotionInView dense delay={revealDelay(3)}>
            <ProfileStatsSection
              totalPoints={model.gamificationState.totalPoints}
              badgeCount={model.earnedBadges.length}
              totalReviews={model.gamificationState.totalReviews}
              totalHelpfulVotes={model.gamificationState.totalHelpfulVotes}
              dispensariesVisited={model.gamificationState.dispensariesVisited}
              currentStreak={model.gamificationState.currentStreak}
            />
          </MotionInView>

          <MotionInView dense delay={revealDelay(4)}>
            <ProfileEmailUpdatesSection
              authSessionStatus={model.authSession.status}
              memberEmail={model.authSession.email}
              subscribed={model.emailSubscriptionStatus.subscribed}
              welcomeEmailState={model.emailSubscriptionStatus.welcomeEmailState}
              welcomeEmailSentAt={model.emailSubscriptionStatus.welcomeEmailSentAt}
              isLoading={model.isLoadingEmailSubscription}
              isSaving={model.isSavingEmailSubscription}
              actionStatus={model.emailSubscriptionActionStatus}
              onSubscribe={model.subscribeToEmailUpdates}
              onUnsubscribe={model.unsubscribeFromEmailUpdates}
            />
          </MotionInView>
        </>
      ) : null}

      {activeSection === 'activity' ? (
        <>
          <MotionInView dense delay={revealDelay(2)}>
            <StorefrontCollectionSection
              title="Saved storefronts"
              body={
                model.savedStorefrontIds.length ? 'Your pinned storefronts.' : 'Save to pin here.'
              }
              isLoading={model.isLoadingSaved}
              storefronts={model.savedStorefronts}
              navigation={navigation}
              emptyText="No saved storefronts yet."
              iconName="chevron-forward"
            />
          </MotionInView>

          <MotionInView dense delay={revealDelay(3)}>
            <StorefrontCollectionSection
              title="Recently viewed"
              body={
                model.recentStorefrontIds.length ? 'Your recent storefronts.' : 'Open to add here.'
              }
              isLoading={model.isLoadingRecentIds || model.isLoadingRecentStorefronts}
              storefronts={model.recentStorefronts}
              navigation={navigation}
              emptyText="No recent storefronts yet."
              iconName="time-outline"
            />
          </MotionInView>

          <MotionInView dense delay={revealDelay(4)}>
            <ProfileRewardsSection
              featuredBadges={model.featuredBadges}
              earnedBadges={model.earnedBadges}
              nextBadges={model.nextBadges}
            />
          </MotionInView>
        </>
      ) : null}

      {activeSection === 'safety' ? (
        <>
          <MotionInView dense delay={revealDelay(2)}>
            <ProfileSafetySection
              hasAcceptedGuidelines={model.hasAcceptedGuidelines}
              blockedAuthorCount={model.blockedAuthorCount}
              supportEmail={model.legalSupportEmail}
              onOpenLegalCenter={model.openLegalCenter}
              onOpenDeleteAccount={model.openDeleteAccount}
            />
          </MotionInView>

          {__DEV__ ? (
            <MotionInView dense delay={revealDelay(3)}>
              <AccountEnvironmentSection
                authSessionStatus={model.authSession.status}
                dataSource={model.storefrontSourceStatus.activeMode}
                backendHealthStatus={model.backendHealth.status}
                activeLocationLabel={model.activeLocationLabel}
                activeLocationMode={model.activeLocationMode}
                activeLatitude={model.activeLocation.latitude}
                activeLongitude={model.activeLocation.longitude}
                seedPayloadLabel={`${model.seedCounts.summaryCount}/${model.seedCounts.detailCount}`}
                environmentNote={
                  model.backendHealth.status === 'healthy'
                    ? `Profile storage: ${model.backendHealth.profileStorage ?? 'unknown'} - Rewards: ${model.backendHealth.gamificationStorage ?? 'unknown'}`
                    : 'Backend health is only actionable when api mode is active and reachable.'
                }
                canSeed={model.canSeed}
                isSeeding={model.isSeeding}
                seedButtonLabel={
                  model.isSeeding
                    ? model.storefrontSourceMode === 'api'
                      ? 'Seeding Backend...'
                      : 'Seeding Firebase...'
                    : model.storefrontSourceMode === 'api'
                      ? 'Seed Through Backend'
                      : 'Seed Firebase Storefronts'
                }
                seedStatus={model.seedStatus}
                showLoadingSeedCounts={
                  model.storefrontSourceMode === 'api' && model.isLoadingBackendSeedStatus
                }
                onSeed={model.seed}
                onOpenAdminRuntime={() => navigation.navigate('AdminRuntimePanel')}
              />
            </MotionInView>
          ) : null}
        </>
      ) : null}
    </ScreenShell>
  );
}
