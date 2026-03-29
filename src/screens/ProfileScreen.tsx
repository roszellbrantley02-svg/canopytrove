import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { brand } from '../config/brand';
import { RootStackParamList } from '../navigation/RootNavigator';
import {
  AccountAccessSection,
  AccountEnvironmentSection,
  BadgeGallerySection,
  NextUnlocksSection,
  PointsPlaybookSection,
  ProfileSafetySection,
  ProfileDetailsSection,
  ProfileHeroCard,
  ProfileStatsSection,
  StorefrontCollectionSection,
  TrophyCaseSection,
} from './profile/ProfileSections';
import { useProfileScreenModel } from './profile/useProfileScreenModel';

export function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const model = useProfileScreenModel(navigation);

  return (
    <ScreenShell
      eyebrow={`${brand.productName} profile`}
      title={model.displayName}
      subtitle={`Level ${model.gamificationState.level} ${model.levelTitle} · ${model.gamificationState.totalPoints} points`}
      headerPill={model.appProfile?.kind === 'authenticated' ? 'Member' : 'Guest'}
      showHero={false}
    >
      <MotionInView delay={80}>
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

      <MotionInView delay={140}>
        <AccountAccessSection
          authSessionStatus={model.authSession.status}
          memberEmail={model.authSession.email}
          ownerPortalEnabled={model.ownerPortalPrelaunchEnabled}
          ownerPortalPreviewEnabled={model.ownerPortalPreviewEnabled}
          onOpenMemberSignIn={model.openMemberSignIn}
          onOpenMemberSignUp={model.openMemberSignUp}
          onOpenOwnerSignIn={model.openOwnerSignIn}
          onOpenOwnerPreviewPortal={model.openOwnerPortal}
          showOwnerPreview={model.showOwnerPreview}
          onDismissOwnerPreview={model.dismissOwnerPreview}
        />
      </MotionInView>

      <MotionInView delay={200}>
        <ProfileDetailsSection
          displayNameInput={model.displayNameInput}
          setDisplayNameInput={model.setDisplayNameInput}
          isSavingDisplayName={model.isSavingDisplayName}
          hasDisplayName={Boolean(model.appProfile?.displayName)}
          profileActionStatus={model.profileActionStatus}
          authSessionStatus={model.authSession.status}
          onSaveDisplayName={model.saveDisplayName}
          onClearDisplayName={model.clearDisplayName}
          onSignOut={model.signOut}
        />
      </MotionInView>

      <MotionInView delay={260}>
        <ProfileStatsSection
          totalPoints={model.gamificationState.totalPoints}
          badgeCount={model.earnedBadges.length}
          totalReviews={model.gamificationState.totalReviews}
          totalHelpfulVotes={model.gamificationState.totalHelpfulVotes}
          dispensariesVisited={model.gamificationState.dispensariesVisited}
          currentStreak={model.gamificationState.currentStreak}
        />
      </MotionInView>

      <MotionInView delay={320}>
        <ProfileSafetySection
          hasAcceptedGuidelines={model.hasAcceptedGuidelines}
          blockedAuthorCount={model.blockedAuthorCount}
          supportEmail={model.legalSupportEmail}
          onOpenLegalCenter={model.openLegalCenter}
          onOpenDeleteAccount={model.openDeleteAccount}
        />
      </MotionInView>

      <MotionInView delay={380}>
        <TrophyCaseSection featuredBadges={model.featuredBadges} />
      </MotionInView>

      <MotionInView delay={440}>
        <PointsPlaybookSection />
      </MotionInView>

      <MotionInView delay={500}>
        <BadgeGallerySection earnedBadges={model.earnedBadges} />
      </MotionInView>

      <MotionInView delay={560}>
        <NextUnlocksSection nextBadges={model.nextBadges} />
      </MotionInView>

      <MotionInView delay={620}>
        <StorefrontCollectionSection
          title="Saved storefronts"
          body={
            model.savedStorefrontIds.length
              ? 'Your favorites stay here for quick return trips.'
              : 'Save a storefront from any detail screen to build this list.'
          }
          isLoading={model.isLoadingSaved}
          storefronts={model.savedStorefronts}
          navigation={navigation}
          emptyText="No saved storefronts yet."
          iconName="chevron-forward"
        />
      </MotionInView>

      <MotionInView delay={680}>
        <StorefrontCollectionSection
          title="Recently viewed"
          body={
            model.recentStorefrontIds.length
              ? 'Jump back into the shops you opened most recently.'
              : 'Open a storefront detail screen to build a recent list.'
          }
          isLoading={model.isLoadingRecentIds || model.isLoadingRecentStorefronts}
          storefronts={model.recentStorefronts}
          navigation={navigation}
          emptyText="No recent storefronts yet."
          iconName="time-outline"
        />
      </MotionInView>

      {__DEV__ ? (
        <MotionInView delay={740}>
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
                ? `Profile storage: ${model.backendHealth.profileStorage ?? 'unknown'} · Rewards: ${model.backendHealth.gamificationStorage ?? 'unknown'}`
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
            showLoadingSeedCounts={model.storefrontSourceMode === 'api' && model.isLoadingBackendSeedStatus}
            onSeed={model.seed}
          />
        </MotionInView>
      ) : null}
    </ScreenShell>
  );
}
