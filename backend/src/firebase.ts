import { App, ServiceAccount, applicationDefault, cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { Auth, getAuth } from 'firebase-admin/auth';
import { Firestore, getFirestore } from 'firebase-admin/firestore';

function readEnv(name: string) {
  return process.env[name]?.trim() || '';
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
  return readEnv('FIREBASE_PROJECT_ID') || readEnv('GOOGLE_CLOUD_PROJECT') || readEnv('GCLOUD_PROJECT') || '';
}

function isCloudRunRuntime() {
  return Boolean(readEnv('K_SERVICE') || readEnv('K_REVISION') || readEnv('K_CONFIGURATION'));
}

const serviceAccount = parseServiceAccount();
const hasApplicationDefaultCredentials = Boolean(
  readEnv('GOOGLE_APPLICATION_CREDENTIALS') || isCloudRunRuntime() || readCloudProjectId()
);
const backendProjectId = readCloudProjectId() || serviceAccount?.projectId || undefined;

export const hasBackendFirebaseConfig = Boolean(serviceAccount || hasApplicationDefaultCredentials);

let cachedApp: App | null = null;
let cachedAuth: Auth | null = null;
let cachedDb: Firestore | null = null;

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
        }
      : {
          credential: applicationDefault(),
          projectId: backendProjectId,
        }
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

  cachedDb = getFirestore(app);
  return cachedDb;
}

export function getBackendFirebaseAuth(): Auth | null {
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
