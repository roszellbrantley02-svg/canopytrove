import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { DimensionValue } from 'react-native';
import { SectionCard } from '../../components/SectionCard';
import type { AppUiIconName } from '../../icons/AppUiIcon';
import { AppUiIcon } from '../../icons/AppUiIcon';
import { colors } from '../../theme/tokens';
import type {
  GamificationBadgeDefinition,
  GamificationLeaderboardEntry,
  GamificationLeaderboardResponse,
} from '../../types/storefront';
import { getPublicDisplayName } from '../profile/profileUtils';
import { styles } from './leaderboardStyles';

export function LeaderboardHeaderRow({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.topRow}>
      <Pressable
        onPress={onBack}
        style={styles.headerBadge}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        accessibilityHint="Returns to the previous screen."
      >
        <AppUiIcon name="arrow-back" size={16} color={colors.text} />
        <Text style={styles.headerBadgeText}>Back</Text>
      </Pressable>
      <View style={styles.headerBadge}>
        <AppUiIcon name="shield-checkmark-outline" size={14} color={colors.textSoft} />
        <Text style={styles.headerBadgeText}>Live</Text>
      </View>
    </View>
  );
}

export function LeaderboardStandingsSection({
  rank,
  totalPoints,
  level,
  levelTitle,
  badgeCount,
  helperText,
}: {
  rank: number;
  totalPoints: number;
  level: number;
  levelTitle: string;
  badgeCount: number;
  helperText: string;
}) {
  return (
    <SectionCard
      eyebrow="Member profile"
      badgeLabel={levelTitle}
      iconName="trophy-outline"
      tone="gold"
      title="Your standings"
      body="This view uses the same profile activity state as visits, reviews, badges, and long-term progress."
    >
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>#{rank}</Text>
          <Text style={styles.statLabel}>Rank</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{totalPoints}</Text>
          <Text style={styles.statLabel}>Activity</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>Lv {level}</Text>
          <Text style={styles.statLabel}>{levelTitle}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{badgeCount}</Text>
          <Text style={styles.statLabel}>Badges</Text>
        </View>
      </View>
      <Text style={styles.helperText}>{helperText}</Text>
    </SectionCard>
  );
}

export function LeaderboardProgressSection({
  level,
  levelTitle,
  levelProgressWidth,
  pointsToNextLevel,
}: {
  level: number;
  levelTitle: string;
  levelProgressWidth: DimensionValue;
  pointsToNextLevel: number;
}) {
  return (
    <SectionCard
      eyebrow="Level track"
      badgeLabel={pointsToNextLevel > 0 ? `${pointsToNextLevel} to go` : 'Current band maxed'}
      iconName="stats-chart-outline"
      tone="primary"
      title="Profile progress"
      body="Levels, activity totals, and badge unlocks live in one shared profile track."
    >
      <View style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>Level {level}</Text>
          <Text style={styles.progressSubtitle}>{levelTitle}</Text>
        </View>
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: levelProgressWidth }]} />
        </View>
        <Text style={styles.progressCaption}>
          {pointsToNextLevel > 0
            ? `${pointsToNextLevel} activity points to the next level`
            : 'Top of the current level band'}
        </Text>
      </View>
    </SectionCard>
  );
}

