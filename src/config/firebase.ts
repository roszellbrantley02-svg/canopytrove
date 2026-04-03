import type { FirebaseApp } from 'firebase/app';
import { getApp, getApps, initializeApp } from 'firebase/app';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

  cachedDb = getFirestore(app);
  return cachedDb;
}

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
      persistence: getReactNativePersistence(AsyncStorage),
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
