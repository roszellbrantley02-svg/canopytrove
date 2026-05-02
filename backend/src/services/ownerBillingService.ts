import crypto from 'node:crypto';
import { Request } from 'express';
import { getMissingOwnerBillingBackendEnvVars, serverConfig } from '../config';
import {
  getBackendFirebaseAuth,
  getBackendFirebaseDb,
  hasBackendFirebaseConfig,
} from '../firebase';
import { logger } from '../observability/logger';
import {
  getOwnerAuthorizationState,
  isVerifiedOwnerStatus,
} from './ownerPortalAuthorizationService';
import { resolveOwnerLaunchTrialOffer } from './launchProgramService';

type OwnerBillingCycle = 'monthly' | 'annual';
type OwnerSubscriptionTier = 'free' | 'verified' | 'growth' | 'pro';
type OwnerSubscriptionStatus =
  | 'inactive'
  | 'trial'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'suspended';

type OwnerProfileRecord = {
  uid: string;
  legalName?: string | null;
  companyName?: string | null;
  subscriptionStatus?: string | null;
};

type OwnerSubscriptionRecord = {
  ownerUid: string;
  dispensaryId: string;
  provider: 'internal_prelaunch' | 'stripe' | 'apple_iap';
  externalCustomerId?: string | null;
  externalSubscriptionId: string | null;
  planId: string;
  tier: OwnerSubscriptionTier;
  status: OwnerSubscriptionStatus;
  billingCycle: OwnerBillingCycle;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
  lastCheckoutSessionId?: string | null;
  lastCheckoutOpenedAt?: string | null;
  launchTrialDays?: number | null;
  launchTrialClaimedAt?: string | null;
  launchProgramWindowEndsAt?: string | null;
};

type StripeCheckoutSession = {
  id: string;
  url: string | null;
  customer?: string | null;
  subscription?: string | null;
  client_reference_id?: string | null;
  mode?: string | null;
  metadata?: Record<string, string> | null;
};

type StripeBillingPortalSession = {
  id: string;
  url: string | null;
};

type StripeSubscription = {
  id: string;
  customer?: string | null;
  status: string;
  cancel_at_period_end?: boolean;
  current_period_start?: number;
  current_period_end?: number;
  metadata?: Record<string, string> | null;
  items?: {
    data?: Array<{
      price?: {
        id?: string | null;
        recurring?: {
          interval?: string | null;
        } | null;
      } | null;
    }>;
  } | null;
};

type StripeInvoice = {
  id: string;
  customer?: string | null;
  subscription?: string | null;
};

type StripeWebhookEvent = {
  id: string;
  type: string;
  data: {
    object: StripeCheckoutSession | StripeSubscription | StripeInvoice;
  };
};

type OwnerAppleSubscriptionTier = Exclude<OwnerSubscriptionTier, 'free'>;

type OwnerAppleSubscriptionSyncPayload = {
  productId?: unknown;
  transactionId?: unknown;
  originalTransactionId?: unknown;
  purchaseToken?: unknown;
  currentPlanId?: unknown;
  environmentIOS?: unknown;
  expirationDateMs?: unknown;
  transactionDateMs?: unknown;
  isAutoRenewing?: unknown;
  purchaseState?: unknown;
  renewalInfoIOS?: unknown;
};

const OWNER_PROFILES_COLLECTION = 'ownerProfiles';
const SUBSCRIPTIONS_COLLECTION = 'subscriptions';
const APPLE_ACCOUNT_TOKENS_COLLECTION = 'appleAccountTokens';
const STRIPE_API_BASE_URL = 'https://api.stripe.com/v1';
const STRIPE_WEBHOOK_TOLERANCE_SECONDS = 300;
const APPLE_OWNER_PRODUCT_IDS: Record<OwnerAppleSubscriptionTier, string> = {
  verified:
    process.env.APPLE_OWNER_IAP_VERIFIED_PRODUCT_ID?.trim() ||
    'com.rezell.canopytrove.owner.verified.monthly.v3',
  growth:
    process.env.APPLE_OWNER_IAP_GROWTH_PRODUCT_ID?.trim() ||
    'com.rezell.canopytrove.owner.growth.monthly.v3',
  pro:
    process.env.APPLE_OWNER_IAP_PRO_PRODUCT_ID?.trim() ||
    'com.rezell.canopytrove.owner.pro.monthly.v3',
};

function getStripeTierPriceId(
  tier: OwnerSubscriptionTier,
  cycle: OwnerBillingCycle,
): string | null {
  const {
    stripeVerifiedMonthlyPriceId,
    stripeVerifiedAnnualPriceId,
    stripeGrowthMonthlyPriceId,
    stripeGrowthAnnualPriceId,
    stripeProMonthlyPriceId,
    stripeProAnnualPriceId,
    stripeOwnerMonthlyPriceId,
    stripeOwnerAnnualPriceId,
  } = serverConfig;

  const tierPriceMap: Record<
    OwnerSubscriptionTier,
    { monthly: string | null; annual: string | null }
  > = {
    free: {
      monthly: null,
      annual: null,
    },
    verified: {
      monthly: stripeVerifiedMonthlyPriceId ?? stripeOwnerMonthlyPriceId,
      annual: stripeVerifiedAnnualPriceId ?? stripeOwnerAnnualPriceId,
    },
    growth: {
      monthly: stripeGrowthMonthlyPriceId,
      annual: stripeGrowthAnnualPriceId,
    },
    pro: {
      monthly: stripeProMonthlyPriceId,
      annual: stripeProAnnualPriceId,
    },
  };

  return tierPriceMap[tier]?.[cycle] ?? null;
}

function resolveTierFromPriceId(priceId: string): OwnerSubscriptionTier {
  const {
    stripeVerifiedMonthlyPriceId,
    stripeVerifiedAnnualPriceId,
    stripeGrowthMonthlyPriceId,
    stripeGrowthAnnualPriceId,
    stripeProMonthlyPriceId,
    stripeProAnnualPriceId,
    stripeOwnerMonthlyPriceId,
    stripeOwnerAnnualPriceId,
  } = serverConfig;

  if (priceId === stripeProMonthlyPriceId || priceId === stripeProAnnualPriceId) {
    return 'pro';
  }

  if (priceId === stripeGrowthMonthlyPriceId || priceId === stripeGrowthAnnualPriceId) {
    return 'growth';
  }

  if (
    priceId === stripeVerifiedMonthlyPriceId ||
    priceId === stripeVerifiedAnnualPriceId ||
    priceId === stripeOwnerMonthlyPriceId ||
    priceId === stripeOwnerAnnualPriceId
  ) {
    return 'verified';
  }

  // Default: legacy subscriptions without tier-specific price IDs
  return 'free';
}

