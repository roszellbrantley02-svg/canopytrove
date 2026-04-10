import fs from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { parse } from 'dotenv';

type Severity = 'required' | 'recommended';

type Check = {
  name: string;
  ok: boolean;
  detail: string;
  severity: Severity;
};

function readValue(name: string) {
  return process.env[name]?.trim() || '';
}

function isTruthy(value: string | undefined) {
  const normalizedValue = value?.trim().toLowerCase() || '';
  return normalizedValue === 'true' || normalizedValue === '1';
}

function parseHttpUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}

function isLocalHostName(hostname: string) {
  const normalizedHost = hostname.toLowerCase();
  if (
    normalizedHost === 'localhost' ||
    normalizedHost === '127.0.0.1' ||
    normalizedHost === '0.0.0.0'
  ) {
    return true;
  }

  if (normalizedHost.startsWith('10.') || normalizedHost.startsWith('192.168.')) {
    return true;
  }

  const match = normalizedHost.match(/^172\.(\d{1,3})\./);
  if (!match) {
    return false;
  }

  const secondOctet = Number(match[1]);
  return secondOctet >= 16 && secondOctet <= 31;
}

function isPublicHttpUrl(value: string) {
  const url = parseHttpUrl(value);
  if (!url) {
    return false;
  }

  return !isLocalHostName(url.hostname);
}

const cliArgs = new Set(process.argv.slice(2).map((argument) => argument.toLowerCase()));
const useProductionEnv =
  cliArgs.has('--production') || isTruthy(process.env.BACKEND_RELEASE_CHECK_PRODUCTION);
const includeLocalOverrides =
  cliArgs.has('--include-local-overrides') ||
  isTruthy(process.env.BACKEND_RELEASE_CHECK_INCLUDE_LOCAL_OVERRIDES);
const initialEnvKeys = new Set(Object.keys(process.env));

function loadEnvFile(fileName: string) {
  const backendRoot = path.resolve(__dirname, '..');
  const envFile = path.join(backendRoot, fileName);

  if (!fs.existsSync(envFile)) {
    return {};
  }

  return parse(fs.readFileSync(envFile, 'utf8'));
}

function applyDerivedEnv(entries: Record<string, string>) {
  for (const [key, value] of Object.entries(entries)) {
    if (!initialEnvKeys.has(key)) {
      process.env[key] = value;
    }
  }
}

function createHostedEnvPlaceholder(name: string) {
  if (name === 'STRIPE_SECRET_KEY') {
    return 'sk_live_placeholder';
  }

  if (name === 'STRIPE_WEBHOOK_SECRET') {
    return 'whsec_placeholder';
  }

  if (name === 'OWNER_PORTAL_ALLOWLIST') {
    return 'configured@example.com';
  }

  if (name.endsWith('_URL')) {
    return 'https://configured.example.com';
  }

  return 'configured';
}

