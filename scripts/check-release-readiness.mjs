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

const cliArgs = new Set(process.argv.slice(2).map((a) => a.toLowerCase()));
const includeLocalOverrides =
  cliArgs.has('--include-local-overrides') ||
  isTruthy(process.env.APP_RELEASE_CHECK_INCLUDE_LOCAL_OVERRIDES || '');
const useProductionEnv =
  cliArgs.has('--production') || isTruthy(process.env.APP_RELEASE_CHECK_PRODUCTION || '');

const env = {
  ...(useProductionEnv ? loadEnvFile('.env.production.example') : loadEnvFile('.env')),
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

function readEasConfig() {
  const easJsonPath = path.join(projectRoot, 'eas.json');
  if (!fs.existsSync(easJsonPath)) {
    return {};
  }

  return JSON.parse(fs.readFileSync(easJsonPath, 'utf8'));
}

const appIdentity = readAppIdentity();
const easConfig = readEasConfig();
const checks = [];

function pushCheck(name, ok, detail, severity = 'required') {
  checks.push({ name, ok, detail, severity });
}

async function fetchJsonWithTimeout(url, timeoutMs = 2500) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'user-agent': 'canopytrove-release-check/1.0',
      },
      signal: controller.signal,
    });
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      json: text ? JSON.parse(text) : null,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function probeHostedStorefrontApi(baseUrl) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');

  try {
    const health = await fetchJsonWithTimeout(`${normalizedBaseUrl}/health`);
    const summaries = await fetchJsonWithTimeout(
      `${normalizedBaseUrl}/storefront-summaries?limit=3&offset=0`,
    );

    const items = Array.isArray(summaries.json?.items) ? summaries.json.items : [];
    const placeIdCoverage =
      items.length > 0
        ? items.filter((item) => typeof item?.placeId === 'string' && item.placeId.trim()).length /
          items.length
        : 0;
    const allClosed = items.length > 0 && items.every((item) => item?.openNow === false);

    return {
      ok: true,
      health,
      summaries,
      itemCount: items.length,
      placeIdCoverage,
      allClosed,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown hosted storefront probe failure.',
    };
  }
}

const storefrontSource = readValue('EXPO_PUBLIC_STOREFRONT_SOURCE').toLowerCase();
pushCheck(
  'Production storefront source',
  storefrontSource === 'api',
  storefrontSource === 'api'
    ? 'App is configured to use the hosted API source.'
    : 'Set EXPO_PUBLIC_STOREFRONT_SOURCE=api before a public release.',
);

const storefrontApiBaseUrl = readValue('EXPO_PUBLIC_STOREFRONT_API_BASE_URL');
pushCheck(
  'Public storefront API URL',
  isPublicHttpUrl(storefrontApiBaseUrl),
  isPublicHttpUrl(storefrontApiBaseUrl)
    ? `Using ${storefrontApiBaseUrl}.`
    : 'Set EXPO_PUBLIC_STOREFRONT_API_BASE_URL to a public non-local http(s) URL.',
);

const hostedStorefrontProbe =
  storefrontSource === 'api' && isPublicHttpUrl(storefrontApiBaseUrl)
    ? await probeHostedStorefrontApi(storefrontApiBaseUrl)
    : null;