function parseOwnerSubscriptionTier(value: unknown): OwnerSubscriptionTier {
  if (value === 'free' || value === 'verified' || value === 'growth' || value === 'pro') {
    return value;
  }

  return 'free';
}

function getAppleTierFromProductId(productId: string): OwnerAppleSubscriptionTier | null {
  const normalizedProductId = productId.trim();
  const match = (
    Object.entries(APPLE_OWNER_PRODUCT_IDS) as Array<[OwnerAppleSubscriptionTier, string]>
  ).find(([, configuredProductId]) => configuredProductId === normalizedProductId);
  return match?.[0] ?? null;
}

function parseAppleSubscriptionSyncPayload(payload: OwnerAppleSubscriptionSyncPayload): {
  productId: string;
  transactionId: string;
  originalTransactionId: string | null;
  purchaseToken: string | null;
  currentPlanId: string | null;
  environmentIOS: string | null;
  expirationDateMs: number | null;
  transactionDateMs: number;
  isAutoRenewing: boolean;
  purchaseState: string;
  renewalInfoIOS: {
    pendingUpgradeProductId: string | null;
    gracePeriodExpirationDateMs: number | null;
    isInBillingRetry: boolean;
    expirationReason: string | null;
  } | null;
} {
  const productId = typeof payload.productId === 'string' ? payload.productId.trim() : '';
  const transactionId =
    typeof payload.transactionId === 'string' ? payload.transactionId.trim() : '';
  const transactionDateMs =
    typeof payload.transactionDateMs === 'number' && Number.isFinite(payload.transactionDateMs)
      ? payload.transactionDateMs
      : NaN;

  if (!productId || !transactionId || !Number.isFinite(transactionDateMs)) {
    throw new OwnerBillingError('Apple subscription sync payload is incomplete.', 400);
  }

  const originalTransactionId =
    typeof payload.originalTransactionId === 'string' && payload.originalTransactionId.trim()
      ? payload.originalTransactionId.trim()
      : null;
  const purchaseToken =
    typeof payload.purchaseToken === 'string' && payload.purchaseToken.trim()
      ? payload.purchaseToken.trim()
      : null;
  const currentPlanId =
    typeof payload.currentPlanId === 'string' && payload.currentPlanId.trim()
      ? payload.currentPlanId.trim()
      : null;
  const environmentIOS =
    typeof payload.environmentIOS === 'string' && payload.environmentIOS.trim()
      ? payload.environmentIOS.trim()
      : null;
  const expirationDateMs =
    typeof payload.expirationDateMs === 'number' && Number.isFinite(payload.expirationDateMs)
      ? payload.expirationDateMs
      : null;
  const purchaseState =
    typeof payload.purchaseState === 'string' ? payload.purchaseState.trim().toLowerCase() : '';

  let renewalInfoIOS: {
    pendingUpgradeProductId: string | null;
    gracePeriodExpirationDateMs: number | null;
    isInBillingRetry: boolean;
    expirationReason: string | null;
  } | null = null;

  if (typeof payload.renewalInfoIOS === 'object' && payload.renewalInfoIOS !== null) {
    const record = payload.renewalInfoIOS as Record<string, unknown>;
    renewalInfoIOS = {
      pendingUpgradeProductId:
        typeof record.pendingUpgradeProductId === 'string' && record.pendingUpgradeProductId.trim()
          ? record.pendingUpgradeProductId.trim()
          : null,
      gracePeriodExpirationDateMs:
        typeof record.gracePeriodExpirationDateMs === 'number' &&
        Number.isFinite(record.gracePeriodExpirationDateMs)
          ? record.gracePeriodExpirationDateMs
          : null,
      isInBillingRetry: record.isInBillingRetry === true,
      expirationReason:
        typeof record.expirationReason === 'string' && record.expirationReason.trim()
          ? record.expirationReason.trim()
          : null,
    };
  }

  return {
    productId,
    transactionId,
    originalTransactionId,
    purchaseToken,
    currentPlanId,
    environmentIOS,
    expirationDateMs,
    transactionDateMs,
    isAutoRenewing: payload.isAutoRenewing === true,
    purchaseState,
    renewalInfoIOS,
  };
}

function toIsoFromMilliseconds(value: number | null | undefined, fallback: string) {
  if (!value || !Number.isFinite(value)) {
    return fallback;
  }

  return new Date(value).toISOString();
}

function mapAppleSubscriptionStatus(input: {
  purchaseState: string;
  expirationDateMs: number | null;
  renewalInfoIOS: {
    pendingUpgradeProductId: string | null;
    gracePeriodExpirationDateMs: number | null;
    isInBillingRetry: boolean;
    expirationReason: string | null;
  } | null;
  isAutoRenewing: boolean;
}): OwnerSubscriptionStatus {
  if (input.purchaseState === 'pending') {
    return 'inactive';
  }

  const now = Date.now();
  const effectiveExpirationMs =
    input.renewalInfoIOS?.gracePeriodExpirationDateMs ?? input.expirationDateMs ?? null;

  if (effectiveExpirationMs && effectiveExpirationMs > now) {
    return 'active';
  }

  if (input.renewalInfoIOS?.isInBillingRetry) {
    return 'past_due';
  }

  if (!input.isAutoRenewing) {
    return 'canceled';
  }

  return 'inactive';
}

export class OwnerBillingError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

function createNow() {
  return new Date().toISOString();
}

