/**
 * Android Moderation Classifier
 *
 * Classifies owner-created card/promotion content as green (allowed), yellow (review_required), or red (blocked) for Android based on Google Play's marijuana sales facilitation policy.
 * Red = auto-blocked on Android (sales-facilitating language)
 * Yellow = manual review required for Android (ambiguous)
 * Green = auto-allowed on Android (informational)
 *
 * Policy reference: docs/ANDROID_MODERATION_SPEC.md
 */

import type {
  ContentCategory,
  ModerationDecision,
  ModerationReasonCode,
  OwnerCardModeration,
  PlatformModeration,
  PlatformVisibility,
} from '../types/moderation';

// ── Classifier version ───────────────────────────────────────────────

export const MODERATION_CLASSIFIER_VERSION = '2026-04-05-android-v1';

// ── Red keyword families (auto-block on Android) ─────────────────────

const RED_PRICE_DISCOUNT: Array<{ pattern: RegExp; reason: ModerationReasonCode }> = [
  { pattern: /\b\d{1,3}%\s*off\b/i, reason: 'PRICE_OR_DISCOUNT' },
  { pattern: /\$\d+\s*off\b/i, reason: 'PRICE_OR_DISCOUNT' },
  { pattern: /\bdiscount\b/i, reason: 'PRICE_OR_DISCOUNT' },
  { pattern: /\bdeal\b/i, reason: 'PRICE_OR_DISCOUNT' },
  { pattern: /\bdeals\b/i, reason: 'PRICE_OR_DISCOUNT' },
  { pattern: /\bsale\b/i, reason: 'PRICE_OR_DISCOUNT' },
  { pattern: /\bspecial\b/i, reason: 'PRICE_OR_DISCOUNT' },
  { pattern: /\bspecials\b/i, reason: 'PRICE_OR_DISCOUNT' },
  { pattern: /\bbogo\b/i, reason: 'PRICE_OR_DISCOUNT' },
  { pattern: /\bbuy one get one\b/i, reason: 'PRICE_OR_DISCOUNT' },
  { pattern: /\bdoorbuster\b/i, reason: 'PRICE_OR_DISCOUNT' },
];

const RED_PRODUCT_TERMS: Array<{ pattern: RegExp; reason: ModerationReasonCode }> = [
  { pattern: /\bflower\b/i, reason: 'PRODUCT_TERM' },
  { pattern: /\bpre[- ]?rolls?\b/i, reason: 'PRODUCT_TERM' },
  { pattern: /\bedibles?\b/i, reason: 'PRODUCT_TERM' },
  { pattern: /\bcarts?\b/i, reason: 'PRODUCT_TERM' },
  { pattern: /\bvapes?\b/i, reason: 'PRODUCT_TERM' },
  { pattern: /\bconcentrates?\b/i, reason: 'PRODUCT_TERM' },
  { pattern: /\bthc\b/i, reason: 'PRODUCT_TERM' },
  { pattern: /\bindica\b/i, reason: 'PRODUCT_TERM' },
  { pattern: /\bsativa\b/i, reason: 'PRODUCT_TERM' },
  { pattern: /\bhybrid\b/i, reason: 'PRODUCT_TERM' },
  { pattern: /\bounces?\b/i, reason: 'PRODUCT_TERM' },
  { pattern: /\bgrams?\b/i, reason: 'PRODUCT_TERM' },
];

const RED_TRANSACTION_LANGUAGE: Array<{ pattern: RegExp; reason: ModerationReasonCode }> = [
  { pattern: /\border now\b/i, reason: 'TRANSACTION_CTA' },
  { pattern: /\bbuy now\b/i, reason: 'TRANSACTION_CTA' },
  { pattern: /\bshop now\b/i, reason: 'TRANSACTION_CTA' },
  { pattern: /\breserve\b/i, reason: 'TRANSACTION_CTA' },
  { pattern: /\bpre[- ]?order\b/i, reason: 'TRANSACTION_CTA' },
  { pattern: /\bshop our menu\b/i, reason: 'MENU_SHOPPING_LANGUAGE' },
];

const RED_ORDER_FLOW: Array<{ pattern: RegExp; reason: ModerationReasonCode }> = [
  { pattern: /\border\b/i, reason: 'ORDER_FLOW_LANGUAGE' },
  { pattern: /\bpickup\b/i, reason: 'DELIVERY_OR_PICKUP' },
  { pattern: /\bcurbside\b/i, reason: 'DELIVERY_OR_PICKUP' },
  { pattern: /\bdelivery\b/i, reason: 'DELIVERY_OR_PICKUP' },
];

