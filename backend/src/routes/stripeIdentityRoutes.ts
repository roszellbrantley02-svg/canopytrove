import { Request, Response } from 'express';
import {
  handleStripeIdentityWebhook,
  StripeIdentityWebhookError,
} from '../services/stripeIdentityService';
import { getSafeErrorMessage } from '../http/errors';

/**
 * Stripe Identity webhook handler.
 * Mounted at POST /identity-verification/stripe/webhook in app.ts
 * with express.raw() so the body arrives as a raw Buffer for signature verification.
 *
 * Status code policy: signature/payload-shape failures => 400 (Stripe
 * stops retrying — safe; a malformed signature won't succeed on retry).
 * Anything else => 500 so Stripe retries with backoff. Hard-coding 400
 * for everything (the previous behavior) silently dropped events on any
 * transient infra failure during processing.
 */
export async function stripeIdentityWebhookHandler(request: Request, response: Response) {
  try {
    const payloadBuffer = Buffer.isBuffer(request.body) ? request.body : Buffer.from('', 'utf8');

    const result = await handleStripeIdentityWebhook(
      payloadBuffer,
      request.header('stripe-signature'),
    );

    response.json(result);
  } catch (error) {
    const statusCode = error instanceof StripeIdentityWebhookError ? error.statusCode : 500;
    const requestId = response.getHeader('X-CanopyTrove-Request-Id');
    response.status(statusCode).json({
      ok: false,
      error: getSafeErrorMessage(
        error,
        statusCode,
        typeof requestId === 'string' ? requestId : null,
      ),
    });
  }
}
