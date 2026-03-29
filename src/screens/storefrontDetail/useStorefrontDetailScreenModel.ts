import React from 'react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { useStorefrontDetails } from '../../hooks/useStorefrontData';
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
import { AppReview, StorefrontSummary } from '../../types/storefront';
import { useStorefrontDetailActions } from './useStorefrontDetailActions';
import { useStorefrontDetailDerivedState } from './useStorefrontDetailDerivedState';

export function useStorefrontDetailScreenModel(
  storefront: StorefrontSummary,
  navigation: NativeStackNavigationProp<RootStackParamList>
) {
  const { isSavedStorefront, toggleSavedStorefront } = useStorefrontRouteController();
  const { profileId, authSession } = useStorefrontProfileController();
  const {
    gamificationState: { visitedStorefrontIds },
  } = useStorefrontRewardsController();
  const { data: details, isLoading, isOperationalDataPending, error } = useStorefrontDetails(
    storefront.id,
    storefront
  );
  const [blockedAuthorProfileIds, setBlockedAuthorProfileIds] = React.useState<string[]>([]);
  const isSaved = isSavedStorefront(storefront.id);
  const isVisited = visitedStorefrontIds.includes(storefront.id);
  const derivedState = useStorefrontDetailDerivedState({
    details,
    storefront,
    isSaved,
    isVisited,
    isOperationalDataPending,
  });
  const actions = useStorefrontDetailActions({
    detailData: derivedState.detailData,
    navigation,
    profileId,
    authSession,
    storefront,
  });
  const visibleAppReviews = React.useMemo(
    () =>
      derivedState.detailData.appReviews.filter(
        (review: AppReview) =>
          !review.authorProfileId ||
          !blockedAuthorProfileIds.includes(review.authorProfileId)
      ),
    [blockedAuthorProfileIds, derivedState.detailData.appReviews]
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
    hasAnySupplementalDetail: derivedState.hasAnySupplementalDetail,
    hasAppReviews: visibleAppReviews.length > 0,
    hasHours: derivedState.hasHours,
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
    previewStatusLabel: derivedState.previewStatusLabel,
    previewStatusTone: derivedState.previewStatusTone,
    previewTone: derivedState.previewTone,
    ratingDisplay: derivedState.ratingDisplay,
    profileId,
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
    reportStorefront: actions.reportStorefront,
    markReviewHelpful: actions.markReviewHelpful,
    blockReviewAuthor: (reviewAuthorProfileId: string | null) => {
      if (!reviewAuthorProfileId) {
        return;
      }

      void blockCommunityAuthor(reviewAuthorProfileId).then((state) => {
        setBlockedAuthorProfileIds(state.blockedAuthorProfileIds);
      });
    },
  };
}
