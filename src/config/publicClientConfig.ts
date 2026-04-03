function readConfiguredValue(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function readConfiguredOrDefault(value: string | null | undefined, fallback: string) {
  return readConfiguredValue(value) ?? fallback;
}

const PUBLIC_CLIENT_DEFAULTS = {
  storefrontSource: 'api',
  storefrontApiBaseUrl: 'https://api.canopytrove.com',
  firebase: {
    apiKey: 'AIzaSyDiKE_Xe7psosPZWrRwkZ8L4NeSG6kGJKY',
    authDomain: 'canopy-trove.firebaseapp.com',
    projectId: 'canopy-trove',
    storageBucket: 'canopy-trove.firebasestorage.app',
    messagingSenderId: '948351810374',
    appId: '1:948351810374:web:4b3c9b1536b604c7204347',
  },
} as const;

export const publicClientConfig = {
  storefrontSource: readConfiguredOrDefault(
    process.env.EXPO_PUBLIC_STOREFRONT_SOURCE,
    PUBLIC_CLIENT_DEFAULTS.storefrontSource,
  ),
  storefrontApiBaseUrl: readConfiguredOrDefault(
    process.env.EXPO_PUBLIC_STOREFRONT_API_BASE_URL,
    PUBLIC_CLIENT_DEFAULTS.storefrontApiBaseUrl,
  ),
  firebase: {
    apiKey: readConfiguredOrDefault(
      process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      PUBLIC_CLIENT_DEFAULTS.firebase.apiKey,
    ),
    authDomain: readConfiguredOrDefault(
      process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      PUBLIC_CLIENT_DEFAULTS.firebase.authDomain,
    ),
    projectId: readConfiguredOrDefault(
      process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      PUBLIC_CLIENT_DEFAULTS.firebase.projectId,
    ),
    storageBucket: readConfiguredOrDefault(
      process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      PUBLIC_CLIENT_DEFAULTS.firebase.storageBucket,
    ),
    messagingSenderId: readConfiguredOrDefault(
      process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      PUBLIC_CLIENT_DEFAULTS.firebase.messagingSenderId,
    ),
    appId: readConfiguredOrDefault(
      process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
      PUBLIC_CLIENT_DEFAULTS.firebase.appId,
    ),
  },
} as const;
