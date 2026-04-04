import type { PreviewTone } from '../mapGridPreview/mapGridPreviewTones';
import type { StorefrontSummary } from '../../types/storefront';

export type StorefrontCardVisualLane =
  | 'hotDeal'
  | 'ownerFeatured'
  | 'newToYou'
  | 'saved'
  | 'visited'
  | 'default';

type StorefrontCardVisualStateInput = {
  isSaved: boolean;
  isVisited: boolean;
  hasPromotion: boolean;
  premiumCardVariant?: StorefrontSummary['premiumCardVariant'];
};

export function getStorefrontCardVisualLane({
  isSaved,
  isVisited,
  hasPromotion,
  premiumCardVariant,
}: StorefrontCardVisualStateInput): StorefrontCardVisualLane {
  if (hasPromotion || premiumCardVariant === 'hot_deal') {
    return 'hotDeal';
  }

  if (premiumCardVariant === 'owner_featured') {
    return 'ownerFeatured';
  }

  if (!isSaved && !isVisited) {
    return 'newToYou';
  }

  if (isSaved) {
    return 'saved';
  }

  if (isVisited) {
    return 'visited';
  }

  return 'default';
}

export function getStorefrontCardPreviewTone(lane: StorefrontCardVisualLane): PreviewTone {
  switch (lane) {
    case 'hotDeal':
      return 'promotion';
    case 'ownerFeatured':
      return 'ownerFeatured';
    case 'saved':
      return 'saved';
    case 'visited':
      return 'visited';
    case 'newToYou':
      return 'neverVisited';
    case 'default':
    default:
      return 'default';
  }
}

export function getStorefrontCardHeroLabel({
  lane,
  activePromotionCount,
  isVerified,
}: {
  lane: StorefrontCardVisualLane;
  activePromotionCount: number;
  isVerified: boolean;
}) {
  switch (lane) {
    case 'hotDeal':
      return activePromotionCount > 1 ? `${activePromotionCount} Live Specials` : 'Live special';
    case 'ownerFeatured':
      return 'Owner featured';
    case 'newToYou':
      return 'New to you';
    case 'saved':
      return 'Saved storefront';
    case 'visited':
      return 'Visited before';
    case 'default':
    default:
      return isVerified ? 'Verified storefront' : 'Local storefront';
  }
}
