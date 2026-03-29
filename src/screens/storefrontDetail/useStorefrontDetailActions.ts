import React from 'react';
import { Linking } from 'react-native';
import { submitStorefrontReviewHelpful } from '../../services/storefrontCommunityService';
import { trackAnalyticsEvent } from '../../services/analyticsService';
import { markStorefrontAsRecent } from '../../services/recentStorefrontService';
import { openStorefrontRoute } from '../../services/navigationService';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StorefrontSummary } from '../../types/storefront';

type UseStorefrontDetailActionsArgs = {
  detailData: {
    phone: string | null;
    website: string | null;
    menuUrl?: string | null;
  };
  navigation: NativeStackNavigationProp<RootStackParamList>;
  profileId: string;
  authSession: {
    status: 'checking' | 'signed-out' | 'anonymous' | 'authenticated' | 'disabled';
    uid: string | null;
  };
  storefront: StorefrontSummary;
};

export function useStorefrontDetailActions({
  detailData,
  navigation,
  profileId,
  authSession,
  storefront,
}: UseStorefrontDetailActionsArgs) {
  const [pendingHelpfulReviewId, setPendingHelpfulReviewId] = React.useState<string | null>(null);

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
      }
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
        }
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
      }
    );
  }, [storefront.id]);

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
      }
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
      }
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
      }
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
      }
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
        }
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
    [pendingHelpfulReviewId, profileId, storefront.id]
  );

  return {
    pendingHelpfulReviewId,
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
    openWebsite: () => {
      void openWebsite();
    },
    openMenu: () => {
      void openMenu();
    },
    reportStorefront: () => navigation.navigate('ReportStorefront', { storefront }),
    writeReview: () => navigation.navigate('WriteReview', { storefront }),
  };
}
