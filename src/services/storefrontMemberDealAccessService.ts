import type { StorefrontDetails, StorefrontSummary } from '../types/storefront';
import { getCanopyTroveAuthCacheKey } from './canopyTroveAuthService';

export function canViewMemberDeals() {
  return getCanopyTroveAuthCacheKey().startsWith('authenticated:');
}

export function getStorefrontMemberAccessCacheKey() {
  return canViewMemberDeals() ? getCanopyTroveAuthCacheKey() : 'signed-out';
}

export function stripMemberOnlyDealsFromSummary(summary: StorefrontSummary): StorefrontSummary {
  return {
    ...summary,
    promotionText: summary.promotionText,
    promotionBadges: summary.promotionBadges,
    promotionExpiresAt: summary.promotionExpiresAt,
    activePromotionId: summary.activePromotionId,
    activePromotionCount: summary.activePromotionCount ?? 0,
    promotionPlacementSurfaces: [],
    promotionPlacementScope: null,
    thumbnailUrl: null,
  };
}

export function stripMemberOnlyDealsFromDetail(detail: StorefrontDetails): StorefrontDetails {
  const visiblePhotoUrls = detail.photoUrls.slice(0, 2);

  return {
    ...detail,
    activePromotions: [],
    photoCount: detail.photoCount ?? detail.photoUrls.length,
    photoUrls: visiblePhotoUrls,
    appReviews: detail.appReviews.map((review) => ({
      ...review,
      photoUrls: [],
    })),
  };
}

export function applyStorefrontMemberDealAccessToSummary(summary: StorefrontSummary) {
  return canViewMemberDeals() ? summary : stripMemberOnlyDealsFromSummary(summary);
}

export function applyStorefrontMemberDealAccessToSummaries(summaries: StorefrontSummary[]) {
  return summaries.map((summary) => applyStorefrontMemberDealAccessToSummary(summary));
}

export function applyStorefrontMemberDealAccessToDetail(detail: StorefrontDetails | null) {
  if (!detail || canViewMemberDeals()) {
    return detail;
  }

  return stripMemberOnlyDealsFromDetail(detail);
}
