import type { StorefrontDetails } from '../../types/storefront';
import { normalizeStorefrontHours } from '../../utils/storefrontHours';

const ANDROID_BLOCKED_OUTBOUND_HOSTS = [
  'dutchie.com',
  'dutchie.app',
  'iheartjane.com',
  'jane.app',
  'leafly.com',
  'weedmaps.com',
];

const ANDROID_BLOCKED_PATH_SEGMENTS = [
  'menu',
  'menus',
  'order',
  'orders',
  'shop',
  'pickup',
  'delivery',
  'reserve',
  'cart',
  'products',
  'product',
  'preorder',
];

function normalizeUrl(url: string | null | undefined) {
  const trimmed = url?.trim();
  return trimmed ? trimmed : null;
}

function isAndroidRestrictedOutboundUrl(url: string | null) {
  if (!url) {
    return false;
  }

  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^www\./i, '').toLowerCase();
    const pathParts = parsed.pathname
      .toLowerCase()
      .split('/')
      .map((part) => part.trim())
      .filter(Boolean);

    if (ANDROID_BLOCKED_OUTBOUND_HOSTS.some((blockedHost) => hostname === blockedHost)) {
      return true;
    }

    return pathParts.some((part) => ANDROID_BLOCKED_PATH_SEGMENTS.includes(part));
  } catch {
    const lowered = url.toLowerCase();
    return (
      ANDROID_BLOCKED_OUTBOUND_HOSTS.some((blockedHost) => lowered.includes(blockedHost)) ||
      ANDROID_BLOCKED_PATH_SEGMENTS.some((segment) => lowered.includes(`/${segment}`))
    );
  }
}

export function getPlatformSafeStorefrontOutboundLinks({
  platform,
  website,
  menuUrl,
}: {
  platform: string;
  website: string | null;
  menuUrl?: string | null;
}) {
  const normalizedWebsite = normalizeUrl(website);
  const normalizedMenuUrl = normalizeUrl(menuUrl);

  if (platform !== 'android') {
    return {
      websiteUrl: normalizedWebsite,
      menuUrl: normalizedMenuUrl,
    };
  }

  return {
    websiteUrl: isAndroidRestrictedOutboundUrl(normalizedWebsite) ? null : normalizedWebsite,
    menuUrl: null,
  };
}

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
