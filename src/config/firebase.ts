import type { FirebaseApp } from 'firebase/app';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { Platform } from 'react-native';
import type { Auth } from 'firebase/auth';
import { getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';
import type { FirebaseStorage } from 'firebase/storage';
import { getStorage } from 'firebase/storage';
import { publicClientConfig } from './publicClientConfig';

const firebaseConfig = {
  apiKey: publicClientConfig.firebase.apiKey,
  authDomain: publicClientConfig.firebase.authDomain,
  projectId: publicClientConfig.firebase.projectId,
  storageBucket: publicClientConfig.firebase.storageBucket,
  messagingSenderId: publicClientConfig.firebase.messagingSenderId,
  appId: publicClientConfig.firebase.appId,
};

export const hasFirebaseConfig = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
);

let cachedApp: FirebaseApp | null = null;
let cachedDb: Firestore | null = null;
let cachedAuth: Auth | null = null;
let cachedStorage: FirebaseStorage | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  if (!hasFirebaseConfig) {
    return null;
  }

  if (cachedApp) {
    return cachedApp;
  }

  cachedApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return cachedApp;
}

export function getFirebaseDb(): Firestore | null {
  if (!hasFirebaseConfig) {
    return null;
  }

  if (cachedDb) {
    return cachedDb;
  }

  const app = getFirebaseApp();
  if (!app) {
    return null;
  }

  const databaseId = publicClientConfig.firebase.databaseId;
  cachedDb = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
  return cachedDb;
}

/**
 * Adapter so expo-secure-store satisfies getReactNativePersistence.
 * Firebase Auth only calls getItem / setItem / removeItem at runtime,
 * but the SDK typings demand the full AsyncStorageStatic surface.
 * Casting through unknown is the accepted community workaround.
 *
 * Key sanitization: Firebase Auth uses internal keys like
 * `firebase:authUser:AIzaSy...:[DEFAULT]` which contain characters
 * (`:`, `[`, `]`) that expo-secure-store rejects — keys must match
 * `[A-Za-z0-9._-]`. We map disallowed chars to `_` so the token still
 * lives in the iOS Keychain (more secure than AsyncStorage) while the
 * key format is legal. The mapping is stable and injective enough for
 * Firebase's fixed key set.
 *
 * On web, Firebase Auth uses browser localStorage by default (via getAuth),
 * so this adapter is never needed and expo-secure-store is not loaded.
 */
const sanitizeSecureStoreKey = (key: string): string => key.replace(/[^A-Za-z0-9._-]/g, '_');

const secureStoreAdapter =
  Platform.OS !== 'web'
    ? (() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const SecureStore = require('expo-secure-store');
        return {
          getItem: (key: string) => SecureStore.getItemAsync(sanitizeSecureStoreKey(key)),
          setItem: (key: string, value: string) =>
            SecureStore.setItemAsync(sanitizeSecureStoreKey(key), value),
          removeItem: (key: string) => SecureStore.deleteItemAsync(sanitizeSecureStoreKey(key)),
        } as Parameters<typeof getReactNativePersistence>[0];
      })()
    : (null as unknown as Parameters<typeof getReactNativePersistence>[0]);

export function getFirebaseAuth(): Auth | null {
  if (!hasFirebaseConfig) {
    return null;
  }

  if (cachedAuth) {
    return cachedAuth;
  }

  const app = getFirebaseApp();
  if (!app) {
    return null;
  }

  if (Platform.OS === 'web') {
    cachedAuth = getAuth(app);
    return cachedAuth;
  }

  try {
    cachedAuth = initializeAuth(app, {
      persistence: getReactNativePersistence(secureStoreAdapter),
    });
  } catch {
    cachedAuth = getAuth(app);
  }

  return cachedAuth;
}

export function getFirebaseStorage(): FirebaseStorage | null {
  if (!hasFirebaseConfig) {
    return null;
  }

  if (cachedStorage) {
    return cachedStorage;
  }

  const app = getFirebaseApp();
  if (!app) {
    return null;
  }

  cachedStorage = getStorage(app);
  return cachedStorage;
}
