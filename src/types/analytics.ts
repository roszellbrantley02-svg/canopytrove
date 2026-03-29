export type AnalyticsScalarValue = string | number | boolean | null;

export type AnalyticsMetadata = Record<string, AnalyticsScalarValue>;

export type AnalyticsEventType =
  | 'app_open'
  | 'session_start'
  | 'session_end'
  | 'screen_view'
  | 'signup_started'
  | 'signup_completed'
  | 'signin'
  | 'password_reset_requested'
  | 'location_prompt_shown'
  | 'location_granted'
  | 'location_denied'
  | 'location_changed'
  | 'search_submitted'
  | 'search_cleared'
  | 'browse_sort_changed'
  | 'hot_deals_toggled'
  | 'storefront_impression'
  | 'storefront_opened'
  | 'go_now_tapped'
  | 'website_tapped'
  | 'phone_tapped'
  | 'menu_tapped'
  | 'deal_impression'
  | 'deal_opened'
  | 'deal_saved'
  | 'deal_redeem_started'
  | 'deal_redeemed'
  | 'review_prompt_shown'
  | 'review_prompt_dismissed'
  | 'post_visit_prompt_shown'
  | 'post_visit_prompt_dismissed'
  | 'post_visit_prompt_save_tapped'
  | 'post_visit_prompt_review_tapped'
  | 'post_visit_prompt_badge_tapped'
  | 'review_started'
  | 'review_submitted'
  | 'report_started'
  | 'report_submitted';

export type AnalyticsProfileKind = 'anonymous' | 'authenticated' | null;

export type AnalyticsEventInput = {
  eventType: AnalyticsEventType;
  installId: string;
  sessionId: string;
  occurredAt: string;
  profileId?: string | null;
  accountId?: string | null;
  profileKind?: AnalyticsProfileKind;
  screen?: string;
  storefrontId?: string;
  dealId?: string;
  metadata?: AnalyticsMetadata;
};

export type AnalyticsEventBatchRequest = {
  platform: string;
  appVersion?: string | null;
  events: AnalyticsEventInput[];
};
