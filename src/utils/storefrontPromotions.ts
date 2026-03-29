import { StorefrontSummary } from '../types/storefront';

export const MAX_STOREFRONT_PROMOTION_BADGES = 5;
const MAX_STOREFRONT_PROMOTION_BADGE_LENGTH = 24;

function normalizePromotionBadge(value: string) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, MAX_STOREFRONT_PROMOTION_BADGE_LENGTH);
}

export function normalizeStorefrontPromotionBadges(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const badges: string[] = [];

  for (const value of values) {
    if (typeof value !== 'string') {
      continue;
    }

    const normalized = normalizePromotionBadge(value);
    const dedupeKey = normalized.toLowerCase();
    if (!normalized || seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    badges.push(normalized);

    if (badges.length >= MAX_STOREFRONT_PROMOTION_BADGES) {
      break;
    }
  }

  return badges;
}

export function getStorefrontPromotionBadges(
  summary: Pick<StorefrontSummary, 'promotionBadges' | 'promotionText'>
) {
  if (summary.promotionBadges?.length) {
    return normalizeStorefrontPromotionBadges(summary.promotionBadges);
  }

  if (summary.promotionText?.trim()) {
    return normalizeStorefrontPromotionBadges(
      summary.promotionText
        .split(/[|•]/g)
        .map((value) => value.trim())
        .filter(Boolean)
    );
  }

  return [];
}

export function getStorefrontPromotionTextFromBadges(badges: string[]) {
  const normalized = normalizeStorefrontPromotionBadges(badges);
  return normalized.length ? normalized.join(' • ') : null;
}

export function hasStorefrontPromotion(
  summary: Pick<StorefrontSummary, 'promotionBadges' | 'promotionText'>
) {
  return getStorefrontPromotionBadges(summary).length > 0;
}

export function formatStorefrontPromotionExpiry(expiresAt: string | null | undefined) {
  if (!expiresAt) {
    return null;
  }

  const expiresAtMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    return null;
  }

  const remainingMinutes = Math.max(1, Math.round((expiresAtMs - Date.now()) / 60_000));
  if (remainingMinutes < 60) {
    return `Ends in ${remainingMinutes}m`;
  }

  const remainingHours = Math.round(remainingMinutes / 60);
  if (remainingHours < 48) {
    return `Ends in ${remainingHours}h`;
  }

  const remainingDays = Math.round(remainingHours / 24);
  return `Ends in ${remainingDays}d`;
}
