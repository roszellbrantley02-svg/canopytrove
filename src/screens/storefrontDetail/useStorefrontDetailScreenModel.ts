import React from 'react';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { useStorefrontDetails } from '../../hooks/useStorefrontDetailData';
import {
  blockCommunityAuthor,
  clearBlockedCommunityAuthorsForStorefront,
  getCommunitySafetyState,
  initializeCommunitySafetyState,
  isCommunityAuthorBlocked,
  subscribeToCommunitySafetyState,
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
  const [communitySafetyState, setCommunitySafetyState] = React.useState(() =>
    getCommunitySafetyState(),
  );
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
    () =>
      appReviews.find(
        (review: AppReview) => review.isOwnReview || review.authorProfileId === profileId,
      ) ?? null,
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
          !review.authorProfileId ||
          !isCommunityAuthorBlocked(storefront.id, review.authorProfileId, communitySafetyState),
      ),
    [appReviews, communitySafetyState, storefront.id],
  );
  const hiddenReviewCount = derivedState.detailData.appReviews.length - visibleAppReviews.length;

  React.useEffect(() => {
    let alive = true;

    void initializeCommunitySafetyState().then(() => {
      if (alive) {
        setCommunitySafetyState(getCommunitySafetyState());
      }
    });
    const unsubscribe = subscribeToCommunitySafetyState((state) => {
      if (alive) {
        setCommunitySafetyState(state);
      }
    });

    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  // Hours expand/collapse state for the operational rows. Local-to-this-screen
  // since it doesn't survive nav-away. Default = collapsed (today's summary
  // only); tap to expand into the full week beneath the row.
  const [hoursExpanded, setHoursExpanded] = React.useState(false);

  // Compose the full operational rows with action handlers + the expandable
  // hours behavior. Pure data rows come from derivedState.operationalRows;
  // we layer the action handlers on top here because actions live at the
  // model layer (one level down would create a circular dep).
  const operationalRowsWithActions = React.useMemo(() => {
    return derivedState.operationalRows.map((row) => {
      if (row.id === 'phone' && derivedState.hasPhone) {
        return { ...row, onPress: actions.callStore, accessibilityHint: 'Starts a phone call.' };
      }
      if (row.id === 'website' && derivedState.hasWebsite) {
        return { ...row, onPress: actions.openWebsite, accessibilityHint: 'Opens the website.' };
      }
      if (row.id === 'menu' && derivedState.hasMenu) {
        return { ...row, onPress: actions.openMenu, accessibilityHint: 'Opens the menu.' };
      }
      if (row.id === 'hours' && derivedState.hasHours) {
        return {
          ...row,
          onPress: () => setHoursExpanded((current) => !current),
          expandable: true,
          expanded: hoursExpanded,
          expandedLines: derivedState.detailData.hours,
          accessibilityHint: hoursExpanded
            ? 'Collapses the full weekly hours.'
            : 'Expands the full weekly hours.',
        };
      }
      return row;
    });
  }, [
    actions.callStore,
    actions.openMenu,
    actions.openWebsite,
    derivedState.detailData.hours,
    derivedState.hasHours,
    derivedState.hasMenu,
    derivedState.hasPhone,
    derivedState.hasWebsite,
    derivedState.operationalRows,
    hoursExpanded,
  ]);

  return {
    detailData: {
      ...derivedState.detailData,
      appReviews: visibleAppReviews,
    },
    error,
    authSession,
    hasAnySupplementalDetail: derivedState.hasAnySupplementalDetail,
    hasAppReviews: derivedState.detailData.appReviews.length > 0,
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
    operationalRows: operationalRowsWithActions,
    pendingHelpfulReviewId: actions.pendingHelpfulReviewId,
    pendingReviewReportId: actions.pendingReviewReportId,
    markedHelpfulReviewIds: actions.markedHelpfulReviewIds,
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

      void blockCommunityAuthor({
        storefrontId: storefront.id,
        storefrontName: storefront.displayName,
        authorId: reviewAuthorProfileId,
      }).then((state) => {
        setCommunitySafetyState(state);
        setReviewModerationStatusText(
          `Reviews from this author are now hidden on ${storefront.displayName}. You can manage blocked authors later in Privacy and safety.`,
        );
      });
    },
    showHiddenReviews: () => {
      void clearBlockedCommunityAuthorsForStorefront(storefront.id).then((state) => {
        setCommunitySafetyState(state);
        setReviewModerationStatusText(
          `Hidden reviews are visible again on ${storefront.displayName}.`,
        );
      });
    },
  };
}
