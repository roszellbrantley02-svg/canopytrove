import {
  OwnerPromotionPlacementScope,
  OwnerPromotionPlacementSurface,
} from '../types/ownerPortal';
import { StorefrontSummary } from '../types/storefront';

export const OWNER_PROMOTION_PLACEMENT_SURFACES: OwnerPromotionPlacementSurface[] = [
  'nearby',
  'browse',
  'hot_deals',
];

export const OWNER_PROMOTION_PLACEMENT_SCOPES: OwnerPromotionPlacementScope[] = [
  'storefront_area',
  'statewide',
];

type PriorityPlacementSummary = Pick<
  StorefrontSummary,
  | 'id'
  | 'marketId'
  | 'activePromotionId'
  | 'premiumCardVariant'
  | 'promotionPlacementSurfaces'
  | 'promotionPlacementScope'
>;

export function normalizeOwnerPromotionPlacementSurfaces(
  values: string[] | null | undefined
): OwnerPromotionPlacementSurface[] {
  const allowed = new Set<OwnerPromotionPlacementSurface>(OWNER_PROMOTION_PLACEMENT_SURFACES);
  return Array.from(
    new Set(
      (values ?? []).filter(
        (value): value is OwnerPromotionPlacementSurface =>
          typeof value === 'string' && allowed.has(value as OwnerPromotionPlacementSurface)
      )
    )
  ).slice(0, OWNER_PROMOTION_PLACEMENT_SURFACES.length);
}

function normalizePlacementScope(
  value: OwnerPromotionPlacementScope | null | undefined
): OwnerPromotionPlacementScope {
  return value === 'statewide' ? 'statewide' : 'storefront_area';
}

function normalizeAreaId(value: string | null | undefined) {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed || trimmed === 'all' || trimmed === 'nearby') {
    return null;
  }

  return trimmed;
}

export function matchesPriorityPlacement(
  summary: PriorityPlacementSummary,
  options: {
    surface: OwnerPromotionPlacementSurface;
    areaId?: string | null;
  }
) {
  if (!summary.activePromotionId) {
    return false;
  }

  const placementSurfaces = normalizeOwnerPromotionPlacementSurfaces(
    summary.promotionPlacementSurfaces
  );
  if (!placementSurfaces.includes(options.surface)) {
    return false;
  }

  const placementScope = normalizePlacementScope(summary.promotionPlacementScope);
  if (placementScope === 'statewide') {
    return true;
  }

  if (options.surface === 'nearby') {
    return true;
  }

  const normalizedAreaId = normalizeAreaId(options.areaId);
  return normalizedAreaId === summary.marketId.trim().toLowerCase();
}

export function getPriorityPlacementRank(
  summary: PriorityPlacementSummary,
  options: {
    surface: OwnerPromotionPlacementSurface;
    areaId?: string | null;
  }
) {
  if (!matchesPriorityPlacement(summary, options)) {
    return 0;
  }

  let score = 100;
  if (summary.premiumCardVariant === 'hot_deal') {
    score += 20;
  } else if (summary.premiumCardVariant === 'owner_featured') {
    score += 10;
  }

  return score;
}

export function sortSummariesByPriorityPlacement<T extends PriorityPlacementSummary>(
  items: T[],
  options: {
    surface: OwnerPromotionPlacementSurface;
    areaId?: string | null;
  }
) {
  return items
    .map((item, index) => ({
      item,
      index,
      rank: getPriorityPlacementRank(item, options),
    }))
    .sort((left, right) => right.rank - left.rank || left.index - right.index)
    .map(({ item }) => item);
}
