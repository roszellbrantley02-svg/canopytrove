import type {
  OwnerAiPromotionDraft,
  OwnerPortalPromotionInput,
  OwnerPromotionAudience,
  OwnerPromotionCardTone,
  OwnerPromotionPerformanceSnapshot,
  OwnerPromotionPlacementScope,
  OwnerPromotionPlacementSurface,
  OwnerStorefrontPromotionDocument,
} from '../../types/ownerPortal';
import type { AppUiIconName } from '../../icons/AppUiIcon';

type PromotionOption<T> = {
  value: T;
  label: string;
};

export type OwnerPromotionPlannerFormState = {
  title: string;
  description: string;
  badgesInput: string;
  startsAt: string;
  endsAt: string;
  audience: OwnerPromotionAudience;
  cardTone: OwnerPromotionCardTone;
  alertFollowersOnStart: boolean;
  placementSurfaces: OwnerPromotionPlacementSurface[];
  placementScope: OwnerPromotionPlacementScope;
};

export const DEFAULT_PROMOTION_PLACEMENT_SURFACES: OwnerPromotionPlacementSurface[] = [
  'hot_deals',
  'nearby',
  'browse',
];

export const PROMOTION_AUDIENCE_OPTIONS: PromotionOption<OwnerPromotionAudience>[] = [
  { value: 'all_followers', label: 'All Followers' },
  { value: 'frequent_visitors', label: 'Frequent Visitors' },
  { value: 'new_customers', label: 'New Customers' },
];

export const PROMOTION_CARD_TONE_OPTIONS: PromotionOption<OwnerPromotionCardTone>[] = [
  { value: 'hot_deal', label: 'Featured Special' },
  { value: 'owner_featured', label: 'Owner Highlight' },
  { value: 'standard', label: 'Standard Card' },
];

export const PROMOTION_PLACEMENT_SURFACE_OPTIONS: PromotionOption<OwnerPromotionPlacementSurface>[] =
  [
    { value: 'nearby', label: 'Nearby' },
    { value: 'browse', label: 'Browse' },
    { value: 'hot_deals', label: 'Specials Lane' },
  ];

export const PROMOTION_PLACEMENT_SCOPE_OPTIONS: PromotionOption<OwnerPromotionPlacementScope>[] = [
  { value: 'storefront_area', label: 'My Area' },
  { value: 'statewide', label: 'Statewide' },
];

function formatLocalDateTimeInputValue(value: Date | string) {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const localTime = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localTime.toISOString().slice(0, 16);
}

function parseLocalDateTimeInputValue(value: string) {
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return null;
  }

  const parsedDate = new Date(normalizedValue);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate.toISOString();
}

export function createDefaultPromotionStart() {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 15);
  return formatLocalDateTimeInputValue(now);
}

export function createDefaultPromotionEnd() {
  const now = new Date();
  now.setHours(now.getHours() + 72);
  return formatLocalDateTimeInputValue(now);
}

export function createDefaultPromotionPlannerState(): OwnerPromotionPlannerFormState {
  return {
    title: '',
    description: '',
    badgesInput: '',
    startsAt: createDefaultPromotionStart(),
    endsAt: createDefaultPromotionEnd(),
    audience: 'all_followers',
    cardTone: 'hot_deal',
    alertFollowersOnStart: true,
    placementSurfaces: DEFAULT_PROMOTION_PLACEMENT_SURFACES,
    placementScope: 'storefront_area',
  };
}

export function buildPromotionPlannerInput(
  formState: OwnerPromotionPlannerFormState,
): OwnerPortalPromotionInput {
  return {
    title: formState.title.trim(),
    description: formState.description.trim(),
    badges: formState.badgesInput
      .split(',')
      .map((badge) => badge.trim())
      .filter(Boolean),
    startsAt: parseLocalDateTimeInputValue(formState.startsAt) ?? formState.startsAt.trim(),
    endsAt: parseLocalDateTimeInputValue(formState.endsAt) ?? formState.endsAt.trim(),
    audience: formState.audience,
    alertFollowersOnStart: formState.alertFollowersOnStart,
    cardTone: formState.cardTone,
    placementSurfaces: formState.placementSurfaces,
    placementScope: formState.placementScope,
  };
}

export function getPromotionPlannerStateFromDraft(
  draft: OwnerAiPromotionDraft,
): Pick<
  OwnerPromotionPlannerFormState,
  | 'title'
  | 'description'
  | 'badgesInput'
  | 'audience'
  | 'cardTone'
  | 'placementSurfaces'
  | 'placementScope'
> {
  return {
    title: draft.title,
    description: draft.description,
    badgesInput: draft.badges.join(', '),
    audience: draft.audience,
    cardTone: draft.cardTone,
    placementSurfaces: draft.placementSurfaces,
    placementScope: draft.placementScope,
  };
}

export function getPromotionPlannerStateFromPromotion(
  promotion: OwnerStorefrontPromotionDocument,
): OwnerPromotionPlannerFormState {
  return {
    title: promotion.title,
    description: promotion.description,
    badgesInput: promotion.badges.join(', '),
    startsAt: formatLocalDateTimeInputValue(promotion.startsAt),
    endsAt: formatLocalDateTimeInputValue(promotion.endsAt),
    audience: promotion.audience,
    cardTone: promotion.cardTone,
    alertFollowersOnStart: promotion.alertFollowersOnStart,
    placementSurfaces: promotion.placementSurfaces,
    placementScope: promotion.placementScope,
  };
}