/**
 * Annual billing is disabled platform-wide until the misconfigured
 * Stripe annual prices are rebuilt. The current "annual" prices in
 * Stripe Dashboard are set to interval=month at the annual dollar
 * amount (e.g. $2,490/mo for Pro instead of $2,490/yr). Routing any
 * customer to those prices would catastrophically overcharge.
 *
 * Defense-in-depth: even if a stale client (an OTA-cached older
 * frontend, a curl test, etc.) sends `billingCycle: 'annual'`, we
 * silently downgrade to monthly here so the broken prices never get
 * picked. Re-enable by:
 *   1. Archiving the broken annual prices in Stripe Dashboard
 *   2. Creating new annual prices with interval=year
 *   3. Updating Cloud Run STRIPE_*_ANNUAL_PRICE_ID env vars
 *   4. Setting ANNUAL_BILLING_DISABLED below to false
 *
 * See docs/STRIPE_DASHBOARD_SETUP.md Section 1.
 */
const ANNUAL_BILLING_DISABLED = true;

function parseOwnerBillingCycle(value: unknown): OwnerBillingCycle {
  if (value === 'annual') {
    if (ANNUAL_BILLING_DISABLED) {
      // Silently coerce to monthly. Logging at info so we can see if
      // anyone's still trying to hit annual.
      logger.info('[ownerBilling] annual billing requested but disabled — coercing to monthly');
      return 'monthly';
    }
    return 'annual';
  }

  if (value === 'monthly') {
    return 'monthly';
  }

  throw new OwnerBillingError('Invalid owner billing cycle.', 400);
}

export function getOwnerBillingDb() {
  const db = getBackendFirebaseDb();
  if (!db) {
    throw new OwnerBillingError('Backend Firebase admin access is not configured.', 503);
  }

  return db;
}

function getBearerToken(request: Request) {
  const authorizationHeader = request.header('authorization')?.trim();
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(/\s+/, 2);
  if (!token || scheme.toLowerCase() !== 'bearer') {
    return null;
  }

  return token;
}

function getStripeBillingConfig(options?: { includeWebhook?: boolean }) {
  const {
    stripeSecretKey,
    stripeWebhookSecret,
    stripeOwnerMonthlyPriceId,
    stripeOwnerAnnualPriceId,
    stripeOwnerSuccessUrl,
    stripeOwnerCancelUrl,
    stripeOwnerPortalReturnUrl,
  } = serverConfig;
  const missingEnvVars = getMissingOwnerBillingBackendEnvVars(options);

  if (missingEnvVars.length) {
    throw new OwnerBillingError(
      `Stripe billing is not fully configured on the backend. Missing env: ${missingEnvVars.join(', ')}.`,
      503,
    );
  }

  return {
    stripeSecretKey: stripeSecretKey!,
    stripeWebhookSecret: stripeWebhookSecret!,
    stripeOwnerMonthlyPriceId: stripeOwnerMonthlyPriceId!,
    stripeOwnerAnnualPriceId: stripeOwnerAnnualPriceId!,
    stripeOwnerSuccessUrl: stripeOwnerSuccessUrl!,
    stripeOwnerCancelUrl: stripeOwnerCancelUrl!,
    stripeOwnerPortalReturnUrl: stripeOwnerPortalReturnUrl!,
  };
}

async function getVerifiedOwnerContext(request: Request) {
  const token = getBearerToken(request);
  if (!token || !hasBackendFirebaseConfig) {
    throw new OwnerBillingError('Owner authentication is required.', 401);
  }

  const auth = getBackendFirebaseAuth();
  if (!auth) {
    throw new OwnerBillingError('Backend Firebase auth is not configured.', 503);
  }

  let decodedToken: Awaited<ReturnType<typeof auth.verifyIdToken>>;
  try {
    decodedToken = await auth.verifyIdToken(token);
  } catch {
    throw new OwnerBillingError('Invalid owner authentication token.', 401);
  }

  const ownerState = await getOwnerAuthorizationState(decodedToken.uid);
  if (!ownerState.ownerProfile) {
    throw new OwnerBillingError('Owner profile not found.', 404);
  }

  return {
    ownerUid: decodedToken.uid,
    ownerEmail: decodedToken.email ?? null,
    ownerProfile: ownerState.ownerProfile as OwnerProfileRecord,
    storefrontId: ownerState.storefrontId,
    businessVerificationStatus: ownerState.businessVerificationStatus,
    identityVerificationStatus: ownerState.identityVerificationStatus,
  };
}

function isVerifiedStatus(status: string | null | undefined) {
  return isVerifiedOwnerStatus(status);
}

function assertOwnerBillingEligibility(input: {
  storefrontId: string | null;
  businessVerificationStatus: string | null | undefined;
  identityVerificationStatus: string | null | undefined;
}) {
  if (!input.storefrontId) {
    throw new OwnerBillingError('Claim your storefront before opening owner billing.', 409);
  }

  if (!isVerifiedStatus(input.businessVerificationStatus)) {
    throw new OwnerBillingError(
      'Business verification must be approved before billing can start.',
      409,
    );
  }

  if (!isVerifiedStatus(input.identityVerificationStatus)) {
    throw new OwnerBillingError(
      'Identity verification must be approved before billing can start.',
      409,
    );
  }
}

function buildStripeHeaders(stripeSecretKey: string, hasBody: boolean, idempotencyKey?: string) {
  const headers = new Headers({
    Authorization: `Bearer ${stripeSecretKey}`,
  });

  if (hasBody) {
    headers.set('Content-Type', 'application/x-www-form-urlencoded');
  }

  if (idempotencyKey) {
    headers.set('Idempotency-Key', idempotencyKey);
  }

  return headers;
}

async function readStripeError(response: Response) {
  try {
    const payload = (await response.json()) as {
      error?: {
        message?: string;
      };
    };
    return payload.error?.message || `Stripe request failed with ${response.status}.`;
  } catch {
    return `Stripe request failed with ${response.status}.`;
  }
}

async function stripePostForm<T>(
  stripeSecretKey: string,
  path: string,
  params: URLSearchParams,
  idempotencyKey?: string,
) {
  const response = await fetch(`${STRIPE_API_BASE_URL}${path}`, {
    method: 'POST',
    headers: buildStripeHeaders(stripeSecretKey, true, idempotencyKey),
    body: params.toString(),
  });

  if (!response.ok) {
    throw new OwnerBillingError(await readStripeError(response), response.status);
  }

  return (await response.json()) as T;
}

async function stripeGetJson<T>(stripeSecretKey: string, path: string) {
  const response = await fetch(`${STRIPE_API_BASE_URL}${path}`, {
    method: 'GET',
    headers: buildStripeHeaders(stripeSecretKey, false),
  });

  if (!response.ok) {
    throw new OwnerBillingError(await readStripeError(response), response.status);
  }

  return (await response.json()) as T;
}

