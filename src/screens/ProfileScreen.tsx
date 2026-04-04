import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { QuickActionsRow, type QuickAction } from '../components/QuickActionsRow';
import { SectionHeader } from '../components/SectionHeader';
import Constants from 'expo-constants';
import { brand } from '../config/brand';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { colors, motion, spacing, textStyles } from '../theme/tokens';
import { ProfileHeroCard, StorefrontCollectionSection } from './profile/ProfileSections';
import { useProfileScreenModel } from './profile/useProfileScreenModel';

export function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const model = useProfileScreenModel(navigation);
  const scrollViewRef = React.useRef<ScrollView>(null);

  const revealDelay = React.useCallback(
    (order: number) => Math.min(order, 5) * Math.round(motion.denseSectionStagger * 0.7),
    [],
  );

  const quickActions: QuickAction[] = React.useMemo(
    () => [
      {
        key: 'write-review',
        label: 'Write Review',
        iconName: 'create-outline',
        onPress: () => {
          const target = model.recentStorefronts[0] ?? model.savedStorefronts[0];
          if (target) {
            navigation.navigate('WriteReview', { storefront: target });
          } else {
            // No storefronts visited yet — send them to Browse to find one
            navigation.navigate('Tabs', { screen: 'Browse' });
          }
        },
      },
      {
        key: 'saved',
        label: 'Saved',
        iconName: 'bookmark-outline',
        onPress: () => navigation.navigate('SavedStorefronts'),
      },
      {
        key: 'leaderboard',
        label: 'Leaderboard',
        iconName: 'trophy-outline',
        onPress: model.openLeaderboard,
      },
      {
        key: 'settings',
        label: 'Settings',
        iconName: 'options-outline',
        onPress: () => navigation.navigate('Settings'),
      },
    ],
    [model, navigation],
  );

  return (
    <ScreenShell
      eyebrow={`${brand.productDisplayName} profile`}
      title={model.displayName}
      subtitle={`Level ${model.gamificationState.level} ${model.levelTitle} \u2022 ${model.gamificationState.totalPoints} points`}
      headerPill={model.appProfile?.kind === 'authenticated' ? 'Member' : 'Guest'}
      showHero={false}
    >
      <ScrollView
        ref={scrollViewRef}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={internalStyles.scrollContent}
      >
        {/* 1. ProfileHeroCard */}
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

        {/* 2. QuickActionsRow */}
        <MotionInView dense delay={revealDelay(1)}>
          <QuickActionsRow actions={quickActions} />
        </MotionInView>

        {/* 3. Stats Snapshot */}
        <MotionInView dense delay={revealDelay(2)}>
          <StatsSnapshot
            totalPoints={model.gamificationState.totalPoints}
            totalReviews={model.gamificationState.totalReviews}
            currentStreak={model.gamificationState.currentStreak}
          />
        </MotionInView>

        {/* 4. Saved Storefronts */}
        <MotionInView dense delay={revealDelay(3)}>
          <View style={internalStyles.section}>
            <SectionHeader
              title="Saved"
              count={model.savedStorefrontIds.length}
              onSeeAll={
                model.savedStorefrontIds.length > 0
                  ? () => navigation.navigate('SavedStorefronts')
                  : undefined
              }
            />
            <StorefrontCollectionSection
              title=""
              body=""
              isLoading={model.isLoadingSaved}
              storefronts={model.savedStorefronts.slice(0, 3)}
              navigation={navigation}
              emptyText="No saved storefronts yet. Save storefronts to see them here."
              iconName="bookmark-outline"
            />
          </View>
        </MotionInView>

        {/* 5. Recently Viewed */}
        <MotionInView dense delay={revealDelay(4)}>
          <View style={internalStyles.section}>
            <SectionHeader
              title="Recently Viewed"
              count={model.recentStorefrontIds.length}
              onSeeAll={
                model.recentStorefrontIds.length > 3
                  ? () => navigation.navigate('Tabs', { screen: 'Browse' })
                  : undefined
              }
              seeAllLabel="Browse More"
            />
            <StorefrontCollectionSection
              title=""
              body=""
              isLoading={model.isLoadingRecentIds || model.isLoadingRecentStorefronts}
              storefronts={model.recentStorefronts.slice(0, 3)}
              navigation={navigation}
              emptyText="No recently viewed storefronts yet. Open storefronts to see them here."
              iconName="time-outline"
            />
          </View>
        </MotionInView>

        {/* 6. Badge Showcase */}
        <MotionInView dense delay={revealDelay(5)}>
          <View style={internalStyles.section}>
            <SectionHeader
              title="Badges"
              count={model.earnedBadges.length}
              onSeeAll={
                model.earnedBadges.length > 0
                  ? () => navigation.navigate('BadgeGallery')
                  : undefined
              }
            />
            <BadgeShowcase badges={model.featuredBadges.slice(0, 3)} />
          </View>
        </MotionInView>

        {/* 7. Footer */}
        <MotionInView dense delay={revealDelay(6)}>
          <View style={internalStyles.footer}>
            <Text style={internalStyles.footerText}>
              {brand.productDisplayName} • v{Constants.expoConfig?.version ?? '1.0.0'}
            </Text>
          </View>
        </MotionInView>
      </ScrollView>
    </ScreenShell>
  );
}

