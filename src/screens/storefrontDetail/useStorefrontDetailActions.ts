import React from 'react';
import { Linking, Platform } from 'react-native';
import { crossPlatformAlert } from '../../utils/crossPlatformAlert';
import { useStorefrontRewardsController } from '../../context/StorefrontController';
import { getPlatformSafeStorefrontOutboundLinks } from './storefrontDetailHelpers';

/** Open a URL in a web-safe way. On web, use window.open with a
 *  location.href fallback (mobile browsers block popups outside the
 *  synchronous user-gesture context). On native, use Linking. */
async function openUrl(url: string) {
  if (Platform.OS === 'web') {
    try {
      const popup = window.open(url, '_blank', 'noopener,noreferrer');
      if (!popup) {
        window.location.href = url;
      }
    } catch {
      window.location.href = url;
    }
  } else {
    await Linking.openURL(url);
  }
}
import { submitStorefrontReviewHelpful } from '../../services/storefrontCommunityService';
import { trackAnalyticsEvent } from '../../services/analyticsService';
import { markStorefrontAsRecent } from '../../services/recentStorefrontService';
import { openStorefrontRoute } from '../../services/navigationService';
import { submitStorefrontReport } from '../../services/storefrontCommunityService';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AppProfile, AppReview, StorefrontSummary } from '../../types/storefront';

type UseStorefrontDetailActionsArgs = {
  detailData: {
    phone: string | null;
    website: string | null;
    menuUrl?: string | null;
  };
  navigation: NativeStackNavigationProp<RootStackParamList>;
  appProfile: AppProfile | null;
  profileId: string;
  authSession: {
    status: 'checking' | 'signed-out' | 'anonymous' | 'authenticated' | 'disabled';
    uid: string | null;
  };
  storefront: StorefrontSummary;
  myReview: AppReview | null;
  onReviewModerationStatusChange?: (value: string | null) => void;
};

function buildReviewModerationDescription(review: AppReview) {
  const excerpt = review.text.trim().replace(/\s+/g, ' ').slice(0, 180);

  return [
    `Review ${review.id} was flagged from the storefront detail screen.`,
    `Author: ${review.authorName}.`,
    `Rating: ${review.rating.toFixed(1)}.`,
    excerpt ? `Excerpt: "${excerpt}".` : null,
    'Reason: Possible harassment, spam, illegal claim, or other abusive content.',
  ]
    .filter(Boolean)
    .join(' ');
}

function getReportAuthorName(appProfile: AppProfile | null) {
  if (appProfile?.displayName?.trim()) {
    return appProfile.displayName.trim();
  }

  return appProfile?.kind === 'authenticated' ? 'Canopy Trove member' : 'Canopy Trove user';
}

function buildSuggestEditDescription(storefront: StorefrontSummary) {
  return `Suggested edit for ${storefront.displayName}: `;
}

function buildReportClosedDescription(storefront: StorefrontSummary) {
  return `${storefront.displayName} appears to be closed because `;
}

