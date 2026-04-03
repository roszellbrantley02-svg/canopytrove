import crypto from 'node:crypto';
import { Request } from 'express';
import { getMissingOwnerBillingBackendEnvVars, serverConfig } from '../config';
import { getBackendFirebaseAuth, getBackendFirebaseDb, hasBackendFirebaseConfig } from '../firebase';
import {
  getOwnerAuthorizationState,
  isVerifiedOwnerStatus,
} from './ownerPortalAuthorizationService';
import { resolveOwnerLaunchTrialOffer } from './launchProgramService';

type OwnerBillingCycle = 'monthly' | 'annual';
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
  provider: 'internal_prelaunch' | 'stripe';
  externalCustomerId?: string | null;
  externalSubscriptionId: string | null;
  planId: string;
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

const OWNER_PROFILES_COLLECTION = 'ownerProfiles';
const SUBSCRIPTIONS_COLLECTION = 'subscriptions';
const STRIPE_API_BASE_URL = 'https://api.stripe.com/v1';
const STRIPE_WEBHOOK_TOLERANCE_SECONDS = 300;

export class OwnerBillingError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400
  ) {
    super(message);
  }
}

function createNow() {
  return new Date().toISOString();
}

function parseOwnerBillingCycle(value: unknown): OwnerBillingCycle {
  if (value === 'annual') {
    return 'annual';
  }

  if (value === 'monthly') {
    return 'monthly';
  }

  throw new OwnerBillingError('Invalid owner billing cycle.', 400);
}

function getOwnerBillingDb() {
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
      503
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
    throw new OwnerBillingError(
      'Claim your storefront before opening owner billing.',
      409
    );
  }

  if (!isVerifiedStatus(input.businessVerificationStatus)) {
    throw new OwnerBillingError(
      'Business verification must be approved before billing can start.',
      409
    );
  }

  if (!isVerifiedStatus(input.identityVerificationStatus)) {
    throw new OwnerBillingError(
      'Identity verification must be approved before billing can start.',
      409
    );
  }
}

function buildStripeHeaders(
  stripeSecretKey: string,
  hasBody: boolean,
  idempotencyKey?: string
) {
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
  idempotencyKey?: string
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
    externalCustomerId:
      typeof subscription.customer === 'string' ? subscription.customer : null,
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
      400
    );
  }

  const nextSubscription: OwnerSubscriptionRecord = {
    ownerUid,
    dispensaryId,
    provider: 'stripe',
    externalCustomerId:
      typeof subscription.customer === 'string'
        ? subscription.customer
        : existingSubscription?.externalCustomerId ?? null,
    externalSubscriptionId: subscription.id,
    planId: getStripePlanId(subscription),
    status: subscriptionStatus,
    billingCycle,
    currentPeriodStart: toIsoFromUnixSeconds(
      subscription.current_period_start,
      existingSubscription?.currentPeriodStart ?? now
    ),
    currentPeriodEnd: toIsoFromUnixSeconds(
      subscription.current_period_end,
      existingSubscription?.currentPeriodEnd ?? now
    ),
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    createdAt: existingSubscription?.createdAt ?? now,
    updatedAt: now,
    lastCheckoutSessionId: existingSubscription?.lastCheckoutSessionId ?? null,
    lastCheckoutOpenedAt: existingSubscription?.lastCheckoutOpenedAt ?? null,
  };

  await Promise.all([
    db.collection(SUBSCRIPTIONS_COLLECTION).doc(ownerUid).set(nextSubscription, { merge: true }),
    db.collection(OWNER_PROFILES_COLLECTION).doc(ownerUid).set(
      {
        subscriptionStatus,
        onboardingStep:
          subscriptionStatus === 'active' || subscriptionStatus === 'trial'
            ? 'completed'
            : 'subscription',
        updatedAt: now,
      },
      { merge: true }
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
  webhookSecret: string
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
      Buffer.from(expectedSignature, 'utf8')
    );
  });

  if (!isMatch) {
    throw new OwnerBillingError('Stripe webhook signature verification failed.', 400);
  }
}

