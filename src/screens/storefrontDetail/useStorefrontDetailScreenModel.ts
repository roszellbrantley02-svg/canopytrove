import React from 'react';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { useStorefrontDetails } from '../../hooks/useStorefrontDetailData';
import {
  blockCommunityAuthor,
  getCommunitySafetyState,
  initializeCommunitySafetyState,
} from '../../services/communitySafetyService';
import {
  useStorefrontProfileController,
  useStorefrontRewardsController,
  useStorefrontRouteController,
} from '../../context/StorefrontController';
import type { AppReview, StorefrontSummary } from '../../types/storefront';
import { useStorefrontDetailActions } from './useStorefrontDetailActions';
import { useStorefrontDetailDerivedState } from './useStorefrontDetailDerivedState';

export function useStorefrontDetailScreenModel(
  storefront: StorefrontSummary,
  navigation: NativeStackNavigationProp<RootStackParamList>,
) {
  const { isSavedStorefront, toggleSavedStorefront } = useStorefrontRouteController();
  const { appProfile, profileId, authSession } = useStorefrontProfileController();
  const {
    gamificationState: { visitedStorefrontIds },
  } = useStorefrontRewardsController();
  const {
    data: details,
    isLoading,
    isOperationalDataPending,
    error,
  } = useStorefrontDetails(storefront.id, storefront);
  const [blockedAuthorProfileIds, setBlockedAuthorProfileIds] = React.useState<string[]>([]);
  const [reviewModerationStatusText, setReviewModerationStatusText] = React.useState<string | null>(
    null,
  );
  const isSaved = isSavedStorefront(storefront.id);
  const isVisited = visitedStorefrontIds.includes(storefront.id);
  const derivedState = useStorefrontDetailDerivedState({
    details,
    storefront,
    isSaved,
    isVisited,
    isOperationalDataPending,
  });
  const appReviews = derivedState.detailData.appReviews;
  const myReview = React.useMemo(
    () => appReviews.find((review: AppReview) => review.authorProfileId === profileId) ?? null,
    [appReviews, profileId],
  );
  const actions = useStorefrontDetailActions({
    detailData: derivedState.detailData,
    navigation,
    appProfile,
    profileId,
    authSession,
    storefront,
    myReview,
    onReviewModerationStatusChange: setReviewModerationStatusText,
  });
  const visibleAppReviews = React.useMemo(
    () =>
      appReviews.filter(
        (review: AppReview) =>
          !review.authorProfileId || !blockedAuthorProfileIds.includes(review.authorProfileId),
      ),
    [blockedAuthorProfileIds, appReviews],
  );
  const hiddenReviewCount = derivedState.detailData.appReviews.length - visibleAppReviews.length;

  React.useEffect(() => {
    let alive = true;

    void initializeCommunitySafetyState().then(() => {
      if (alive) {
        setBlockedAuthorProfileIds(getCommunitySafetyState().blockedAuthorProfileIds);
      }
    });

    return () => {
      alive = false;
    };
  }, []);

  return {
    detailData: {
      ...derivedState.detailData,
      appReviews: visibleAppReviews,
    },
    error,
    authSession,
    hasAnySupplementalDetail: derivedState.hasAnySupplementalDetail,
    hasAppReviews: visibleAppReviews.length > 0,
    hasHours: derivedState.hasHours,
    hasLockedPhotos: derivedState.hasLockedPhotos,
    hasMenu: derivedState.hasMenu,
    hasOperationalInfo: derivedState.hasOperationalInfo,
    hasPhone: derivedState.hasPhone,
    hasPhotos: derivedState.hasPhotos,
    hasStoreSummarySection: derivedState.hasStoreSummarySection,
    hasWebsite: derivedState.hasWebsite,
    isLoading,
    isOperationalDataPending,
    isSaved,
    navigation,
    operationalCardBody: derivedState.operationalCardBody,
    operationalRows: derivedState.operationalRows,
    pendingHelpfulReviewId: actions.pendingHelpfulReviewId,
    pendingReviewReportId: actions.pendingReviewReportId,
    previewStatusLabel: derivedState.previewStatusLabel,
    previewStatusTone: derivedState.previewStatusTone,
    previewTone: derivedState.previewTone,
    ratingDisplay: derivedState.ratingDisplay,
    lockedPhotoCount: derivedState.lockedPhotoCount,
    visiblePhotoCount: derivedState.visiblePhotoCount,
    profileId,
    reviewModerationStatusText,
    hiddenReviewCount,
    displayAmenities: derivedState.displayAmenities,
    editorialSummary: derivedState.editorialSummary,
    storefront,
    toggleSavedStorefront,
    goBack: actions.goBack,
    goNow: actions.goNow,
    openWebsite: actions.openWebsite,
    openMenu: actions.openMenu,
    callStore: actions.callStore,
    writeReview: actions.writeReview,
    writeReviewLabel: myReview ? 'Edit Review' : 'Write Review',
    suggestStorefrontEdit: actions.suggestStorefrontEdit,
    reportStorefrontClosed: actions.reportStorefrontClosed,
    reportStorefront: actions.reportStorefront,
    reportReview: actions.reportReview,
    markReviewHelpful: actions.markReviewHelpful,
    blockReviewAuthor: (reviewAuthorProfileId: string | null) => {
      if (!reviewAuthorProfileId) {
        return;
      }

      void blockCommunityAuthor(reviewAuthorProfileId).then((state) => {
        setBlockedAuthorProfileIds(state.blockedAuthorProfileIds);
        setReviewModerationStatusText(
          'Review author blocked. Their reviews are now hidden on this device and can be managed in Privacy and safety.',
        );
      });
    },
  };
}
