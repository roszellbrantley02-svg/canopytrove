import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { QuickActionsRow, type QuickAction } from '../components/QuickActionsRow';
import { SectionHeader } from '../components/SectionHeader';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import { AppUiIcon } from '../icons/AppUiIcon';
import Constants from 'expo-constants';
import { brand } from '../config/brand';
import { ownerPortalAccessAvailable } from '../config/ownerPortalConfig';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { colors, radii, motion, spacing, textStyles } from '../theme/tokens';
import {
  ProfileHeroCard,
  StorefrontCollectionSection,
  UsernameRequestSection,
} from './profile/ProfileSections';
import { useProfileScreenModel } from './profile/useProfileScreenModel';

function ProfileScreenInner() {
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

        {/* 1b. Sign-in / Create Account CTA (guests only) */}
        {model.authSession.status !== 'authenticated' ? (
          <MotionInView dense delay={revealDelay(0) + 30}>
            <View style={internalStyles.authCard}>
              <View style={internalStyles.authCardIcon}>
                <AppUiIcon name="person-add-outline" size={22} color={colors.accent} />
              </View>
              <View style={internalStyles.authCardContent}>
                <Text style={internalStyles.authCardTitle}>Create an account or sign in</Text>
                <Text style={internalStyles.authCardBody}>
                  Save favorites, write reviews, earn badges, and unlock your full profile.
                </Text>
              </View>
              <View style={internalStyles.authCardActions}>
                <Pressable
                  onPress={() => navigation.navigate('CanopyTroveSignUp')}
                  accessibilityRole="button"
                  accessibilityLabel="Create account"
                  style={({ pressed }) => [
                    internalStyles.authCardButton,
                    internalStyles.authCardButtonPrimary,
                    pressed && internalStyles.authCardButtonPressed,
                  ]}
                >
                  <Text style={internalStyles.authCardButtonPrimaryText}>Create Account</Text>
                </Pressable>
                <Pressable
                  onPress={() => navigation.navigate('CanopyTroveSignIn')}
                  accessibilityRole="button"
                  accessibilityLabel="Sign in"
                  style={({ pressed }) => [
                    internalStyles.authCardButton,
                    internalStyles.authCardButtonSecondary,
                    pressed && internalStyles.authCardButtonPressed,
                  ]}
                >
                  <Text style={internalStyles.authCardButtonSecondaryText}>Sign In</Text>
                </Pressable>
              </View>
            </View>
          </MotionInView>
        ) : null}

        {/* 1c. Username Request (authenticated only) */}
        {model.authSession.status === 'authenticated' ? (
          <MotionInView dense delay={revealDelay(0) + 60}>
            <UsernameRequestSection
              displayNameInput={model.displayNameInput}
              onChangeDisplayNameInput={model.setDisplayNameInput}
              pendingRequest={model.pendingUsernameRequest}
              isSubmitting={model.isSavingDisplayName}
              isLoadingPending={model.isLoadingPendingRequest}
              statusMessage={model.profileActionStatus}
              onSubmit={model.submitUsernameRequest}
            />
          </MotionInView>
        ) : null}

        {/* 2. QuickActionsRow */}
        <MotionInView dense delay={revealDelay(1)}>
          <QuickActionsRow actions={quickActions} />
        </MotionInView>

        {/* 2b. Owner Portal CTA */}
        {ownerPortalAccessAvailable ? (
          <MotionInView dense delay={revealDelay(1) + 30}>
            <OwnerClaimCard onPress={() => navigation.navigate('OwnerPortalAccess')} />
          </MotionInView>
        ) : null}

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

export const ProfileScreen = withScreenErrorBoundary(ProfileScreenInner, 'profile-screen');

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

/** Owner Claim CTA: visible banner linking to the Owner Portal */
function OwnerClaimCard({ onPress }: { onPress: () => void }) {
  return (
    <View style={internalStyles.ownerCard}>
      <View style={internalStyles.ownerCardIcon}>
        <AppUiIcon name="storefront-outline" size={22} color={colors.gold} />
      </View>
      <View style={internalStyles.ownerCardContent}>
        <Text style={internalStyles.ownerCardTitle}>Own a dispensary?</Text>
        <Text style={internalStyles.ownerCardBody}>
          Claim your listing, manage reviews, and publish deals on Canopy Trove.
        </Text>
      </View>
      <View style={internalStyles.ownerCardActions}>
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel="Claim your dispensary"
          accessibilityHint="Opens the owner portal to claim and manage your dispensary listing."
          style={({ pressed }) => [
            internalStyles.ownerCardButton,
            pressed && internalStyles.ownerCardButtonPressed,
          ]}
        >
          <Text style={internalStyles.ownerCardButtonText}>Claim Your Dispensary</Text>
        </Pressable>
      </View>
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
  authCard: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  authCardIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: 'rgba(46, 204, 113, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  authCardContent: {
    gap: 4,
  },
  authCardTitle: {
    ...textStyles.bodyStrong,
    color: colors.text,
  },
  authCardBody: {
    ...textStyles.caption,
    color: colors.textMuted,
    lineHeight: 20,
  },
  authCardActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  authCardButton: {
    minHeight: 48,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authCardButtonPrimary: {
    backgroundColor: colors.accent,
  },
  authCardButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  authCardButtonPressed: {
    opacity: 0.7,
  },
  authCardButtonPrimaryText: {
    ...textStyles.bodyStrong,
    color: colors.background,
    fontSize: 14,
  },
  authCardButtonSecondaryText: {
    ...textStyles.bodyStrong,
    color: colors.text,
    fontSize: 14,
  },
  ownerCard: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  ownerCardIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: 'rgba(232, 160, 0, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  ownerCardContent: {
    gap: 4,
  },
  ownerCardTitle: {
    ...textStyles.bodyStrong,
    color: colors.text,
  },
  ownerCardBody: {
    ...textStyles.caption,
    color: colors.textMuted,
    lineHeight: 20,
  },
  ownerCardActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  ownerCardButton: {
    minHeight: 48,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
  },
  ownerCardButtonPressed: {
    opacity: 0.7,
  },
  ownerCardButtonText: {
    ...textStyles.bodyStrong,
    color: colors.background,
    fontSize: 14,
  },
});
