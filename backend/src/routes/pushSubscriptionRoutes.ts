import { Router, Request, Response } from 'express';
import { createRateLimitMiddleware } from '../http/rateLimit';
import { getBackendFirebaseDb } from '../firebase';
import { logger } from '../observability/logger';

const PUSH_SUBSCRIPTIONS_COLLECTION = 'pushSubscriptions';
const MAX_ENDPOINT_LENGTH = 2048;
const MAX_PUSH_KEY_LENGTH = 512;

const router = Router();
router.use(
  createRateLimitMiddleware({
    name: 'push-subscription-write',
    windowMs: 60_000,
    max: 20,
    methods: ['POST', 'DELETE'],
  }),
);

function isValidPushString(value: unknown, maxLength: number) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength;
}

/**
 * POST /push/subscribe
 *
 * Receives a Web Push subscription from the frontend and stores it in Firestore.
 * The subscription object comes from the browser's PushManager.subscribe() call.
 *
 * Body:
 *   subscription: { endpoint, keys: { p256dh, auth } }
 *   platform: "web" | "expo"
 *
 * Keyed by a SHA-256 hash of the endpoint URL to prevent duplicates.
 */
router.post('/subscribe', async (request: Request, response: Response) => {
  try {
    const { subscription, platform } = request.body ?? {};

    if (
      !isValidPushString(subscription?.endpoint, MAX_ENDPOINT_LENGTH) ||
      !isValidPushString(subscription?.keys?.p256dh, MAX_PUSH_KEY_LENGTH) ||
      !isValidPushString(subscription?.keys?.auth, MAX_PUSH_KEY_LENGTH)
    ) {
      response.status(400).json({ error: 'Invalid push subscription object.' });
      return;
    }

    if (platform !== undefined && platform !== 'web' && platform !== 'expo') {
      response.status(400).json({ error: 'Invalid push subscription platform.' });
      return;
    }

    const db = getBackendFirebaseDb();
    if (!db) {
      response.status(503).json({ error: 'Push subscriptions are not available.' });
      return;
    }

    // Use a hash of the endpoint as the document ID to deduplicate
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(subscription.endpoint));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const docId = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    const now = new Date().toISOString();
    await db
      .collection(PUSH_SUBSCRIPTIONS_COLLECTION)
      .doc(docId)
      .set(
        {
          endpoint: subscription.endpoint.trim(),
          keys: {
            p256dh: subscription.keys.p256dh.trim(),
            auth: subscription.keys.auth.trim(),
          },
          platform: platform || 'web',
          updatedAt: now,
          createdAt: now,
        },
        { merge: true },
      );

    logger.info('[push] Subscription stored', { docId, platform: platform || 'web' });
    response.json({ ok: true });
  } catch (error) {
    logger.error('[push] Failed to store subscription', {
      error: error instanceof Error ? error.message : String(error),
    });
    response.status(500).json({ error: 'Failed to store push subscription.' });
  }
});

/**
 * DELETE /push/subscribe
 *
 * Removes a push subscription when the user unsubscribes or the subscription expires.
 *
 * Body:
 *   endpoint: string (the subscription endpoint URL)
 */
router.delete('/subscribe', async (request: Request, response: Response) => {
  try {
    const { endpoint } = request.body ?? {};

    if (!isValidPushString(endpoint, MAX_ENDPOINT_LENGTH)) {
      response.status(400).json({ error: 'Missing endpoint.' });
      return;
    }

    const db = getBackendFirebaseDb();
    if (!db) {
      response.status(503).json({ error: 'Push subscriptions are not available.' });
      return;
    }

    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(endpoint.trim()));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const docId = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    await db.collection(PUSH_SUBSCRIPTIONS_COLLECTION).doc(docId).delete();

    logger.info('[push] Subscription removed', { docId });
    response.json({ ok: true });
  } catch (error) {
    logger.error('[push] Failed to remove subscription', {
      error: error instanceof Error ? error.message : String(error),
    });
    response.status(500).json({ error: 'Failed to remove push subscription.' });
  }
});

export { router as pushSubscriptionRoutes };