async function handleCheckoutSessionCompleted(
  stripeSecretKey: string,
  session: StripeCheckoutSession
) {
  if (session.mode !== 'subscription') {
    return {
      ok: true,
      ignored: true,
      reason: 'Non-subscription checkout session.',
    };
  }

  const ownerUid =
    session.metadata?.ownerUid ?? session.client_reference_id ?? null;
  const db = getOwnerBillingDb();
  const now = createNow();

  if (ownerUid) {
    await db.collection(SUBSCRIPTIONS_COLLECTION).doc(ownerUid).set(
      {
        provider: 'stripe',
        externalCustomerId:
          typeof session.customer === 'string' ? session.customer : null,
        externalSubscriptionId:
          typeof session.subscription === 'string' ? session.subscription : null,
        lastCheckoutSessionId: session.id,
        lastCheckoutOpenedAt: now,
        updatedAt: now,
      },
      { merge: true }
    );
  }

  if (typeof session.subscription === 'string') {
    const subscription = await stripeGetJson<StripeSubscription>(
      stripeSecretKey,
      `/subscriptions/${encodeURIComponent(session.subscription)}`
    );
    if (ownerUid) {
      subscription.metadata = {
        ...(subscription.metadata ?? {}),
        ownerUid,
        dispensaryId:
          subscription.metadata?.dispensaryId ??
          session.metadata?.dispensaryId ??
          '',
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

async function handleInvoicePaymentFailed(
  stripeSecretKey: string,
  invoice: StripeInvoice
) {
  if (typeof invoice.subscription !== 'string') {
    return {
      ok: true,
      ignored: true,
      reason: 'Invoice does not reference a subscription.',
    };
  }

  const subscription = await stripeGetJson<StripeSubscription>(
    stripeSecretKey,
    `/subscriptions/${encodeURIComponent(invoice.subscription)}`
  );
  return persistStripeSubscriptionUpdate(subscription);
}

export async function createOwnerBillingCheckoutSession(
  request: Request,
  cycleInput: unknown
) {
  const cycle = parseOwnerBillingCycle(cycleInput);
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
  const priceId =
    cycle === 'annual' ? stripeOwnerAnnualPriceId : stripeOwnerMonthlyPriceId;
  const now = createNow();
  const launchTrialOffer = await resolveOwnerLaunchTrialOffer({
    ownerUid,
    storefrontId: storefrontId ?? '',
    currentSubscription,
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
  params.set('subscription_data[metadata][ownerUid]', ownerUid);
  params.set('subscription_data[metadata][dispensaryId]', storefrontId ?? '');
  if (launchTrialOffer.trialDays > 0) {
    params.set('subscription_data[trial_period_days]', String(launchTrialOffer.trialDays));
    params.set('metadata[launchTrialDays]', String(launchTrialOffer.trialDays));
    params.set(
      'subscription_data[metadata][launchTrialDays]',
      String(launchTrialOffer.trialDays)
    );
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
    `owner-billing:${ownerUid}:${cycle}`
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
        launchTrialDays:
          launchTrialOffer.trialDays ||
          currentSubscription?.launchTrialDays ||
          null,
        launchTrialClaimedAt:
          launchTrialOffer.claim?.claimedAt ??
          currentSubscription?.launchTrialClaimedAt ??
          null,
        launchProgramWindowEndsAt:
          launchTrialOffer.claim?.windowEndsAt ??
          currentSubscription?.launchProgramWindowEndsAt ??
          null,
      },
      { merge: true }
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
  const {
    stripeOwnerPortalReturnUrl,
    stripeSecretKey,
  } = getStripeBillingConfig();
  const { ownerUid } = await getVerifiedOwnerContext(request);
  const currentSubscription = await getOwnerSubscription(ownerUid);

  if (!currentSubscription?.externalCustomerId) {
    throw new OwnerBillingError(
      'No Stripe customer is linked to this owner account yet.',
      409
    );
  }

  const params = new URLSearchParams();
  params.set('customer', currentSubscription.externalCustomerId);
  params.set('return_url', stripeOwnerPortalReturnUrl);

  const session = await stripePostForm<StripeBillingPortalSession>(
    stripeSecretKey,
    '/billing_portal/sessions',
    params,
    `owner-billing-portal:${ownerUid}`
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

export async function handleOwnerBillingWebhook(
  payloadBuffer: Buffer,
  signatureHeader: string | null | undefined
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
        event.data.object as StripeCheckoutSession
      );
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      return persistStripeSubscriptionUpdate(event.data.object as StripeSubscription);
    case 'invoice.payment_failed':
      return handleInvoicePaymentFailed(
        stripeSecretKey,
        event.data.object as StripeInvoice
      );
    default:
      return {
        ok: true,
        ignored: true,
        type: event.type,
      };
  }
}
