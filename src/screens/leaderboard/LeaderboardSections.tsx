import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { DimensionValue } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SectionCard } from '../../components/SectionCard';
import { colors } from '../../theme/tokens';
import {
  GamificationBadgeDefinition,
  GamificationLeaderboardEntry,
  GamificationLeaderboardResponse,
} from '../../types/storefront';
import { styles } from './leaderboardStyles';

export function LeaderboardHeaderRow({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.topRow}>
      <Pressable onPress={onBack} style={styles.headerBadge}>
        <Ionicons name="arrow-back" size={16} color={colors.text} />
        <Text style={styles.headerBadgeText}>Back</Text>
      </Pressable>
      <View style={styles.headerBadge}>
        <Ionicons name="trophy-outline" size={14} color={colors.warning} />
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
      title="Your standings"
      body="This uses the same profile-scoped rewards state as visits, badges, and progression."
    >
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>#{rank}</Text>
          <Text style={styles.statLabel}>Rank</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{totalPoints}</Text>
          <Text style={styles.statLabel}>Points</Text>
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
      title="Progression"
      body="Levels, points, and badge unlocks now live in one shared rewards track."
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
            ? `${pointsToNextLevel} points to the next level`
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
      title="Unlocked badges"
      body={
        earnedBadges.length
          ? 'These are already earned on this Canopy Trove profile.'
          : 'No badges earned yet. Reviews, visits, and future photo/community flows will unlock them.'
      }
    >
      {earnedBadges.length ? (
        <View style={styles.badgeGrid}>
          {earnedBadges.map((badge) => (
            <View key={badge.id} style={styles.badgeCard}>
              <View style={[styles.badgeIconWrap, { backgroundColor: badge.color }]}>
                <Ionicons
                  name={badge.icon as keyof typeof Ionicons.glyphMap}
                  size={18}
                  color={colors.background}
                />
              </View>
              <Text style={styles.badgeName}>{badge.name}</Text>
              <Text style={styles.badgeCategory}>{badge.category}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.helperText}>
          Badge unlocks will appear here as this profile accumulates points and milestones.
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
      title="Next badge targets"
      body="Locked achievements are still visible so the progression path is clear."
    >
      <View style={styles.badgeGrid}>
        {lockedBadges.slice(0, 6).map((badge) => (
          <View key={badge.id} style={[styles.badgeCard, styles.badgeCardLocked]}>
            <View style={[styles.badgeIconWrap, styles.badgeIconWrapLocked]}>
              <Ionicons
                name={badge.icon as keyof typeof Ionicons.glyphMap}
                size={18}
                color={colors.textMuted}
              />
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
          {entry.displayName || `Canopy Trove ${entry.profileId.slice(-6)}`}
        </Text>
        <Text style={styles.entryMeta}>
          {`${entry.profileKind === 'authenticated' ? 'Member' : 'Anonymous'} - ${entry.totalReviews} reviews - ${entry.badgeCount} badges`}
        </Text>
      </View>
      <View style={styles.entryStats}>
        <Text style={styles.entryPoints}>{entry.totalPoints}</Text>
        <Text style={styles.entryPointsLabel}>Points</Text>
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
      title="Top Canopy Trove profiles"
      body={
        isLoading
          ? 'Loading leaderboard...'
          : leaderboard.items.length
            ? 'All-time rankings from persisted rewards state.'
            : 'No leaderboard entries yet.'
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
          Leaderboard data will appear here as Canopy Trove profiles start earning rewards.
        </Text>
      )}
    </SectionCard>
  );
}