async function getOwnerSubscription(ownerUid: string) {
  const db = getOwnerBillingDb();
  const snapshot = await db.collection(SUBSCRIPTIONS_COLLECTION).doc(ownerUid).get();
  if (!snapshot.exists) {
    return null;
  }

  return snapshot.data() as OwnerSubscriptionRecord;
}

function mapStripeSubscriptionStatus(status: string): OwnerSubscriptionStatus {
  switch (status) {
    case 'trialing':
      return 'trial';
    case 'active':
      return 'active';
    case 'past_due':
    case 'unpaid':
      return 'past_due';
    case 'canceled':
    case 'incomplete_expired':
      return 'canceled';
    case 'paused':
      return 'suspended';
    default:
      return 'inactive';
  }
}

function getStripeBillingCycle(subscription: StripeSubscription): OwnerBillingCycle {
  const interval =
    subscription.items?.data?.[0]?.price?.recurring?.interval?.trim().toLowerCase() ?? 'month';

  return interval === 'year' ? 'annual' : 'monthly';
}

function getStripePlanId(subscription: StripeSubscription) {
  return subscription.items?.data?.[0]?.price?.id?.trim() || 'owner-plan';
}

function toIsoFromUnixSeconds(value: number | undefined, fallback: string) {
  if (!value || !Number.isFinite(value)) {
    return fallback;
  }

  return new Date(value * 1000).toISOString();
}

async function resolveOwnerUidFromStripePointers(input: {
  ownerUid?: string | null;
  externalSubscriptionId?: string | null;
  externalCustomerId?: string | null;
}) {
  if (input.ownerUid) {
    return input.ownerUid;
  }

  const db = getOwnerBillingDb();

  if (input.externalSubscriptionId) {
    const subscriptionSnapshot = await db
      .collection(SUBSCRIPTIONS_COLLECTION)
      .where('externalSubscriptionId', '==', input.externalSubscriptionId)
      .limit(1)
      .get();
    if (!subscriptionSnapshot.empty) {
      return subscriptionSnapshot.docs[0]?.id ?? null;
    }
  }

  if (input.externalCustomerId) {
    const customerSnapshot = await db
      .collection(SUBSCRIPTIONS_COLLECTION)
      .where('externalCustomerId', '==', input.externalCustomerId)
      .limit(1)
      .get();
    if (!customerSnapshot.empty) {
      return customerSnapshot.docs[0]?.id ?? null;
    }
  }

  return null;
}

async function persistStripeSubscriptionUpdate(subscription: StripeSubscription) {
  const ownerUid = await resolveOwnerUidFromStripePointers({
    ownerUid: subscription.metadata?.ownerUid ?? null,
    externalSubscriptionId: subscription.id ?? null,
    externalCustomerId: typeof subscription.customer === 'string' ? subscription.customer : null,
  });

  if (!ownerUid) {
    throw new OwnerBillingError('Unable to resolve the owner for this Stripe subscription.', 400);
  }

  const db = getOwnerBillingDb();
  const ownerState = await getOwnerAuthorizationState(ownerUid);
  const existingSubscription = await getOwnerSubscription(ownerUid);
  const now = createNow();
  const subscriptionStatus = mapStripeSubscriptionStatus(subscription.status);
  const billingCycle = getStripeBillingCycle(subscription);
  const dispensaryId =
    subscription.metadata?.dispensaryId ||
    existingSubscription?.dispensaryId ||
    ownerState.storefrontId;

  if (!dispensaryId) {
    throw new OwnerBillingError(
      'Stripe subscription update is missing the storefront mapping.',
      400,
    );
  }

  const resolvedPlanId = getStripePlanId(subscription);
  const resolvedTier = subscription.metadata?.tier
    ? parseOwnerSubscriptionTier(subscription.metadata.tier)
    : resolveTierFromPriceId(resolvedPlanId);

  const nextSubscription: OwnerSubscriptionRecord = {
    ownerUid,
    dispensaryId,
    provider: 'stripe',
    externalCustomerId:
      typeof subscription.customer === 'string'
        ? subscription.customer
        : (existingSubscription?.externalCustomerId ?? null),
    externalSubscriptionId: subscription.id,
    planId: resolvedPlanId,
    tier: resolvedTier,
    status: subscriptionStatus,
    billingCycle,
    currentPeriodStart: toIsoFromUnixSeconds(
      subscription.current_period_start,
      existingSubscription?.currentPeriodStart ?? now,
    ),
    currentPeriodEnd: toIsoFromUnixSeconds(
      subscription.current_period_end,
      existingSubscription?.currentPeriodEnd ?? now,
    ),
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    createdAt: existingSubscription?.createdAt ?? now,
    updatedAt: now,
    lastCheckoutSessionId: existingSubscription?.lastCheckoutSessionId ?? null,
    lastCheckoutOpenedAt: existingSubscription?.lastCheckoutOpenedAt ?? null,
  };

  await Promise.all([
    db.collection(SUBSCRIPTIONS_COLLECTION).doc(ownerUid).set(nextSubscription, { merge: true }),
    db
      .collection(OWNER_PROFILES_COLLECTION)
      .doc(ownerUid)
      .set(
        {
          subscriptionStatus,
          onboardingStep:
            subscriptionStatus === 'active' || subscriptionStatus === 'trial'
              ? 'completed'
              : 'subscription',
          updatedAt: now,
        },
        { merge: true },
      ),
  ]);

  return {
    ok: true,
    ownerUid,
    status: subscriptionStatus,
    billingCycle,
  };
}

function parseStripeSignatureHeader(signatureHeader: string | null | undefined) {
  if (!signatureHeader) {
    throw new OwnerBillingError('Stripe signature header is missing.', 400);
  }

  const parts = signatureHeader.split(',').map((part) => part.trim());
  const timestampPart = parts.find((part) => part.startsWith('t='));
  const signatureParts = parts
    .filter((part) => part.startsWith('v1='))
    .map((part) => part.slice(3));

  if (!timestampPart || !signatureParts.length) {
    throw new OwnerBillingError('Stripe signature header is invalid.', 400);
  }

  const timestamp = Number(timestampPart.slice(2));
  if (!Number.isFinite(timestamp)) {
    throw new OwnerBillingError('Stripe signature timestamp is invalid.', 400);
  }

  return {
    timestamp,
    signatures: signatureParts,
  };
}

