import { Platform } from 'react-native';

/**
 * Firebase App Check — App Attest bridge.
 *
 * We use the @react-native-firebase/app-check SDK as a narrow, iOS-only
 * companion to the `firebase` web SDK we use elsewhere. The two SDKs
 * coexist: the web SDK owns auth/firestore/storage, RNFirebase owns
 * only App Check token generation. This avoids a large migration while
 * still giving us native App Attest attestation on iOS, which is what
 * the web SDK cannot do in React Native.
 *
 * All RNFirebase access is lazy and failure-tolerant. If the native
 * module isn't installed (e.g. JS-only dev client, Expo Go, web), or
 * if App Attest can't be provisioned (e.g. simulator, jailbroken
 * device), getAppCheckToken() returns null and the backend treats the
 * request as unattested. During the rollout phase we ship the backend
 * middleware in "log only" mode so missing tokens don't break anyone.
 */

type AppCheckModule = {
  default: () => {
    newReactNativeFirebaseAppCheckProvider: () => {
      configure: (config: {
        apple?: { provider?: 'appAttest' | 'debug'; debugToken?: string };
      }) => unknown;
    };
    initializeAppCheck: (
      provider: unknown,
      options?: { isTokenAutoRefreshEnabled?: boolean },
    ) => Promise<void>;
    getToken: (forceRefresh?: boolean) => Promise<{ token: string }>;
  };
};

let appCheckModuleCache: AppCheckModule | null = null;
let appCheckInitPromise: Promise<boolean> | null = null;
let appCheckInitialized = false;

function loadAppCheckModule(): AppCheckModule | null {
  if (appCheckModuleCache) {
    return appCheckModuleCache;
  }

  try {
    // Lazy require so the web bundle and JS-only dev clients don't
    // blow up when the native module is missing.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-firebase/app-check') as AppCheckModule;
    appCheckModuleCache = mod;
    return mod;
  } catch {
    return null;
  }
}

/**
 * Initialize App Check once at app startup. Safe to call multiple
 * times — subsequent calls are no-ops. Safe to call on web or in
 * environments where RNFirebase isn't present — returns false and
 * the rest of the app continues without App Check.
 */
export async function initializeAppCheck(): Promise<boolean> {
  if (appCheckInitialized) {
    return true;
  }

  if (appCheckInitPromise) {
    return appCheckInitPromise;
  }

  appCheckInitPromise = (async () => {
    if (Platform.OS === 'web') {
      return false;
    }

    const mod = loadAppCheckModule();
    if (!mod) {
      return false;
    }

    try {
      const appCheck = mod.default();
      const providerFactory = appCheck.newReactNativeFirebaseAppCheckProvider();
      const provider = providerFactory.configure({
        apple: {
          // App Attest is the iOS 14+ hardware-backed attestation.
          // Falls back gracefully on simulator (returns a debug token
          // only if one is registered in the Firebase console).
          provider: 'appAttest',
        },
      });

      await appCheck.initializeAppCheck(provider, {
        isTokenAutoRefreshEnabled: true,
      });

      appCheckInitialized = true;
      return true;
    } catch {
      // Never let an App Check failure break app boot. The backend is
      // in log-only mode during the rollout, so a missing token just
      // means this request goes through unattested.
      return false;
    }
  })();

  return appCheckInitPromise;
}

/**
 * Fetch the current App Check token. Returns null if App Check isn't
 * initialized, if the platform doesn't support it, or if token
 * retrieval failed. Callers should treat a null return as "no
 * attestation available" and send the request anyway — the backend
 * decides whether to enforce.
 */
export async function getAppCheckToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return null;
  }

  if (!appCheckInitialized) {
    const initialized = await initializeAppCheck();
    if (!initialized) {
      return null;
    }
  }

  const mod = loadAppCheckModule();
  if (!mod) {
    return null;
  }

  try {
    const appCheck = mod.default();
    const result = await appCheck.getToken(false);
    return typeof result?.token === 'string' && result.token.length > 0 ? result.token : null;
  } catch {
    return null;
  }
}
