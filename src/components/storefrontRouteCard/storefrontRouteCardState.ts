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
  const hasResolvedHoursStatus = hasPublishedHours && typeof openNow === 'boolean';
  const previewStatusTone: PreviewStatusTone = hasResolvedHoursStatus
    ? openNow
      ? 'open'
      : 'closed'
    : isOperationalStatusPending
      ? 'checking'
      : !hasPublishedHours
        ? 'checking'
        : 'default';
  const baseStatusLabel = hasResolvedHoursStatus
    ? openNow
      ? 'Open Now'
      : 'Closed'
    : isOperationalStatusPending
      ? 'Checking'
      : !hasPublishedHours
        ? 'See Details'
        : 'Check Hours';

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
