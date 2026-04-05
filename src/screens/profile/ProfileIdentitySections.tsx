import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
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
import { AppUiIcon } from '../../icons/AppUiIcon';
import { brand } from '../../config/brand';
import { colors } from '../../theme/tokens';
import type { AppProfile } from '../../types/storefront';
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
    rank > 0 ? `Standing #${rank}` : null,
    `${visitedCount} storefronts visited`,
    `${joinedDays} days on ${brand.productName}`,
  ].filter(Boolean) as string[];
  const heroHighlights = [
    { label: 'Standing', value: rank > 0 ? `#${rank}` : 'New' },
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
            <View style={styles.heroKickerRow}>
              <Text style={styles.heroKicker}>
                {appProfile?.kind === 'authenticated' ? 'Member profile' : 'Guest access'}
              </Text>
              <View style={styles.heroMiniChip}>
                <Text style={styles.heroMiniChipText}>{levelTitle}</Text>
              </View>
            </View>
            <Text
              style={styles.heroName}
              numberOfLines={2}
              ellipsizeMode="tail"
              maxFontSizeMultiplier={1.15}
            >
              {displayName}
            </Text>
            <View style={styles.heroBadge}>
              <AppUiIcon
                name={
                  appProfile?.kind === 'authenticated'
                    ? 'shield-checkmark'
                    : 'person-circle-outline'
                }
                size={12}
                color={colors.primary}
              />
              <Text style={styles.heroBadgeText}>
                {appProfile?.kind === 'authenticated' ? 'Verified member' : 'Guest access'}
              </Text>
            </View>
          </View>
          <Text style={styles.heroMeta} numberOfLines={2} ellipsizeMode="tail">
            {heroMetaParts.join(' · ')}
          </Text>
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
          <View
            style={[
              styles.progressFill,
              { width: `${Math.max(6, levelProgress.progress * 100)}%` },
            ]}
          />
        </View>
        <Text style={styles.progressCaption}>
          {levelProgress.pointsToNext > 0
            ? `${levelProgress.pointsToNext} activity points to level ${level + 1}`
            : 'At the top of this level'}
        </Text>
      </View>

      <View style={styles.heroActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open progress"
          accessibilityHint="Opens your leaderboard and progress view."
          onPress={onOpenLeaderboard}
          style={styles.primaryButton}
        >
          <AppUiIcon name="stats-chart-outline" size={16} color={colors.backgroundDeep} />
          <Text style={styles.primaryButtonText}>Open Progress</Text>
        </Pressable>
        {authSessionStatus === 'signed-out' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Browse as guest"
            accessibilityHint="Starts guest access for browsing without a member account."
            disabled={isStartingGuestSession}
            onPress={onStartGuestSession}
            style={[styles.secondaryButton, isStartingGuestSession && styles.buttonDisabled]}
          >
            {isStartingGuestSession ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <AppUiIcon name="person-add-outline" size={16} color={colors.text} />
            )}
            <Text style={styles.secondaryButtonText}>
              {isStartingGuestSession ? 'Starting...' : 'Browse as Guest'}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </LinearGradient>
  );
}

