import type { StorefrontDetails } from '../../types/storefront';
import { normalizeStorefrontHours } from '../../utils/storefrontHours';

export function createFallbackDetails(storefrontId: string): StorefrontDetails {
  return {
    storefrontId,
    phone: null,
    website: null,
    hours: [],
    openNow: null,
    hasOwnerClaim: false,
    activePromotions: [],
    appReviewCount: 0,
    appReviews: [],
    photoUrls: [],
    amenities: [],
    editorialSummary: null,
    routeMode: 'verified',
  };
}

export function isPlaceholderEditorialSummary(value: string | null) {
  return (
    value?.trim().toLowerCase() ===
    'verified adult-use storefront from the new york ocm public dispensary verification list.'.toLowerCase()
  );
}

export function getWebsiteLabel(website: string | null) {
  if (!website) {
    return 'Not published yet';
  }

  try {
    return new URL(website).hostname.replace(/^www\./i, '');
  } catch {
    return website.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  }
}

export function getHoursSummary(hours: string[]) {
  const normalizedHours = normalizeStorefrontHours(hours);
  if (!normalizedHours.length) {
    return 'Hours not published yet';
  }

  return `${normalizedHours.length}-day schedule available`;
}
