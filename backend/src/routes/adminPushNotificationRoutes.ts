import { Router, Request, Response } from 'express';
import { getBackendFirebaseDb } from '../firebase';
import { serverConfig } from '../config';
import { logger } from '../observability/logger';

const PUSH_SUBSCRIPTIONS_COLLECTION = 'pushSubscriptions';

const router = Router();

/**
 * POST /admin/push/send
 *
 * Sends a push notification to all stored web push subscriptions.
 * Uses the Web Push protocol directly (no FCM SDK required).
 *
 * Requires: VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, VAPID_SUBJECT env vars.
 *
 * Body:
 *   title: string
 *   body: string
 *   url?: string (deep link to open on tap)
 *   tag?: string (notification grouping key)
 *   dryRun?: boolean
 */
router.post('/send', async (request: Request, response: Response) => {
  try {
    const { title, body: messageBody, url, tag, dryRun } = request.body ?? {};

    if (!title || !messageBody) {
      response.status(400).json({ error: 'title and body are required.' });
      return;
    }

    const db = getBackendFirebaseDb();
    if (!db) {
      response.status(503).json({ error: 'Push service is not available.' });
      return;
    }

    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:askmehere@canopytrove.com';

    if (!vapidPrivateKey || !vapidPublicKey) {
      response.status(503).json({
        error: 'VAPID keys are not configured. Set VAPID_PRIVATE_KEY and VAPID_PUBLIC_KEY.',
      });
      return;
    }

    // Fetch all subscriptions
    const snapshot = await db.collection(PUSH_SUBSCRIPTIONS_COLLECTION).get();

    if (snapshot.empty) {
      response.json({ ok: true, sent: 0, message: 'No subscribers found.' });
      return;
    }

    const payload = JSON.stringify({
      title,
      body: messageBody,
      url: url || '/',
      tag: tag || 'ct-notification',
    });

    if (dryRun) {
      response.json({
        ok: true,
        dryRun: true,
        subscriberCount: snapshot.size,
        payload: JSON.parse(payload),
      });
      return;
    }

    // Dynamic import of web-push (install with: npm install web-push)
    let webpush: typeof import('web-push');
    try {
      webpush = await import('web-push');
    } catch {
      response.status(503).json({
        error:
          'web-push package is not installed. Run: npm install web-push --save in the backend directory.',
      });
      return;
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    let sent = 0;
    let failed = 0;
    const expired: string[] = [];

    // Concurrency-limit fan-out: previously every doc started a
    // sendNotification simultaneously via Promise.all. With thousands of
    // subscribers that meant thousands of simultaneous outbound HTTPS
    // requests, exhausting the Cloud Run instance's network/file-handle
    // budget and triggering rate-limit pushback from Apple/Google's
    // push services. Process in waves of 25.
    const PUSH_CONCURRENCY = 25;
    const PUSH_TIMEOUT_MS = 10_000;

    const sendOne = async (doc: (typeof snapshot.docs)[number]) => {
      const data = doc.data();
      const subscription = {
        endpoint: data.endpoint,
        keys: {
          p256dh: data.keys?.p256dh,
          auth: data.keys?.auth,
        },
      };

      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('push send timed out')), PUSH_TIMEOUT_MS),
      );

      try {
        await Promise.race([webpush.sendNotification(subscription, payload), timeout]);
        sent++;
      } catch (error: unknown) {
        const statusCode = (error as { statusCode?: number })?.statusCode;
        if (statusCode === 410 || statusCode === 404) {
          // Subscription expired or invalid — clean it up
          expired.push(doc.id);
          await doc.ref.delete().catch(() => {});
        }
        failed++;
        logger.warn('[push] Send failed', {
          docId: doc.id,
          statusCode,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };

    for (let i = 0; i < snapshot.docs.length; i += PUSH_CONCURRENCY) {
      const batch = snapshot.docs.slice(i, i + PUSH_CONCURRENCY);
      await Promise.all(batch.map(sendOne));
    }

    logger.info('[push] Broadcast complete', { sent, failed, expired: expired.length });
    response.json({
      ok: true,
      sent,
      failed,
      expiredAndCleaned: expired.length,
      totalSubscribers: snapshot.size,
    });
  } catch (error) {
    logger.error('[push] Broadcast failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    response.status(500).json({ error: 'Failed to send push notifications.' });
  }
});

export { router as adminPushNotificationRoutes };