function verifyStripeWebhookSignature(
  payloadBuffer: Buffer,
  signatureHeader: string | null | undefined,
  webhookSecret: string,
) {
  const { timestamp, signatures } = parseStripeSignatureHeader(signatureHeader);
  const ageSeconds = Math.abs(Date.now() / 1000 - timestamp);
  if (ageSeconds > STRIPE_WEBHOOK_TOLERANCE_SECONDS) {
    throw new OwnerBillingError('Stripe webhook signature is too old.', 400);
  }

  const signedPayload = `${timestamp}.${payloadBuffer.toString('utf8')}`;
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(signedPayload, 'utf8')
    .digest('hex');

  const isMatch = signatures.some((signature) => {
    if (signature.length !== expectedSignature.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(signature, 'utf8'),
      Buffer.from(expectedSignature, 'utf8'),
    );
  });

  if (!isMatch) {
    throw new OwnerBillingError('Stripe webhook signature verification failed.', 400);
  }
}

async function handleCheckoutSessionCompleted(
  stripeSecretKey: string,
  session: StripeCheckoutSession,
) {
  if (session.mode !== 'subscription') {
    return {
      ok: true,
      ignored: true,
      reason: 'Non-subscription checkout session.',
    };
  }

  const ownerUid = session.metadata?.ownerUid ?? session.client_reference_id ?? null;
  const db = getOwnerBillingDb();
  const now = createNow();

  if (ownerUid) {
    await db
      .collection(SUBSCRIPTIONS_COLLECTION)
      .doc(ownerUid)
      .set(
        {
          provider: 'stripe',
          externalCustomerId: typeof session.customer === 'string' ? session.customer : null,
          externalSubscriptionId:
            typeof session.subscription === 'string' ? session.subscription : null,
          lastCheckoutSessionId: session.id,
          lastCheckoutOpenedAt: now,
          updatedAt: now,
        },
        { merge: true },
      );
  }

  if (typeof session.subscription === 'string') {
    const subscription = await stripeGetJson<StripeSubscription>(
      stripeSecretKey,
      `/subscriptions/${encodeURIComponent(session.subscription)}`,
    );
    if (ownerUid) {
      subscription.metadata = {
        ...(subscription.metadata ?? {}),
        ownerUid,
        dispensaryId: subscription.metadata?.dispensaryId ?? session.metadata?.dispensaryId ?? '',
      };
    }

    return persistStripeSubscriptionUpdate(subscription);
  }

  return {
    ok: true,
    ownerUid,
    checkoutSessionId: session.id,
  };
}

async function handleInvoicePaymentFailed(stripeSecretKey: string, invoice: StripeInvoice) {
  if (typeof invoice.subscription !== 'string') {
    return {
      ok: true,
      ignored: true,
      reason: 'Invoice does not reference a subscription.',
    };
  }

  const subscription = await stripeGetJson<StripeSubscription>(
    stripeSecretKey,
    `/subscriptions/${encodeURIComponent(invoice.subscription)}`,
  );
  return persistStripeSubscriptionUpdate(subscription);
}

export async function createOwnerBillingCheckoutSession(
  request: Request,
  cycleInput: unknown,
  tierInput?: unknown,
) {
  const cycle = parseOwnerBillingCycle(cycleInput);
  const tier = parseOwnerSubscriptionTier(tierInput);

  if (tier === 'free') {
    throw new OwnerBillingError(
      'The Free plan does not require billing. Claim your storefront to get started.',
      400,
    );
  }

  const {
    stripeSecretKey,
    stripeOwnerAnnualPriceId,
    stripeOwnerCancelUrl,
    stripeOwnerMonthlyPriceId,
    stripeOwnerSuccessUrl,
  } = getStripeBillingConfig();
  const {
    businessVerificationStatus,
    identityVerificationStatus,
    ownerEmail,
    ownerProfile,
    ownerUid,
    storefrontId,
  } = await getVerifiedOwnerContext(request);

  assertOwnerBillingEligibility({
    storefrontId,
    businessVerificationStatus,
    identityVerificationStatus,
  });

  const currentSubscription = await getOwnerSubscription(ownerUid);

  // SECURITY: Prevent duplicate subscriptions
  if (
    currentSubscription &&
    (currentSubscription.status === 'active' || currentSubscription.status === 'trial')
  ) {
    throw new OwnerBillingError(
      'You already have an active subscription. Use the billing portal to manage your plan.',
      409,
    );
  }

  const tierPriceId = getStripeTierPriceId(tier, cycle);
  const priceId =
    tierPriceId ?? (cycle === 'annual' ? stripeOwnerAnnualPriceId : stripeOwnerMonthlyPriceId);

  if (!priceId) {
    throw new OwnerBillingError(
      `No Stripe price is configured for the ${tier} tier (${cycle}). Contact support.`,
      503,
    );
  }

  const now = createNow();
  const launchTrialOffer = await resolveOwnerLaunchTrialOffer({
    ownerUid,
    storefrontId: storefrontId ?? '',
    currentSubscription,
    tier,
    now,
  });

  const params = new URLSearchParams();
  params.set('mode', 'subscription');
  params.set('success_url', stripeOwnerSuccessUrl);
  params.set('cancel_url', stripeOwnerCancelUrl);
  params.set('line_items[0][price]', priceId);
  params.set('line_items[0][quantity]', '1');
  params.set('client_reference_id', ownerUid);
  params.set('allow_promotion_codes', 'true');
  params.set('billing_address_collection', 'required');
  params.set('metadata[ownerUid]', ownerUid);
  params.set('metadata[dispensaryId]', storefrontId ?? '');
  params.set('metadata[tier]', tier);
  params.set('subscription_data[metadata][ownerUid]', ownerUid);
  params.set('subscription_data[metadata][dispensaryId]', storefrontId ?? '');
  params.set('subscription_data[metadata][tier]', tier);
  if (launchTrialOffer.trialDays > 0) {
    params.set('subscription_data[trial_period_days]', String(launchTrialOffer.trialDays));
    params.set('metadata[launchTrialDays]', String(launchTrialOffer.trialDays));
    params.set('subscription_data[metadata][launchTrialDays]', String(launchTrialOffer.trialDays));
  }

  if (currentSubscription?.externalCustomerId) {
    params.set('customer', currentSubscription.externalCustomerId);
  } else if (ownerEmail) {
    params.set('customer_email', ownerEmail);
  }

  const session = await stripePostForm<StripeCheckoutSession>(
    stripeSecretKey,
    '/checkout/sessions',
    params,
    `owner-billing:${ownerUid}:${tier}:${cycle}:${priceId}`,
  );

  if (!session.url) {
    throw new OwnerBillingError('Stripe checkout did not return a redirect URL.', 502);
  }

  await getOwnerBillingDb()
    .collection(SUBSCRIPTIONS_COLLECTION)
    .doc(ownerUid)
    .set(
      {
        ownerUid,
        dispensaryId: storefrontId,
        provider: 'stripe',
        tier,
        externalCustomerId:
          (typeof session.customer === 'string' ? session.customer : null) ??
          currentSubscription?.externalCustomerId ??
          null,
        externalSubscriptionId:
          (typeof session.subscription === 'string' ? session.subscription : null) ??
          currentSubscription?.externalSubscriptionId ??
          null,
        planId: priceId,
        status: currentSubscription?.status ?? 'inactive',
        billingCycle: cycle,
        currentPeriodStart: currentSubscription?.currentPeriodStart ?? now,
        currentPeriodEnd: currentSubscription?.currentPeriodEnd ?? now,
        cancelAtPeriodEnd: currentSubscription?.cancelAtPeriodEnd ?? false,
        createdAt: currentSubscription?.createdAt ?? now,
        updatedAt: now,
        lastCheckoutSessionId: session.id,
        lastCheckoutOpenedAt: now,
        launchTrialDays: launchTrialOffer.trialDays || currentSubscription?.launchTrialDays || null,
        launchTrialClaimedAt:
          launchTrialOffer.claim?.claimedAt ?? currentSubscription?.launchTrialClaimedAt ?? null,
        launchProgramWindowEndsAt:
          launchTrialOffer.claim?.windowEndsAt ??
          currentSubscription?.launchProgramWindowEndsAt ??
          null,
      },
      { merge: true },
    );

  return {
    ok: true,
    checkoutSessionId: session.id,
    billingCycle: cycle,
    url: session.url,
    source: 'backend_stripe',
    launchTrialDaysApplied: launchTrialOffer.trialDays,
  };
}

