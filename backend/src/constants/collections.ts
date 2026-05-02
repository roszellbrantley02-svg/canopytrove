// Centralized Firestore collection name constants
// This file ensures consistency and makes collection names easier to maintain

export const COLLECTIONS = {
  // Owner and account management
  OWNER_PROFILES: 'ownerProfiles',
  DISPENSARY_CLAIMS: 'dispensaryClaims',
  DISPENSARIES: 'dispensaries',
  BUSINESS_VERIFICATIONS: 'businessVerifications',
  IDENTITY_VERIFICATIONS: 'identityVerifications',

  // Storefront data
  SUMMARY_COLLECTION: 'storefront_summaries',
  STOREFRONT_SUMMARIES: 'storefront_summaries',
  STOREFRONT_DETAILS: 'storefront_details',
  STOREFRONT_REPORTS: 'storefront_reports',
  ROUTE_STATE: 'route_state',

  // Notifications and alerts
  FAVORITE_DEAL_ALERTS: 'favorite_deal_alerts',
  MEMBER_EMAIL_SUBSCRIPTIONS: 'member_email_subscriptions',
  OPS_ALERT_SUBSCRIPTIONS: 'ops_alert_subscriptions',

  // Analytics
  ANALYTICS_EVENTS: 'analytics_events',
  DAILY_APP_METRICS: 'analytics_daily_app_metrics',
  DAILY_STOREFRONT_METRICS: 'analytics_daily_storefront_metrics',
  DAILY_DEAL_METRICS: 'analytics_daily_deal_metrics',
  DAILY_SEARCH_METRICS: 'analytics_daily_search_metrics',
  DAILY_SIGNUP_METRICS: 'analytics_daily_signup_metrics',
  DAILY_QUERY_METRICS: 'analytics_daily_query_metrics',
  // Per-storefront-per-hour route-start counter, drives the heat-glow
  // visual on storefront cards. Doc id = `{storefrontId}__{YYYYMMDDHH}`.
  HOURLY_STOREFRONT_ROUTES: 'analytics_hourly_storefront_routes',

  // Gamification
  GAMIFICATION_STATE: 'gamification_state',

  // Owner tools and profiles
  PROFILE_TOOLS: 'owner_storefront_profile_tools',
  SUBSCRIPTIONS: 'subscriptions',

  // Launch and programs
  LAUNCH_PROGRAM_META: 'launch_program_meta',
  EARLY_ADOPTER_CLAIMS: 'launch_program_early_adopters',
  OWNER_TRIAL_CLAIMS: 'launch_program_owner_trials',

  // Payment methods (blue badge feature)
  PAYMENT_METHOD_DECLARATIONS: 'payment_method_declarations',
  PAYMENT_METHOD_REPORTS: 'payment_method_reports',

  // Operations
  RATE_LIMIT_BUCKETS: 'ops_rate_limit_buckets',
  RUNTIME_MONITORING: 'ops_runtime_monitoring',

  // Multi-location bulk claim (Phase 2 of cluster auto-claim feature)
  BULK_VERIFICATION_BATCHES: 'bulkVerificationBatches',
} as const;

// Derive constants for backward compatibility with existing code
export const OWNER_PROFILES_COLLECTION = COLLECTIONS.OWNER_PROFILES;
export const DISPENSARY_CLAIMS_COLLECTION = COLLECTIONS.DISPENSARY_CLAIMS;
export const DISPENSARIES_COLLECTION = COLLECTIONS.DISPENSARIES;
export const BUSINESS_VERIFICATIONS_COLLECTION = COLLECTIONS.BUSINESS_VERIFICATIONS;
export const IDENTITY_VERIFICATIONS_COLLECTION = COLLECTIONS.IDENTITY_VERIFICATIONS;
export const STOREFRONT_REPORTS_COLLECTION = COLLECTIONS.STOREFRONT_REPORTS;
export const FAVORITE_DEAL_ALERTS_COLLECTION = COLLECTIONS.FAVORITE_DEAL_ALERTS;
export const MEMBER_EMAIL_SUBSCRIPTIONS_COLLECTION = COLLECTIONS.MEMBER_EMAIL_SUBSCRIPTIONS;
export const OPS_ALERT_SUBSCRIPTIONS_COLLECTION = COLLECTIONS.OPS_ALERT_SUBSCRIPTIONS;
export const EVENTS_COLLECTION = COLLECTIONS.ANALYTICS_EVENTS;
export const DAILY_APP_METRICS_COLLECTION = COLLECTIONS.DAILY_APP_METRICS;
export const DAILY_STOREFRONT_METRICS_COLLECTION = COLLECTIONS.DAILY_STOREFRONT_METRICS;
export const DAILY_DEAL_METRICS_COLLECTION = COLLECTIONS.DAILY_DEAL_METRICS;
export const DAILY_SEARCH_METRICS_COLLECTION = COLLECTIONS.DAILY_SEARCH_METRICS;
export const DAILY_SIGNUP_METRICS_COLLECTION = COLLECTIONS.DAILY_SIGNUP_METRICS;
export const DAILY_QUERY_METRICS_COLLECTION = COLLECTIONS.DAILY_QUERY_METRICS;
export const HOURLY_STOREFRONT_ROUTES_COLLECTION = COLLECTIONS.HOURLY_STOREFRONT_ROUTES;
export const GAMIFICATION_STATE_COLLECTION = COLLECTIONS.GAMIFICATION_STATE;
export const PROFILE_TOOLS_COLLECTION = COLLECTIONS.PROFILE_TOOLS;
export const SUBSCRIPTIONS_COLLECTION = COLLECTIONS.SUBSCRIPTIONS;
export const LAUNCH_PROGRAM_META_COLLECTION = COLLECTIONS.LAUNCH_PROGRAM_META;
export const EARLY_ADOPTER_CLAIMS_COLLECTION = COLLECTIONS.EARLY_ADOPTER_CLAIMS;
export const OWNER_TRIAL_CLAIMS_COLLECTION = COLLECTIONS.OWNER_TRIAL_CLAIMS;
export const RATE_LIMIT_COLLECTION = COLLECTIONS.RATE_LIMIT_BUCKETS;
export const RUNTIME_MONITORING_COLLECTION = COLLECTIONS.RUNTIME_MONITORING;
export const SUMMARY_COLLECTION = COLLECTIONS.SUMMARY_COLLECTION;
export const STOREFRONT_SUMMARY_COLLECTION = COLLECTIONS.STOREFRONT_SUMMARIES;
export const ROUTE_STATE_COLLECTION = COLLECTIONS.ROUTE_STATE;
export const PAYMENT_METHOD_DECLARATIONS_COLLECTION = COLLECTIONS.PAYMENT_METHOD_DECLARATIONS;
export const PAYMENT_METHOD_REPORTS_COLLECTION = COLLECTIONS.PAYMENT_METHOD_REPORTS;
export const BULK_VERIFICATION_BATCHES_COLLECTION = COLLECTIONS.BULK_VERIFICATION_BATCHES;
