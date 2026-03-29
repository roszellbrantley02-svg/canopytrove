function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

function parseCorsOrigin(value: string | undefined) {
  const normalizedValue = value?.trim();
  if (!normalizedValue || normalizedValue === '*') {
    return '*';
  }

  const origins = normalizedValue
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins.length === 1 ? origins[0] : origins;
}

function readConfiguredValue(value: string | null | undefined) {
  const normalizedValue = value?.trim();
  return normalizedValue ? normalizedValue : null;
}

export const serverConfig = {
  port: Number(process.env.PORT || 4100),
  corsOrigin: parseCorsOrigin(process.env.CORS_ORIGIN),
  expoAccessToken: readConfiguredValue(process.env.EXPO_ACCESS_TOKEN),
  adminApiKey: readConfiguredValue(process.env.ADMIN_API_KEY),
  stripeSecretKey: readConfiguredValue(process.env.STRIPE_SECRET_KEY),
  stripeWebhookSecret: readConfiguredValue(process.env.STRIPE_WEBHOOK_SECRET),
  stripeOwnerMonthlyPriceId: readConfiguredValue(process.env.STRIPE_OWNER_MONTHLY_PRICE_ID),
  stripeOwnerAnnualPriceId: readConfiguredValue(process.env.STRIPE_OWNER_ANNUAL_PRICE_ID),
  stripeOwnerSuccessUrl: readConfiguredValue(process.env.OWNER_BILLING_SUCCESS_URL),
  stripeOwnerCancelUrl: readConfiguredValue(process.env.OWNER_BILLING_CANCEL_URL),
  stripeOwnerPortalReturnUrl: readConfiguredValue(process.env.OWNER_BILLING_PORTAL_RETURN_URL),
  allowDevSeed: process.env.ALLOW_DEV_SEED === 'true',
  requestLoggingEnabled: process.env.REQUEST_LOGGING_ENABLED !== 'false',
  readRateLimitPerMinute: parsePositiveInteger(process.env.READ_RATE_LIMIT_PER_MINUTE, 600),
  writeRateLimitPerMinute: parsePositiveInteger(process.env.WRITE_RATE_LIMIT_PER_MINUTE, 180),
  adminRateLimitPerTenMinutes: parsePositiveInteger(
    process.env.ADMIN_RATE_LIMIT_PER_TEN_MINUTES,
    10
  ),
} as const;

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
        .map(([name]) => name)
    );
  }

  return missingEnvVars;
}

export function hasConfiguredOwnerBillingBackend(options?: { includeWebhook?: boolean }) {
  return getMissingOwnerBillingBackendEnvVars(options).length === 0;
}
