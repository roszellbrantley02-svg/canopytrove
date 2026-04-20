import React from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Constants from 'expo-constants';
import { MotionInView } from '../components/MotionInView';
import { QuickActionsGrid } from '../components/QuickActionsGrid';
import { type QuickAction } from '../components/QuickActionsRow';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { SectionHeader } from '../components/SectionHeader';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import { supportsOwnerWorkspaceUi, supportsProductDiscoveryUi } from '../config/playStorePolicy';
import { brand } from '../config/brand';
import { ownerPortalAccessAvailable } from '../config/ownerPortalConfig';
import { useStorefrontProfileController } from '../context/StorefrontController';
import { useOwnerPortalAccessState } from '../hooks/useOwnerPortalAccessState';
import { MusicToggleRow } from '../music/MusicToggleRow';
import { AppUiIcon, type AppUiIconName } from '../icons/AppUiIcon';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { colors, radii, motion, spacing, textStyles } from '../theme/tokens';
import {
  ProfileHeroCard,
  StorefrontCollectionSection,
  UsernameRequestSection,
} from './profile/ProfileSections';
import { useProfileScreenModel } from './profile/useProfileScreenModel';

function ProfileScreenInner() {
  const { authSession } = useStorefrontProfileController();
  const { accessState, isCheckingAccess } = useOwnerPortalAccessState(authSession);
  const ownerPortalUiAvailable =
    supportsOwnerWorkspaceUi && (ownerPortalAccessAvailable || Platform.OS === 'web');
  const ownerWorkspaceReady =
    ownerPortalUiAvailable &&
    authSession.status === 'authenticated' &&
    accessState.allowlisted &&
    !isCheckingAccess;

  if (authSession.status === 'checking') {
    return (
      <ProfileLoadingScreen
        title="Checking your account"
        body="Opening the right profile view for this session."
      />
    );
  }

  if (authSession.status === 'authenticated' && ownerPortalAccessAvailable && isCheckingAccess) {
    return (
      <ProfileLoadingScreen
        title="Checking your account role"
        body="Making sure this session opens the right side of the profile."
      />
    );
  }

  if (ownerWorkspaceReady) {
    return <OwnerProfileWorkspace />;
  }

  if (
    !supportsOwnerWorkspaceUi &&
    authSession.status === 'authenticated' &&
    accessState.allowlisted &&
    !isCheckingAccess
  ) {
    return <AndroidBusinessNoticeWorkspace />;
  }

  if (authSession.status !== 'authenticated') {
    return <ProfileEntryWorkspace />;
  }

  return <MemberProfileWorkspace />;
}

function ProfileLoadingScreen({ title, body }: { title: string; body: string }) {
  return (
    <ScreenShell
      eyebrow="Profile"
      title={title}
      subtitle={body}
      headerPill="Profile"
      showHero={false}
    >
      <SectionCard title="Loading profile" body={body}>
        <View style={internalStyles.loadingCard}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={internalStyles.loadingText}>One moment.</Text>
        </View>
      </SectionCard>
    </ScreenShell>
  );
}