export function ProfileAccountSection({
  displayNameInput,
  profileActionStatus,
  authSessionStatus,
  memberEmail,
  ownerPortalEnabled,
  onSignOut,
  onOpenMemberSignIn,
  onOpenMemberSignUp,
  onOpenOwnerSignIn,
}: {
  displayNameInput: string;
  profileActionStatus: string | null;
  authSessionStatus: string;
  memberEmail: string | null;
  ownerPortalEnabled: boolean;
  onSignOut: () => void;
  onOpenMemberSignIn: () => void;
  onOpenMemberSignUp: () => void;
  onOpenOwnerSignIn: () => void;
}) {
  const isMemberAuthenticated = authSessionStatus === 'authenticated';
  const isGuestSession = authSessionStatus === 'anonymous';
  const accountTitle = isMemberAuthenticated
    ? 'Member account is active'
    : isGuestSession
      ? 'Guest access is active'
      : 'No member account is connected';
  const accountBody =
    isMemberAuthenticated && memberEmail
      ? `${memberEmail} is connected to this profile.`
      : isGuestSession
        ? 'You are browsing with guest access. Connect a member account to keep your history.'
        : 'Sign in to keep your history, reviews, and saved storefronts together.';

  return (
    <SectionCard title="Account" body="Manage your sign-in and member account.">
      <View style={styles.previewCard}>
        <View style={styles.previewCardHeader}>
          <View style={styles.progressText}>
            <Text style={styles.previewCardTitle}>{accountTitle}</Text>
            <Text style={styles.previewCardBody}>{accountBody}</Text>
          </View>
          <View style={styles.heroBadge}>
            <AppUiIcon
              name={
                isMemberAuthenticated
                  ? 'shield-checkmark'
                  : isGuestSession
                    ? 'person-circle-outline'
                    : 'log-in-outline'
              }
              size={12}
              color={colors.primary}
            />
            <Text style={styles.heroBadgeText}>
              {isMemberAuthenticated ? 'Member' : isGuestSession ? 'Guest' : 'Signed out'}
            </Text>
          </View>
        </View>
        <View style={styles.accountSnapshotGrid}>
          <View style={styles.accountSnapshotCard}>
            <Text style={styles.accountSnapshotValue}>
              {isMemberAuthenticated ? 'Member' : isGuestSession ? 'Guest' : 'Offline'}
            </Text>
            <Text style={styles.accountSnapshotLabel}>Session</Text>
            <Text style={styles.accountSnapshotBody}>
              {isMemberAuthenticated
                ? 'Activity synced to this account.'
                : isGuestSession
                  ? 'Connect an account to save activity.'
                  : 'Sign in to sync history.'}
            </Text>
          </View>
          <View style={styles.accountSnapshotCard}>
            <Text style={styles.accountSnapshotValue} numberOfLines={1} ellipsizeMode="tail">
              {displayNameInput.trim() ? displayNameInput.trim() : 'Not set'}
            </Text>
            <Text style={styles.accountSnapshotLabel}>Public name</Text>
            <Text style={styles.accountSnapshotBody}>Shown on your reviews.</Text>
          </View>
          <View style={styles.accountSnapshotCard}>
            <Text style={styles.accountSnapshotValue}>
              {ownerPortalEnabled ? 'Available' : 'Locked'}
            </Text>
            <Text style={styles.accountSnapshotLabel}>Business portal</Text>
            <Text style={styles.accountSnapshotBody}>
              {ownerPortalEnabled ? 'Sign in to connect your business.' : 'Not enabled.'}
            </Text>
          </View>
        </View>
      </View>

      {memberEmail ? (
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Display name</Text>
          <Text style={styles.fieldHint}>{memberEmail}</Text>
        </View>
      ) : null}

      <View style={styles.heroActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isMemberAuthenticated ? 'Switch member account' : 'Member sign in'}
          accessibilityHint="Opens the member sign-in flow."
          onPress={onOpenMemberSignIn}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>
            {isMemberAuthenticated ? 'Switch Member Account' : 'Member Sign In'}
          </Text>
        </Pressable>
        {!isMemberAuthenticated ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create member account"
            accessibilityHint="Opens the member account sign-up flow."
            onPress={onOpenMemberSignUp}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Create Account</Text>
          </Pressable>
        ) : null}
        {ownerPortalEnabled ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Owner sign in"
            accessibilityHint="Opens the owner portal sign-in flow."
            onPress={onOpenOwnerSignIn}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Owner Sign In</Text>
          </Pressable>
        ) : null}
      </View>

      {authSessionStatus === 'anonymous' || authSessionStatus === 'authenticated' ? (
        <View style={styles.heroActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            accessibilityHint="Signs out of the current member session."
            onPress={onSignOut}
            style={styles.secondaryButton}
          >
            <AppUiIcon name="log-out-outline" size={16} color={colors.text} />
            <Text style={styles.secondaryButtonText}>Sign Out</Text>
          </Pressable>
        </View>
      ) : null}

      {profileActionStatus ? (
        <Text style={styles.environmentNote}>{profileActionStatus}</Text>
      ) : null}
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
    { label: 'Activity', value: String(totalPoints), icon: TrophyIcon, tone: colors.primary },
    { label: 'Milestones', value: String(badgeCount), icon: BadgeIcon, tone: colors.cyan },
    { label: 'Reviews', value: String(totalReviews), icon: ReviewIcon, tone: colors.warning },
    { label: 'Helpful', value: String(totalHelpfulVotes), icon: StarIcon, tone: colors.accent },
    {
      label: 'Visited',
      value: String(dispensariesVisited),
      icon: LocationPinIcon,
      tone: colors.blue,
    },
    { label: 'Streak', value: String(currentStreak), icon: FireIcon, tone: colors.danger },
  ] as const;

  return (
    <SectionCard title="Profile stats" body="">
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
