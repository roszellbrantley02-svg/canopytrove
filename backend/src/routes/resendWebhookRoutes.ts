import type { Request, Response } from 'express';
import { processResendWebhook } from '../services/resendWebhookService';

function getRawBody(request: Request) {
  if (typeof request.body === 'string') {
    return request.body;
  }

  if (Buffer.isBuffer(request.body)) {
    return request.body.toString('utf8');
  }

  throw new Error('Resend webhook requests must use the raw request body.');
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
    const message = error instanceof Error ? error.message : 'Unknown Resend webhook failure.';
    const statusCode =
      /verification|signature|missing resend webhook|missing resend webhook verification|raw request body|required email event fields/i.test(
        message
      )
        ? 400
        : /not configured/i.test(message)
          ? 503
          : 500;
    response.status(statusCode).json({
      ok: false,
      error: message,
    });
  }
}
