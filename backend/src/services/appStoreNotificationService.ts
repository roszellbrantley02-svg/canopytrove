import path from 'node:path';
import fs from 'node:fs/promises';
import {
  Environment,
  SignedDataVerifier,
  type JWSRenewalInfoDecodedPayload,
  type JWSTransactionDecodedPayload,
  type ResponseBodyV2DecodedPayload,
} from '@apple/app-store-server-library';
import { applyAppleNotification, getOwnerBillingDb } from './ownerBillingService';

const APPLE_BUNDLE_ID = process.env.APPLE_OWNER_IAP_BUNDLE_ID?.trim() || 'com.rezell.canopytrove';
const APPLE_APP_APPLE_ID_RAW = process.env.APPLE_APP_APPLE_ID?.trim();
const APPLE_APP_APPLE_ID = APPLE_APP_APPLE_ID_RAW ? Number.parseInt(APPLE_APP_APPLE_ID_RAW, 10) : 0;

const APPLE_NOTIFICATIONS_COLLECTION = 'appleNotifications';
const APPLE_ROOT_CA_DIR = path.resolve(__dirname, '..', 'certs', 'apple-root-cas');
const APPLE_ROOT_CA_FILES = ['AppleRootCA-G3.cer', 'AppleIncRootCertificate.cer'];

let cachedVerifiers: { production: SignedDataVerifier; sandbox: SignedDataVerifier } | null = null;

async function loadAppleRootCAs(): Promise<Buffer[]> {
  const certs: Buffer[] = [];
  for (const fn of APPLE_ROOT_CA_FILES) {
    try {
      const data = await fs.readFile(path.join(APPLE_ROOT_CA_DIR, fn));
      certs.push(data);
    } catch {
      // Skip if missing — at least one cert must succeed
    }
  }
  if (!certs.length) {
    throw new Error(
      `No Apple Root CAs found at ${APPLE_ROOT_CA_DIR}. ` +
        'Run `node backend/scripts/fetch-apple-root-cas.mjs` before deploying.',
    );
  }
  return certs;
}

async function getVerifiers(): Promise<{
  production: SignedDataVerifier;
  sandbox: SignedDataVerifier;
}> {
  if (cachedVerifiers) {
    return cachedVerifiers;
  }
  if (!APPLE_APP_APPLE_ID) {
    throw new Error(
      'APPLE_APP_APPLE_ID env var is not set; cannot construct SignedDataVerifier. ' +
        'Set it to the numeric Apple ID of the app from App Store Connect.',
    );
  }
  const rootCAs = await loadAppleRootCAs();
  cachedVerifiers = {
    production: new SignedDataVerifier(
      rootCAs,
      true,
      Environment.PRODUCTION,
      APPLE_BUNDLE_ID,
      APPLE_APP_APPLE_ID,
    ),
    sandbox: new SignedDataVerifier(
      rootCAs,
      true,
      Environment.SANDBOX,
      APPLE_BUNDLE_ID,
      APPLE_APP_APPLE_ID,
    ),
  };
  return cachedVerifiers;
}

// Apple's notifications can come from either Sandbox or Production. The
// signature verifier needs to match the environment. Try production first
// (most common), fall back to sandbox.
async function verifySignedNotification(signedPayload: string): Promise<{
  decoded: ResponseBodyV2DecodedPayload;
  environment: Environment;
}> {
  const verifiers = await getVerifiers();
  try {
    const decoded = await verifiers.production.verifyAndDecodeNotification(signedPayload);
    return { decoded, environment: Environment.PRODUCTION };
  } catch {
    const decoded = await verifiers.sandbox.verifyAndDecodeNotification(signedPayload);
    return { decoded, environment: Environment.SANDBOX };
  }
}

export type AppleNotificationProcessingResult = {
  status: 'processed' | 'duplicate' | 'no_state_change';
  notificationUUID: string;
  notificationType: string;
  subtype: string | null;
};

export async function processSignedNotification(
  signedPayload: string,
): Promise<AppleNotificationProcessingResult> {
  const { decoded, environment } = await verifySignedNotification(signedPayload);

  const notificationUUID = decoded.notificationUUID;
  const notificationType = decoded.notificationType;
  const subtype = decoded.subtype ?? null;

  if (!notificationUUID) {
    throw new Error('Apple notification missing notificationUUID');
  }
  if (!notificationType) {
    throw new Error('Apple notification missing notificationType');
  }

  // Idempotency check: Apple retries on non-2xx for up to a few days.
  const db = getOwnerBillingDb();
  const notifRef = db.collection(APPLE_NOTIFICATIONS_COLLECTION).doc(notificationUUID);
  const existing = await notifRef.get();
  if (existing.exists) {
    return {
      status: 'duplicate',
      notificationUUID,
      notificationType: String(notificationType),
      subtype: subtype ? String(subtype) : null,
    };
  }

  // Decode embedded transaction + renewal info using the same env.
  const verifiers = await getVerifiers();
  const verifier =
    environment === Environment.SANDBOX ? verifiers.sandbox : verifiers.production;

  let transactionInfo: JWSTransactionDecodedPayload | null = null;
  let renewalInfo: JWSRenewalInfoDecodedPayload | null = null;

  if (decoded.data?.signedTransactionInfo) {
    transactionInfo = await verifier.verifyAndDecodeTransaction(
      decoded.data.signedTransactionInfo,
    );
  }
  if (decoded.data?.signedRenewalInfo) {
    renewalInfo = await verifier.verifyAndDecodeRenewalInfo(decoded.data.signedRenewalInfo);
  }

  // Persist for audit trail + idempotency, even if nothing maps to a state change.
  await notifRef.set({
    notificationUUID,
    notificationType: String(notificationType),
    subtype: subtype ? String(subtype) : null,
    bundleId: decoded.data?.bundleId ?? null,
    bundleVersion: decoded.data?.bundleVersion ?? null,
    environment: environment === Environment.SANDBOX ? 'Sandbox' : 'Production',
    appAppleId: decoded.data?.appAppleId ?? null,
    receivedAt: new Date().toISOString(),
    transactionId: transactionInfo?.transactionId ?? null,
    originalTransactionId: transactionInfo?.originalTransactionId ?? null,
    productId: transactionInfo?.productId ?? null,
    expiresDate: transactionInfo?.expiresDate ?? null,
    autoRenewStatus: renewalInfo?.autoRenewStatus ?? null,
    autoRenewProductId: renewalInfo?.autoRenewProductId ?? null,
  });

  // Dispatch to ownerBillingService for the actual subscription state mapping.
  const stateChanged = await applyAppleNotification({
    notificationType: String(notificationType),
    subtype: subtype ? String(subtype) : null,
    transactionInfo,
    renewalInfo,
  });

  return {
    status: stateChanged ? 'processed' : 'no_state_change',
    notificationUUID,
    notificationType: String(notificationType),
    subtype: subtype ? String(subtype) : null,
  };
}