export async function createOwnerBillingPortalSession(request: Request) {
  const { stripeOwnerPortalReturnUrl, stripeSecretKey } = getStripeBillingConfig();
  const { ownerUid } = await getVerifiedOwnerContext(request);
  const currentSubscription = await getOwnerSubscription(ownerUid);

  if (!currentSubscription?.externalCustomerId) {
    throw new OwnerBillingError('No Stripe customer is linked to this owner account yet.', 409);
  }

  const params = new URLSearchParams();
  params.set('customer', currentSubscription.externalCustomerId);
  params.set('return_url', stripeOwnerPortalReturnUrl);

  const session = await stripePostForm<StripeBillingPortalSession>(
    stripeSecretKey,
    '/billing_portal/sessions',
    params,
    `owner-billing-portal:${ownerUid}`,
  );

  if (!session.url) {
    throw new OwnerBillingError('Stripe billing portal did not return a redirect URL.', 502);
  }

  return {
    ok: true,
    portalSessionId: session.id,
    url: session.url,
    source: 'backend_stripe',
  };
}

export async function syncOwnerAppleSubscription(
  request: Request,
  payload: OwnerAppleSubscriptionSyncPayload,
) {
  const parsedPayload = parseAppleSubscriptionSyncPayload(payload);
  const tier =
    getAppleTierFromProductId(parsedPayload.currentPlanId ?? parsedPayload.productId) ??
    getAppleTierFromProductId(parsedPayload.productId);
  if (!tier) {
    throw new OwnerBillingError(
      'The Apple product does not map to a Canopy Trove owner tier.',
      400,
    );
  }

  const {
    ownerUid,
    ownerProfile,
    storefrontId,
    businessVerificationStatus,
    identityVerificationStatus,
  } = await getVerifiedOwnerContext(request);

  assertOwnerBillingEligibility({
    storefrontId,
    businessVerificationStatus,
    identityVerificationStatus,
  });

  const existingSubscription = await getOwnerSubscription(ownerUid);
  const now = createNow();
  const subscriptionStatus = mapAppleSubscriptionStatus({
    purchaseState: parsedPayload.purchaseState,
    expirationDateMs: parsedPayload.expirationDateMs,
    renewalInfoIOS: parsedPayload.renewalInfoIOS,
    isAutoRenewing: parsedPayload.isAutoRenewing,
  });

  const nextSubscription: OwnerSubscriptionRecord = {
    ownerUid,
    dispensaryId: storefrontId ?? existingSubscription?.dispensaryId ?? '',
    provider: 'apple_iap',
    externalCustomerId: existingSubscription?.externalCustomerId ?? null,
    externalSubscriptionId:
      parsedPayload.originalTransactionId ??
      existingSubscription?.externalSubscriptionId ??
      parsedPayload.transactionId,
    planId: parsedPayload.currentPlanId ?? parsedPayload.productId,
    tier,
    status: subscriptionStatus,
    billingCycle: 'monthly',
    currentPeriodStart: toIsoFromMilliseconds(
      parsedPayload.transactionDateMs,
      existingSubscription?.currentPeriodStart ?? now,
    ),
    currentPeriodEnd: toIsoFromMilliseconds(
      parsedPayload.expirationDateMs ?? parsedPayload.renewalInfoIOS?.gracePeriodExpirationDateMs,
      existingSubscription?.currentPeriodEnd ?? now,
    ),
    cancelAtPeriodEnd: !parsedPayload.isAutoRenewing,
    createdAt: existingSubscription?.createdAt ?? now,
    updatedAt: now,
    lastCheckoutSessionId: parsedPayload.transactionId,
    lastCheckoutOpenedAt: now,
  };

  const db = getOwnerBillingDb();
  await Promise.all([
    db.collection(SUBSCRIPTIONS_COLLECTION).doc(ownerUid).set(nextSubscription, { merge: true }),
    db
      .collection(OWNER_PROFILES_COLLECTION)
      .doc(ownerUid)
      .set(
        {
          subscriptionStatus: subscriptionStatus === 'past_due' ? 'active' : subscriptionStatus,
          onboardingStep:
            subscriptionStatus === 'active' || subscriptionStatus === 'trial'
              ? 'completed'
              : 'subscription',
          updatedAt: now,
        },
        { merge: true },
      ),
  ]);

  return {
    ok: true as const,
    ownerUid,
    status: subscriptionStatus,
    tier,
    billingCycle: 'monthly' as const,
    planId: nextSubscription.planId,
    provider: 'apple_iap' as const,
  };
}