if (hostedStorefrontProbe) {
  pushCheck(
    'Hosted storefront API health probe',
    hostedStorefrontProbe.ok &&
      hostedStorefrontProbe.health.ok &&
      hostedStorefrontProbe.health.json?.ok === true,
    hostedStorefrontProbe.ok
      ? hostedStorefrontProbe.health.ok && hostedStorefrontProbe.health.json?.ok === true
        ? `Public health endpoint responded with HTTP ${hostedStorefrontProbe.health.status}.`
        : `Public health endpoint returned HTTP ${hostedStorefrontProbe.health.status}.`
      : `Unable to reach the hosted storefront API: ${hostedStorefrontProbe.error}.`,
    'recommended',
  );

  pushCheck(
    'Hosted storefront summary probe',
    hostedStorefrontProbe.ok &&
      hostedStorefrontProbe.summaries.ok &&
      hostedStorefrontProbe.itemCount > 0,
    hostedStorefrontProbe.ok
      ? hostedStorefrontProbe.summaries.ok && hostedStorefrontProbe.itemCount > 0
        ? `Hosted storefront summaries returned ${hostedStorefrontProbe.itemCount} sampled item${hostedStorefrontProbe.itemCount === 1 ? '' : 's'}.`
        : `Hosted storefront summaries returned HTTP ${hostedStorefrontProbe.summaries.status} or no sampled items.`
      : `Unable to probe hosted storefront summaries: ${hostedStorefrontProbe.error}.`,
    'recommended',
  );

  pushCheck(
    'Hosted storefront summary freshness signal',
    !hostedStorefrontProbe.ok ||
      hostedStorefrontProbe.itemCount === 0 ||
      !hostedStorefrontProbe.allClosed ||
      hostedStorefrontProbe.placeIdCoverage > 0,
    !hostedStorefrontProbe.ok || hostedStorefrontProbe.itemCount === 0
      ? 'Hosted storefront freshness signal could not be evaluated.'
      : !hostedStorefrontProbe.allClosed || hostedStorefrontProbe.placeIdCoverage > 0
        ? `Hosted summary sample is not uniformly closed, and ${(hostedStorefrontProbe.placeIdCoverage * 100).toFixed(0)}% of sampled items expose place IDs.`
        : 'Hosted summary sample is uniformly closed and has no place IDs. Open/closed state may be stale.',
    'recommended',
  );
}

const publicAdminApiKey = readValue('EXPO_PUBLIC_ADMIN_API_KEY');
pushCheck(
  'No public admin API key in app env',
  !publicAdminApiKey,
  !publicAdminApiKey
    ? 'No EXPO_PUBLIC_ADMIN_API_KEY is present in app env.'
    : 'Remove EXPO_PUBLIC_ADMIN_API_KEY from app env. Admin runtime access must use authenticated admin accounts, not a bundled shared secret.',
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
    : `Missing Firebase client env: ${missingFirebaseEnvVars.join(', ')}.`,
);

const easBuildProfiles = ['preview', 'production'];
const trackedPublicEasEnvAllowlist = new Set(['EXPO_PUBLIC_OWNER_PORTAL_PRELAUNCH_ENABLED']);
const hardcodedEasEnvEntries = easBuildProfiles.flatMap((profileName) => {
  const profileEnv = easConfig.build?.[profileName]?.env ?? {};
  return Object.keys(profileEnv)
    .filter((name) => name.startsWith('EXPO_PUBLIC_'))
    .filter((name) => !trackedPublicEasEnvAllowlist.has(name))
    .map((name) => `${profileName}.${name}`);
});
pushCheck(
  'Tracked EAS profiles do not hardcode public app env',
  hardcodedEasEnvEntries.length === 0,
  hardcodedEasEnvEntries.length === 0
    ? 'Preview and production EAS profiles rely on hosted env instead of tracked EXPO_PUBLIC values, except allowlisted release-safety flags.'
    : `Move these values out of eas.json and into hosted EAS environments: ${hardcodedEasEnvEntries.join(', ')}.`,
);

function resolveEasBuildProfile(profileName, seen = new Set()) {
  const profile = easConfig.build?.[profileName];
  if (!profile || typeof profile !== 'object') {
    return {};
  }

  const parentName = typeof profile.extends === 'string' ? profile.extends : '';
  if (!parentName || seen.has(parentName)) {
    return profile;
  }

  seen.add(profileName);
  return {
    ...resolveEasBuildProfile(parentName, seen),
    ...profile,
  };
}

const easUpdateUrl = String(appIdentity.updates?.url ?? '').trim();
const easBuildProfileNames = Object.keys(easConfig.build ?? {});
const easProfilesMissingUpdateChannel =
  easUpdateUrl.length > 0
    ? easBuildProfileNames.filter((profileName) => {
        const resolvedProfile = resolveEasBuildProfile(profileName);
        return typeof resolvedProfile.channel !== 'string' || !resolvedProfile.channel.trim();
      })
    : [];
pushCheck(
  'EAS Update channels configured',
  !easUpdateUrl || easProfilesMissingUpdateChannel.length === 0,
  !easUpdateUrl
    ? 'EAS Update is not configured, so build profile channels are not required.'
    : easProfilesMissingUpdateChannel.length === 0
      ? 'Every EAS build profile has an update channel.'
      : `Add channel values to these EAS build profiles: ${easProfilesMissingUpdateChannel.join(', ')}.`,
);

