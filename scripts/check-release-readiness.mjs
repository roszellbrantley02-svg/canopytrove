import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function loadEnvFile(fileName) {
  const filePath = path.join(projectRoot, fileName);
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const env = {};
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const name = trimmedLine.slice(0, separatorIndex).trim();
    const rawValue = trimmedLine.slice(separatorIndex + 1).trim();
    const normalizedValue = rawValue.replace(/^['"]|['"]$/g, '');
    env[name] = normalizedValue;
  }

  return env;
}

const includeLocalOverrides = isTruthy(process.env.APP_RELEASE_CHECK_INCLUDE_LOCAL_OVERRIDES || '');

const env = {
  ...loadEnvFile('.env'),
  ...(includeLocalOverrides ? loadEnvFile('.env.local') : {}),
  ...process.env,
};

function readValue(name) {
  return env[name]?.trim() || '';
}

function isTruthy(value) {
  const normalizedValue = value.trim().toLowerCase();
  return normalizedValue === 'true' || normalizedValue === '1';
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function parseHttpUrl(value) {
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

function isLocalHostName(hostname) {
  if (!hostname) {
    return true;
  }

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

function isPublicHttpUrl(value) {
  const url = parseHttpUrl(value);
  return Boolean(url) && !isLocalHostName(url.hostname);
}

function readAppIdentity() {
  const appJsonPath = path.join(projectRoot, 'app.json');
  const rawAppJson = fs.readFileSync(appJsonPath, 'utf8');
  const parsed = JSON.parse(rawAppJson);
  return parsed.expo ?? {};
}

const appIdentity = readAppIdentity();
const checks = [];

function pushCheck(name, ok, detail, severity = 'required') {
  checks.push({ name, ok, detail, severity });
}

const storefrontSource = readValue('EXPO_PUBLIC_STOREFRONT_SOURCE').toLowerCase();
pushCheck(
  'Production storefront source',
  storefrontSource === 'api',
  storefrontSource === 'api'
    ? 'App is configured to use the hosted API source.'
    : 'Set EXPO_PUBLIC_STOREFRONT_SOURCE=api before a public release.'
);

const storefrontApiBaseUrl = readValue('EXPO_PUBLIC_STOREFRONT_API_BASE_URL');
pushCheck(
  'Public storefront API URL',
  isPublicHttpUrl(storefrontApiBaseUrl),
  isPublicHttpUrl(storefrontApiBaseUrl)
    ? `Using ${storefrontApiBaseUrl}.`
    : 'Set EXPO_PUBLIC_STOREFRONT_API_BASE_URL to a public non-local http(s) URL.'
);

const firebaseRequiredEnvVars = [
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'EXPO_PUBLIC_FIREBASE_APP_ID',
];
const missingFirebaseEnvVars = firebaseRequiredEnvVars.filter((name) => !readValue(name));
pushCheck(
  'Firebase client config',
  missingFirebaseEnvVars.length === 0,
  missingFirebaseEnvVars.length === 0
    ? 'All required Firebase client env vars are configured.'
    : `Missing Firebase client env: ${missingFirebaseEnvVars.join(', ')}.`
);

const mapsClientKey = readValue('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY');
pushCheck(
  'Google Maps client key',
  Boolean(mapsClientKey),
  mapsClientKey
    ? 'Client Google Maps key is configured.'
    : 'Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY for storefront operational-data recovery.',
  'recommended'
);

const supportEmail = readValue('EXPO_PUBLIC_SUPPORT_EMAIL');
pushCheck(
  'Support email',
  isEmail(supportEmail),
  isEmail(supportEmail)
    ? `Using ${supportEmail}.`
    : 'Set EXPO_PUBLIC_SUPPORT_EMAIL to a monitored support inbox.'
);

for (const [envVar, label] of [
  ['EXPO_PUBLIC_PRIVACY_POLICY_URL', 'Privacy policy URL'],
  ['EXPO_PUBLIC_TERMS_URL', 'Terms URL'],
  ['EXPO_PUBLIC_COMMUNITY_GUIDELINES_URL', 'Community guidelines URL'],
]) {
  const value = readValue(envVar);
  pushCheck(
    label,
    isPublicHttpUrl(value),
    isPublicHttpUrl(value)
      ? `Using ${value}.`
      : `Set ${envVar} to a public non-local http(s) URL.`
  );
}

for (const [envVar, label] of [
  ['EXPO_PUBLIC_APP_WEBSITE_URL', 'App website URL'],
  ['EXPO_PUBLIC_ACCOUNT_DELETION_HELP_URL', 'Account deletion help URL'],
]) {
  const value = readValue(envVar);
  pushCheck(
    label,
    isPublicHttpUrl(value),
    isPublicHttpUrl(value)
      ? `Using ${value}.`
      : `Set ${envVar} to a public non-local http(s) URL.`,
    'recommended'
  );
}

const ownerPreviewEnabled = isTruthy(readValue('EXPO_PUBLIC_OWNER_PORTAL_PREVIEW_ENABLED'));
pushCheck(
  'Owner preview disabled',
  !ownerPreviewEnabled,
  ownerPreviewEnabled
    ? 'Disable EXPO_PUBLIC_OWNER_PORTAL_PREVIEW_ENABLED for public release builds.'
    : 'Owner preview is off for public release checks.'
);

const publicMonthlyCheckoutUrl = readValue('EXPO_PUBLIC_OWNER_PORTAL_MONTHLY_CHECKOUT_URL');
const publicAnnualCheckoutUrl = readValue('EXPO_PUBLIC_OWNER_PORTAL_ANNUAL_CHECKOUT_URL');
const publicBillingPortalUrl = readValue('EXPO_PUBLIC_OWNER_PORTAL_BILLING_PORTAL_URL');
const hasAnyPublicBillingFallback =
  Boolean(publicMonthlyCheckoutUrl) ||
  Boolean(publicAnnualCheckoutUrl) ||
  Boolean(publicBillingPortalUrl);
const hasCompletePublicCheckoutPair =
  Boolean(publicMonthlyCheckoutUrl) && Boolean(publicAnnualCheckoutUrl);

pushCheck(
  'Public owner checkout fallback completeness',
  !hasAnyPublicBillingFallback || hasCompletePublicCheckoutPair,
  !hasAnyPublicBillingFallback || hasCompletePublicCheckoutPair
    ? 'Public owner checkout fallback is either unused or complete.'
    : 'If using public owner billing fallback, configure both EXPO_PUBLIC_OWNER_PORTAL_MONTHLY_CHECKOUT_URL and EXPO_PUBLIC_OWNER_PORTAL_ANNUAL_CHECKOUT_URL.',
  'recommended'
);

for (const [value, label] of [
  [publicMonthlyCheckoutUrl, 'Monthly checkout fallback URL'],
  [publicAnnualCheckoutUrl, 'Annual checkout fallback URL'],
  [publicBillingPortalUrl, 'Billing portal fallback URL'],
]) {
  if (!value) {
    continue;
  }

  const looksLikeTestStripeUrl = value.includes('/test_');
  pushCheck(
    label,
    isPublicHttpUrl(value) && !looksLikeTestStripeUrl,
    isPublicHttpUrl(value) && !looksLikeTestStripeUrl
      ? `Using ${value}.`
      : `${label} must be a public non-local live URL, not a local or Stripe test URL.`,
    'recommended'
  );
}

const monthlyPriceLabel = readValue('EXPO_PUBLIC_OWNER_PORTAL_MONTHLY_PRICE_LABEL');
const annualPriceLabel = readValue('EXPO_PUBLIC_OWNER_PORTAL_ANNUAL_PRICE_LABEL');
pushCheck(
  'Owner price labels',
  Boolean(monthlyPriceLabel) && Boolean(annualPriceLabel),
  monthlyPriceLabel && annualPriceLabel
    ? 'Owner plan labels are configured.'
    : 'Set EXPO_PUBLIC_OWNER_PORTAL_MONTHLY_PRICE_LABEL and EXPO_PUBLIC_OWNER_PORTAL_ANNUAL_PRICE_LABEL for polished owner plan presentation.',
  'recommended'
);

pushCheck(
  'Expo slug',
  appIdentity.slug === 'canopytrove',
  appIdentity.slug === 'canopytrove'
    ? 'Expo slug is canopytrove.'
    : 'Set expo.slug to canopytrove in app.json.'
);

pushCheck(
  'iOS bundle identifier',
  appIdentity.ios?.bundleIdentifier === 'com.rezell.canopytrove',
  appIdentity.ios?.bundleIdentifier === 'com.rezell.canopytrove'
    ? 'iOS bundle identifier is com.rezell.canopytrove.'
    : 'Set expo.ios.bundleIdentifier to com.rezell.canopytrove in app.json.'
);

pushCheck(
  'Android package identifier',
  appIdentity.android?.package === 'com.rezell.canopytrove',
  appIdentity.android?.package === 'com.rezell.canopytrove'
    ? 'Android package identifier is com.rezell.canopytrove.'
    : 'Set expo.android.package to com.rezell.canopytrove in app.json.'
);

let passedRequired = 0;
let passedRecommended = 0;
const failedRequired = [];
const failedRecommended = [];

console.log('Canopy Trove app release readiness check');
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
  console.error('Release check failed. Fix the required items above before a public app release.');
  process.exitCode = 1;
} else if (failedRecommended.length) {
  console.log('');
  console.log('Release check passed with warnings. Review the recommended items before launch.');
} else {
  console.log('');
  console.log('Release check passed. App-side production release blockers are clear.');
}