function ProfileEntryWorkspace() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const ownerPortalUiAvailable =
    supportsOwnerWorkspaceUi && (ownerPortalAccessAvailable || Platform.OS === 'web');

  return (
    <ScreenShell
      eyebrow="Profile"
      title="Choose your account"
      subtitle={
        ownerPortalUiAvailable
          ? 'Sign in as a member or as an owner. Once you sign in, this tab stays on the right side of the profile until you sign out.'
          : 'Sign in as a member for saved storefronts, reviews, badges, and personal settings. Business tools stay on iPhone and web.'
      }
      headerPill="Profile"
    >
      <MotionInView delay={70}>
        <SectionCard
          title="Member access"
          body="Use the member side for saved storefronts, reviews, badges, and personal settings."
        >
          <View style={internalStyles.entryCardHeader}>
            <View style={internalStyles.entryIconMember}>
              <AppUiIcon name="person-circle-outline" size={20} color={colors.accent} />
            </View>
            <View style={internalStyles.entryCopy}>
              <Text style={internalStyles.entryTitle}>Customer account</Text>
              <Text style={internalStyles.entryBody}>
                Sign in as a member if this profile is for browsing storefronts, saving favorites,
                and writing reviews.
              </Text>
            </View>
          </View>
          <View style={internalStyles.entryActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Member sign in"
              onPress={() => navigation.navigate('MemberSignIn')}
              style={({ pressed }) => [
                internalStyles.primaryButton,
                pressed && internalStyles.buttonPressed,
              ]}
            >
              <Text style={internalStyles.primaryButtonText}>Member Sign In</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create member account"
              onPress={() => navigation.navigate('CanopyTroveSignUp')}
              style={({ pressed }) => [
                internalStyles.secondaryButton,
                pressed && internalStyles.buttonPressed,
              ]}
            >
              <Text style={internalStyles.secondaryButtonText}>Create Member Account</Text>
            </Pressable>
          </View>
        </SectionCard>
      </MotionInView>

      <MotionInView delay={100}>
        <MusicToggleRow />
      </MotionInView>

      {ownerPortalUiAvailable ? (
        <MotionInView delay={120}>
          <SectionCard
            title="Owner access"
            body="Use the owner side for storefront photos, profile updates, reviews, offers, and billing."
          >
            <View style={internalStyles.entryCardHeader}>
              <View style={internalStyles.entryIconOwner}>
                <AppUiIcon name="storefront-outline" size={20} color={colors.goldSoft} />
              </View>
              <View style={internalStyles.entryCopy}>
                <Text style={internalStyles.entryTitle}>Business account</Text>
                <Text style={internalStyles.entryBody}>
                  Sign in as an owner if this profile belongs to a storefront operator or business
                  manager.
                </Text>
              </View>
            </View>
            <View style={internalStyles.entryActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Owner sign in"
                onPress={() => navigation.navigate('OwnerSignIn')}
                style={({ pressed }) => [
                  internalStyles.primaryButtonGold,
                  pressed && internalStyles.buttonPressed,
                ]}
              >
                <Text style={internalStyles.primaryButtonGoldText}>Owner Sign In</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Create owner account"
                onPress={() => navigation.navigate('OwnerPortalSignUp')}
                style={({ pressed }) => [
                  internalStyles.secondaryButton,
                  pressed && internalStyles.buttonPressed,
                ]}
              >
                <Text style={internalStyles.secondaryButtonText}>Create Owner Account</Text>
              </Pressable>
            </View>
          </SectionCard>
        </MotionInView>
      ) : null}
    </ScreenShell>
  );
}

function AndroidBusinessNoticeWorkspace() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { authSession, signOutSession } = useStorefrontProfileController();

  return (
    <ScreenShell
      eyebrow="Profile"
      title="Business tools stay off Android"
      subtitle="This Android build stays focused on storefront discovery and verification while we prepare Google Play review."
      headerPill="Profile"
    >
      <MotionInView delay={70}>
        <SectionCard
          title="Signed in with a business account"
          body="Use iPhone or the web owner workspace for storefront management, reviews, profile updates, and billing."
        >
          <View style={internalStyles.sessionLockCard}>
            <View style={internalStyles.sessionCopy}>
              <Text style={internalStyles.sessionTitle}>Business account detected</Text>
              <Text style={internalStyles.sessionBody}>
                {authSession.email ?? authSession.displayName ?? 'Owner account active'}
              </Text>
            </View>
            <View style={internalStyles.ownerChip}>
              <Text style={internalStyles.ownerChipText}>Owner</Text>
            </View>
          </View>
        </SectionCard>
      </MotionInView>

      <MotionInView delay={110}>
        <SectionCard
          title="What you can do here"
          body="Browse storefronts, verify licenses, and check public storefront details on Android."
        >
          <View style={internalStyles.actionStack}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Browse storefronts"
              onPress={() => navigation.navigate('Tabs', { screen: 'Browse' })}
              style={({ pressed }) => [
                internalStyles.primaryButton,
                pressed && internalStyles.buttonPressed,
              ]}
            >
              <Text style={internalStyles.primaryButtonText}>Browse Storefronts</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sign out"
              onPress={() => {
                void signOutSession();
              }}
              style={({ pressed }) => [
                internalStyles.secondaryButton,
                pressed && internalStyles.buttonPressed,
              ]}
            >
              <Text style={internalStyles.secondaryButtonText}>Sign Out</Text>
            </Pressable>
          </View>
        </SectionCard>
      </MotionInView>
    </ScreenShell>
  );
}