const sentryClientDsn = readValue('EXPO_PUBLIC_SENTRY_DSN');
pushCheck(
  'Mobile crash monitoring DSN',
  Boolean(sentryClientDsn),
  sentryClientDsn
    ? 'EXPO_PUBLIC_SENTRY_DSN is configured.'
    : 'Set EXPO_PUBLIC_SENTRY_DSN to enable hosted mobile crash monitoring.',
  'recommended',
);

const sentryBuildOrg = readValue('SENTRY_ORG');
const sentryBuildProject = readValue('SENTRY_PROJECT');
const sentryBuildAuthToken = readValue('SENTRY_AUTH_TOKEN');
const hasSentryBuildMetadata = Boolean(sentryBuildOrg && sentryBuildProject);
pushCheck(
  'Sentry mobile source map upload config',
  !sentryClientDsn ||
    (!hasSentryBuildMetadata && !sentryBuildAuthToken) ||
    (hasSentryBuildMetadata && Boolean(sentryBuildAuthToken)),
  !sentryClientDsn
    ? 'Mobile Sentry DSN is not configured yet, so source map upload is not expected.'
    : hasSentryBuildMetadata && sentryBuildAuthToken
      ? 'Sentry build metadata is configured for native source map upload.'
      : 'If you want release crash stacks to resolve back to source lines, set SENTRY_ORG, SENTRY_PROJECT, and SENTRY_AUTH_TOKEN in hosted build env.',
  'recommended',
);

const supportEmail = readValue('EXPO_PUBLIC_SUPPORT_EMAIL');
pushCheck(
  'Support email',
  isEmail(supportEmail),
  isEmail(supportEmail)
    ? `Using ${supportEmail}.`
    : 'Set EXPO_PUBLIC_SUPPORT_EMAIL to a monitored support inbox.',
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
    isPublicHttpUrl(value) ? `Using ${value}.` : `Set ${envVar} to a public non-local http(s) URL.`,
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
    isPublicHttpUrl(value) ? `Using ${value}.` : `Set ${envVar} to a public non-local http(s) URL.`,
    'recommended',
  );
}

const ownerPrelaunchEnabled = isTruthy(readValue('EXPO_PUBLIC_OWNER_PORTAL_PRELAUNCH_ENABLED'));
pushCheck(
  'Owner prelaunch gate enabled',
  ownerPrelaunchEnabled,
  ownerPrelaunchEnabled
    ? 'Owner portal prelaunch mode is on, so owner onboarding stays gated in the app bundle.'
    : 'Set EXPO_PUBLIC_OWNER_PORTAL_PRELAUNCH_ENABLED=true until owner onboarding is fully gated server-side.',
  'recommended',
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
  'recommended',
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
    'recommended',
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
  'recommended',
);

pushCheck(
  'Expo slug',
  appIdentity.slug === 'canopytrove',
  appIdentity.slug === 'canopytrove'
    ? 'Expo slug is canopytrove.'
    : 'Set expo.slug to canopytrove in app.json.',
);

pushCheck(
  'iOS bundle identifier',
  appIdentity.ios?.bundleIdentifier === 'com.rezell.canopytrove',
  appIdentity.ios?.bundleIdentifier === 'com.rezell.canopytrove'
    ? 'iOS bundle identifier is com.rezell.canopytrove.'
    : 'Set expo.ios.bundleIdentifier to com.rezell.canopytrove in app.json.',
);

pushCheck(
  'Android package identifier',
  appIdentity.android?.package === 'com.rezell.canopytrove',
  appIdentity.android?.package === 'com.rezell.canopytrove'
    ? 'Android package identifier is com.rezell.canopytrove.'
    : 'Set expo.android.package to com.rezell.canopytrove in app.json.',
);

const iconPath = path.join(projectRoot, appIdentity.icon || './assets/icon.png');
const splashPath = path.join(projectRoot, appIdentity.splash?.image || './assets/splash-icon.png');
const hasIconFile = fs.existsSync(iconPath);
const hasSplashFile = fs.existsSync(splashPath);
const androidPermissions = Array.isArray(appIdentity.android?.permissions)
  ? appIdentity.android.permissions
  : [];
const androidBlockedPermissions = Array.isArray(appIdentity.android?.blockedPermissions)
  ? appIdentity.android.blockedPermissions
  : [];

pushCheck(
  'App icon file exists',
  hasIconFile,
  hasIconFile
    ? `App icon found at ${appIdentity.icon || 'assets/icon.png'}.`
    : `App icon file not found. Ensure ${appIdentity.icon || 'assets/icon.png'} exists.`,
);