// Generates an appAccountToken (RFC4122 UUID) the frontend stamps onto its
// StoreKit purchase. The token is persisted with the owner uid so the App
// Store Server Notification webhook can recover the owner identity even when
// the frontend's syncOwnerAppleSubscription call never lands (app crash,
// network drop between StoreKit completion and our backend roundtrip).
export async function prepareOwnerApplePurchase(request: Request) {
  const { ownerUid, storefrontId, businessVerificationStatus, identityVerificationStatus } =
    await getVerifiedOwnerContext(request);

  assertOwnerBillingEligibility({
    storefrontId,
    businessVerificationStatus,
    identityVerificationStatus,
  });

  const appAccountToken = crypto.randomUUID();
  await getOwnerBillingDb().collection(APPLE_ACCOUNT_TOKENS_COLLECTION).doc(appAccountToken).set({
    ownerUid,
    createdAt: createNow(),
    consumedAt: null,
  });

  return {
    ok: true as const,
    appAccountToken,
  };
}

export async function handleOwnerBillingWebhook(
  payloadBuffer: Buffer,
  signatureHeader: string | null | undefined,
) {
  const { stripeSecretKey, stripeWebhookSecret } = getStripeBillingConfig({
    includeWebhook: true,
  });

  verifyStripeWebhookSignature(payloadBuffer, signatureHeader, stripeWebhookSecret);

  const event = JSON.parse(payloadBuffer.toString('utf8')) as StripeWebhookEvent;

  switch (event.type) {
    case 'checkout.session.completed':
      return handleCheckoutSessionCompleted(
        stripeSecretKey,
        event.data.object as StripeCheckoutSession,
      );
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      return persistStripeSubscriptionUpdate(event.data.object as StripeSubscription);
    case 'invoice.payment_failed':
      return handleInvoicePaymentFailed(stripeSecretKey, event.data.object as StripeInvoice);
    default:
      return {
        ok: true,
        ignored: true,
        type: event.type,
      };
  }
}

// =============================================================================
// Apple App Store Server Notifications V2 — state mapper
// =============================================================================
//
// Called from appStoreNotificationService after the signed payload has been
// verified and decoded. This function maps Apple's notification types onto our
// internal OwnerSubscriptionRecord shape.
//
// Returns true when a state change was applied, false when the notification
// was logged but did not change subscription state (PRICE_INCREASE, TEST,
// REFUND audit-only types, unmapped notifications).

type AppleNotificationContext = {
  notificationType: string;
  subtype: string | null;
  // From @apple/app-store-server-library — we use loose typing here because
  // the SignedDataVerifier-decoded shapes use `unknown`-ish fields and we want
  // ownerBillingService to remain library-agnostic for testing.
  transactionInfo: {
    transactionId?: string;
    originalTransactionId?: string;
    productId?: string;
    expiresDate?: number;
    purchaseDate?: number;
    purchaseDateMs?: number;
    type?: string;
    appAccountToken?: string;
  } | null;
  renewalInfo: {
    autoRenewStatus?: number;
    autoRenewProductId?: string;
    expirationIntent?: number;
    isInBillingRetryPeriod?: boolean;
    gracePeriodExpiresDate?: number;
  } | null;
};

async function findOwnerSubscriptionByOriginalTransactionId(
  originalTransactionId: string,
): Promise<{ ownerUid: string; record: OwnerSubscriptionRecord } | null> {
  const db = getOwnerBillingDb();
  const snapshot = await db
    .collection(SUBSCRIPTIONS_COLLECTION)
    .where('externalSubscriptionId', '==', originalTransactionId)
    .limit(1)
    .get();
  if (snapshot.empty) {
    return null;
  }
  const doc = snapshot.docs[0];
  return { ownerUid: doc.id, record: doc.data() as OwnerSubscriptionRecord };
}

async function bootstrapSubscriptionFromAppAccountToken(
  ctx: AppleNotificationContext,
): Promise<{ ownerUid: string; record: OwnerSubscriptionRecord } | null> {
  const appAccountToken = ctx.transactionInfo?.appAccountToken;
  const originalTransactionId = ctx.transactionInfo?.originalTransactionId;
  if (!appAccountToken || !originalTransactionId) {
    return null;
  }
  const db = getOwnerBillingDb();
  const tokenSnap = await db.collection(APPLE_ACCOUNT_TOKENS_COLLECTION).doc(appAccountToken).get();
  if (!tokenSnap.exists) {
    return null;
  }
  const ownerUid = tokenSnap.get('ownerUid');
  if (typeof ownerUid !== 'string' || !ownerUid) {
    return null;
  }
  const ownerState = await getOwnerAuthorizationState(ownerUid);
  const productId = ctx.transactionInfo?.productId ?? '';
  const tier = productId ? getAppleTierFromProductId(productId) : null;
  if (!tier) {
    return null;
  }
  const now = createNow();
  const expiresIso =
    ctx.transactionInfo?.expiresDate && Number.isFinite(ctx.transactionInfo.expiresDate)
      ? new Date(ctx.transactionInfo.expiresDate).toISOString()
      : now;
  const purchaseIso =
    ctx.transactionInfo?.purchaseDate && Number.isFinite(ctx.transactionInfo.purchaseDate)
      ? new Date(ctx.transactionInfo.purchaseDate).toISOString()
      : now;
  const record: OwnerSubscriptionRecord = {
    ownerUid,
    dispensaryId: ownerState.storefrontId ?? '',
    provider: 'apple_iap',
    externalCustomerId: null,
    externalSubscriptionId: originalTransactionId,
    planId: productId,
    tier,
    status: 'active',
    billingCycle: 'monthly',
    currentPeriodStart: purchaseIso,
    currentPeriodEnd: expiresIso,
    cancelAtPeriodEnd: ctx.renewalInfo?.autoRenewStatus === 0,
    createdAt: now,
    updatedAt: now,
  };
  await db.collection(SUBSCRIPTIONS_COLLECTION).doc(ownerUid).set(record, { merge: true });
  await db
    .collection(APPLE_ACCOUNT_TOKENS_COLLECTION)
    .doc(appAccountToken)
    .set({ consumedAt: now, originalTransactionId }, { merge: true });
  return { ownerUid, record };
}