function OwnerProfileWorkspace() {
  const isAndroid = Platform.OS === 'android';
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { authSession, signOutSession } = useStorefrontProfileController();
  const promotionsLabel = isAndroid ? 'Updates' : 'Offers';

  const ownerWorkspaceCards: Array<{
    key: string;
    title: string;
    body: string;
    buttonLabel: string;
    accessibilityLabel: string;
    iconName: React.ComponentProps<typeof SectionCard>['iconName'];
    badgeLabel: string;
    tone: NonNullable<React.ComponentProps<typeof SectionCard>['tone']>;
    onPress: () => void;
  }> = React.useMemo(
    () => [
      {
        key: 'storefront',
        title: 'Storefront studio',
        body: 'Update gallery photos, the hero image, menu link, and short copy from one polished editor.',
        buttonLabel: 'Open Storefront Studio',
        accessibilityLabel: 'Open storefront studio',
        iconName: 'storefront-outline',
        badgeLabel: 'Studio',
        tone: 'gold' as const,
        onPress: () => navigation.navigate('OwnerPortalProfileTools'),
      },
      {
        key: 'reviews',
        title: 'Review inbox',
        body: 'Read new feedback, spot issues quickly, and keep customer replies moving from one private workspace.',
        buttonLabel: 'Open Review Inbox',
        accessibilityLabel: 'Open review inbox',
        iconName: 'chatbubble-ellipses-outline',
        badgeLabel: 'Reviews',
        tone: 'cyan' as const,
        onPress: () => navigation.navigate('OwnerPortalReviewInbox'),
      },
      {
        key: 'dashboard',
        title: 'Business dashboard',
        body: 'Check the business overview, verification state, and account readiness from the main owner dashboard.',
        buttonLabel: 'Open Business Dashboard',
        accessibilityLabel: 'Open business dashboard',
        iconName: 'stats-chart-outline',
        badgeLabel: 'Dashboard',
        tone: 'primary' as const,
        onPress: () => navigation.navigate('OwnerPortalHome'),
      },
      {
        key: 'promotions',
        title: `${promotionsLabel} workspace`,
        body: isAndroid
          ? 'Manage storefront updates, visibility, and publishing from one focused owner workflow.'
          : 'Manage storefront offers, visibility, and publishing from one focused owner workflow.',
        buttonLabel: isAndroid ? 'Open Updates Workspace' : 'Open Offers Workspace',
        accessibilityLabel: isAndroid ? 'Open updates workspace' : 'Open offers workspace',
        iconName: 'megaphone-outline',
        badgeLabel: promotionsLabel,
        tone: 'gold' as const,
        onPress: () => navigation.navigate('OwnerPortalPromotions'),
      },
      {
        key: 'billing',
        title: 'Billing center',
        body: 'Review your plan, subscription status, and business billing settings without leaving the owner side.',
        buttonLabel: 'Open Billing Center',
        accessibilityLabel: 'Open billing center',
        iconName: 'pricetag-outline',
        badgeLabel: 'Billing',
        tone: 'neutral' as const,
        onPress: () => navigation.navigate('OwnerPortalSubscription'),
      },
    ],
    [isAndroid, navigation, promotionsLabel],
  );

  return (
    <ScreenShell
      eyebrow="Profile"
      title="Business profile"
      subtitle="This tab is signed in as an owner. Member history stays hidden until you sign out."
      headerPill="Business"
    >
      <MotionInView delay={70}>
        <SectionCard
          title="Owner account active"
          body={
            isAndroid
              ? 'Use this private profile for the storefront customers see, from gallery photos and reviews to updates and billing.'
              : 'Use this private profile for the storefront customers see, from gallery photos and reviews to offers and billing.'
          }
        >
          <View style={internalStyles.sessionLockCard}>
            <View style={internalStyles.sessionCopy}>
              <Text style={internalStyles.sessionTitle}>Signed in as owner</Text>
              <Text style={internalStyles.sessionBody}>
                {authSession.email ?? authSession.displayName ?? 'Business account active'}
              </Text>
            </View>
            <View style={internalStyles.ownerChip}>
              <Text style={internalStyles.ownerChipText}>Owner</Text>
            </View>
          </View>
        </SectionCard>
      </MotionInView>

      {ownerWorkspaceCards.map((card, index) => (
        <MotionInView key={card.key} delay={120 + index * 50}>
          <OwnerWorkspaceActionCard
            title={card.title}
            body={card.body}
            buttonLabel={card.buttonLabel}
            accessibilityLabel={card.accessibilityLabel}
            iconName={card.iconName}
            badgeLabel={card.badgeLabel}
            tone={card.tone}
            onPress={card.onPress}
          />
        </MotionInView>
      ))}

      <MotionInView delay={120 + ownerWorkspaceCards.length * 50}>
        <MusicToggleRow />
      </MotionInView>

      <MotionInView delay={120 + (ownerWorkspaceCards.length + 1) * 50}>
        <SectionCard
          title="Switch account"
          body="Sign out to return to the profile chooser and switch back to a member account."
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            onPress={() => {
              void signOutSession();
            }}
            style={({ pressed }) => [
              internalStyles.secondaryButton,
              pressed && internalStyles.buttonPressed,
            ]}
          >
            <Text style={internalStyles.secondaryButtonText}>Sign Out</Text>
          </Pressable>
        </SectionCard>
      </MotionInView>
    </ScreenShell>
  );
}