pushCheck(
  'Splash icon file exists',
  hasSplashFile,
  hasSplashFile
    ? `Splash icon found at ${appIdentity.splash?.image || 'assets/splash-icon.png'}.`
    : `Splash icon file not found. Ensure ${appIdentity.splash?.image || 'assets/splash-icon.png'} exists.`,
);

// Expo SDK removed the `ios.minimumOSVersion` top-level field; pin via the
// expo-build-properties plugin instead and read its config back.
const buildPropsPlugin = (appIdentity.plugins ?? []).find(
  (entry) =>
    Array.isArray(entry) && entry[0] === 'expo-build-properties' && entry[1]?.ios?.deploymentTarget,
);
const buildPropsConfig = Array.isArray(buildPropsPlugin) ? (buildPropsPlugin[1] ?? {}) : {};
const iosMinimumOsVersion = buildPropsConfig?.ios?.deploymentTarget;
const hasValidIosVersion = iosMinimumOsVersion && /^\d+\.\d+/.test(iosMinimumOsVersion);
const androidTargetSdkVersion = Number(buildPropsConfig?.android?.targetSdkVersion ?? 0);
const androidCompileSdkVersion = Number(buildPropsConfig?.android?.compileSdkVersion ?? 0);

pushCheck(
  'iOS minimum OS version configured',
  hasValidIosVersion,
  hasValidIosVersion
    ? `iOS minimum OS version set to ${iosMinimumOsVersion} via expo-build-properties.`
    : 'Set ios.deploymentTarget via the expo-build-properties plugin in app.json.',
);

pushCheck(
  'Android target SDK configured',
  Number.isFinite(androidTargetSdkVersion) && androidTargetSdkVersion >= 36,
  Number.isFinite(androidTargetSdkVersion) && androidTargetSdkVersion >= 36
    ? `Android target SDK set to ${androidTargetSdkVersion} via expo-build-properties.`
    : 'Set android.targetSdkVersion to 36 or higher via the expo-build-properties plugin in app.json.',
);

pushCheck(
  'Android compile SDK configured',
  Number.isFinite(androidCompileSdkVersion) && androidCompileSdkVersion >= 36,
  Number.isFinite(androidCompileSdkVersion) && androidCompileSdkVersion >= 36
    ? `Android compile SDK set to ${androidCompileSdkVersion} via expo-build-properties.`
    : 'Set android.compileSdkVersion to 36 or higher via the expo-build-properties plugin in app.json.',
);

pushCheck(
  'Android broad photo access removed',
  !androidPermissions.includes('android.permission.READ_MEDIA_IMAGES') &&
    androidBlockedPermissions.includes('android.permission.READ_MEDIA_IMAGES'),
  !androidPermissions.includes('android.permission.READ_MEDIA_IMAGES') &&
    androidBlockedPermissions.includes('android.permission.READ_MEDIA_IMAGES')
    ? 'READ_MEDIA_IMAGES is not requested and is explicitly blocked for Android builds.'
    : 'Remove READ_MEDIA_IMAGES from expo.android.permissions and block it via expo.android.blockedPermissions for Play-safe Android builds.',
);

pushCheck(
  'Android image picker audio permission blocked',
  androidBlockedPermissions.includes('android.permission.RECORD_AUDIO'),
  androidBlockedPermissions.includes('android.permission.RECORD_AUDIO')
    ? 'RECORD_AUDIO is explicitly blocked for Android builds.'
    : 'Block RECORD_AUDIO via expo.android.blockedPermissions so the Android build does not inherit unused audio capture access.',
);

const webDescription = String(appIdentity.web?.description ?? '');
const hasSalesForwardDescription = /\bhot deals?\b|\bbuy now\b|\bshop now\b/i.test(webDescription);
pushCheck(
  'Manifest marketing copy avoids sales-forward phrasing',
  !hasSalesForwardDescription,
  !hasSalesForwardDescription
    ? 'Web/app manifest description avoids sales-forward phrases such as "hot deals" and "buy now".'
    : 'Remove sales-forward phrases such as "hot deals", "buy now", or "shop now" from app metadata before a Play submission.',
  'recommended',
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
  `Required checks: ${passedRequired}/${checks.filter((check) => check.severity === 'required').length} passed`,
);
console.log(
  `Recommended checks: ${passedRecommended}/${checks.filter((check) => check.severity === 'recommended').length} passed`,
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
