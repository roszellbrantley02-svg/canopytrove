import React from 'react';
import { Animated, AppState, AppStateStatus, StyleSheet, Text, View } from 'react-native';
import type { NavigationContainerRef } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useStorefrontProfileController,
  useStorefrontRewardsController,
  useStorefrontRouteController,
} from '../context/StorefrontController';
import { RootStackParamList } from '../navigation/RootNavigator';
import { HapticPressable } from './HapticPressable';
import { trackAnalyticsEvent } from '../services/analyticsService';
import {
  dismissPostVisitPrompt,
  evaluatePostVisitJourney,
  getPostVisitFollowUpState,
  initializePostVisitPrompts,
  markPostVisitJourneyBackgrounded,
  subscribeToPostVisitFollowUpState,
  syncPostVisitPromptForProfile,
} from '../services/postVisitPromptService';
import { colors, radii, spacing, typography } from '../theme/tokens';

type PostVisitPromptHostProps = {
  navigationRef: React.RefObject<NavigationContainerRef<RootStackParamList> | null>;
};

export function PostVisitPromptHost({ navigationRef }: PostVisitPromptHostProps) {
  const insets = useSafeAreaInsets();
  const { authSession, profileId } = useStorefrontProfileController();
  const { isSavedStorefront, toggleSavedStorefront } = useStorefrontRouteController();
  const {
    gamificationState: { badges },
  } = useStorefrontRewardsController();

  const [followUpState, setFollowUpState] = React.useState(() => getPostVisitFollowUpState());
  const opacity = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(28)).current;
  const appStateRef = React.useRef<AppStateStatus>(AppState.currentState);
  const lastShownPromptIdRef = React.useRef<string | null>(null);

  const pendingPrompt = followUpState.pendingPrompt;
  const isSaved = pendingPrompt ? isSavedStorefront(pendingPrompt.storefront.id) : false;
  const hasBadges = badges.length > 0;
  const isGuestFirstVisit = pendingPrompt?.promptKind === 'guest_first_visit';

  React.useEffect(() => {
    let isActive = true;

    void initializePostVisitPrompts().then((nextState) => {
      if (isActive) {
        setFollowUpState(nextState);
      }
    });

    const unsubscribe = subscribeToPostVisitFollowUpState((nextState) => {
      if (isActive) {
        setFollowUpState(nextState);
      }
    });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, []);

  React.useEffect(() => {
    void syncPostVisitPromptForProfile(
      profileId,
      authSession.status === 'authenticated',
      authSession.status === 'authenticated' ? authSession.uid : null
    );
  }, [authSession.status, authSession.uid, profileId]);

  React.useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextAppState;

      if (
        (previousState === 'active' || previousState === 'unknown') &&
        (nextAppState === 'background' || nextAppState === 'inactive')
      ) {
        void markPostVisitJourneyBackgrounded();
        return;
      }

      if (
        (previousState === 'background' || previousState === 'inactive') &&
        nextAppState === 'active'
      ) {
        void evaluatePostVisitJourney();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  React.useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: pendingPrompt ? 1 : 0,
        duration: pendingPrompt ? 200 : 160,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: pendingPrompt ? 0 : 28,
        tension: 165,
        friction: 18,
        useNativeDriver: true,
      }),
    ]);

    animation.start();

    return () => {
      animation.stop();
    };
  }, [opacity, pendingPrompt, translateY]);

  React.useEffect(() => {
    if (!pendingPrompt || lastShownPromptIdRef.current === pendingPrompt.id) {
      return;
    }

    lastShownPromptIdRef.current = pendingPrompt.id;
    trackAnalyticsEvent(
      'post_visit_prompt_shown',
      {
        source: pendingPrompt.source,
        hasBadges,
        promptKind: pendingPrompt.promptKind,
      },
      {
        screen: 'PostVisitPrompt',
        storefrontId: pendingPrompt.storefront.id,
      }
    );
  }, [hasBadges, pendingPrompt]);

  const dismissPrompt = React.useCallback(
    (
      eventType:
        | 'post_visit_prompt_dismissed'
        | 'post_visit_prompt_save_tapped'
        | 'post_visit_prompt_review_tapped'
        | 'post_visit_prompt_badge_tapped'
    ) => {
      if (!pendingPrompt) {
        return Promise.resolve();
      }

      trackAnalyticsEvent(
        eventType,
        {
          source: pendingPrompt.source,
          hasBadges,
          promptKind: pendingPrompt.promptKind,
        },
        {
          screen: 'PostVisitPrompt',
          storefrontId: pendingPrompt.storefront.id,
        }
      );

      return dismissPostVisitPrompt().then(() => undefined);
    },
    [hasBadges, pendingPrompt]
  );

  const handleDismiss = React.useCallback(() => {
    void dismissPrompt('post_visit_prompt_dismissed');
  }, [dismissPrompt]);

  const handleSave = React.useCallback(() => {
    if (!pendingPrompt) {
      return;
    }

    if (!isSaved) {
      toggleSavedStorefront(pendingPrompt.storefront.id);
    }

    void dismissPrompt('post_visit_prompt_save_tapped');
  }, [dismissPrompt, isSaved, pendingPrompt, toggleSavedStorefront]);

  const handleLeaveReview = React.useCallback(() => {
    if (!pendingPrompt) {
      return;
    }

    void dismissPrompt('post_visit_prompt_review_tapped').then(() => {
      navigationRef.current?.navigate('WriteReview', {
        storefront: pendingPrompt.storefront,
      });
    });
  }, [dismissPrompt, navigationRef, pendingPrompt]);

  const handleOpenBadges = React.useCallback(() => {
    if (!pendingPrompt) {
      return;
    }

    void dismissPrompt('post_visit_prompt_badge_tapped').then(() => {
      navigationRef.current?.navigate('Tabs', {
        screen: 'Profile',
      });
    });
  }, [dismissPrompt, navigationRef, pendingPrompt]);

  if (!pendingPrompt) {
    return null;
  }

  const title = 'Tell us how your visit was.';

  const body = isGuestFirstVisit
    ? `You made it to ${pendingPrompt.storefront.displayName}. Save this shop, leave a review, and earn your first badge on Canopy Trove.`
    : hasBadges
      ? `You made it to ${pendingPrompt.storefront.displayName}. Leave a review or check your badge progress.`
      : `You made it to ${pendingPrompt.storefront.displayName}. Leave a review and unlock your first badge on Canopy Trove.`;

  return (
    <View pointerEvents="box-none" style={[styles.container, { paddingBottom: insets.bottom + 90 }]}>
      <Animated.View
        style={[
          styles.card,
          {
            opacity,
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>Arrival prompt</Text>
            <Text style={styles.title}>{title}</Text>
          </View>
          <HapticPressable onPress={handleDismiss} style={styles.dismissButton}>
            <Ionicons name="close" size={18} color={colors.textSoft} />
          </HapticPressable>
        </View>
        <Text style={styles.body}>{body}</Text>
        <View style={styles.actionRow}>
          <HapticPressable
            disabled={isSaved}
            onPress={handleSave}
            style={[styles.secondaryButton, isSaved && styles.buttonDisabled]}
          >
            <Ionicons
              name={isSaved ? 'bookmark' : 'bookmark-outline'}
              size={16}
              color={isSaved ? colors.primary : colors.text}
            />
            <Text style={styles.secondaryButtonText}>{isSaved ? 'Saved' : 'Save Shop'}</Text>
          </HapticPressable>
          <HapticPressable onPress={handleLeaveReview} style={styles.primaryButton}>
            <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.background} />
            <Text style={styles.primaryButtonText}>Leave Review</Text>
          </HapticPressable>
        </View>
        <HapticPressable onPress={handleOpenBadges} style={styles.tertiaryButton}>
          <Ionicons name="trophy-outline" size={16} color={colors.text} />
          <Text style={styles.tertiaryButtonText}>{hasBadges ? 'View Badges' : 'Earn First Badge'}</Text>
        </HapticPressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
  },
  card: {
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: 1.75,
    borderColor: colors.borderStrong,
    padding: spacing.lg,
    gap: spacing.md,
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
    elevation: 16,
  },
  headerRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  headerCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  title: {
    color: colors.text,
    fontSize: typography.section,
    fontWeight: '900',
    lineHeight: 24,
  },
  dismissButton: {
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  body: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  primaryButtonText: {
    color: colors.background,
    fontSize: typography.body,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.45,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '800',
  },
  tertiaryButton: {
    minHeight: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  tertiaryButtonText: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
});