export function LeaderboardEarnedBadgesSection({
  earnedBadges,
}: {
  earnedBadges: readonly GamificationBadgeDefinition[];
}) {
  return (
    <SectionCard
      eyebrow="Earned rewards"
      badgeLabel={earnedBadges.length ? `${earnedBadges.length} unlocked` : 'No unlocks yet'}
      iconName="ribbon-outline"
      tone="primary"
      title="Unlocked badges"
      body={
        earnedBadges.length
          ? 'These are already earned on this Canopy Trove profile.'
          : 'No badges earned yet. Reviews, visits, and useful community activity will unlock them over time.'
      }
    >
      {earnedBadges.length ? (
        <View style={styles.badgeGrid}>
          {earnedBadges.map((badge) => (
            <View key={badge.id} style={styles.badgeCard}>
              <View style={[styles.badgeIconWrap, { backgroundColor: badge.color }]}>
                <AppUiIcon name={badge.icon as AppUiIconName} size={18} color={colors.background} />
              </View>
              <Text style={styles.badgeName}>{badge.name}</Text>
              <Text style={styles.badgeCategory}>{badge.category}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.helperText}>
          Badge unlocks will appear here as this profile accumulates milestones.
        </Text>
      )}
    </SectionCard>
  );
}

export function LeaderboardTargetsSection({
  lockedBadges,
}: {
  lockedBadges: readonly GamificationBadgeDefinition[];
}) {
  return (
    <SectionCard
      eyebrow="Next targets"
      badgeLabel={
        lockedBadges.length
          ? `${Math.min(6, lockedBadges.length)} showing`
          : 'No pending milestones'
      }
      iconName="sparkles-outline"
      tone="cyan"
      title="Next badge milestones"
      body="Locked milestones stay visible so the next useful unlocks are easy to understand."
    >
      <View style={styles.badgeGrid}>
        {lockedBadges.slice(0, 6).map((badge) => (
          <View key={badge.id} style={[styles.badgeCard, styles.badgeCardLocked]}>
            <View style={[styles.badgeIconWrap, styles.badgeIconWrapLocked]}>
              <AppUiIcon name={badge.icon as AppUiIconName} size={18} color={colors.textMuted} />
            </View>
            <Text style={styles.badgeName}>{badge.name}</Text>
            <Text style={styles.badgeDescription}>{badge.description}</Text>
          </View>
        ))}
      </View>
    </SectionCard>
  );
}

function LeaderboardEntryCard({
  entry,
  isCurrent,
}: {
  entry: GamificationLeaderboardEntry;
  isCurrent: boolean;
}) {
  return (
    <View style={[styles.entryCard, isCurrent && styles.entryCardCurrent]}>
      <View style={styles.rankBlock}>
        <Text style={styles.rankValue}>#{entry.rank}</Text>
      </View>
      <View style={styles.entryMain}>
        <Text style={styles.entryName}>
          {getPublicDisplayName(entry.displayName, entry.profileId)}
        </Text>
        <Text style={styles.entryMeta}>
          {`${entry.profileKind === 'authenticated' ? 'Member' : 'Anonymous'} - ${entry.totalReviews} reviews - ${entry.badgeCount} badges`}
        </Text>
      </View>
      <View style={styles.entryStats}>
        <Text style={styles.entryPoints}>{entry.totalPoints}</Text>
        <Text style={styles.entryPointsLabel}>Activity</Text>
      </View>
    </View>
  );
}

export function LeaderboardEntriesSection({
  leaderboard,
  isLoading,
  currentProfileId,
}: {
  leaderboard: GamificationLeaderboardResponse;
  isLoading: boolean;
  currentProfileId: string;
}) {
  return (
    <SectionCard
      eyebrow="Community activity"
      badgeLabel={isLoading ? 'Refreshing' : leaderboard.items.length ? 'Live ranks' : 'Waiting'}
      iconName="people-outline"
      tone="gold"
      title="Top profile activity"
      body={
        isLoading
          ? 'Loading standings...'
          : leaderboard.items.length
            ? 'All-time rankings from persisted profile activity state.'
            : 'No standings yet.'
      }
    >
      {leaderboard.items.length ? (
        <ScrollView
          horizontal={false}
          scrollEnabled={false}
          contentContainerStyle={styles.leaderboardList}
        >
          {leaderboard.items.map((entry) => (
            <LeaderboardEntryCard
              key={entry.profileId}
              entry={entry}
              isCurrent={entry.profileId === currentProfileId}
            />
          ))}
        </ScrollView>
      ) : (
        <Text style={styles.helperText}>
          Standings will appear here as Canopy Trove profiles accumulate activity.
        </Text>
      )}
    </SectionCard>
  );
}