export function useStorefrontDetailActions({
  detailData,
  navigation,
  appProfile,
  profileId,
  authSession,
  storefront,
  myReview,
  onReviewModerationStatusChange,
}: UseStorefrontDetailActionsArgs) {
  const { trackRouteStartedReward } = useStorefrontRewardsController();
  const [pendingHelpfulReviewId, setPendingHelpfulReviewId] = React.useState<string | null>(null);
  const [pendingReviewReportId, setPendingReviewReportId] = React.useState<string | null>(null);
  const safeOutboundLinks = React.useMemo(
    () =>
      getPlatformSafeStorefrontOutboundLinks({
        platform: Platform.OS,
        website: detailData.website,
        menuUrl: detailData.menuUrl,
      }),
    [detailData.menuUrl, detailData.website],
  );

  React.useEffect(() => {
    void markStorefrontAsRecent(storefront.id);
  }, [storefront.id]);

  React.useEffect(() => {
    trackAnalyticsEvent(
      'storefront_opened',
      {
        sourceScreen: 'StorefrontDetail',
      },
      {
        screen: 'StorefrontDetail',
        storefrontId: storefront.id,
      },
    );
    if (storefront.activePromotionId) {
      trackAnalyticsEvent(
        'deal_opened',
        {
          sourceScreen: 'StorefrontDetail',
        },
        {
          screen: 'StorefrontDetail',
          storefrontId: storefront.id,
          dealId: storefront.activePromotionId,
        },
      );
    }
    trackAnalyticsEvent(
      'review_prompt_shown',
      {
        sourceScreen: 'StorefrontDetail',
      },
      {
        screen: 'StorefrontDetail',
        storefrontId: storefront.id,
      },
    );
  }, [storefront.activePromotionId, storefront.id]);

  const openWebsite = React.useCallback(async () => {
    if (!safeOutboundLinks.websiteUrl) {
      return;
    }

    trackAnalyticsEvent(
      'website_tapped',
      {
        sourceScreen: 'StorefrontDetail',
      },
      {
        screen: 'StorefrontDetail',
        storefrontId: storefront.id,
        dealId: storefront.activePromotionId ?? undefined,
      },
    );
    await openUrl(safeOutboundLinks.websiteUrl);
  }, [safeOutboundLinks.websiteUrl, storefront.activePromotionId, storefront.id]);

  const callStore = React.useCallback(async () => {
    if (!detailData.phone) {
      return;
    }

    trackAnalyticsEvent(
      'phone_tapped',
      {
        sourceScreen: 'StorefrontDetail',
      },
      {
        screen: 'StorefrontDetail',
        storefrontId: storefront.id,
        dealId: storefront.activePromotionId ?? undefined,
      },
    );
    await openUrl(`tel:${detailData.phone}`);
  }, [detailData.phone, storefront.activePromotionId, storefront.id]);

  const openMenu = React.useCallback(async () => {
    if (!safeOutboundLinks.menuUrl) {
      return;
    }

    trackAnalyticsEvent(
      'menu_tapped',
      {
        sourceScreen: 'StorefrontDetail',
      },
      {
        screen: 'StorefrontDetail',
        storefrontId: storefront.id,
        dealId: storefront.activePromotionId ?? undefined,
      },
    );
    await openUrl(safeOutboundLinks.menuUrl);
  }, [safeOutboundLinks.menuUrl, storefront.activePromotionId, storefront.id]);

  const goNow = React.useCallback(async () => {
    trackAnalyticsEvent(
      'go_now_tapped',
      {
        sourceScreen: 'StorefrontDetail',
      },
      {
        screen: 'StorefrontDetail',
        storefrontId: storefront.id,
        dealId: storefront.activePromotionId ?? undefined,
      },
    );

    if (storefront.activePromotionId) {
      trackAnalyticsEvent(
        'deal_redeem_started',
        {
          sourceScreen: 'StorefrontDetail',
        },
        {
          screen: 'StorefrontDetail',
          storefrontId: storefront.id,
          dealId: storefront.activePromotionId,
        },
      );
    }

    await openStorefrontRoute(storefront, 'verified', {
      profileId,
      accountId: authSession.status === 'authenticated' ? authSession.uid : null,
      isAuthenticated: authSession.status === 'authenticated',
      sourceScreen: 'StorefrontDetail',
      storefront,
      onRouteStarted: trackRouteStartedReward,
    });
  }, [authSession.status, authSession.uid, profileId, storefront, trackRouteStartedReward]);

  const promptCommunitySignIn = React.useCallback(
    (actionLabel: string) => {
      if (authSession.status === 'disabled') {
        crossPlatformAlert(
          'Sign in unavailable',
          `${actionLabel} requires a signed-in account, but sign-in is not available in this build right now.`,
          [{ text: 'OK', style: 'cancel' }],
        );
        return;
      }

      crossPlatformAlert(
        'Sign in required',
        `You need to sign in before you can ${actionLabel.toLowerCase()}.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign In',
            onPress: () => navigation.navigate('Tabs', { screen: 'Profile' }),
          },
        ],
      );
    },
    [authSession.status, navigation],
  );

  const markReviewHelpful = React.useCallback(
    async (reviewId: string, isOwnReview?: boolean) => {
      if (pendingHelpfulReviewId === reviewId) {
        return;
      }
      if (isOwnReview) {
        return;
      }
      if (authSession.status !== 'authenticated') {
        promptCommunitySignIn('Mark this review as helpful');
        return;
      }

      setPendingHelpfulReviewId(reviewId);
      try {
        await submitStorefrontReviewHelpful({
          storefrontId: storefront.id,
          reviewId,
          profileId,
          isOwnReview,
        });
      } finally {
        setPendingHelpfulReviewId((current) => (current === reviewId ? null : current));
      }
    },
    [authSession.status, pendingHelpfulReviewId, profileId, promptCommunitySignIn, storefront.id],
  );

  const submitReviewReport = React.useCallback(
    async (review: AppReview) => {
      if (pendingReviewReportId === review.id || review.isOwnReview) {
        return;
      }
      if (authSession.status !== 'authenticated') {
        promptCommunitySignIn('Report a review');
        return;
      }

      setPendingReviewReportId(review.id);
      onReviewModerationStatusChange?.(null);

      try {
        await submitStorefrontReport({
          storefrontId: storefront.id,
          profileId,
          authorName: getReportAuthorName(appProfile),
          reason: 'Review content issue',
          description: buildReviewModerationDescription(review),
          reportTarget: 'review',
          reportedReviewId: review.id,
          reportedReviewAuthorName: review.authorName,
          reportedReviewExcerpt: review.text.trim().replace(/\s+/g, ' ').slice(0, 180),
        });

        trackAnalyticsEvent(
          'report_submitted',
          {
            sourceScreen: 'StorefrontDetail',
            reason: 'Review content issue',
            target: 'review',
          },
          {
            screen: 'StorefrontDetail',
            storefrontId: storefront.id,
          },
        );

        onReviewModerationStatusChange?.(
          'Review reported. Our team now has the flagged review and your notes.',
        );
      } catch (error) {
        onReviewModerationStatusChange?.(
          error instanceof Error
            ? error.message
            : 'Could not report that review right now. Try again in a moment.',
        );
      } finally {
        setPendingReviewReportId((current) => (current === review.id ? null : current));
      }
    },
    [
      appProfile,
      authSession.status,
      onReviewModerationStatusChange,
      pendingReviewReportId,
      profileId,
      promptCommunitySignIn,
      storefront.id,
    ],
  );

  const reportReview = React.useCallback(
    (review: AppReview) => {
      if (review.isOwnReview) {
        return;
      }
      if (authSession.status !== 'authenticated') {
        promptCommunitySignIn('Report a review');
        return;
      }

      crossPlatformAlert(
        'Report this review?',
        'Use reports for harassment, spam, illegal claims, or other abusive content. Block only hides the author on this storefront for your account.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Report Review',
            style: 'destructive',
            onPress: () => {
              void submitReviewReport(review);
            },
          },
        ],
      );
    },
    [authSession.status, promptCommunitySignIn, submitReviewReport],
  );

  return {
    pendingHelpfulReviewId,
    pendingReviewReportId,
    callStore: () => {
      void callStore();
    },
    goBack: () => {
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('Tabs', { screen: 'Nearby' } as never);
      }
    },
    goNow: () => {
      void goNow();
    },
    markReviewHelpful: (reviewId: string, isOwnReview?: boolean) => {
      void markReviewHelpful(reviewId, isOwnReview);
    },
    reportReview,
    openWebsite: () => {
      void openWebsite();
    },
    openMenu: () => {
      void openMenu();
    },
    suggestStorefrontEdit: () => {
      navigation.navigate('ReportStorefront', {
        storefront,
        entryMode: 'suggest_edit',
        initialReason: 'Listing issue',
        initialDescription: buildSuggestEditDescription(storefront),
      });
    },
    reportStorefrontClosed: () => {
      navigation.navigate('ReportStorefront', {
        storefront,
        entryMode: 'report_closed',
        initialReason: 'Store closed',
        initialDescription: buildReportClosedDescription(storefront),
      });
    },
    reportStorefront: () => {
      navigation.navigate('ReportStorefront', {
        storefront,
        entryMode: 'general_report',
      });
    },
    writeReview: () => {
      if (authSession.status !== 'authenticated') {
        crossPlatformAlert(
          'Sign in required',
          'You need to sign in before you can leave a review.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Sign In',
              onPress: () => navigation.navigate('Tabs', { screen: 'Profile' }),
            },
          ],
        );
        return;
      }
      navigation.navigate('WriteReview', {
        storefront,
        existingReview: myReview ?? undefined,
      });
    },
  };
}
