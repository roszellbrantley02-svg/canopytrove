import React from 'react';
import { Platform } from 'react-native';
import type {
  PreviewStatusTone,
  PreviewTone,
} from '../../components/mapGridPreview/mapGridPreviewTones';
import type { StorefrontDetails, StorefrontSummary } from '../../types/storefront';
import {
  createFallbackDetails,
  getPlatformSafeStorefrontOutboundLinks,
  getHoursSummary,
  getWebsiteLabel,
  isPlaceholderEditorialSummary,
} from './storefrontDetailHelpers';
import { normalizeStorefrontHours } from '../../utils/storefrontHours';
import { resolveStorefrontOpenNow } from '../../utils/storefrontOperationalStatus';
import { getStorefrontRatingDisplay } from '../../utils/storefrontRatings';

export function getStorefrontDetailPreviewStatus({
  hasHours,
  hasWebsite,
  hasMenu,
  resolvedOpenNow,
  isOperationalDataPending,
}: {
  hasHours: boolean;
  hasWebsite: boolean;
  hasMenu: boolean;
  resolvedOpenNow: boolean | null;
  isOperationalDataPending: boolean;
}) {
  const hasResolvedHoursStatus = hasHours && typeof resolvedOpenNow === 'boolean';

  if (hasResolvedHoursStatus) {
    return {
      previewStatusLabel: resolvedOpenNow ? 'Open Now' : 'Closed',
      previewStatusTone: (resolvedOpenNow ? 'open' : 'closed') as PreviewStatusTone,
    };
  }

  if (isOperationalDataPending) {
    return {
      previewStatusLabel: 'Checking',
      previewStatusTone: 'checking' as PreviewStatusTone,
    };
  }

  if (!hasHours) {
    return {
      previewStatusLabel: hasWebsite || hasMenu ? 'Check Website' : 'See Details',
      previewStatusTone: 'checking' as PreviewStatusTone,
    };
  }

  return {
    previewStatusLabel: 'Check Hours',
    previewStatusTone: 'default' as PreviewStatusTone,
  };
}

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
  const safeOutboundLinks = React.useMemo(
    () =>
      getPlatformSafeStorefrontOutboundLinks({
        platform: Platform.OS,
        website: detailData.website,
        menuUrl: detailData.menuUrl,
      }),
    [detailData.menuUrl, detailData.website],
  );
  const hasWebsite = Boolean(safeOutboundLinks.websiteUrl);
  const hasMenu = Boolean(safeOutboundLinks.menuUrl);
  const hasPhone = Boolean(detailData.phone);
  const isAndroid = Platform.OS === 'android';
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
    hours: normalizedHours,
    summaryOpenNow: storefront.openNow,
    detailOpenNow: detailData.openNow,
  });
  const { previewStatusLabel, previewStatusTone } = getStorefrontDetailPreviewStatus({
    hasHours,
    hasWebsite,
    hasMenu,
    resolvedOpenNow,
    isOperationalDataPending,
  });
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
    () =>
      [
        !isAndroid
          ? {
              id: 'menu',
              icon: 'restaurant-outline' as const,
              label: 'Menu',
              value: hasMenu
                ? 'Available'
                : isOperationalDataPending
                  ? 'Checking...'
                  : 'Not listed',
              status: getOperationalStatus(hasMenu),
            }
          : null,
        {
          id: 'website',
          icon: 'globe-outline' as const,
          label: 'Website',
          value: hasWebsite
            ? getWebsiteLabel(safeOutboundLinks.websiteUrl)
            : isOperationalDataPending
              ? 'Checking...'
              : 'Not listed',
          status: getOperationalStatus(hasWebsite),
        },
        {
          id: 'phone',
          icon: 'call-outline' as const,
          label: 'Phone',
          value: hasPhone
            ? (detailData.phone ?? 'Not listed')
            : isOperationalDataPending
              ? 'Checking...'
              : 'Not listed',
          status: getOperationalStatus(hasPhone),
        },
        {
          id: 'hours',
          icon: 'time-outline' as const,
          label: 'Hours',
          value: hasHours
            ? getHoursSummary(normalizedHours)
            : isOperationalDataPending
              ? 'Checking...'
              : 'Not listed',
          status: getOperationalStatus(hasHours),
        },
      ].filter(
        (
          row,
        ): row is {
          id: string;
          icon: 'restaurant-outline' | 'globe-outline' | 'call-outline' | 'time-outline';
          label: string;
          value: string;
          status: 'available' | 'checking' | 'unavailable';
        } => row !== null,
      ),
    [
      detailData.phone,
      getOperationalStatus,
      hasHours,
      hasMenu,
      hasPhone,
      hasWebsite,
      isOperationalDataPending,
      isAndroid,
      normalizedHours,
      safeOutboundLinks.websiteUrl,
    ],
  );
  const operationalCardBody = isOperationalDataPending
    ? 'Checking the latest hours and contact details for this storefront.'
    : hasOperationalInfo
      ? isAndroid
        ? 'Hours, website, and phone details are shown here when they are available.'
        : 'Hours, website, menu, and phone details are shown here when they are available.'
      : 'Hours and contact details have not been added for this storefront yet.';
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
