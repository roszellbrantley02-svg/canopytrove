import {
  App,
  ServiceAccount,
  applicationDefault,
  cert,
  getApp,
  getApps,
  initializeApp,
} from 'firebase-admin/app';
import { Auth, getAuth } from 'firebase-admin/auth';
import { Firestore, getFirestore } from 'firebase-admin/firestore';
import { Storage, getStorage } from 'firebase-admin/storage';

type BackendFirebaseAuthOverride = Pick<Auth, 'verifyIdToken' | 'getUser'>;

function readEnv(name: string) {
  return process.env[name]?.trim() || '';
}

function getBackendFirebaseAuthTestOverride(): BackendFirebaseAuthOverride | null {
  if (process.env.NODE_ENV !== 'test') {
    return null;
  }

  const globalValue = (
    globalThis as typeof globalThis & {
      __CANOPY_TEST_BACKEND_FIREBASE_AUTH__?: BackendFirebaseAuthOverride;
    }
  ).__CANOPY_TEST_BACKEND_FIREBASE_AUTH__;

  return globalValue ?? null;
}

function parseServiceAccount(): ServiceAccount | null {
  const raw = readEnv('FIREBASE_SERVICE_ACCOUNT_JSON');
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as ServiceAccount;
    if (parsed.privateKey) {
      parsed.privateKey = parsed.privateKey.replace(/\\n/g, '\n');
    }

    return parsed;
  } catch {
    return null;
  }
}

function readCloudProjectId() {
  return (
    readEnv('FIREBASE_PROJECT_ID') ||
    readEnv('GOOGLE_CLOUD_PROJECT') ||
    readEnv('GCLOUD_PROJECT') ||
    ''
  );
}

function readFirestoreDatabaseId() {
  return readEnv('FIREBASE_DATABASE_ID');
}

function readStorageBucket() {
  return readEnv('FIREBASE_STORAGE_BUCKET');
}

function isCloudRunRuntime() {
  return Boolean(readEnv('K_SERVICE') || readEnv('K_REVISION') || readEnv('K_CONFIGURATION'));
}

const serviceAccount = parseServiceAccount();
const hasApplicationDefaultCredentials = Boolean(
  readEnv('GOOGLE_APPLICATION_CREDENTIALS') || isCloudRunRuntime() || readCloudProjectId(),
);
const backendProjectId = readCloudProjectId() || serviceAccount?.projectId || undefined;
const backendFirestoreDatabaseId = readFirestoreDatabaseId() || undefined;
const backendStorageBucket = readStorageBucket() || undefined;

export const hasBackendFirebaseConfig = Boolean(
  serviceAccount || hasApplicationDefaultCredentials || getBackendFirebaseAuthTestOverride(),
);

let cachedApp: App | null = null;
let cachedAuth: Auth | null = null;
let cachedDb: Firestore | null = null;
let cachedStorage: Storage | null = null;

export function getBackendFirebaseApp(): App | null {
  if (!hasBackendFirebaseConfig) {
    return null;
  }

  if (cachedApp) {
    return cachedApp;
  }

  if (getApps().length) {
    cachedApp = getApp();
    return cachedApp;
  }

  cachedApp = initializeApp(
    serviceAccount
      ? {
          credential: cert(serviceAccount),
          projectId: backendProjectId,
          storageBucket: backendStorageBucket,
        }
      : {
          credential: applicationDefault(),
          projectId: backendProjectId,
          storageBucket: backendStorageBucket,
        },
  );
  return cachedApp;
}

export function getBackendFirebaseDb(): Firestore | null {
  if (!hasBackendFirebaseConfig) {
    return null;
  }

  if (cachedDb) {
    return cachedDb;
  }

  const app = getBackendFirebaseApp();
  if (!app) {
    return null;
  }

  cachedDb = backendFirestoreDatabaseId
    ? getFirestore(app, backendFirestoreDatabaseId)
    : getFirestore(app);
  return cachedDb;
}

export function getBackendFirebaseAuth(): Auth | null {
  const testOverride = getBackendFirebaseAuthTestOverride();
  if (testOverride) {
    return testOverride as Auth;
  }

  if (!hasBackendFirebaseConfig) {
    return null;
  }

  if (cachedAuth) {
    return cachedAuth;
  }

  const app = getBackendFirebaseApp();
  if (!app) {
    return null;
  }

  cachedAuth = getAuth(app);
  return cachedAuth;
}

export function getBackendFirebaseStorage(): Storage | null {
  if (!hasBackendFirebaseConfig) {
    return null;
  }

  if (cachedStorage) {
    return cachedStorage;
  }

  const app = getBackendFirebaseApp();
  if (!app) {
    return null;
  }

  cachedStorage = getStorage(app);
  return cachedStorage;
}

export function setBackendFirebaseAuthForTests(auth: BackendFirebaseAuthOverride | null) {
  if (process.env.NODE_ENV !== 'test') {
    return;
  }

  const testGlobals = globalThis as typeof globalThis & {
    __CANOPY_TEST_BACKEND_FIREBASE_AUTH__?: BackendFirebaseAuthOverride;
  };
  if (auth) {
    testGlobals.__CANOPY_TEST_BACKEND_FIREBASE_AUTH__ = auth;
    return;
  }

  delete testGlobals.__CANOPY_TEST_BACKEND_FIREBASE_AUTH__;
}

export function clearBackendFirebaseTestStateForTests() {
  setBackendFirebaseAuthForTests(null);
  cachedApp = null;
  cachedAuth = null;
  cachedDb = null;
  cachedStorage = null;
}