/** Stats Snapshot: compact 3-column view of key metrics */
function StatsSnapshot({
  totalPoints,
  totalReviews,
  currentStreak,
}: {
  totalPoints: number;
  totalReviews: number;
  currentStreak: number;
}) {
  return (
    <View style={internalStyles.statsSnapshot}>
      <StatCard label="Points" value={String(totalPoints)} />
      <StatCard label="Reviews" value={String(totalReviews)} />
      <StatCard label="Streak" value={`${currentStreak}d`} />
    </View>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={internalStyles.statCard}>
      <Text style={internalStyles.statValue} maxFontSizeMultiplier={1.1}>
        {value}
      </Text>
      <Text style={internalStyles.statLabel} maxFontSizeMultiplier={1}>
        {label}
      </Text>
    </View>
  );
}

/** Badge Showcase: top 3 featured badges in a row */
function BadgeShowcase({ badges }: { badges: Array<{ icon?: string; name?: string }> }) {
  if (badges.length === 0) {
    return (
      <View style={internalStyles.emptyBadges}>
        <Text style={internalStyles.emptyBadgesText}>
          Earn badges by completing challenges and activities.
        </Text>
      </View>
    );
  }

  return (
    <View style={internalStyles.badgeGrid}>
      {badges.map((badge, idx) => (
        <View key={idx} style={internalStyles.badgeItem}>
          <View style={internalStyles.badgePlaceholder}>
            {badge?.icon ? (
              <Text style={internalStyles.badgeEmoji}>{badge.icon}</Text>
            ) : (
              <Text style={internalStyles.badgeEmoji}>⭐</Text>
            )}
          </View>
          <Text style={internalStyles.badgeItemLabel} numberOfLines={2} maxFontSizeMultiplier={1}>
            {badge?.name ?? 'Badge'}
          </Text>
        </View>
      ))}
    </View>
  );
}

const internalStyles = StyleSheet.create({
  scrollContent: {
    paddingVertical: spacing.lg,
    gap: spacing.xl,
  },
  section: {
    gap: spacing.md,
  },
  statsSnapshot: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 12,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  statValue: {
    ...textStyles.title,
    color: colors.accent,
    fontSize: 24,
    lineHeight: 28,
  },
  statLabel: {
    ...textStyles.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  badgeGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  badgeItem: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
  },
  badgePlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeEmoji: {
    fontSize: 32,
  },
  badgeItemLabel: {
    ...textStyles.caption,
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 11,
  },
  emptyBadges: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyBadgesText: {
    ...textStyles.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  footer: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  footerText: {
    ...textStyles.caption,
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 0.3,
  },
});