// ── Yellow keyword families (manual review on Android) ───────────────

const YELLOW_PATTERNS: Array<{ pattern: RegExp; reason: ModerationReasonCode }> = [
  { pattern: /\blimited[- ]?time\b/i, reason: 'AMBIGUOUS_EVENT_PROMO' },
  { pattern: /\bexclusive\b/i, reason: 'AMBIGUOUS_EVENT_PROMO' },
  { pattern: /\bfeatured\b/i, reason: 'AMBIGUOUS_EVENT_PROMO' },
  { pattern: /\bmember appreciation\b/i, reason: 'AMBIGUOUS_EVENT_PROMO' },
  { pattern: /\bcelebration\b/i, reason: 'AMBIGUOUS_EVENT_PROMO' },
  { pattern: /\bvendor day\b/i, reason: 'AMBIGUOUS_EVENT_PROMO' },
  { pattern: /\bguest vendor\b/i, reason: 'AMBIGUOUS_EVENT_PROMO' },
  { pattern: /\b4[\/ ]?20\b/i, reason: 'AMBIGUOUS_EVENT_PROMO' },
  { pattern: /\bdrop\b/i, reason: 'AMBIGUOUS_EVENT_PROMO' },
  { pattern: /\blaunch\b/i, reason: 'AMBIGUOUS_EVENT_PROMO' },
  { pattern: /\bmenu spotlight\b/i, reason: 'AMBIGUOUS_EVENT_PROMO' },
  { pattern: /\bsamples?\b/i, reason: 'AMBIGUOUS_EVENT_PROMO' },
  { pattern: /\bpop[- ]?up\b/i, reason: 'AMBIGUOUS_EVENT_PROMO' },
];

// ── Green-safe content categories ────────────────────────────────────

const GREEN_SAFE_CATEGORIES = new Set<ContentCategory>([
  'announcement',
  'event',
  'community',
  'hours_update',
  'amenity_update',
  'education',
]);

// ── Text normalization ───────────────────────────────────────────────

