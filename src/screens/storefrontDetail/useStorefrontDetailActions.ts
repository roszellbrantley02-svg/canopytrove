import React from 'react';
import { Alert, Linking } from 'react-native';
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
    `Author: ${review.authorName}${review.authorProfileId ? ` (${review.authorProfileId})` : ''}.`,
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
  const [pendingHelpfulReviewId, setPendingHelpfulReviewId] = React.useState<string | null>(null);
  const [pendingReviewReportId, setPendingReviewReportId] = React.useState<string | null>(null);

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
    if (!detailData.website) {
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
    await Linking.openURL(detailData.website);
  }, [detailData.website, storefront.activePromotionId, storefront.id]);

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
    await Linking.openURL(`tel:${detailData.phone}`);
  }, [detailData.phone, storefront.activePromotionId, storefront.id]);

  const openMenu = React.useCallback(async () => {
    if (!detailData.menuUrl) {
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
    await Linking.openURL(detailData.menuUrl);
  }, [detailData.menuUrl, storefront.activePromotionId, storefront.id]);

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
    });
  }, [authSession.status, authSession.uid, profileId, storefront]);

  const markReviewHelpful = React.useCallback(
    async (reviewId: string, reviewAuthorProfileId: string | null) => {
      if (pendingHelpfulReviewId === reviewId) {
        return;
      }

      setPendingHelpfulReviewId(reviewId);
      try {
        await submitStorefrontReviewHelpful({
          storefrontId: storefront.id,
          reviewId,
          profileId,
          reviewAuthorProfileId,
        });
      } finally {
        setPendingHelpfulReviewId((current) => (current === reviewId ? null : current));
      }
    },
    [pendingHelpfulReviewId, profileId, storefront.id],
  );

  const submitReviewReport = React.useCallback(
    async (review: AppReview) => {
      if (pendingReviewReportId === review.id || review.authorProfileId === profileId) {
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
          'Review reported. The moderation queue has the flagged review and supporting context now.',
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
    [appProfile, onReviewModerationStatusChange, pendingReviewReportId, profileId, storefront.id],
  );

  const reportReview = React.useCallback(
    (review: AppReview) => {
      if (review.authorProfileId === profileId) {
        return;
      }

      Alert.alert(
        'Report this review?',
        'Use reports for harassment, spam, illegal claims, or other abusive content. Block only hides the author on this device.',
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
    [profileId, submitReviewReport],
  );

  return {
    pendingHelpfulReviewId,
    pendingReviewReportId,
    callStore: () => {
      void callStore();
    },
    goBack: () => navigation.goBack(),
    goNow: () => {
      void goNow();
    },
    markReviewHelpful: (reviewId: string, reviewAuthorProfileId: string | null) => {
      void markReviewHelpful(reviewId, reviewAuthorProfileId);
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
    writeReview: () =>
      navigation.navigate('WriteReview', {
        storefront,
        existingReview: myReview ?? undefined,
      }),
  };
}