function loadHostedCloudRunEnv() {
  const projectId =
    readValue('BACKEND_RELEASE_CHECK_GCP_PROJECT') ||
    readValue('GOOGLE_CLOUD_PROJECT') ||
    readValue('GCLOUD_PROJECT') ||
    'canopy-trove';
  const serviceName = readValue('BACKEND_RELEASE_CHECK_CLOUD_RUN_SERVICE') || 'canopytrove-api';
  const region = readValue('BACKEND_RELEASE_CHECK_CLOUD_RUN_REGION') || 'us-east4';

  try {
    const gcloudCommand = process.platform === 'win32' ? 'gcloud.cmd' : 'gcloud';
    const raw = execSync(
      `${gcloudCommand} run services describe ${serviceName} --region ${region} --project ${projectId} --format=json`,
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    const parsed = JSON.parse(raw) as {
      spec?: {
        template?: {
          spec?: { containers?: Array<{ env?: Array<Record<string, unknown>> }> };
        };
      };
    };
    const envEntries =
      parsed.spec?.template?.spec?.containers?.[0]?.env?.filter(
        (entry): entry is Record<string, unknown> => Boolean(entry && entry.name),
      ) ?? [];

    const derivedEnv: Record<string, string> = {};
    for (const entry of envEntries) {
      const name = String(entry.name ?? '').trim();
      if (!name) {
        continue;
      }

      const directValue = typeof entry.value === 'string' ? entry.value : '';
      const hasValueSource = Boolean(entry.valueFrom || entry.valueSource);
      if (directValue) {
        derivedEnv[name] = directValue;
        continue;
      }

      if (hasValueSource) {
        derivedEnv[name] = createHostedEnvPlaceholder(name);
      }
    }

    applyDerivedEnv(derivedEnv);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown gcloud error.';
    console.warn(
      `[release-check] Could not load hosted Cloud Run env for production mode: ${message}`,
    );
  }
}

function loadBackendEnv() {
  applyDerivedEnv(loadEnvFile(useProductionEnv ? '.env.production.example' : '.env'));
  if (includeLocalOverrides) {
    applyDerivedEnv(loadEnvFile('.env.local'));
  }
  if (useProductionEnv) {
    loadHostedCloudRunEnv();
  }
}

loadBackendEnv();

void (async () => {
  const [
    { getMissingOwnerBillingBackendEnvVars, hasConfiguredOwnerPortalClaimSync, serverConfig },
    { hasBackendFirebaseConfig },
    { getAdminReviewReadiness },
    { backendStorefrontSourceStatus },
    { getStorefrontReadinessStatus },
  ] = await Promise.all([
    import('../src/config'),
    import('../src/firebase'),
    import('../src/services/adminReviewService'),
    import('../src/sources'),
    import('../src/services/healthMonitorService'),
  ]);

  const checks: Check[] = [];

  function pushCheck(name: string, ok: boolean, detail: string, severity: Severity = 'required') {
    checks.push({ name, ok, detail, severity });
  }

  const requestedSourceMode = readValue('STOREFRONT_BACKEND_SOURCE').toLowerCase();
  pushCheck(
    'Backend storefront source mode',
    requestedSourceMode === 'firestore',
    requestedSourceMode === 'firestore'
      ? 'Backend is requested in firestore mode.'
      : 'Set STOREFRONT_BACKEND_SOURCE=firestore before a public release.',
  );

  pushCheck(
    'Active storefront source mode',
    backendStorefrontSourceStatus.activeMode === 'firestore',
    backendStorefrontSourceStatus.activeMode === 'firestore'
      ? 'Firestore source is active.'
      : `Backend would currently serve ${backendStorefrontSourceStatus.activeMode} data. ${backendStorefrontSourceStatus.fallbackReason ?? 'Check backend Firebase config.'}`,
  );

  const storefrontReadiness = await getStorefrontReadinessStatus({
    probeGooglePlaces: false,
    timeoutMs: 7_000,
  });
  for (const readinessCheck of storefrontReadiness.checks) {
    if (readinessCheck.name === 'Storefront source mode') {
      continue;
    }

    pushCheck(
      readinessCheck.name,
      readinessCheck.ok,
      readinessCheck.detail,
      readinessCheck.severity,
    );
  }

  pushCheck(
    'Restricted CORS origin',
    serverConfig.corsOrigin !== '*',
    serverConfig.corsOrigin !== '*'
      ? 'CORS origin is restricted.'
      : 'Set CORS_ORIGIN to the production app/web origins instead of "*".',
  );

  pushCheck(
    'Backend Firebase admin access',
    hasBackendFirebaseConfig,
    hasBackendFirebaseConfig
      ? 'Backend Firebase admin access is configured.'
      : 'Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS for the hosted backend.',
  );

  const backendGoogleMapsKey = readValue('GOOGLE_MAPS_API_KEY');
  pushCheck(
    'Backend Google Places key',
    Boolean(backendGoogleMapsKey),
    backendGoogleMapsKey
      ? 'GOOGLE_MAPS_API_KEY is configured.'
      : 'Set GOOGLE_MAPS_API_KEY for backend storefront enrichment.',
  );

  pushCheck(
    'Owner AI live provider',
    Boolean(serverConfig.openAiApiKey),
    serverConfig.openAiApiKey
      ? `OPENAI_API_KEY is configured and owner AI will use ${serverConfig.openAiModel}.`
      : 'Set OPENAI_API_KEY if the owner AI assistant should use live model generation instead of fallback copy.',
    'recommended',
  );

  const sentryDsn = readValue('SENTRY_DSN');
  pushCheck(
    'Backend crash monitoring DSN',
    Boolean(sentryDsn),
    sentryDsn
      ? 'SENTRY_DSN is configured.'
      : 'Set SENTRY_DSN to enable hosted backend crash monitoring.',
    'recommended',
  );

  const emailDeliveryProvider = readValue('EMAIL_DELIVERY_PROVIDER');
  const resendApiKey = readValue('RESEND_API_KEY');
  const resendWebhookSecret = readValue('RESEND_WEBHOOK_SECRET');
  const emailFromAddress = readValue('EMAIL_FROM_ADDRESS');
  const welcomeEmailsEnabled = readValue('WELCOME_EMAILS_ENABLED') !== 'false';
  pushCheck(
    'Welcome email delivery',
    !welcomeEmailsEnabled ||
      (emailDeliveryProvider === 'resend' && Boolean(resendApiKey) && Boolean(emailFromAddress)),
    !welcomeEmailsEnabled
      ? 'Welcome emails are disabled.'
      : emailDeliveryProvider === 'resend' && resendApiKey && emailFromAddress
        ? 'Welcome email delivery is configured through Resend.'
        : 'Set EMAIL_DELIVERY_PROVIDER=resend plus RESEND_API_KEY and EMAIL_FROM_ADDRESS to send automatic welcome emails.',
    'recommended',
  );
  pushCheck(
    'Welcome email delivery webhooks',
    !welcomeEmailsEnabled || emailDeliveryProvider !== 'resend' || Boolean(resendWebhookSecret),
    !welcomeEmailsEnabled
      ? 'Welcome emails are disabled.'
      : emailDeliveryProvider !== 'resend'
        ? 'Resend email delivery is not enabled, so webhook tracking is not required.'
        : resendWebhookSecret
          ? 'RESEND_WEBHOOK_SECRET is configured for signed delivery-event tracking.'
          : 'Set RESEND_WEBHOOK_SECRET and register /email/webhooks/resend in Resend to track delivered, bounced, complained, and suppressed events.',
    'recommended',
  );

  const opsHealthcheckApiUrl = readValue('OPS_HEALTHCHECK_API_URL');
  const opsHealthcheckApiRawUrl = readValue('OPS_HEALTHCHECK_API_RAW_URL');
  const opsHealthcheckSiteUrl = readValue('OPS_HEALTHCHECK_SITE_URL');
  const opsAlertWebhookUrl = readValue('OPS_ALERT_WEBHOOK_URL');
  const hasOpsMonitoringTargets = Boolean(opsHealthcheckApiUrl || opsHealthcheckSiteUrl);

  pushCheck(
    'Runtime health monitor targets',
    hasOpsMonitoringTargets,
    hasOpsMonitoringTargets
      ? 'At least one runtime health monitor target is configured.'
      : 'Set OPS_HEALTHCHECK_API_URL and/or OPS_HEALTHCHECK_SITE_URL to enable scheduled uptime sweeps.',
    'recommended',
  );

  if (opsHealthcheckApiUrl) {
    pushCheck(
      'OPS_HEALTHCHECK_API_URL public URL',
      isPublicHttpUrl(opsHealthcheckApiUrl),
      isPublicHttpUrl(opsHealthcheckApiUrl)
        ? 'OPS_HEALTHCHECK_API_URL is public.'
        : 'OPS_HEALTHCHECK_API_URL must be a public non-local http(s) URL.',
      'recommended',
    );
  }

  pushCheck(
    'OPS_HEALTHCHECK_API_RAW_URL companion target',
    !opsHealthcheckApiUrl || Boolean(opsHealthcheckApiRawUrl),
    !opsHealthcheckApiUrl || opsHealthcheckApiRawUrl
      ? 'OPS_HEALTHCHECK_API_RAW_URL is configured or the custom API monitor is not enabled.'
      : 'Set OPS_HEALTHCHECK_API_RAW_URL to the raw Cloud Run health URL so monitor alerts can distinguish domain-path failures from full API outages.',
    'recommended',
  );

  if (opsHealthcheckApiRawUrl) {
    pushCheck(
      'OPS_HEALTHCHECK_API_RAW_URL public URL',
      isPublicHttpUrl(opsHealthcheckApiRawUrl),
      isPublicHttpUrl(opsHealthcheckApiRawUrl)
        ? 'OPS_HEALTHCHECK_API_RAW_URL is public.'
        : 'OPS_HEALTHCHECK_API_RAW_URL must be a public non-local http(s) URL.',
      'recommended',
    );
  }

  if (opsHealthcheckSiteUrl) {
    pushCheck(
      'OPS_HEALTHCHECK_SITE_URL public URL',
      isPublicHttpUrl(opsHealthcheckSiteUrl),
      isPublicHttpUrl(opsHealthcheckSiteUrl)
        ? 'OPS_HEALTHCHECK_SITE_URL is public.'
        : 'OPS_HEALTHCHECK_SITE_URL must be a public non-local http(s) URL.',
      'recommended',
    );
  }

  pushCheck(
    'Ops alert webhook',
    !hasOpsMonitoringTargets || Boolean(opsAlertWebhookUrl),
    !hasOpsMonitoringTargets || opsAlertWebhookUrl
      ? 'Ops alert webhook is configured or runtime sweeps are not enabled yet.'
      : 'Set OPS_ALERT_WEBHOOK_URL so runtime health failures alert you while you are away.',
    'recommended',
  );

  pushCheck(
    'Expo push access token',
    Boolean(serverConfig.expoAccessToken),
    serverConfig.expoAccessToken
      ? 'EXPO_ACCESS_TOKEN is configured.'
      : 'Set EXPO_ACCESS_TOKEN so hosted favorite-deal push dispatch can run.',
  );

  pushCheck(
    'Owner portal claim sync config',
    !serverConfig.ownerPortalPrelaunchEnabled || hasConfiguredOwnerPortalClaimSync(),
    !serverConfig.ownerPortalPrelaunchEnabled
      ? 'Owner portal prelaunch is disabled, so claim sync allowlist gating is not required.'
      : hasConfiguredOwnerPortalClaimSync()
        ? 'Owner portal claim sync allowlist is configured.'
        : 'Set OWNER_PORTAL_ALLOWLIST on the backend so approved owner accounts can receive owner auth claims.',
    serverConfig.ownerPortalPrelaunchEnabled ? 'required' : 'recommended',
  );

  const adminReadiness = getAdminReviewReadiness();
  pushCheck(
    'Admin review readiness',
    adminReadiness.ok,
    adminReadiness.ok
      ? 'Admin review queue requirements are configured.'
      : `Missing admin review requirements: ${adminReadiness.missingRequirements.join(', ')}.`,
  );

  const missingOwnerBillingEnvVars = getMissingOwnerBillingBackendEnvVars({ includeWebhook: true });
  pushCheck(
    'Stripe owner billing backend env',
    missingOwnerBillingEnvVars.length === 0,
    missingOwnerBillingEnvVars.length === 0
      ? 'Stripe owner billing env is fully configured.'
      : `Missing owner billing env: ${missingOwnerBillingEnvVars.join(', ')}.`,
  );

  const stripeSecretKey = readValue('STRIPE_SECRET_KEY');
  pushCheck(
    'Live Stripe secret key',
    !stripeSecretKey || stripeSecretKey.startsWith('sk_live_'),
    !stripeSecretKey || stripeSecretKey.startsWith('sk_live_')
      ? 'Stripe secret key is either unset or live.'
      : 'STRIPE_SECRET_KEY is still using a Stripe test key. Switch to sk_live_ before release.',
  );

  for (const [name, value] of [
    ['OWNER_BILLING_SUCCESS_URL', serverConfig.stripeOwnerSuccessUrl],
    ['OWNER_BILLING_CANCEL_URL', serverConfig.stripeOwnerCancelUrl],
    ['OWNER_BILLING_PORTAL_RETURN_URL', serverConfig.stripeOwnerPortalReturnUrl],
  ] as const) {
    pushCheck(
      `${name} public URL`,
      !value || isPublicHttpUrl(value),
      !value || isPublicHttpUrl(value)
        ? `${name} is public or not configured yet.`
        : `${name} must be a public non-local http(s) URL.`,
    );
  }

  pushCheck(
    'Dev seed disabled',
    process.env.ALLOW_DEV_SEED !== 'true',
    process.env.ALLOW_DEV_SEED !== 'true'
      ? 'ALLOW_DEV_SEED is off.'
      : 'Set ALLOW_DEV_SEED=false for the hosted release backend.',
    'recommended',
  );

  let passedRequired = 0;
  let passedRecommended = 0;
  const failedRequired: Check[] = [];
  const failedRecommended: Check[] = [];

  console.log('Canopy Trove backend release readiness check');
  console.log('');

  for (const check of checks) {
    const marker = check.ok ? '[PASS]' : check.severity === 'required' ? '[FAIL]' : '[WARN]';
    console.log(`${marker} ${check.name}: ${check.detail}`);

    if (check.severity === 'required') {
      if (check.ok) {
        passedRequired += 1;
      } else {
        failedRequired.push(check);
      }
    } else if (check.ok) {
      passedRecommended += 1;
    } else {
      failedRecommended.push(check);
    }
  }

  console.log('');
  console.log(
    `Required checks: ${passedRequired}/${checks.filter((check) => check.severity === 'required').length} passed`,
  );
  console.log(
    `Recommended checks: ${passedRecommended}/${checks.filter((check) => check.severity === 'recommended').length} passed`,
  );

  if (failedRequired.length) {
    console.error('');
    console.error(
      'Release check failed. Fix the required backend items above before a public release.',
    );
    process.exitCode = 1;
  } else if (failedRecommended.length) {
    console.log('');
    console.log(
      'Release check passed with warnings. Review the recommended backend items before launch.',
    );
  } else {
    console.log('');
    console.log('Release check passed. Backend-side production release blockers are clear.');
  }
})();