function OwnerWorkspaceActionCard({
  title,
  body,
  buttonLabel,
  accessibilityLabel,
  iconName,
  badgeLabel,
  tone,
  onPress,
}: {
  title: string;
  body: string;
  buttonLabel: string;
  accessibilityLabel: string;
  iconName: React.ComponentProps<typeof SectionCard>['iconName'];
  badgeLabel: string;
  tone: React.ComponentProps<typeof SectionCard>['tone'];
  onPress: () => void;
}) {
  return (
    <SectionCard title={title} body={body} iconName={iconName} badgeLabel={badgeLabel} tone={tone}>
      <View style={internalStyles.actionStack}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          onPress={onPress}
          style={({ pressed }) => [
            internalStyles.primaryButtonGold,
            pressed && internalStyles.buttonPressed,
          ]}
        >
          <Text style={internalStyles.primaryButtonGoldText}>{buttonLabel}</Text>
        </Pressable>
      </View>
    </SectionCard>
  );
}

function MemberProfileWorkspace() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const model = useProfileScreenModel(navigation);
  const scrollViewRef = React.useRef<ScrollView>(null);
  const showProductLibrary = supportsProductDiscoveryUi;

  const revealDelay = React.useCallback(
    (order: number) => Math.min(order, 5) * Math.round(motion.denseSectionStagger * 0.7),
    [],
  );

  // Semantic tone assignment: each action's color encodes its *category*,
  // not its index. rose = community voice, primary green = library/saved,
  // gold = featured content, blue = trust/verified, purple = social,
  // textMuted = utility/settings (iOS gray-neutral convention).
  const quickActions: QuickAction[] = React.useMemo(
    () => [
      {
        key: 'write-review',
        label: 'Write Review',
        iconName: 'create-outline',
        tone: colors.rose,
        onPress: () => {
          const target = model.recentStorefronts[0] ?? model.savedStorefronts[0];
          if (target) {
            navigation.navigate('WriteReview', { storefront: target });
          } else {
            navigation.navigate('Tabs', { screen: 'Browse' });
          }
        },
      },
      {
        key: 'saved',
        label: 'Saved',
        iconName: 'bookmark-outline',
        tone: colors.primary,
        onPress: () => navigation.navigate('SavedStorefronts'),
      },
      ...(showProductLibrary
        ? ([
            {
              key: 'brands',
              label: 'My Brands',
              iconName: 'ribbon-outline',
              tone: colors.gold,
              onPress: () => navigation.navigate('MyBrands'),
            },
            {
              key: 'products',
              label: 'My Products',
              iconName: 'sparkles-outline',
              tone: colors.blue,
              onPress: () => navigation.navigate('MyProducts'),
            },
          ] satisfies QuickAction[])
        : []),
      {
        key: 'leaderboard',
        label: 'Leaderboard',
        iconName: 'trophy-outline',
        tone: colors.purple,
        onPress: model.openLeaderboard,
      },
      {
        key: 'settings',
        label: 'Settings',
        iconName: 'options-outline',
        tone: colors.textMuted,
        onPress: () => navigation.navigate('Settings'),
      },
    ],
    [model, navigation, showProductLibrary],
  );

  return (
    <ScreenShell
      eyebrow={`${brand.productDisplayName} profile`}
      title={model.displayName}
      subtitle={`Level ${model.gamificationState.level} ${model.levelTitle} \u2022 ${model.gamificationState.totalPoints} points`}
      headerPill="Member"
      showHero={false}
    >
      <ScrollView
        ref={scrollViewRef}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={internalStyles.scrollContent}
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

        <MotionInView dense delay={revealDelay(0) + 30}>
          <SectionCard
            title="Member account active"
            body="This profile is locked to the member side. Sign out here if you need to switch to an owner account."
          >
            <View style={internalStyles.sessionLockCard}>
              <View style={internalStyles.sessionCopy}>
                <Text style={internalStyles.sessionTitle}>Signed in as member</Text>
                <Text style={internalStyles.sessionBody}>
                  {model.authSession.email ?? model.displayName}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sign out"
                onPress={model.signOut}
                style={({ pressed }) => [
                  internalStyles.inlineButton,
                  pressed && internalStyles.buttonPressed,
                ]}
              >
                <Text style={internalStyles.inlineButtonText}>Sign Out</Text>
              </Pressable>
            </View>
          </SectionCard>
        </MotionInView>

        <MotionInView dense delay={revealDelay(0) + 45}>
          <MusicToggleRow />
        </MotionInView>

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

        <MotionInView dense delay={revealDelay(1)}>
          <QuickActionsGrid actions={quickActions} />
        </MotionInView>

        <MotionInView dense delay={revealDelay(2)}>
          <StatsSnapshot
            totalPoints={model.gamificationState.totalPoints}
            totalReviews={model.gamificationState.totalReviews}
            currentStreak={model.gamificationState.currentStreak}
          />
        </MotionInView>

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

        {showProductLibrary ? (
          <MotionInView dense delay={revealDelay(3) + 30}>
            <SectionCard
              title="Your brand lineup"
              body="Save brands from scans or browse the NY lineup. Sort by smell, taste, or potency to find your next favorite."
              iconName="ribbon-outline"
              badgeLabel="Brands"
              tone="primary"
            >
              <View style={internalStyles.actionStack}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open My Brands"
                  onPress={() => navigation.navigate('MyBrands')}
                  style={({ pressed }) => [
                    internalStyles.primaryButton,
                    pressed && internalStyles.buttonPressed,
                  ]}
                >
                  <Text style={internalStyles.primaryButtonText}>My Brands</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Browse all brands"
                  onPress={() => navigation.navigate('BrowseBrands')}
                  style={({ pressed }) => [
                    internalStyles.secondaryButton,
                    pressed && internalStyles.buttonPressed,
                  ]}
                >
                  <Text style={internalStyles.secondaryButtonText}>Browse brands</Text>
                </Pressable>
              </View>
            </SectionCard>
          </MotionInView>
        ) : null}

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

        <MotionInView dense delay={revealDelay(5)}>
          <View style={internalStyles.section}>
            <SectionHeader
              title="Badges"
              count={model.earnedBadges.length}
              // Always allow jumping into the trophy case so new members
              // see the full trove of milestones, not a dead-end empty state.
              onSeeAll={() => navigation.navigate('BadgeGallery')}
            />
            <BadgeShowcase
              badges={model.featuredBadges.slice(0, 3)}
              previewBadges={model.nextBadges.slice(0, 3)}
            />
          </View>
        </MotionInView>

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

export function BadgeShowcase({
  badges,
  previewBadges = [],
}: {
  badges: Array<{ icon?: string; name?: string; color?: string }>;
  /**
   * Locked badges to preview when the user hasn't earned any yet. Shown in a
   * muted/grayscale style with a lock overlay so the section never appears
   * empty. Sourced from `nextBadges` (closest measurable milestones) so the
   * preview doubles as a "what's next" teaser.
   */
  previewBadges?: Array<{
    badge: { id: string; icon?: string; name?: string; color?: string };
    label?: string;
  }>;
}) {
  if (badges.length === 0) {
    const visiblePreviews = previewBadges.slice(0, 3);
    if (visiblePreviews.length === 0) {
      return (
        <View style={internalStyles.emptyBadges}>
          <Text style={internalStyles.emptyBadgesText}>
            Earn badges by completing challenges and activities.
          </Text>
        </View>
      );
    }

    return (
      <View>
        <View style={internalStyles.badgeGrid}>
          {visiblePreviews.map((item, idx) => (
            <View key={item.badge.id ?? idx} style={internalStyles.badgeItem}>
              <View style={internalStyles.badgePreviewPlaceholder}>
                <AppUiIcon
                  name={(item.badge?.icon as AppUiIconName | undefined) ?? 'star-outline'}
                  size={26}
                  color={colors.textMuted}
                />
                <View style={internalStyles.badgeLockPip}>
                  <AppUiIcon name="lock-closed-outline" size={11} color={colors.background} />
                </View>
              </View>
              <Text
                style={internalStyles.badgePreviewLabel}
                numberOfLines={2}
                maxFontSizeMultiplier={1}
              >
                {item.badge?.name ?? 'Upcoming'}
              </Text>
              {item.label ? (
                <Text style={internalStyles.badgePreviewProgress} maxFontSizeMultiplier={1}>
                  {item.label}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
        <Text style={internalStyles.badgePreviewHint}>
          Locked previews — visit storefronts and write reviews to start unlocking.
        </Text>
      </View>
    );
  }

  return (
    <View style={internalStyles.badgeGrid}>
      {badges.map((badge, idx) => (
        <View key={idx} style={internalStyles.badgeItem}>
          <View style={internalStyles.badgePlaceholder}>
            <AppUiIcon
              name={(badge?.icon as AppUiIconName | undefined) ?? 'star-outline'}
              size={28}
              color={badge?.color ?? colors.goldSoft}
            />
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
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  loadingText: {
    ...textStyles.body,
    color: colors.textMuted,
  },
  entryCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  entryIconMember: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: 'rgba(46, 204, 113, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  entryIconOwner: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: 'rgba(245, 200, 106, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  entryCopy: {
    flex: 1,
    gap: 4,
  },
  entryTitle: {
    ...textStyles.bodyStrong,
    color: colors.text,
  },
  entryBody: {
    ...textStyles.caption,
    color: colors.textMuted,
    lineHeight: 20,
  },
  entryActions: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionStack: {
    gap: spacing.md,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: radii.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
  },
  primaryButtonText: {
    ...textStyles.bodyStrong,
    color: colors.background,
  },
  primaryButtonGold: {
    minHeight: 48,
    borderRadius: radii.md,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
  },
  primaryButtonGoldText: {
    ...textStyles.bodyStrong,
    color: colors.backgroundDeep,
  },
  secondaryButton: {
    minHeight: 46,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    backgroundColor: colors.surfaceElevated,
  },
  secondaryButtonText: {
    ...textStyles.bodyStrong,
    color: colors.text,
    textAlign: 'center',
  },
  inlineButton: {
    minHeight: 40,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: colors.surfaceElevated,
  },
  inlineButtonText: {
    ...textStyles.bodyStrong,
    color: colors.text,
    fontSize: 13,
  },
  buttonPressed: {
    opacity: 0.82,
  },
  sessionLockCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sessionCopy: {
    flex: 1,
    gap: 3,
  },
  sessionTitle: {
    ...textStyles.bodyStrong,
    color: colors.text,
  },
  sessionBody: {
    ...textStyles.caption,
    color: colors.textMuted,
    lineHeight: 20,
  },
  ownerChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(245, 200, 106, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 200, 106, 0.18)',
  },
  ownerChipText: {
    ...textStyles.caption,
    color: colors.goldSoft,
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
  badgePreviewPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.72,
  },
  badgeLockPip: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  badgePreviewLabel: {
    ...textStyles.caption,
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 11,
  },
  badgePreviewProgress: {
    ...textStyles.caption,
    color: colors.textSoft,
    textAlign: 'center',
    fontSize: 10,
    letterSpacing: 0.4,
  },
  badgePreviewHint: {
    ...textStyles.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    fontSize: 11,
    opacity: 0.8,
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