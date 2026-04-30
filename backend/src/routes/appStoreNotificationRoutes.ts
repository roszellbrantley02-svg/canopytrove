import { Router, type Request, type Response } from 'express';
import {
  processSignedNotification,
  VerificationException,
  VerificationStatus,
} from '../services/appStoreNotificationService';

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
    } catch (error: unknown) {
      // @apple/app-store-server-library throws VerificationException with a
      // numeric `.status` (VerificationStatus enum) and an underlying `.cause`.
      // Permanent verification failures => 400 (Apple won't retry; safe — a
      // bad signature won't succeed on retry). RETRYABLE_VERIFICATION_FAILURE
      // signals a transient issue Apple wants us to retry on, so 500.
      // Anything that isn't a VerificationException is treated as infra
      // failure (Firestore down, etc.) => 500 so Apple retries.
      const errorAny = error as {
        message?: string;
        name?: string;
        cause?: unknown;
        stack?: string;
      };
      const errorName = errorAny.name || (error instanceof Error ? 'Error' : 'NonError');
      const baseMessage = errorAny.message || '';
      const causeMessage =
        errorAny.cause instanceof Error
          ? errorAny.cause.message
          : errorAny.cause != null
            ? String(errorAny.cause)
            : '';

      let verificationStatus: number | undefined;
      let status: number;
      if (error instanceof VerificationException) {
        verificationStatus = error.status;
        status = error.status === VerificationStatus.RETRYABLE_VERIFICATION_FAILURE ? 500 : 400;
      } else {
        status = 500;
      }

      const surfacedMessage =
        baseMessage ||
        causeMessage ||
        (verificationStatus !== undefined
          ? `${errorName}(status=${verificationStatus})`
          : errorName);

      console.error(
        JSON.stringify({
          level: 'error',
          message: 'apple_notification_failed',
          requestId,
          errorName,
          errorMessage: baseMessage,
          causeMessage,
          verificationStatus,
          stack: errorAny.stack ?? null,
          status,
        }),
      );

      response.status(status).json({
        ok: false,
        error: surfacedMessage,
        errorName,
        verificationStatus,
        causeMessage: causeMessage || undefined,
      });
    }
  },
);
