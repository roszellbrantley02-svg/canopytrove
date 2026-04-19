import type { PreviewStatusTone } from '../mapGridPreview/mapGridPreviewTones';
import type { StorefrontSummary } from '../../types/storefront';
import { getUSHolidayInfo } from '../../utils/holidayUtils';
import { hasPublishedStorefrontHours } from '../../utils/storefrontHours';
import { getStorefrontCardVisualLane } from './storefrontRouteCardVisualState';

export function getStorefrontRouteCardHoursState(storefront: Pick<StorefrontSummary, 'hours'>) {
  return hasPublishedStorefrontHours(storefront.hours);
}

export function getStorefrontRouteCardState({
  isSaved,
  isVisited,
  hasPromotion,
  premiumCardVariant,
  openNow,
  isOperationalStatusPending,
  hasPublishedHours,
}: {
  isSaved: boolean;
  isVisited: boolean;
  hasPromotion: boolean;
  premiumCardVariant?: StorefrontSummary['premiumCardVariant'];
  openNow: boolean | null;
  isOperationalStatusPending: boolean;
  hasPublishedHours: boolean;
}) {
  const cardVisualLane = getStorefrontCardVisualLane({
    isSaved,
    isVisited,
    hasPromotion,
    premiumCardVariant,
  });
  // Trust a resolved openNow boolean even when hours haven't been published.
  // Android builds routinely land on the `hours=[]` path (no placeId yet,
  // Google Places enrichment hasn't backfilled, or the published hours
  // shipped as the "Hours not published yet" placeholder that the normalizer
  // strips). In those cases the backend still supplies a summary-level
  // `openNow` value derived from Google's `currentOpeningHours.openNow`, and
  // `useStorefrontOperationalStatus` falls through `computeOpenNow` to that
  // static boolean. We should render "Open Now" / "Closed" whenever that
  // resolved value is known — the old `hasPublishedHours &&` guard was
  // collapsing those cases to "See Details" and making listing cards feel
  // broken on Android. The detail screen already did this — commit
  // e45d43c — this is the same fix for the card layer.
  const hasResolvedHoursStatus = typeof openNow === 'boolean';
  const previewStatusTone: PreviewStatusTone = hasResolvedHoursStatus
    ? openNow
      ? 'open'
      : 'closed'
    : isOperationalStatusPending
      ? 'checking'
      : 'checking';
  const baseStatusLabel = hasResolvedHoursStatus
    ? openNow
      ? 'Open Now'
      : 'Closed'
    : isOperationalStatusPending
      ? 'Checking'
      : 'See Details';

  const holiday = getUSHolidayInfo();
  const previewStatusLabel = holiday
    ? `${baseStatusLabel} \u00B7 ${holiday.notice}`
    : baseStatusLabel;

  return {
    cardVisualLane,
    previewStatusTone,
    previewStatusLabel,
  };
}
