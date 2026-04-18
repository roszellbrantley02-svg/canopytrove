import React from 'react';
import type { DimensionValue } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import {
  useGamificationLeaderboard,
  useGamificationLeaderboardRank,
} from '../hooks/useGamificationData';
import {
  useStorefrontProfileController,
  useStorefrontRewardsController,
} from '../context/StorefrontController';
import type { RootStackParamList } from '../navigation/RootNavigator';
import {
  LeaderboardEarnedBadgesSection,
  LeaderboardEntriesSection,
  LeaderboardHeaderRow,
  LeaderboardProgressSection,
  LeaderboardStandingsSection,
  LeaderboardTargetsSection,
} from './leaderboard/LeaderboardSections';

type LeaderboardRoute = RouteProp<RootStackParamList, 'Leaderboard'>;

const PAGE_SIZE = 20;

function LeaderboardScreenInner() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<LeaderboardRoute>();
  const { highlightProfileId } = route.params ?? {};
  const { appProfile, profileId } = useStorefrontProfileController();
  const { badgeDefinitions, gamificationState, levelTitle } = useStorefrontRewardsController();
  const { data: leaderboard, isLoading } = useGamificationLeaderboard(PAGE_SIZE, 0);
  const { data: rankData } = useGamificationLeaderboardRank();
  const currentProfileId = highlightProfileId ?? profileId;
  const earnedBadgeIds = React.useMemo(
    () => new Set(gamificationState.badges),
    [gamificationState.badges],
  );
  const earnedBadges = React.useMemo(
    () => badgeDefinitions.filter((badge) => earnedBadgeIds.has(badge.id)),
    [badgeDefinitions, earnedBadgeIds],
  );
  const lockedBadges = React.useMemo(
    () => badgeDefinitions.filter((badge) => !earnedBadgeIds.has(badge.id)),
    [badgeDefinitions, earnedBadgeIds],
  );
  const pointsToNextLevel = Math.max(
    0,
    gamificationState.nextLevelPoints - gamificationState.totalPoints,
  );
  const levelProgress = gamificationState.nextLevelPoints
    ? Math.min(1, gamificationState.totalPoints / gamificationState.nextLevelPoints)
    : 1;
  const helperText = appProfile?.displayName
    ? `Signed in as ${appProfile.displayName}`
    : 'Anonymous profile rankings stay tied to this Canopy Trove install until full account ownership is turned on.';
  const resolvedRank = Math.max(rankData.rank, currentProfileId ? 1 : 0);
  const levelProgressWidth: DimensionValue = `${Math.max(6, levelProgress * 100)}%`;

  return (
    <ScreenShell
      eyebrow="Progress"
      title="Community standings."
      subtitle="See how your profile activity compares across reviews, visits, and long-term progress signals."
      headerPill="Standings"
    >
      <MotionInView delay={100}>
        <LeaderboardHeaderRow onBack={() => navigation.goBack()} />
      </MotionInView>

      <MotionInView delay={160}>
        <LeaderboardStandingsSection
          rank={resolvedRank}
          totalPoints={gamificationState.totalPoints}
          level={gamificationState.level}
          levelTitle={levelTitle}
          badgeCount={gamificationState.badges.length}
          helperText={helperText}
        />
      </MotionInView>

      <MotionInView delay={220}>
        <LeaderboardProgressSection
          level={gamificationState.level}
          levelTitle={levelTitle}
          levelProgressWidth={levelProgressWidth}
          pointsToNextLevel={pointsToNextLevel}
        />
      </MotionInView>

      <MotionInView delay={280}>
        <LeaderboardEarnedBadgesSection earnedBadges={earnedBadges} />
      </MotionInView>

      <MotionInView delay={340}>
        <LeaderboardTargetsSection lockedBadges={lockedBadges} />
      </MotionInView>

      <MotionInView delay={400}>
        <LeaderboardEntriesSection
          leaderboard={leaderboard}
          isLoading={isLoading}
          currentProfileId={currentProfileId}
        />
      </MotionInView>
    </ScreenShell>
  );
}

export const LeaderboardScreen = withScreenErrorBoundary(
  LeaderboardScreenInner,
  'leaderboard-screen',
);
