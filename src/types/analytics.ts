export type AnalyticsScalarValue = string | number | boolean | null;

export type AnalyticsMetadata = Record<string, AnalyticsScalarValue>;

export const ANALYTICS_EVENT_TYPES = [
  'app_open',
  'session_start',
  'session_end',
  'screen_view',
  'signup_started',
  'signup_completed',
  'signin',
  'password_reset_requested',
  'location_prompt_shown',
  'location_granted',
  'location_denied',
  'location_changed',
  'search_submitted',
  'search_cleared',
  'browse_sort_changed',
  'hot_deals_toggled',
  'storefront_impression',
  'storefront_opened',
  'go_now_tapped',
  'website_tapped',
  'phone_tapped',
  'menu_tapped',
  'deal_impression',
  'deal_opened',
  'deal_saved',
  'deal_redeem_started',
  'deal_redeemed',
  'review_prompt_shown',
  'review_prompt_dismissed',
  'post_visit_prompt_shown',
  'post_visit_prompt_dismissed',
  'post_visit_prompt_save_tapped',
  'post_visit_prompt_review_tapped',
  'post_visit_prompt_badge_tapped',
  'review_started',
  'review_submitted',
  'report_started',
  'report_submitted',
  'license_verify_submitted',
  'license_verify_result',
  'scan_opened',
  'scan_detected',
  'scan_resolved',
  'scan_unrecognized',
  'scan_manual_fallback_tapped',
  'scan_coa_view_tapped',
  'badge_unlocked_scan_first_product',
  'badge_unlocked_scan_lab_curious',
  'badge_unlocked_scan_brand_scout',
  'badge_unlocked_scan_terpene_explorer',
  'badge_unlocked_scan_deep_verifier',
  'badge_unlocked_scan_clean_choice',
  'badge_unlocked_scan_cream_of_the_crop',
  'auth_mode_picker_shown',
  'auth_member_mode_tapped',
  'auth_owner_mode_tapped',
  'auth_guest_mode_tapped',
  'auth_owner_role_denied',
  'my_brands_opened',
  'my_brands_sort_changed',
  'my_brands_filter_changed',
  'my_brand_tapped',
  'my_brand_removed',
  'browse_brands_opened',
  'browse_brands_sort_changed',
  'browse_brand_saved',
  'brand_detail_opened',
  'brand_detail_saved',
  'brand_detail_unsaved',
  'brand_detail_website_tapped',
  'scan_result_brand_saved',
  'scan_result_brand_unsaved',
] as const;

export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

export type AnalyticsProfileKind = 'anonymous' | 'authenticated' | null;

export type AnalyticsEventInput = {
  eventId?: string;
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
