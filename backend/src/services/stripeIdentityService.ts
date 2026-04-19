/**
 * Stripe Identity — automated document + selfie verification for owner onboarding.
 *
 * Flow:
 *   1. Owner submits business verification (OCM auto-check runs first)
 *   2. If business passes, frontend calls POST /owner-portal/identity-verification/session
 *   3. Backend creates a Stripe Identity VerificationSession and returns the client_secret
 *   4. Frontend opens the Stripe Identity hosted verification UI
 *   5. Stripe webhooks POST /identity-verification/stripe/webhook with the result
 *   6. Backend updates Firestore and advances onboarding step
 */

import crypto from 'node:crypto';
import { serverConfig } from '../config';
import { getBackendFirebaseDb, hasBackendFirebaseConfig } from '../firebase';
import { logger } from '../observability/logger';
import {
  IDENTITY_VERIFICATIONS_COLLECTION,
  OWNER_PROFILES_COLLECTION,
} from '../constants/collections';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StripeIdentityVerificationSession = {
  id: string;
  client_secret: string | null;
  url: string | null;
  status: string; // requires_input | processing | verified | canceled
  type: string;
  last_error?: { code?: string; reason?: string } | null;
  last_verification_report?: string | null;
  metadata?: Record<string, string> | null;
};

type StripeIdentityWebhookEvent = {
  id: string;
  type: string;
  data: {
    object: StripeIdentityVerificationSession;
  };
};

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

const STRIPE_API_BASE_URL = 'https://api.stripe.com/v1';
const STRIPE_WEBHOOK_TOLERANCE_SECONDS = 300;

function getStripeSecretKey(): string {
  const key = serverConfig.stripeSecretKey;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not configured.');
  }
  return key;
}

function getStripeIdentityWebhookSecret(): string {
  const secret = process.env.STRIPE_IDENTITY_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw new Error('STRIPE_IDENTITY_WEBHOOK_SECRET is not configured.');
  }
  return secret;
}

function getFirestoreDb() {
  if (!hasBackendFirebaseConfig) {
    throw new Error('Firebase admin access is not configured.');
  }
  const db = getBackendFirebaseDb();
  if (!db) {
    throw new Error('Backend Firestore is not available.');
  }
  return db;
}

// ---------------------------------------------------------------------------
// Stripe API helpers
// ---------------------------------------------------------------------------

async function stripePost<T>(path: string, body: Record<string, string>): Promise<T> {
  const response = await fetch(`${STRIPE_API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getStripeSecretKey()}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(body).toString(),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Stripe API error ${response.status}: ${errorText}`);
  }

  return (await response.json()) as T;
}

// ---------------------------------------------------------------------------
// Create a Stripe Identity VerificationSession
// ---------------------------------------------------------------------------

export async function createStripeIdentitySession(ownerUid: string): Promise<{
  ok: true;
  sessionId: string;
  clientSecret: string;
  verificationUrl: string | null;
}> {
  const db = getFirestoreDb();

  // Check that the owner exists and business verification is done
  const ownerSnapshot = await db.collection(OWNER_PROFILES_COLLECTION).doc(ownerUid).get();

  if (!ownerSnapshot.exists) {
    throw new Error('Owner profile not found.');
  }

  const ownerData = ownerSnapshot.data() as Record<string, unknown>;
  const businessStatus = ownerData?.businessVerificationStatus;

  if (businessStatus !== 'verified') {
    throw new Error('Business verification must be completed before identity verification.');
  }

  // Check if there's already a pending/processing/verified session. We
  // block 'pending' too: the previous check let owners start a new Stripe
  // Identity session while one was still outstanding, which burned Stripe
  // API quota, left orphaned VerificationSessions on Stripe's side, and
  // created a race where the webhook could land on a stale session id and
  // overwrite the current record with an out-of-date status.
  const existingVerification = await db
    .collection(IDENTITY_VERIFICATIONS_COLLECTION)
    .doc(ownerUid)
    .get();

  if (existingVerification.exists) {
    const existing = existingVerification.data() as Record<string, unknown>;
    const blockingStatuses = new Set(['verified', 'processing', 'pending']);
    if (typeof existing?.verificationStatus === 'string' && blockingStatuses.has(existing.verificationStatus)) {
      throw new Error(`Identity verification is already ${existing.verificationStatus}.`);
    }
  }

  // Create a Stripe Identity VerificationSession
  // Providing a return_url causes Stripe to generate a hosted verification URL
  const returnUrl =
    serverConfig.stripeOwnerSuccessUrl?.replace('/billing/success', '/identity/complete') ??
    'https://canopytrove.com/owner/identity/complete';

  const session = await stripePost<StripeIdentityVerificationSession>(
    '/identity/verification_sessions',
    {
      type: 'document',
      return_url: returnUrl,
      'metadata[ownerUid]': ownerUid,
      'options[document][require_matching_selfie]': 'true',
      'options[document][require_live_capture]': 'true',
      'options[document][allowed_types][0]': 'driving_license',
      'options[document][allowed_types][1]': 'id_card',
      'options[document][allowed_types][2]': 'passport',
    },
  );

  if (!session.client_secret) {
    throw new Error('Stripe Identity did not return a client secret.');
  }

  const now = new Date().toISOString();

  // Save the verification record to Firestore
  await db.collection(IDENTITY_VERIFICATIONS_COLLECTION).doc(ownerUid).set(
    {
      ownerUid,
      provider: 'stripe_identity',
      providerReferenceId: session.id,
      verificationStatus: 'pending',
      stripeSessionStatus: session.status,
      submittedAt: now,
      reviewedAt: null,
      adminNotes: null,
      updatedAt: now,
    },
    { merge: true },
  );

  logger.info('Stripe Identity session created', {
    ownerUid,
    sessionId: session.id,
    status: session.status,
  });

  return {
    ok: true,
    sessionId: session.id,
    clientSecret: session.client_secret,
    verificationUrl: session.url ?? null,
  };
}

