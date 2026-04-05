/**
 * Owner Portal Moderation Types
 *
 * Type definitions for content moderation and compliance in the owner portal.
 * These types are duplicated from the frontend to avoid cross-boundary imports.
 */

export type ContentCategory =
  | 'announcement'
  | 'event'
  | 'community'
  | 'hours_update'
  | 'amenity_update'
  | 'education'
  | 'promotion';

export type ModerationDecision = 'allowed' | 'review_required' | 'blocked';

export type ModerationReasonCode =
  | 'PRICE_OR_DISCOUNT'
  | 'PRODUCT_TERM'
  | 'TRANSACTION_CTA'
  | 'ORDER_FLOW_LANGUAGE'
  | 'DELIVERY_OR_PICKUP'
  | 'MENU_SHOPPING_LANGUAGE'
  | 'AMBIGUOUS_EVENT_PROMO'
  | 'IMAGE_TEXT_REVIEW_REQUIRED'
  | 'UNKNOWN_RISK';

export type PlatformModeration = {
  decision: ModerationDecision;
  reasons: ModerationReasonCode[];
  reviewedAt?: string | null;
  reviewedBy?: string | null;
};

export type OwnerCardModeration = {
  category: ContentCategory;
  overallDecision: ModerationDecision;
  android: PlatformModeration;
  ios: PlatformModeration;
  web: PlatformModeration;
  classifierVersion: string;
};

export type PlatformVisibility = {
  android: boolean;
  ios: boolean;
  web: boolean;
};
