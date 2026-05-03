function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

const DEFAULT_LOCAL_CORS_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:8081',
  'http://127.0.0.1:8081',
  'http://localhost:19006',
  'http://127.0.0.1:19006',
] as const;

function parseCorsOrigin(value: string | undefined) {
  const normalizedValue = value?.trim();
  if (!normalizedValue) {
    return [...DEFAULT_LOCAL_CORS_ORIGINS];
  }

  const origins = normalizedValue
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (!origins.length || origins.includes('*')) {
    throw new Error('CORS_ORIGIN must be an explicit origin list.');
  }

  return origins.length === 1 ? origins[0] : origins;
}

function isWildcardCorsOrigin(value: string | string[]) {
  return value === '*' || (Array.isArray(value) && value.includes('*'));
}

function readConfiguredValue(value: string | null | undefined) {
  const normalizedValue = value?.trim();
  return normalizedValue ? normalizedValue : null;
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (!value) {
    return fallback;
  }

  const normalizedValue = value.trim().toLowerCase();
  if (normalizedValue === 'true' || normalizedValue === '1') {
    return true;
  }

  if (normalizedValue === 'false' || normalizedValue === '0') {
    return false;
  }

  return fallback;
}

function parseCsv(value: string | undefined) {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export type TransactionalEmailRuntimeConfig = {
  emailDeliveryProvider: string | null;
  resendApiKey: string | null;
  resendWebhookSecret: string | null;
  emailFromAddress: string | null;
  emailReplyToAddress: string | null;
  welcomeEmailsEnabled: boolean;
  // Deal-digest daily email pipeline. dealDigestsEnabled is the master
  // feature flag — leave false until smoke-tested on yourself, then flip
  // to true on Cloud Run to start sending to real users via the cron.
  dealDigestsEnabled: boolean;
  // Mailing address printed in every digest email footer for CAN-SPAM
  // compliance. Required if dealDigestsEnabled is true. Multi-line value
  // with literal \n separators (e.g. "Canopy Trove\n5942 ... \nWolcott,
  // NY 14590"). The footer renderer splits on \n.
  emailFooterAddress: string | null;
  // HMAC secret for signing one-click unsubscribe tokens. Required if
  // dealDigestsEnabled is true. Rotate by appending the new secret as
  // ` ${old}|${new}` and the verify path will accept either; pure single
  // value supported here for simplicity.
  emailUnsubscribeTokenSecret: string | null;
  // Public URL base used to build the unsubscribe link in emails. Should
  // point to the backend host (api.canopytrove.com) since that's where
  // the unsubscribe routes live.
  emailUnsubscribeBaseUrl: string | null;
  // Public URL base for the web app — used in deal-digest emails to deep
  // link to a storefront detail page (`{webAppBaseUrl}/storefronts/{id}`).
  webAppBaseUrl: string | null;
};

export function getTransactionalEmailRuntimeConfig(): TransactionalEmailRuntimeConfig {
  return {
    emailDeliveryProvider: readConfiguredValue(process.env.EMAIL_DELIVERY_PROVIDER),
    resendApiKey: readConfiguredValue(process.env.RESEND_API_KEY),
    resendWebhookSecret: readConfiguredValue(process.env.RESEND_WEBHOOK_SECRET),
    emailFromAddress: readConfiguredValue(process.env.EMAIL_FROM_ADDRESS),
    emailReplyToAddress: readConfiguredValue(process.env.EMAIL_REPLY_TO_ADDRESS),
    welcomeEmailsEnabled: parseBoolean(process.env.WELCOME_EMAILS_ENABLED, true),
    dealDigestsEnabled: parseBoolean(process.env.EMAIL_DEAL_DIGESTS_ENABLED, false),
    emailFooterAddress: readConfiguredValue(process.env.EMAIL_FOOTER_ADDRESS),
    emailUnsubscribeTokenSecret: readConfiguredValue(process.env.EMAIL_UNSUBSCRIBE_TOKEN_SECRET),
    emailUnsubscribeBaseUrl:
      readConfiguredValue(process.env.EMAIL_UNSUBSCRIBE_BASE_URL) ?? 'https://api.canopytrove.com',
    webAppBaseUrl:
      readConfiguredValue(process.env.WEB_APP_BASE_URL) ?? 'https://app.canopytrove.com',
  };
}

const transactionalEmailRuntimeConfig = getTransactionalEmailRuntimeConfig();

export const serverConfig = {
  port: Number(process.env.PORT || 4100),
  trustProxyHops: parsePositiveInteger(process.env.TRUST_PROXY_HOPS, 1),
  corsOrigin: parseCorsOrigin(process.env.CORS_ORIGIN),
  rateLimitPepper: readConfiguredValue(process.env.RATE_LIMIT_PEPPER),
  expoAccessToken: readConfiguredValue(process.env.EXPO_ACCESS_TOKEN),
  // Web Push (VAPID) — browser-based push notifications for owner-portal web users.
  // Generate a key pair once via `npx web-push generate-vapid-keys` and persist:
  //   WEB_PUSH_VAPID_PUBLIC_KEY  → also exposed to web client as EXPO_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY
  //   WEB_PUSH_VAPID_PRIVATE_KEY → server-only, store via Secret Manager in prod
  //   WEB_PUSH_VAPID_SUBJECT     → mailto:askmehere@canopytrove.com (or https://canopytrove.com)
  // If any of the three are missing the web-push sender short-circuits to a no-op
  // and only Expo (native) notifications continue to flow.
  webPushVapidPublicKey: readConfiguredValue(process.env.WEB_PUSH_VAPID_PUBLIC_KEY),
  webPushVapidPrivateKey: readConfiguredValue(process.env.WEB_PUSH_VAPID_PRIVATE_KEY),
  webPushVapidSubject: readConfiguredValue(process.env.WEB_PUSH_VAPID_SUBJECT),
  adminApiKey: readConfiguredValue(process.env.ADMIN_API_KEY),
  openAiApiKey: readConfiguredValue(process.env.OPENAI_API_KEY),
  openAiModel: readConfiguredValue(process.env.OPENAI_MODEL) ?? 'gpt-4o-mini',
  emailDeliveryProvider: transactionalEmailRuntimeConfig.emailDeliveryProvider,
  resendApiKey: transactionalEmailRuntimeConfig.resendApiKey,
  resendWebhookSecret: transactionalEmailRuntimeConfig.resendWebhookSecret,
  emailFromAddress: transactionalEmailRuntimeConfig.emailFromAddress,
  emailReplyToAddress: transactionalEmailRuntimeConfig.emailReplyToAddress,
  welcomeEmailsEnabled: transactionalEmailRuntimeConfig.welcomeEmailsEnabled,
  dealDigestsEnabled: transactionalEmailRuntimeConfig.dealDigestsEnabled,
  emailFooterAddress: transactionalEmailRuntimeConfig.emailFooterAddress,
  emailUnsubscribeTokenSecret: transactionalEmailRuntimeConfig.emailUnsubscribeTokenSecret,
  emailUnsubscribeBaseUrl: transactionalEmailRuntimeConfig.emailUnsubscribeBaseUrl,
  webAppBaseUrl: transactionalEmailRuntimeConfig.webAppBaseUrl,
  // Twilio Verify — owner phone verification
  // TWILIO_AUTH_TOKEN should be loaded via Secret Manager in production.
  twilioAccountSid: readConfiguredValue(process.env.TWILIO_ACCOUNT_SID),
  twilioAuthToken: readConfiguredValue(process.env.TWILIO_AUTH_TOKEN),
  twilioVerifyServiceSid: readConfiguredValue(process.env.TWILIO_VERIFY_SERVICE_SID),
  stripeSecretKey: readConfiguredValue(process.env.STRIPE_SECRET_KEY),
  stripeWebhookSecret: readConfiguredValue(process.env.STRIPE_WEBHOOK_SECRET),
  stripeOwnerMonthlyPriceId: readConfiguredValue(process.env.STRIPE_OWNER_MONTHLY_PRICE_ID),
  stripeOwnerAnnualPriceId: readConfiguredValue(process.env.STRIPE_OWNER_ANNUAL_PRICE_ID),
  // Tier-specific Stripe price IDs (override the generic ones above when set)
  stripeVerifiedMonthlyPriceId: readConfiguredValue(process.env.STRIPE_VERIFIED_MONTHLY_PRICE_ID),
  stripeVerifiedAnnualPriceId: readConfiguredValue(process.env.STRIPE_VERIFIED_ANNUAL_PRICE_ID),
  stripeGrowthMonthlyPriceId: readConfiguredValue(process.env.STRIPE_GROWTH_MONTHLY_PRICE_ID),
  stripeGrowthAnnualPriceId: readConfiguredValue(process.env.STRIPE_GROWTH_ANNUAL_PRICE_ID),
  stripeProMonthlyPriceId: readConfiguredValue(process.env.STRIPE_PRO_MONTHLY_PRICE_ID),
  stripeProAnnualPriceId: readConfiguredValue(process.env.STRIPE_PRO_ANNUAL_PRICE_ID),
  // Per-extra-location seat — quantity-based price ($99.99/month/location).
  // Added to the owner's existing subscription as a separate line item with
  // quantity == count of additionalLocationIds. Set this BEFORE owners can
  // claim multiple locations or the multi-location flow refuses to add.
  stripeAdditionalLocationPriceId: readConfiguredValue(
    process.env.STRIPE_ADDITIONAL_LOCATION_PRICE_ID,
  ),
  stripeOwnerSuccessUrl: readConfiguredValue(process.env.OWNER_BILLING_SUCCESS_URL),
  stripeOwnerCancelUrl: readConfiguredValue(process.env.OWNER_BILLING_CANCEL_URL),
  stripeOwnerPortalReturnUrl: readConfiguredValue(process.env.OWNER_BILLING_PORTAL_RETURN_URL),
  launchProgramStartAt: readConfiguredValue(process.env.LAUNCH_PROGRAM_START_AT),
  launchProgramDurationDays: parsePositiveInteger(process.env.LAUNCH_PROGRAM_DURATION_DAYS, 183),
  launchEarlyAdopterLimit: parsePositiveInteger(process.env.LAUNCH_EARLY_ADOPTER_LIMIT, 500),
  ownerLaunchTrialDays: parsePositiveInteger(process.env.OWNER_LAUNCH_TRIAL_DAYS, 0),
  ownerPortalPrelaunchEnabled: parseBoolean(
    process.env.OWNER_PORTAL_PRELAUNCH_ENABLED ??
      process.env.EXPO_PUBLIC_OWNER_PORTAL_PRELAUNCH_ENABLED,
    false,
  ),
  ownerPortalAllowlist: parseCsv(
    process.env.OWNER_PORTAL_ALLOWLIST ?? process.env.EXPO_PUBLIC_OWNER_PORTAL_ALLOWLIST,
  ),
  allowDevSeed: process.env.ALLOW_DEV_SEED === 'true',
  requestLoggingEnabled: process.env.REQUEST_LOGGING_ENABLED !== 'false',
  runtimeAutoMitigationEnabled: process.env.RUNTIME_AUTO_MITIGATION_ENABLED !== 'false',
  runtimeIncidentThreshold: parsePositiveInteger(process.env.RUNTIME_INCIDENT_THRESHOLD, 3),
  opsHealthcheckEnabled: parseBoolean(process.env.OPS_HEALTHCHECK_ENABLED, true),
  opsHealthcheckApiUrl: readConfiguredValue(process.env.OPS_HEALTHCHECK_API_URL),
  opsHealthcheckApiRawUrl: readConfiguredValue(process.env.OPS_HEALTHCHECK_API_RAW_URL),
  opsHealthcheckSiteUrl: readConfiguredValue(process.env.OPS_HEALTHCHECK_SITE_URL),
  opsHealthcheckTimeoutMs: parsePositiveInteger(process.env.OPS_HEALTHCHECK_TIMEOUT_MS, 8_000),
  opsHealthcheckFailureConfirmationSweeps: parsePositiveInteger(
    process.env.OPS_HEALTHCHECK_FAILURE_CONFIRMATION_SWEEPS,
    2,
  ),
  opsHealthcheckFailureRetryCount: parsePositiveInteger(
    process.env.OPS_HEALTHCHECK_FAILURE_RETRY_COUNT,
    1,
  ),
  opsHealthcheckFailureRetryDelayMs: parsePositiveInteger(
    process.env.OPS_HEALTHCHECK_FAILURE_RETRY_DELAY_MS,
    1_000,
  ),
  opsHealthcheckIntervalMinutes: parsePositiveInteger(
    process.env.OPS_HEALTHCHECK_INTERVAL_MINUTES,
    5,
  ),
  ownerLicenseComplianceSchedulerEnabled: parseBoolean(
    process.env.OWNER_LICENSE_COMPLIANCE_SCHEDULER_ENABLED,
    true,
  ),
  ownerLicenseComplianceIntervalHours: parsePositiveInteger(
    process.env.OWNER_LICENSE_COMPLIANCE_INTERVAL_HOURS,
    24,
  ),
  ownerPromotionSchedulerEnabled: parseBoolean(process.env.OWNER_PROMOTION_SCHEDULER_ENABLED, true),
  ownerPromotionSweepIntervalMinutes: parsePositiveInteger(
    process.env.OWNER_PROMOTION_SWEEP_INTERVAL_MINUTES,
    5,
  ),
  ownerAiUserRateLimitPerMinute: parsePositiveInteger(
    process.env.OWNER_AI_USER_RATE_LIMIT_PER_MINUTE,
    12,
  ),
  ownerAiDailyRequestLimit: parsePositiveInteger(process.env.OWNER_AI_DAILY_REQUEST_LIMIT, 120),
  ownerAiMaxCompletionTokens: parsePositiveInteger(process.env.OWNER_AI_MAX_COMPLETION_TOKENS, 350),
  ownerAiInputModerationEnabled: parseBoolean(process.env.OWNER_AI_INPUT_MODERATION_ENABLED, true),
  // Multi-location claim feature flags (Phase 2 of the cluster-claim work).
  // All three default OFF so the feature ships dark — existing single-claim
  // path is unaffected until the flags flip in production.
  //
  //   verificationChainEnabled — refactors claimAutoApprovalService into a
  //     pluggable verification chain (shop-OTP + ocm-confidence today,
  //     extensible to entity_name match + dual-OTP for clusters).
  //   bulkClaimEnabled — exposes POST /owner-portal/claims/bulk to the
  //     frontend. When false the route 404s.
  //   bulkClaimDualOtpThreshold — cluster size at which we require a SECOND
  //     OTP to a different sibling shop. Default 3 (security bar scales
  //     with cluster size; 1-2 shop adds skip the dual-OTP gate).
  verificationChainEnabled: parseBoolean(process.env.VERIFICATION_CHAIN_ENABLED, false),
  bulkClaimEnabled: parseBoolean(process.env.BULK_CLAIM_ENABLED, false),
  bulkClaimDualOtpThreshold: parsePositiveInteger(process.env.BULK_CLAIM_DUAL_OTP_THRESHOLD, 3),
  // Tax-ID verification (Phase 2.5 — additive verified-owner badge, NOT a
  // gating check). Owner enters their NY business taxpayer ID; we match
  // against the public NYS Tax & Finance "Registered Retail Dealers"
  // dataset (gttd-5u6y) and tag the owner profile with a verified badge.
  // Defaults off; flip to true after the dataset cache has been smoke-
  // tested in production.
  taxIdVerificationEnabled: parseBoolean(process.env.TAX_ID_VERIFICATION_ENABLED, false),
  // Required when taxIdVerificationEnabled=true. Used as the salt for
  // hashing entered TPIDs before they're persisted to Firestore. Never
  // store a raw TPID — the dataset is public but the TPID itself is
  // business-sensitive (NY tax IDs are ~similar in posture to EINs).
  taxIdHashSalt: readConfiguredValue(process.env.TAX_ID_HASH_SALT),
  opsAlertWebhookUrl: readConfiguredValue(process.env.OPS_ALERT_WEBHOOK_URL),
  opsAlertCooldownMinutes: parsePositiveInteger(process.env.OPS_ALERT_COOLDOWN_MINUTES, 30),
  readRateLimitPerMinute: parsePositiveInteger(process.env.READ_RATE_LIMIT_PER_MINUTE, 600),
  writeRateLimitPerMinute: parsePositiveInteger(process.env.WRITE_RATE_LIMIT_PER_MINUTE, 180),
  adminRateLimitPerTenMinutes: parsePositiveInteger(
    process.env.ADMIN_RATE_LIMIT_PER_TEN_MINUTES,
    10,
  ),
} as const;

export function hasRestrictedCorsOrigin() {
  return !isWildcardCorsOrigin(serverConfig.corsOrigin);
}

export function isProductionLikeBackendRuntime() {
  return (
    process.env.NODE_ENV?.trim() === 'production' ||
    Boolean(process.env.K_SERVICE || process.env.CLOUD_RUN_JOB)
  );
}

export function assertSecureServerConfig() {
  if (!hasRestrictedCorsOrigin()) {
    throw new Error('CORS_ORIGIN must be an explicit origin list.');
  }

  if (isProductionLikeBackendRuntime() && !serverConfig.rateLimitPepper) {
    throw new Error('RATE_LIMIT_PEPPER must be configured in production-like runtimes.');
  }
}

const ownerBillingBackendEnvMap = {
  STRIPE_SECRET_KEY: serverConfig.stripeSecretKey,
  STRIPE_OWNER_MONTHLY_PRICE_ID: serverConfig.stripeOwnerMonthlyPriceId,
  STRIPE_OWNER_ANNUAL_PRICE_ID: serverConfig.stripeOwnerAnnualPriceId,
  OWNER_BILLING_SUCCESS_URL: serverConfig.stripeOwnerSuccessUrl,
  OWNER_BILLING_CANCEL_URL: serverConfig.stripeOwnerCancelUrl,
  OWNER_BILLING_PORTAL_RETURN_URL: serverConfig.stripeOwnerPortalReturnUrl,
} as const;

const ownerBillingWebhookEnvMap = {
  STRIPE_WEBHOOK_SECRET: serverConfig.stripeWebhookSecret,
} as const;

export function getMissingOwnerBillingBackendEnvVars(options?: { includeWebhook?: boolean }) {
  const missingEnvVars = Object.entries(ownerBillingBackendEnvMap)
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (options?.includeWebhook) {
    missingEnvVars.push(
      ...Object.entries(ownerBillingWebhookEnvMap)
        .filter(([, value]) => !value)
        .map(([name]) => name),
    );
  }

  return missingEnvVars;
}

export function hasConfiguredOwnerBillingBackend(options?: { includeWebhook?: boolean }) {
  return getMissingOwnerBillingBackendEnvVars(options).length === 0;
}

export function hasConfiguredOwnerPortalClaimSync() {
  return !serverConfig.ownerPortalPrelaunchEnabled || serverConfig.ownerPortalAllowlist.length > 0;
}

export function hasConfiguredTransactionalEmailDelivery(
  emailRuntimeConfig: TransactionalEmailRuntimeConfig = getTransactionalEmailRuntimeConfig(),
) {
  if (!emailRuntimeConfig.welcomeEmailsEnabled) {
    return false;
  }

  if (emailRuntimeConfig.emailDeliveryProvider === 'resend') {
    return Boolean(emailRuntimeConfig.resendApiKey && emailRuntimeConfig.emailFromAddress);
  }

  return false;
}
