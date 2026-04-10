import { Platform } from 'react-native';
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
  audiences: OwnerPromotionAudience[];
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
  { value: 'hot_deal', label: Platform.OS === 'android' ? 'Featured Update' : 'Hot Deal' },
  { value: 'owner_featured', label: 'Owner Highlight' },
  { value: 'standard', label: 'Standard Card' },
];

export const PROMOTION_PLACEMENT_SURFACE_OPTIONS: PromotionOption<OwnerPromotionPlacementSurface>[] =
  [
    { value: 'nearby', label: 'Nearby' },
    { value: 'browse', label: 'Browse' },
    { value: 'hot_deals', label: Platform.OS === 'android' ? 'Updates Lane' : 'Hot Deals Lane' },
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
    audiences: ['all_followers'],
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
    audiences: formState.audiences,
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
  | 'audiences'
  | 'cardTone'
  | 'placementSurfaces'
  | 'placementScope'
> {
  return {
    title: draft.title,
    description: draft.description,
    badgesInput: draft.badges.join(', '),
    audiences: draft.audiences,
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
    audiences: promotion.audiences,
    cardTone: promotion.cardTone,
    alertFollowersOnStart: promotion.alertFollowersOnStart,
    placementSurfaces: promotion.placementSurfaces,
    placementScope: promotion.placementScope,
  };
}

export function getPromotionPlannerTitle(editingPromotionId: string | null) {
  if (editingPromotionId) {
    return Platform.OS === 'android' ? 'Editing selected update' : 'Editing selected promotion';
  }

  return Platform.OS === 'android' ? 'Create a new update' : 'Create a new promotion';
}

export function getPromotionPlannerBody(editingPromotionId: string | null) {
  return editingPromotionId
    ? Platform.OS === 'android'
      ? 'Update timing, lane, placement, or highlight reach without losing the existing update state.'
      : 'Update timing, lane, placement, or highlight reach without losing the existing promotion state.'
    : Platform.OS === 'android'
      ? 'Choose a card tone that matches your update. Featured Update adds urgency. Owner Highlight feels premium and curated. Standard keeps it clean and neutral.'
      : 'Choose a card tone that matches your offer. Hot Deal creates urgency. Owner Highlight feels premium and curated. Standard keeps it clean and neutral.';
}

export function getPromotionPlannerModeLabel(editingPromotionId: string | null) {
  if (editingPromotionId) {
    return 'Editing';
  }

  return 'Draft';
}

export function getPromotionRuntimeMessage(
  promotionWritesEnabled: boolean,
  safeModeEnabled: boolean,
) {
  if (!promotionWritesEnabled) {
    return Platform.OS === 'android'
      ? 'Update publishing is temporarily paused while the system stabilizes.'
      : 'Promotion writes are temporarily paused while the system stabilizes.';
  }

  if (safeModeEnabled) {
    return Platform.OS === 'android'
      ? 'Protected mode is active. Update analytics remain visible while live changes are monitored more closely.'
      : 'Protected mode is active. Promotion analytics remain visible while live changes are monitored more closely.';
  }

  return null;
}

export function formatPromotionValue(value: string) {
  const normalizedValue = value.trim().toLowerCase();
  if (normalizedValue === 'hot_deal') {
    return Platform.OS === 'android' ? 'Featured Update' : 'Hot Deal';
  }

  if (normalizedValue === 'owner_featured') {
    return 'Owner Highlight';
  }

  if (normalizedValue === 'standard') {
    return 'Standard Card';
  }

  if (normalizedValue === 'hot_deals') {
    return Platform.OS === 'android' ? 'Updates Lane' : 'Hot Deals Lane';
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
    if (Platform.OS === 'android') {
      return editingPromotionId ? 'Save Preview Update' : 'Create Preview Update';
    }

    return editingPromotionId ? 'Update Preview Promotion' : 'Save Preview Promotion';
  }

  if (!promotionWritesEnabled) {
    return Platform.OS === 'android' ? 'Updates Paused' : 'Promotions Paused';
  }

  if (isSaving) {
    return 'Saving...';
  }

  if (Platform.OS === 'android') {
    return editingPromotionId ? 'Save Update' : 'Create Update';
  }

  return editingPromotionId ? 'Update Promotion' : 'Create Promotion';
}

// ── Android moderation helpers (client-side pre-validation) ──────────

const ANDROID_RED_PATTERNS = [
  /\b\d{1,3}%\s*off\b/i,
  /\$\d+\s*off\b/i,
  /\bdiscount\b/i,
  /\bdeal\b/i,
  /\bdeals\b/i,
  /\bsale\b/i,
  /\bspecial\b/i,
  /\bspecials\b/i,
  /\bbogo\b/i,
  /\bbuy one get one\b/i,
  /\bdoorbuster\b/i,
  /\bflower\b/i,
  /\bpre[- ]?rolls?\b/i,
  /\bedibles?\b/i,
  /\bcarts?\b/i,
  /\bvapes?\b/i,
  /\bconcentrates?\b/i,
  /\bthc\b/i,
  /\bindica\b/i,
  /\bsativa\b/i,
  /\bhybrid\b/i,
  /\bounces?\b/i,
  /\bgrams?\b/i,
  /\border now\b/i,
  /\bbuy now\b/i,
  /\bshop now\b/i,
  /\breserve\b/i,
  /\bpre[- ]?order\b/i,
  /\bpickup\b/i,
  /\bcurbside\b/i,
  /\bdelivery\b/i,
  /\bshop our menu\b/i,
];

const ANDROID_YELLOW_PATTERNS = [
  /\blimited[- ]?time\b/i,
  /\bexclusive\b/i,
  /\bfeatured\b/i,
  /\bmember appreciation\b/i,
  /\bcelebration\b/i,
  /\bvendor day\b/i,
  /\bguest vendor\b/i,
  /\b4[\/ ]?20\b/i,
  /\bdrop\b/i,
  /\blaunch\b/i,
  /\bmenu spotlight\b/i,
  /\bsamples?\b/i,
  /\bpop[- ]?up\b/i,
];

export type AndroidModerationPrecheck = {
  level: 'green' | 'yellow' | 'red';
  message: string | null;
};

/**
 * Client-side pre-validation for Android compliance.
 * Mirrors the backend classifier so owners get immediate feedback
 * in the composer before hitting the server.
 */
export function precheckAndroidModeration(
  title: string,
  description: string,
  badges: string[],
): AndroidModerationPrecheck {
  const text = [title, description, ...badges]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) {
    return { level: 'green', message: null };
  }

  for (const pattern of ANDROID_RED_PATTERNS) {
    if (pattern.test(text)) {
      return {
        level: 'red',
        message:
          'This content includes cannabis sales or deal language and will not appear on Android. Announcements and events are allowed.',
      };
    }
  }

  for (const pattern of ANDROID_YELLOW_PATTERNS) {
    if (pattern.test(text)) {
      return {
        level: 'yellow',
        message:
          'This content may require review before appearing on Android. Avoid deal-like language for faster approval.',
      };
    }
  }

  return { level: 'green', message: null };
}

/**
 * Short helper text for the owner composer explaining Android rules.
 */
export const ANDROID_COMPOSER_HELP_TEXT =
  'Announcements and events can appear on Android. Discounts, product deals, and order-driving language are not allowed on Android.';

/**
 * Status line for the owner composer showing current Android eligibility.
 */
export function getAndroidEligibilityLabel(precheck: AndroidModerationPrecheck): string {
  switch (precheck.level) {
    case 'green':
      return 'Eligible for Android, iOS, and web.';
    case 'yellow':
      return 'Pending review for Android. Visible on iOS and web.';
    case 'red':
      return 'This content will appear on iOS and web only.';
  }
}