export async function applyAppleNotification(ctx: AppleNotificationContext): Promise<boolean> {
  if (!ctx.transactionInfo?.originalTransactionId) {
    return false;
  }

  let found = await findOwnerSubscriptionByOriginalTransactionId(
    ctx.transactionInfo.originalTransactionId,
  );
  // Webhook-as-source-of-truth fallback: if the lookup misses on a
  // SUBSCRIBED notification, the frontend's syncOwnerAppleSubscription
  // call hasn't landed (or never will). Resolve owner via the
  // appAccountToken the frontend stamped onto the StoreKit purchase.
  if (!found && ctx.notificationType === 'SUBSCRIBED') {
    found = await bootstrapSubscriptionFromAppAccountToken(ctx);
  }
  if (!found) {
    return false;
  }
  const { ownerUid, record: existing } = found;

  // Compute the candidate next-state. Defaults to current values; only modified
  // fields will be persisted via merge.
  let nextStatus: OwnerSubscriptionStatus = existing.status;
  let nextCancelAtPeriodEnd = existing.cancelAtPeriodEnd;
  let nextTier: OwnerSubscriptionTier = existing.tier;
  let nextPlanId = existing.planId;
  let nextCurrentPeriodEnd = existing.currentPeriodEnd;
  let stateChanged = false;

  const expiresIso =
    ctx.transactionInfo.expiresDate && Number.isFinite(ctx.transactionInfo.expiresDate)
      ? new Date(ctx.transactionInfo.expiresDate).toISOString()
      : null;
  const graceExpiresIso =
    ctx.renewalInfo?.gracePeriodExpiresDate &&
    Number.isFinite(ctx.renewalInfo.gracePeriodExpiresDate)
      ? new Date(ctx.renewalInfo.gracePeriodExpiresDate).toISOString()
      : null;
  const productTier =
    ctx.transactionInfo.productId && getAppleTierFromProductId(ctx.transactionInfo.productId);

  switch (ctx.notificationType) {
    case 'SUBSCRIBED':
    case 'DID_RENEW':
      nextStatus = 'active';
      // Apple carries auto-renew on renewalInfo, not transactionInfo.
      // autoRenewStatus: 0 = off, 1 = on. Treat unknown as "still on" to
      // avoid flipping cancelAtPeriodEnd for a renewal arriving without
      // renewalInfo (rare but documented as possible by Apple).
      nextCancelAtPeriodEnd = ctx.renewalInfo?.autoRenewStatus === 0;
      if (productTier) {
        nextTier = productTier;
      }
      if (ctx.transactionInfo.productId) {
        nextPlanId = ctx.transactionInfo.productId;
      }
      if (expiresIso) {
        nextCurrentPeriodEnd = expiresIso;
      }
      stateChanged = true;
      break;

    case 'DID_FAIL_TO_RENEW':
      if (ctx.subtype === 'GRACE_PERIOD') {
        nextStatus = 'past_due';
        if (graceExpiresIso) {
          nextCurrentPeriodEnd = graceExpiresIso;
        }
      } else {
        nextStatus = 'inactive';
      }
      stateChanged = true;
      break;

    case 'GRACE_PERIOD_EXPIRED':
      nextStatus = 'inactive';
      stateChanged = true;
      break;

    case 'EXPIRED':
      nextStatus = 'canceled';
      stateChanged = true;
      break;

    case 'REVOKE':
      // Family-Sharing revocation — owner loses access immediately.
      nextStatus = 'canceled';
      stateChanged = true;
      break;

    case 'DID_CHANGE_RENEWAL_STATUS':
      if (ctx.subtype === 'AUTO_RENEW_DISABLED') {
        nextCancelAtPeriodEnd = true;
        stateChanged = true;
      } else if (ctx.subtype === 'AUTO_RENEW_ENABLED') {
        nextCancelAtPeriodEnd = false;
        stateChanged = true;
      }
      break;

    case 'DID_CHANGE_RENEWAL_PREF':
      // User scheduled a tier change for next renewal — record the *current*
      // plan + tier from the active transaction, but the renewal switch is
      // surfaced via the renewalInfo.autoRenewProductId field which we log.
      if (productTier) {
        nextTier = productTier;
        stateChanged = true;
      }
      if (ctx.transactionInfo.productId) {
        nextPlanId = ctx.transactionInfo.productId;
      }
      break;

    case 'PRICE_INCREASE':
    case 'OFFER_REDEEMED':
    case 'RENEWAL_EXTENDED':
    case 'TEST':
    case 'CONSUMPTION_REQUEST':
    case 'REFUND':
    case 'REFUND_DECLINED':
    case 'REFUND_REVERSED':
    case 'EXTERNAL_PURCHASE_TOKEN':
      // Logged by appStoreNotificationService for audit; no state change here.
      return false;

    default:
      return false;
  }

  if (!stateChanged) {
    return false;
  }

  const now = createNow();
  const nextSubscription: OwnerSubscriptionRecord = {
    ...existing,
    status: nextStatus,
    cancelAtPeriodEnd: nextCancelAtPeriodEnd,
    tier: nextTier,
    planId: nextPlanId,
    currentPeriodEnd: nextCurrentPeriodEnd,
    updatedAt: now,
  };

  const db = getOwnerBillingDb();
  await Promise.all([
    db.collection(SUBSCRIPTIONS_COLLECTION).doc(ownerUid).set(nextSubscription, { merge: true }),
    db
      .collection(OWNER_PROFILES_COLLECTION)
      .doc(ownerUid)
      .set(
        {
          subscriptionStatus: nextStatus === 'past_due' ? 'active' : nextStatus,
          updatedAt: now,
        },
        { merge: true },
      ),
  ]);

  return true;
}