// ---------------------------------------------------------------------------
// Webhook signature verification (matches Stripe's v1 scheme)
// ---------------------------------------------------------------------------

function verifyStripeWebhookSignature(
  payload: Buffer,
  signatureHeader: string | undefined,
  secret: string,
): StripeIdentityWebhookEvent {
  if (!signatureHeader) {
    throw new Error('Missing stripe-signature header.');
  }

  const parts = signatureHeader.split(',').reduce(
    (accumulator, part) => {
      const [key, value] = part.split('=');
      if (key === 't') accumulator.timestamp = value;
      if (key === 'v1') accumulator.signatures.push(value);
      return accumulator;
    },
    { timestamp: '', signatures: [] as string[] },
  );

  if (!parts.timestamp || parts.signatures.length === 0) {
    throw new Error('Invalid stripe-signature format.');
  }

  const timestampSeconds = Number(parts.timestamp);
  const nowSeconds = Math.floor(Date.now() / 1000);

  if (Math.abs(nowSeconds - timestampSeconds) > STRIPE_WEBHOOK_TOLERANCE_SECONDS) {
    throw new Error('Webhook timestamp is outside tolerance window.');
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${parts.timestamp}.${payload.toString('utf8')}`)
    .digest('hex');

  const isValid = parts.signatures.some((sig) =>
    crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expectedSignature, 'hex')),
  );

  if (!isValid) {
    throw new Error('Webhook signature verification failed.');
  }

  return JSON.parse(payload.toString('utf8')) as StripeIdentityWebhookEvent;
}

// ---------------------------------------------------------------------------
// Handle Stripe Identity webhook events
// ---------------------------------------------------------------------------

export async function handleStripeIdentityWebhook(
  payload: Buffer,
  signatureHeader: string | undefined,
): Promise<{ ok: true; eventType: string }> {
  const secret = getStripeIdentityWebhookSecret();
  const event = verifyStripeWebhookSignature(payload, signatureHeader, secret);

  logger.info('Stripe Identity webhook received', {
    eventId: event.id,
    eventType: event.type,
  });

  switch (event.type) {
    case 'identity.verification_session.verified':
      await handleVerificationVerified(event.data.object);
      break;

    case 'identity.verification_session.requires_input':
      await handleVerificationRequiresInput(event.data.object);
      break;

    case 'identity.verification_session.canceled':
      await handleVerificationCanceled(event.data.object);
      break;

    default:
      logger.info('Unhandled Stripe Identity event type', {
        eventType: event.type,
      });
  }

  return { ok: true, eventType: event.type };
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handleVerificationVerified(
  session: StripeIdentityVerificationSession,
): Promise<void> {
  const ownerUid = session.metadata?.ownerUid;
  if (!ownerUid) {
    logger.warn('Stripe Identity verified event missing ownerUid metadata', {
      sessionId: session.id,
    });
    return;
  }

  const db = getFirestoreDb();
  const now = new Date().toISOString();

  await Promise.all([
    db
      .collection(IDENTITY_VERIFICATIONS_COLLECTION)
      .doc(ownerUid)
      .set(
        {
          verificationStatus: 'verified',
          stripeSessionStatus: 'verified',
          stripeVerificationReportId: session.last_verification_report ?? null,
          reviewedAt: now,
          updatedAt: now,
        },
        { merge: true },
      ),
    db.collection(OWNER_PROFILES_COLLECTION).doc(ownerUid).set(
      {
        identityVerificationStatus: 'verified',
        onboardingStep: 'subscription',
        updatedAt: now,
      },
      { merge: true },
    ),
  ]);

  logger.info('Owner identity verified via Stripe Identity', {
    ownerUid,
    sessionId: session.id,
  });
}

async function handleVerificationRequiresInput(
  session: StripeIdentityVerificationSession,
): Promise<void> {
  const ownerUid = session.metadata?.ownerUid;
  if (!ownerUid) {
    logger.warn('Stripe Identity requires_input event missing ownerUid', {
      sessionId: session.id,
    });
    return;
  }

  const db = getFirestoreDb();
  const now = new Date().toISOString();

  const errorCode = session.last_error?.code ?? 'unknown';
  const errorReason = session.last_error?.reason ?? 'Verification could not be completed.';

  await db.collection(IDENTITY_VERIFICATIONS_COLLECTION).doc(ownerUid).set(
    {
      verificationStatus: 'needs_resubmission',
      stripeSessionStatus: 'requires_input',
      stripeErrorCode: errorCode,
      stripeErrorReason: errorReason,
      updatedAt: now,
    },
    { merge: true },
  );

  logger.info('Owner identity verification needs resubmission', {
    ownerUid,
    sessionId: session.id,
    errorCode,
  });
}

async function handleVerificationCanceled(
  session: StripeIdentityVerificationSession,
): Promise<void> {
  const ownerUid = session.metadata?.ownerUid;
  if (!ownerUid) {
    logger.warn('Stripe Identity canceled event missing ownerUid', {
      sessionId: session.id,
    });
    return;
  }

  const db = getFirestoreDb();
  const now = new Date().toISOString();

  await db.collection(IDENTITY_VERIFICATIONS_COLLECTION).doc(ownerUid).set(
    {
      verificationStatus: 'canceled',
      stripeSessionStatus: 'canceled',
      updatedAt: now,
    },
    { merge: true },
  );

  logger.info('Owner identity verification canceled', {
    ownerUid,
    sessionId: session.id,
  });
}
