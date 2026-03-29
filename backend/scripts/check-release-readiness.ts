import fs from 'node:fs';
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

const initialEnvKeys = new Set(Object.keys(process.env));

function loadBackendEnv() {
  const backendRoot = path.resolve(__dirname, '..');
  const envFile = path.join(backendRoot, '.env');

  if (!fs.existsSync(envFile)) {
    return;
  }

  const parsed = parse(fs.readFileSync(envFile, 'utf8'));
  for (const [key, value] of Object.entries(parsed)) {
    if (!initialEnvKeys.has(key)) {
      process.env[key] = value;
    }
  }
}

loadBackendEnv();

void (async () => {
  const [
    { getMissingOwnerBillingBackendEnvVars, serverConfig },
    { hasBackendFirebaseConfig },
    { getAdminReviewReadiness },
    { backendStorefrontSourceStatus },
  ] = await Promise.all([
    import('../src/config'),
    import('../src/firebase'),
    import('../src/services/adminReviewService'),
    import('../src/sources'),
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
      : 'Set STOREFRONT_BACKEND_SOURCE=firestore before a public release.'
  );

  pushCheck(
    'Active storefront source mode',
    backendStorefrontSourceStatus.activeMode === 'firestore',
    backendStorefrontSourceStatus.activeMode === 'firestore'
      ? 'Firestore source is active.'
      : `Backend would currently serve ${backendStorefrontSourceStatus.activeMode} data. ${backendStorefrontSourceStatus.fallbackReason ?? 'Check backend Firebase config.'}`
  );

  pushCheck(
    'Restricted CORS origin',
    serverConfig.corsOrigin !== '*',
    serverConfig.corsOrigin !== '*'
      ? 'CORS origin is restricted.'
      : 'Set CORS_ORIGIN to the production app/web origins instead of "*".'
  );

  pushCheck(
    'Backend Firebase admin access',
    hasBackendFirebaseConfig,
    hasBackendFirebaseConfig
      ? 'Backend Firebase admin access is configured.'
      : 'Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS for the hosted backend.'
  );

  const backendGoogleMapsKey = readValue('GOOGLE_MAPS_API_KEY');
  pushCheck(
    'Backend Google Places key',
    Boolean(backendGoogleMapsKey),
    backendGoogleMapsKey
      ? 'GOOGLE_MAPS_API_KEY is configured.'
      : 'Set GOOGLE_MAPS_API_KEY for backend storefront enrichment.'
  );

  pushCheck(
    'Expo push access token',
    Boolean(serverConfig.expoAccessToken),
    serverConfig.expoAccessToken
      ? 'EXPO_ACCESS_TOKEN is configured.'
      : 'Set EXPO_ACCESS_TOKEN so hosted favorite-deal push dispatch can run.'
  );

  const adminReadiness = getAdminReviewReadiness();
  pushCheck(
    'Admin review readiness',
    adminReadiness.ok,
    adminReadiness.ok
      ? 'Admin review queue requirements are configured.'
      : `Missing admin review requirements: ${adminReadiness.missingRequirements.join(', ')}.`
  );

  const missingOwnerBillingEnvVars = getMissingOwnerBillingBackendEnvVars({ includeWebhook: true });
  pushCheck(
    'Stripe owner billing backend env',
    missingOwnerBillingEnvVars.length === 0,
    missingOwnerBillingEnvVars.length === 0
      ? 'Stripe owner billing env is fully configured.'
      : `Missing owner billing env: ${missingOwnerBillingEnvVars.join(', ')}.`
  );

  const stripeSecretKey = readValue('STRIPE_SECRET_KEY');
  pushCheck(
    'Live Stripe secret key',
    !stripeSecretKey || stripeSecretKey.startsWith('sk_live_'),
    !stripeSecretKey || stripeSecretKey.startsWith('sk_live_')
      ? 'Stripe secret key is either unset or live.'
      : 'STRIPE_SECRET_KEY is still using a Stripe test key. Switch to sk_live_ before release.'
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
        : `${name} must be a public non-local http(s) URL.`
    );
  }

  pushCheck(
    'Dev seed disabled',
    process.env.ALLOW_DEV_SEED !== 'true',
    process.env.ALLOW_DEV_SEED !== 'true'
      ? 'ALLOW_DEV_SEED is off.'
      : 'Set ALLOW_DEV_SEED=false for the hosted release backend.',
    'recommended'
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
    `Required checks: ${passedRequired}/${checks.filter((check) => check.severity === 'required').length} passed`
  );
  console.log(
    `Recommended checks: ${passedRecommended}/${checks.filter((check) => check.severity === 'recommended').length} passed`
  );

  if (failedRequired.length) {
    console.error('');
    console.error(
      'Release check failed. Fix the required backend items above before a public release.'
    );
    process.exitCode = 1;
  } else if (failedRecommended.length) {
    console.log('');
    console.log(
      'Release check passed with warnings. Review the recommended backend items before launch.'
    );
  } else {
    console.log('');
    console.log('Release check passed. Backend-side production release blockers are clear.');
  }
})();
