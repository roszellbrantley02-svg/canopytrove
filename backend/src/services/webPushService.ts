import { serverConfig } from '../config';
import { logger } from '../observability/logger';

// Lightweight wrapper around the `web-push` npm package. Lazy-imports the
// library so backend boot doesn't pay the cost (or fail with a missing
// module error) when VAPID keys aren't configured. Returns a discriminated
// union per delivery so callers can react to expired/410-Gone subscriptions
// and prune them out of Firestore.

export type WebPushSubscriptionRecord = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type WebPushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  data?: Record<string, unknown>;
};

export type WebPushDeliveryResult =
  | { status: 'ok'; endpoint: string }
  | { status: 'expired'; endpoint: string; statusCode: number }
  | { status: 'error'; endpoint: string; statusCode?: number; message: string }
  | { status: 'skipped'; endpoint: string; reason: 'not_configured' | 'invalid_subscription' };

type WebPushModule = typeof import('web-push');

let cachedWebPush: WebPushModule | null = null;
let cachedVapidFingerprint: string | null = null;

function getVapidFingerprint() {
  return [
    serverConfig.webPushVapidPublicKey ?? '',
    serverConfig.webPushVapidPrivateKey ?? '',
    serverConfig.webPushVapidSubject ?? '',
  ].join('|');
}

function loadWebPush(): WebPushModule | null {
  if (
    !serverConfig.webPushVapidPublicKey ||
    !serverConfig.webPushVapidPrivateKey ||
    !serverConfig.webPushVapidSubject
  ) {
    return null;
  }

  // If VAPID config rotates at runtime (env reloaded in tests, secret rotation
  // on a hot Cloud Run instance) make sure we re-call setVapidDetails.
  const fingerprint = getVapidFingerprint();
  if (cachedWebPush && cachedVapidFingerprint === fingerprint) {
    return cachedWebPush;
  }

  // Use require() rather than dynamic import to keep the call synchronous
  // and let the test suite swap the module via require.cache.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('web-push') as WebPushModule;
  mod.setVapidDetails(
    serverConfig.webPushVapidSubject,
    serverConfig.webPushVapidPublicKey,
    serverConfig.webPushVapidPrivateKey,
  );
  cachedWebPush = mod;
  cachedVapidFingerprint = fingerprint;
  return cachedWebPush;
}

export function isWebPushConfigured() {
  return Boolean(
    serverConfig.webPushVapidPublicKey &&
    serverConfig.webPushVapidPrivateKey &&
    serverConfig.webPushVapidSubject,
  );
}

function isExpiredStatusCode(statusCode: number | undefined) {
  // 404 Not Found and 410 Gone are the canonical "subscription is dead, prune
  // it" responses per RFC 8030. Some push services also return 401/403 when
  // the VAPID key is rotated; we treat those as expired too — better to force
  // a re-subscribe than to keep dead-lettering.
  return statusCode === 404 || statusCode === 410 || statusCode === 401 || statusCode === 403;
}

function isValidSubscription(subscription: WebPushSubscriptionRecord) {
  return Boolean(
    subscription &&
    typeof subscription.endpoint === 'string' &&
    subscription.endpoint.startsWith('http') &&
    typeof subscription.p256dh === 'string' &&
    subscription.p256dh.length > 0 &&
    typeof subscription.auth === 'string' &&
    subscription.auth.length > 0,
  );
}

export async function sendWebPushNotification(
  subscription: WebPushSubscriptionRecord,
  payload: WebPushPayload,
): Promise<WebPushDeliveryResult> {
  const mod = loadWebPush();
  if (!mod) {
    return { status: 'skipped', endpoint: subscription?.endpoint ?? '', reason: 'not_configured' };
  }

  if (!isValidSubscription(subscription)) {
    return {
      status: 'skipped',
      endpoint: subscription?.endpoint ?? '',
      reason: 'invalid_subscription',
    };
  }

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? '/',
    tag: payload.tag,
    data: payload.data,
  });

  try {
    await mod.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      body,
      { TTL: 60 * 60 * 24 }, // 1 day — review notifications shouldn't pile up beyond that
    );
    return { status: 'ok', endpoint: subscription.endpoint };
  } catch (error) {
    const statusCode =
      typeof error === 'object' &&
      error &&
      'statusCode' in error &&
      typeof (error as { statusCode?: unknown }).statusCode === 'number'
        ? (error as { statusCode: number }).statusCode
        : undefined;

    if (isExpiredStatusCode(statusCode)) {
      return { status: 'expired', endpoint: subscription.endpoint, statusCode: statusCode! };
    }

    const message = error instanceof Error ? error.message : String(error);
    logger.warn('[webPushService] sendNotification failed', {
      endpoint: subscription.endpoint,
      statusCode,
      message,
    });
    return { status: 'error', endpoint: subscription.endpoint, statusCode, message };
  }
}

export async function sendWebPushNotifications(
  subscriptions: WebPushSubscriptionRecord[],
  payload: WebPushPayload,
): Promise<WebPushDeliveryResult[]> {
  if (!subscriptions.length) {
    return [];
  }

  const results = await Promise.allSettled(
    subscriptions.map((subscription) => sendWebPushNotification(subscription, payload)),
  );

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
    logger.warn('[webPushService] unexpected sendWebPushNotification rejection', {
      endpoint: subscriptions[index]?.endpoint,
      message,
    });
    return {
      status: 'error',
      endpoint: subscriptions[index]?.endpoint ?? '',
      message,
    };
  });
}
