import { Router, type Request, type Response } from 'express';
import { processSignedNotification } from '../services/appStoreNotificationService';

export const appStoreNotificationRoutes = Router();

// Apple sends App Store Server Notifications V2 as a POST with a JSON body
// of shape `{ "signedPayload": "<JWT>" }`. The endpoint MUST be public
// (no auth) since Apple's edge does not authenticate; instead the payload
// is signed by Apple and we verify the signature in the service.
//
// Apple expects:
//   - 200 on successful processing OR successful idempotent dedup
//   - non-2xx on processing failure (Apple retries with backoff)
//
// We avoid 5xx for known/expected outcomes (signature failure, bad shape)
// because Apple will retry on those, and a malformed request will never
// succeed on retry. 4xx surfaces it to logging without burning Apple's
// retry queue.
appStoreNotificationRoutes.post(
  '/apple-notifications/v2',
  async (request: Request, response: Response) => {
    const requestIdHeader = response.getHeader('X-CanopyTrove-Request-Id');
    const requestId = typeof requestIdHeader === 'string' ? requestIdHeader : null;

    const body = request.body as { signedPayload?: unknown };
    const signedPayload =
      typeof body?.signedPayload === 'string' && body.signedPayload.length > 0
        ? body.signedPayload
        : null;

    if (!signedPayload) {
      console.warn(
        JSON.stringify({
          level: 'warn',
          message: 'apple_notification_missing_signed_payload',
          requestId,
        }),
      );
      response.status(400).json({ ok: false, error: 'missing_signed_payload' });
      return;
    }

    try {
      const result = await processSignedNotification(signedPayload);

      console.log(
        JSON.stringify({
          level: 'info',
          message: 'apple_notification_processed',
          requestId,
          ...result,
        }),
      );

      response.status(200).json({ ok: true, ...result });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Signature-verification failures are unrecoverable — return 400 so
      // Apple stops retrying. Other errors return 500 so Apple does retry.
      const isSignatureError =
        errorMessage.toLowerCase().includes('signature') ||
        errorMessage.toLowerCase().includes('verification') ||
        errorMessage.toLowerCase().includes('jwt');
      const status = isSignatureError ? 400 : 500;

      console.error(
        JSON.stringify({
          level: 'error',
          message: 'apple_notification_failed',
          requestId,
          error: errorMessage,
          status,
        }),
      );

      response.status(status).json({ ok: false, error: errorMessage });
    }
  },
);