export function normalizeTextForModeration(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019\u201C\u201D]/g, "'") // smart quotes
    .replace(/[\u2013\u2014]/g, '-') // em/en dashes
    .replace(/[^\w\s%$\-/'.]/g, ' ') // strip most punctuation, keep % $ - / '
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Combine all moderatable text fields into a single blob.
 */
export function buildModeratableText(fields: {
  title?: string | null;
  description?: string | null;
  badges?: string[] | null;
  ctaLabel?: string | null;
}): string {
  const parts = [
    fields.title,
    fields.description,
    ...(fields.badges ?? []),
    fields.ctaLabel,
  ].filter(Boolean) as string[];

  return normalizeTextForModeration(parts.join(' '));
}

// ── Pattern matching ─────────────────────────────────────────────────

function matchPatterns(
  text: string,
  patterns: Array<{ pattern: RegExp; reason: ModerationReasonCode }>,
): ModerationReasonCode[] {
  const reasons = new Set<ModerationReasonCode>();
  for (const { pattern, reason } of patterns) {
    if (pattern.test(text)) {
      reasons.add(reason);
    }
  }
  return Array.from(reasons);
}

function hasProductTerm(text: string): boolean {
  return RED_PRODUCT_TERMS.some(({ pattern }) => pattern.test(text));
}

function hasPriceOrDiscount(text: string): boolean {
  return RED_PRICE_DISCOUNT.some(({ pattern }) => pattern.test(text));
}

function hasTransactionLanguage(text: string): boolean {
  return [...RED_TRANSACTION_LANGUAGE, ...RED_ORDER_FLOW].some(({ pattern }) => pattern.test(text));
}

// ── Core classification engine ───────────────────────────────────────

export type ModerationClassification = {
  decision: ModerationDecision;
  reasons: ModerationReasonCode[];
};

/**
 * Classify text for Android eligibility.
 *
 * Decision order:
 * 1. Check red rules (any match → blocked)
 * 2. Check compound red rule (product + price/transaction → blocked)
 * 3. Check yellow rules (any match → review_required)
 * 4. Otherwise → allowed
 */
export function classifyForAndroid(text: string): ModerationClassification {
  const normalized = normalizeTextForModeration(text);

  // Step 1: Check all red pattern families
  const redReasons = [
    ...matchPatterns(normalized, RED_PRICE_DISCOUNT),
    ...matchPatterns(normalized, RED_PRODUCT_TERMS),
    ...matchPatterns(normalized, RED_TRANSACTION_LANGUAGE),
    ...matchPatterns(normalized, RED_ORDER_FLOW),
  ];

  if (redReasons.length > 0) {
    return { decision: 'blocked', reasons: [...new Set(redReasons)] };
  }

  // Step 2: Compound red rule — product term + price/transaction
  if (
    hasProductTerm(normalized) &&
    (hasPriceOrDiscount(normalized) || hasTransactionLanguage(normalized))
  ) {
    const reasons: ModerationReasonCode[] = ['PRODUCT_TERM'];
    if (hasPriceOrDiscount(normalized)) reasons.push('PRICE_OR_DISCOUNT');
    if (hasTransactionLanguage(normalized)) reasons.push('TRANSACTION_CTA');
    return { decision: 'blocked', reasons };
  }

  // Step 3: Check yellow patterns
  const yellowReasons = matchPatterns(normalized, YELLOW_PATTERNS);
  if (yellowReasons.length > 0) {
    return { decision: 'review_required', reasons: yellowReasons };
  }

  // Step 4: Green — no matches
  return { decision: 'allowed', reasons: [] };
}

// ── Full moderation result builder ───────────────────────────────────

/**
 * Build a complete moderation result for an owner card/promotion.
 *
 * Android is strictly classified. iOS and web default to allowed
 * (the backend can apply separate policies later if needed).
 */
export function classifyOwnerContent(options: {
  title: string;
  description: string;
  badges: string[];
  contentCategory?: ContentCategory;
  ctaLabel?: string | null;
}): { moderation: OwnerCardModeration; platformVisibility: PlatformVisibility } {
  const text = buildModeratableText({
    title: options.title,
    description: options.description,
    badges: options.badges,
    ctaLabel: options.ctaLabel,
  });

  const category: ContentCategory = options.contentCategory ?? 'promotion';
  const android = classifyForAndroid(text);

  // If the category is an informational type AND the classifier says allowed,
  // fast-track green. Otherwise defer to the classifier result.
  const androidDecision: ModerationDecision =
    GREEN_SAFE_CATEGORIES.has(category) && android.decision === 'allowed'
      ? 'allowed'
      : android.decision;

  const androidModeration: PlatformModeration = {
    decision: androidDecision,
    reasons: android.reasons,
    reviewedAt: null,
    reviewedBy: null,
  };

  // iOS and web: allowed by default (can restrict later)
  const permissiveModeration: PlatformModeration = {
    decision: 'allowed',
    reasons: [],
    reviewedAt: null,
    reviewedBy: null,
  };

  const overallDecision: ModerationDecision =
    androidDecision === 'blocked'
      ? 'blocked'
      : androidDecision === 'review_required'
        ? 'review_required'
        : 'allowed';

  const moderation: OwnerCardModeration = {
    category,
    overallDecision,
    android: androidModeration,
    ios: permissiveModeration,
    web: permissiveModeration,
    classifierVersion: MODERATION_CLASSIFIER_VERSION,
  };

  const platformVisibility: PlatformVisibility = {
    android: androidDecision === 'allowed',
    ios: true,
    web: true,
  };

  return { moderation, platformVisibility };
}

/**
 * Quick check: is this content eligible for Android?
 * Useful for filtering in read paths without building the full moderation object.
 */
export function isAndroidEligible(options: {
  title: string;
  description: string;
  badges: string[];
}): boolean {
  const text = buildModeratableText(options);
  return classifyForAndroid(text).decision === 'allowed';
}

/**
 * Check if a promotion document has been classified and is allowed on Android.
 * Falls back to runtime classification if moderation fields are missing (migration path).
 */
export function isPromotionAndroidVisible(promotion: {
  title: string;
  description: string;
  badges: string[];
  platformVisibility?: PlatformVisibility;
}): boolean {
  // If moderation fields exist, use them directly
  if (promotion.platformVisibility) {
    return promotion.platformVisibility.android;
  }

  // Fallback: classify at read time (pre-migration promotions)
  return isAndroidEligible(promotion);
}
