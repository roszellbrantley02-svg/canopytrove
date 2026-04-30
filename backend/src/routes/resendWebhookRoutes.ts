import type { Request, Response } from 'express';
import { processResendWebhook, ResendWebhookError } from '../services/resendWebhookService';

function getRawBody(request: Request) {
  if (typeof request.body === 'string') {
    return request.body;
  }

  if (Buffer.isBuffer(request.body)) {
    return request.body.toString('utf8');
  }

  throw new ResendWebhookError('Resend webhook requests must use the raw request body.');
}

function getHeaderMap(request: Request) {
  const headerMap: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(request.headers)) {
    headerMap[key.toLowerCase()] = Array.isArray(value) ? value.join(',') : value;
  }

  return headerMap;
}

export async function resendWebhookHandler(request: Request, response: Response) {
  try {
    const result = await processResendWebhook({
      rawBody: getRawBody(request),
      headers: getHeaderMap(request),
    });

    response.status(200).json({
      ok: true,
      duplicate: result.duplicate,
      webhookId: result.webhookId,
      eventType: result.eventType,
      matchedTarget: result.matchedTarget,
      matchedId: result.matchedId,
    });
  } catch (error) {
    // Typed errors carry the right status code. Everything else is an
    // unexpected infra failure → 500 so Resend (Svix) retries with
    // backoff. Previously this used substring sniffing on the error
    // message, which mis-classified transient 5xx failures as 400 and
    // caused Resend to drop the event permanently.
    const statusCode = error instanceof ResendWebhookError ? error.statusCode : 500;
    const message = error instanceof Error ? error.message : 'Unknown Resend webhook failure.';
    response.status(statusCode).json({
      ok: false,
      error: statusCode >= 500 ? 'Internal server error' : message,
    });
  }
}
