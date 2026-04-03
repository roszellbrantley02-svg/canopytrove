import React from 'react';
import type {
  PreviewStatusTone,
  PreviewTone,
} from '../../components/mapGridPreview/mapGridPreviewTones';
import type { StorefrontDetails, StorefrontSummary } from '../../types/storefront';
import {
  createFallbackDetails,
  getHoursSummary,
  getWebsiteLabel,
  isPlaceholderEditorialSummary,
} from './storefrontDetailHelpers';
import { normalizeStorefrontHours } from '../../utils/storefrontHours';
import { resolveStorefrontOpenNow } from '../../utils/storefrontOperationalStatus';
import { getStorefrontRatingDisplay } from '../../utils/storefrontRatings';

export function useStorefrontDetailDerivedState({
  details,
  storefront,
  isSaved,
  isVisited,
  isOperationalDataPending,
}: {
  details: StorefrontDetails | null;
  storefront: StorefrontSummary;
  isSaved: boolean;
  isVisited: boolean;
  isOperationalDataPending: boolean;
}) {
  const detailData = React.useMemo(
    () => details ?? createFallbackDetails(storefront.id),
    [details, storefront.id],
  );
  const normalizedHours = React.useMemo(
    () => normalizeStorefrontHours(detailData.hours),
    [detailData.hours],
  );
  const normalizedDetailData = React.useMemo(
    () => ({
      ...detailData,
      hours: normalizedHours,
    }),
    [detailData, normalizedHours],
  );
  const hasWebsite = Boolean(detailData.website);
  const hasMenu = Boolean(detailData.menuUrl);
  const hasPhone = Boolean(detailData.phone);
  const editorialSummary = isPlaceholderEditorialSummary(detailData.editorialSummary)
    ? null
    : detailData.editorialSummary;
  const displayAmenities = detailData.amenities.filter(
    (amenity: string) => amenity.trim().toLowerCase() !== 'state licensed',
  );
  const hasStoreSummarySection = Boolean(editorialSummary?.trim() || displayAmenities.length);
  const hasHours = normalizedHours.length > 0;
  const hasAppReviews = detailData.appReviews.length > 0;
  const hasLiveDeals = (detailData.activePromotions?.length ?? 0) > 0;
  const visiblePhotoCount = detailData.photoUrls.length;
  const totalPhotoCount = Math.max(visiblePhotoCount, detailData.photoCount ?? visiblePhotoCount);
  const hasPhotos = visiblePhotoCount > 0;
  const lockedPhotoCount = Math.max(0, totalPhotoCount - visiblePhotoCount);
  const hasLockedPhotos = lockedPhotoCount > 0;
  const hasOperationalInfo = hasWebsite || hasMenu || hasPhone || hasHours;
  const hasAnySupplementalDetail =
    hasWebsite ||
    hasMenu ||
    hasPhone ||
    hasLiveDeals ||
    hasLockedPhotos ||
    hasStoreSummarySection ||
    hasHours ||
    hasAppReviews ||
    hasPhotos;
  const hasPromotion = Boolean(storefront.promotionText?.trim());
  const previewTone: PreviewTone = hasPromotion
    ? 'promotion'
    : isSaved
      ? 'saved'
      : isVisited
        ? 'visited'
        : 'neverVisited';
  const resolvedOpenNow = resolveStorefrontOpenNow({
    summaryOpenNow: storefront.openNow,
    detailOpenNow: detailData.openNow,
  });
  const previewStatusLabel =
    typeof resolvedOpenNow === 'boolean'
      ? resolvedOpenNow
        ? 'Open Now'
        : 'Closed'
      : isOperationalDataPending
        ? 'Checking'
        : 'Check Hours';
  const previewStatusTone: PreviewStatusTone =
    typeof resolvedOpenNow === 'boolean'
      ? resolvedOpenNow
        ? 'open'
        : 'closed'
      : isOperationalDataPending
        ? 'checking'
        : 'default';
  const getOperationalStatus = React.useCallback(
    (isAvailable: boolean) => {
      if (isAvailable) {
        return 'available' as const;
      }

      if (isOperationalDataPending) {
        return 'checking' as const;
      }

      return 'unavailable' as const;
    },
    [isOperationalDataPending],
  );
  const operationalRows = React.useMemo(
    () => [
      {
        id: 'menu',
        icon: 'restaurant-outline' as const,
        label: 'Menu',
        value: hasMenu
          ? 'Available'
          : isOperationalDataPending
            ? 'Checking live source...'
            : 'Not published',
        status: getOperationalStatus(hasMenu),
      },
      {
        id: 'website',
        icon: 'globe-outline' as const,
        label: 'Website',
        value: hasWebsite
          ? getWebsiteLabel(detailData.website)
          : isOperationalDataPending
            ? 'Checking live source...'
            : 'Not published',
        status: getOperationalStatus(hasWebsite),
      },
      {
        id: 'phone',
        icon: 'call-outline' as const,
        label: 'Phone',
        value: hasPhone
          ? (detailData.phone ?? 'Not published')
          : isOperationalDataPending
            ? 'Checking live source...'
            : 'Not published',
        status: getOperationalStatus(hasPhone),
      },
      {
        id: 'hours',
        icon: 'time-outline' as const,
        label: 'Hours',
        value: hasHours
          ? getHoursSummary(normalizedHours)
          : isOperationalDataPending
            ? 'Checking live source...'
            : 'Not published',
        status: getOperationalStatus(hasHours),
      },
    ],
    [
      detailData.phone,
      detailData.website,
      getOperationalStatus,
      hasHours,
      hasMenu,
      hasPhone,
      hasWebsite,
      isOperationalDataPending,
      normalizedHours,
    ],
  );
  const operationalCardBody = isOperationalDataPending
    ? 'Canopy Trove is checking live storefront sources for current hours and contact details.'
    : hasOperationalInfo
      ? 'Public contact details are shown here when Canopy Trove can verify them from live storefront sources.'
      : 'This storefront is on the official OCM list. Public hours and contact details have not been published.';
  const ratingDisplay = React.useMemo(
    () =>
      getStorefrontRatingDisplay({
        publishedRating: storefront.rating,
        publishedReviewCount: storefront.reviewCount,
        appReviewCount: normalizedDetailData.appReviewCount,
        appReviews: normalizedDetailData.appReviews,
      }),
    [
      normalizedDetailData.appReviewCount,
      normalizedDetailData.appReviews,
      storefront.rating,
      storefront.reviewCount,
    ],
  );

  return {
    detailData: normalizedDetailData,
    displayAmenities,
    editorialSummary,
    hasAnySupplementalDetail,
    hasAppReviews,
    hasHours,
    hasLiveDeals,
    hasLockedPhotos,
    hasMenu,
    hasOperationalInfo,
    hasPhone,
    hasPhotos,
    hasStoreSummarySection,
    hasWebsite,
    operationalCardBody,
    operationalRows,
    previewStatusLabel,
    previewStatusTone,
    previewTone,
    ratingDisplay,
    lockedPhotoCount,
    visiblePhotoCount,
  };
}
