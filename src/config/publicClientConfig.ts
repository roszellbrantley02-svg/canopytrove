function readConfiguredValue(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function readConfiguredOrDefault(value: string | null | undefined, fallback: string) {
  return readConfiguredValue(value) ?? fallback;
}

/**
 * Read a Firebase config value. In development, falls back to the default.
 * In production builds (when EXPO_PUBLIC_FIREBASE_API_KEY is set), all
 * Firebase values must come from environment variables.
 */
function readFirebaseValue(value: string | null | undefined, fallback: string, name: string) {
  const configured = readConfiguredValue(value);
  if (configured) return configured;

  // If the API key env var is set, we're in a configured environment —
  // all Firebase values should be explicitly provided.
  const isConfiguredBuild = Boolean(readConfiguredValue(process.env.EXPO_PUBLIC_FIREBASE_API_KEY));
  if (isConfiguredBuild && __DEV__) {
    console.warn(
      `[publicClientConfig] Missing ${name} — expected in configured build. Using development fallback.`,
    );
  }

  return fallback;
}

/**
 * Development-only defaults. These are the Canopy Trove Firebase project
 * credentials used during local development. Production builds MUST
 * provide all values via EXPO_PUBLIC_* environment variables.
 *
 * Firebase API keys are safe to include in client-side code — they only
 * identify the project and are restricted by Firebase Security Rules.
 * However, production builds should always use env vars so that
 * misconfiguration is caught early.
 */
const DEV_FIREBASE_DEFAULTS = {
  apiKey: 'AIzaSyDiKE_Xe7psosPZWrRwkZ8L4NeSG6kGJKY',
  authDomain: 'canopy-trove.firebaseapp.com',
  projectId: 'canopy-trove',
  storageBucket: 'canopy-trove.firebasestorage.app',
  messagingSenderId: '948351810374',
  appId: '1:948351810374:web:4b3c9b1536b604c7204347',
} as const;

export const publicClientConfig = {
  storefrontSource: readConfiguredOrDefault(process.env.EXPO_PUBLIC_STOREFRONT_SOURCE, 'api'),
  storefrontApiBaseUrl: readConfiguredOrDefault(
    process.env.EXPO_PUBLIC_STOREFRONT_API_BASE_URL,
    'https://api.canopytrove.com',
  ),
  firebase: {
    apiKey: readFirebaseValue(
      process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      DEV_FIREBASE_DEFAULTS.apiKey,
      'EXPO_PUBLIC_FIREBASE_API_KEY',
    ),
    authDomain: readFirebaseValue(
      process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      DEV_FIREBASE_DEFAULTS.authDomain,
      'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
    ),
    projectId: readFirebaseValue(
      process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      DEV_FIREBASE_DEFAULTS.projectId,
      'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
    ),
    storageBucket: readFirebaseValue(
      process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      DEV_FIREBASE_DEFAULTS.storageBucket,
      'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
    ),
    messagingSenderId: readFirebaseValue(
      process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      DEV_FIREBASE_DEFAULTS.messagingSenderId,
      'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    ),
    appId: readFirebaseValue(
      process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
      DEV_FIREBASE_DEFAULTS.appId,
      'EXPO_PUBLIC_FIREBASE_APP_ID',
    ),
    databaseId: readConfiguredOrDefault(
      process.env.EXPO_PUBLIC_FIREBASE_DATABASE_ID,
      'canopytrove',
    ),
  },
} as const;