export function getPromotionPlannerTitle(editingPromotionId: string | null) {
  return editingPromotionId ? 'Editing selected promotion' : 'Create a new promotion';
}

export function getPromotionPlannerBody(editingPromotionId: string | null) {
  return editingPromotionId
    ? 'Update timing, lane, placement, or highlight reach without losing the existing promotion state.'
    : 'Lead with a featured special by default, or switch to an owner highlight when the card should feel premium instead of urgent.';
}

export function getPromotionPlannerModeLabel(editingPromotionId: string | null, preview: boolean) {
  if (editingPromotionId) {
    return 'Editing';
  }

  return preview ? 'Preview' : 'Draft';
}

export function getPromotionRuntimeMessage(
  promotionWritesEnabled: boolean,
  safeModeEnabled: boolean,
) {
  if (!promotionWritesEnabled) {
    return 'Promotion writes are temporarily paused while the system stabilizes.';
  }

  if (safeModeEnabled) {
    return 'Protected mode is active. Promotion analytics remain visible while live changes are monitored more closely.';
  }

  return null;
}

export function formatPromotionValue(value: string) {
  const normalizedValue = value.trim().toLowerCase();
  if (normalizedValue === 'hot_deal') {
    return 'Featured Special';
  }

  if (normalizedValue === 'owner_featured') {
    return 'Owner Highlight';
  }

  if (normalizedValue === 'standard') {
    return 'Standard Card';
  }

  if (normalizedValue === 'hot_deals') {
    return 'Specials Lane';
  }

  return value.replace(/_/g, ' ').replace(/\b\w/g, (segment) => segment.toUpperCase());
}

export function formatPromotionPlacementScope(placementScope: OwnerPromotionPlacementScope) {
  return placementScope === 'statewide' ? 'Statewide' : 'My area';
}

export function formatPromotionPlacementSurfaces(
  placementSurfaces: OwnerPromotionPlacementSurface[],
) {
  return placementSurfaces.length
    ? `Boosted on ${placementSurfaces.map((surface) => formatPromotionValue(surface)).join(', ')}.`
    : 'No boosted placement surfaces selected.';
}

export function getPromotionTrackedActions(metrics: OwnerPromotionPerformanceSnapshot['metrics']) {
  return metrics.redeemStarts + metrics.websiteTaps + metrics.menuTaps + metrics.phoneTaps;
}

function comparePromotionPerformance(
  left: OwnerPromotionPerformanceSnapshot,
  right: OwnerPromotionPerformanceSnapshot,
) {
  if (right.metrics.actionRate !== left.metrics.actionRate) {
    return right.metrics.actionRate - left.metrics.actionRate;
  }

  return right.metrics.impressions - left.metrics.impressions;
}

export function getPromotionAnalyticsSummary(
  promotions: OwnerStorefrontPromotionDocument[],
  promotionPerformance: OwnerPromotionPerformanceSnapshot[],
) {
  const activePromotions = promotions.filter((promotion) => promotion.status === 'active').length;
  const totalImpressions = promotionPerformance.reduce(
    (sum, promotion) => sum + promotion.metrics.impressions,
    0,
  );
  const totalTrackedActions = promotionPerformance.reduce(
    (sum, promotion) => sum + getPromotionTrackedActions(promotion.metrics),
    0,
  );
  const bestActionRate = promotionPerformance.reduce(
    (best, promotion) => Math.max(best, promotion.metrics.actionRate),
    0,
  );
  const topPerformance = [...promotionPerformance].sort(comparePromotionPerformance)[0] ?? null;
  const maxPromotionImpressions = Math.max(
    ...promotionPerformance.map((promotion) => promotion.metrics.impressions),
    1,
  );
  const maxPromotionActions = Math.max(
    ...promotionPerformance.map((promotion) => getPromotionTrackedActions(promotion.metrics)),
    1,
  );

  return {
    activePromotions,
    totalImpressions,
    totalTrackedActions,
    bestActionRate,
    topPerformance,
    maxPromotionImpressions,
    maxPromotionActions,
  };
}

export function getPromotionPerformancePresentation(index: number) {
  const warm = {
    icon: 'sparkles-outline' as AppUiIconName,
    tone: 'warm' as const,
  };
  const success = {
    icon: 'flash-outline' as AppUiIconName,
    tone: 'success' as const,
  };
  const cyan = {
    icon: 'layers-outline' as AppUiIconName,
    tone: 'cyan' as const,
  };
  const rose = {
    icon: 'stats-chart-outline' as AppUiIconName,
    tone: 'rose' as const,
  };

  if (index % 4 === 0) {
    return warm;
  }

  if (index % 4 === 1) {
    return success;
  }

  if (index % 4 === 2) {
    return cyan;
  }

  return rose;
}

export function getPromotionSaveButtonLabel({
  preview,
  promotionWritesEnabled,
  isSaving,
  editingPromotionId,
}: {
  preview: boolean;
  promotionWritesEnabled: boolean;
  isSaving: boolean;
  editingPromotionId: string | null;
}) {
  if (preview) {
    return editingPromotionId ? 'Update Preview Promotion' : 'Save Preview Promotion';
  }

  if (!promotionWritesEnabled) {
    return 'Promotions Paused';
  }

  if (isSaving) {
    return 'Saving...';
  }

  return editingPromotionId ? 'Update Promotion' : 'Create Promotion';
}
