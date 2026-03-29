import React from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AppIconStatCard } from '../../components/AppIconStatCard';
import { SectionCard } from '../../components/SectionCard';
import {
  BadgeIcon,
  FireIcon,
  LocationPinIcon,
  ReviewIcon,
  StarIcon,
  TrophyIcon,
} from '../../icons/AppIcons';
import { brand } from '../../config/brand';
import { colors } from '../../theme/tokens';
import { AppProfile } from '../../types/storefront';
import { styles } from './profileStyles';

export function ProfileHeroCard({
  appProfile,
  displayName,
  profileInitials,
  rank,
  visitedCount,
  joinedDays,
  level,
  levelTitle,
  levelProgress,
  isStartingGuestSession,
  authSessionStatus,
  onOpenLeaderboard,
  onStartGuestSession,
}: {
  appProfile: AppProfile | null;
  displayName: string;
  profileInitials: string;
  rank: number;
  visitedCount: number;
  joinedDays: number;
  level: number;
  levelTitle: string;
  levelProgress: { progress: number; pointsToNext: number };
  isStartingGuestSession: boolean;
  authSessionStatus: string;
  onOpenLeaderboard: () => void;
  onStartGuestSession: () => void;
}) {
  const heroMetaParts = [
    rank > 0 ? `Rank #${rank}` : null,
    `${visitedCount} shops visited`,
    `${joinedDays} days on ${brand.productName}`,
  ].filter(Boolean) as string[];
  const heroHighlights = [
    { label: 'Rank', value: rank > 0 ? `#${rank}` : 'New' },
    { label: 'Visited', value: String(visitedCount) },
    { label: 'Member span', value: joinedDays > 0 ? `${joinedDays}d` : 'Today' },
  ];

  return (
    <LinearGradient
      colors={['rgba(17, 31, 38, 0.98)', 'rgba(8, 14, 19, 0.94)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.heroCard}
    >
      <View pointerEvents="none" style={styles.heroGlow} />
      <View style={styles.heroTopRow}>
        <View style={styles.avatarWrap}>
          <Text style={styles.avatarText}>{profileInitials}</Text>
        </View>
        <View style={styles.heroBody}>
          <View style={styles.heroTitleRow}>
            <Text style={styles.heroName}>{displayName}</Text>
            <View style={styles.heroBadge}>
              <Ionicons
                name={appProfile?.kind === 'authenticated' ? 'shield-checkmark' : 'person-circle-outline'}
                size={12}
                color={colors.primary}
              />
              <Text style={styles.heroBadgeText}>
                {appProfile?.kind === 'authenticated' ? 'Member account' : 'Guest profile'}
              </Text>
            </View>
          </View>
          <Text style={styles.heroMeta}>{heroMetaParts.join(' ·')}</Text>
        </View>
      </View>

      <View style={styles.heroHighlightGrid}>
        {heroHighlights.map((item) => (
          <View key={item.label} style={styles.heroHighlightCard}>
            <Text style={styles.heroHighlightValue}>{item.value}</Text>
            <Text style={styles.heroHighlightLabel}>{item.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.progressBlock}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>{`Level ${level}`}</Text>
          <Text style={styles.progressSubtitle}>{levelTitle}</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.max(6, levelProgress.progress * 100)}%` }]} />
        </View>
        <Text style={styles.progressCaption}>
          {levelProgress.pointsToNext > 0
            ? `${levelProgress.pointsToNext} points to level ${level + 1}`
            : 'Top of the current level band'}
        </Text>
      </View>

      <View style={styles.heroActions}>
        <Pressable onPress={onOpenLeaderboard} style={styles.primaryButton}>
          <Ionicons name="trophy-outline" size={16} color={colors.backgroundDeep} />
          <Text style={styles.primaryButtonText}>Open Leaderboard</Text>
        </Pressable>
        {authSessionStatus === 'signed-out' ? (
          <Pressable
            disabled={isStartingGuestSession}
            onPress={onStartGuestSession}
            style={[styles.secondaryButton, isStartingGuestSession && styles.buttonDisabled]}
          >
            {isStartingGuestSession ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <Ionicons name="person-add-outline" size={16} color={colors.text} />
            )}
            <Text style={styles.secondaryButtonText}>
              {isStartingGuestSession ? 'Starting...' : 'Start Guest Session'}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </LinearGradient>
  );
}

export function ProfileDetailsSection({
  displayNameInput,
  setDisplayNameInput,
  isSavingDisplayName,
  hasDisplayName,
  profileActionStatus,
  authSessionStatus,
  onSaveDisplayName,
  onClearDisplayName,
  onSignOut,
}: {
  displayNameInput: string;
  setDisplayNameInput: (value: string) => void;
  isSavingDisplayName: boolean;
  hasDisplayName: boolean;
  profileActionStatus: string | null;
  authSessionStatus: string;
  onSaveDisplayName: () => void;
  onClearDisplayName: () => void;
  onSignOut: () => void;
}) {
  return (
    <SectionCard
      title="Profile details"
      body="Set the name that appears on your reviews, profile, and community activity."
    >
      <TextInput
        value={displayNameInput}
        onChangeText={setDisplayNameInput}
        placeholder="Display name"
        placeholderTextColor={colors.textSoft}
        style={styles.input}
      />
      <View style={styles.heroActions}>
        <Pressable
          disabled={isSavingDisplayName}
          onPress={onSaveDisplayName}
          style={[styles.primaryButton, isSavingDisplayName && styles.buttonDisabled]}
        >
          {isSavingDisplayName ? <ActivityIndicator color={colors.backgroundDeep} /> : null}
          <Text style={styles.primaryButtonText}>
            {isSavingDisplayName ? 'Saving...' : 'Save Name'}
          </Text>
        </Pressable>
        <Pressable
          disabled={isSavingDisplayName || !hasDisplayName}
          onPress={onClearDisplayName}
          style={[
            styles.secondaryButton,
            (isSavingDisplayName || !hasDisplayName) && styles.buttonDisabled,
          ]}
        >
          <Ionicons name="close-circle-outline" size={16} color={colors.text} />
          <Text style={styles.secondaryButtonText}>Clear Name</Text>
        </Pressable>
        {authSessionStatus === 'anonymous' || authSessionStatus === 'authenticated' ? (
          <Pressable onPress={onSignOut} style={styles.secondaryButton}>
            <Ionicons name="log-out-outline" size={16} color={colors.text} />
            <Text style={styles.secondaryButtonText}>Sign Out</Text>
          </Pressable>
        ) : null}
      </View>
      {profileActionStatus ? <Text style={styles.environmentNote}>{profileActionStatus}</Text> : null}
    </SectionCard>
  );
}

export function ProfileStatsSection({
  totalPoints,
  badgeCount,
  totalReviews,
  totalHelpfulVotes,
  dispensariesVisited,
  currentStreak,
}: {
  totalPoints: number;
  badgeCount: number;
  totalReviews: number;
  totalHelpfulVotes: number;
  dispensariesVisited: number;
  currentStreak: number;
}) {
  const statCards = [
    { label: 'Points', value: String(totalPoints), icon: TrophyIcon, tone: colors.primary },
    { label: 'Badges', value: String(badgeCount), icon: BadgeIcon, tone: colors.cyan },
    { label: 'Reviews', value: String(totalReviews), icon: ReviewIcon, tone: colors.warning },
    { label: 'Helpful', value: String(totalHelpfulVotes), icon: StarIcon, tone: colors.accent },
    { label: 'Visited', value: String(dispensariesVisited), icon: LocationPinIcon, tone: colors.blue },
    { label: 'Streak', value: String(currentStreak), icon: FireIcon, tone: colors.danger },
  ] as const;

  return (
    <SectionCard
      title="Profile stats"
      body="Progress is driven by real visits, thoughtful reviews, and helpful community feedback."
    >
      <View style={styles.infoGrid}>
        {statCards.map((card) => (
          <AppIconStatCard
            key={card.label}
            label={card.label}
            value={card.value}
            icon={card.icon}
            tone={card.tone}
          />
        ))}
      </View>
    </SectionCard>
  );
}
