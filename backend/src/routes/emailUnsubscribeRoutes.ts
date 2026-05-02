/**
 * Public unsubscribe routes for transactional + marketing-adjacent
 * emails. Used by the daily deal-digest pipeline; extensible to other
 * scoped mailings via the `scope` field on the signed token.
 *
 * Two routes:
 *
 * GET  /email/unsubscribe?token=...
 *   Renders a tiny HTML page that the browser displays after the user
 *   clicks the "Unsubscribe" link in an email. Verifies the token,
 *   flips the per-channel opt-out, and shows a friendly confirmation.
 *
 * POST /email/unsubscribe?token=...
 *   The RFC 8058 one-click unsubscribe endpoint. Mailbox providers
 *   (Gmail, Apple Mail, Outlook, etc.) will POST here automatically
 *   when the user hits the "Unsubscribe" affordance in their email
 *   client, without ever loading the page in a browser. Must respond
 *   2xx for the client to consider it successful. No HTML.
 *
 * Both routes are intentionally NOT admin-gated and NOT rate-limited
 * by the admin pipeline — they're public endpoints by design (the
 * recipient can't authenticate to call them; the token IS the auth).
 * The token is HMAC-signed and timing-safe-verified, so spam is bounded.
 */
import { Router, type Request, type Response } from 'express';
import { logger } from '../observability/logger';
import { verifyUnsubscribeToken } from '../services/emailUnsubscribeTokenService';
import { optOutOfDealDigest } from '../services/memberEmailSubscriptionService';

export const emailUnsubscribeRoutes = Router();

function readToken(request: Request): string | null {
  const queryToken = typeof request.query.token === 'string' ? request.query.token.trim() : '';
  if (queryToken) return queryToken;

  const bodyToken =
    typeof (request.body as { token?: unknown } | undefined)?.token === 'string'
      ? ((request.body as { token: string }).token as string).trim()
      : '';
  return bodyToken || null;
}

async function performUnsubscribe(token: string | null): Promise<{
  ok: boolean;
  status: number;
  scope: string | null;
  alreadyOptedOut: boolean;
  reason?: string;
}> {
  if (!token) {
    return { ok: false, status: 400, scope: null, alreadyOptedOut: false, reason: 'missing_token' };
  }

  const payload = verifyUnsubscribeToken(token);
  if (!payload) {
    return { ok: false, status: 400, scope: null, alreadyOptedOut: false, reason: 'invalid_token' };
  }

  if (payload.scope === 'deal_digest') {
    const result = await optOutOfDealDigest(payload.accountId);
    if (!result.ok) {
      // not_found means the account has no subscription record — treat
      // as user-side success (they're not getting any emails from us
      // anyway) so the click feels like it worked.
      return {
        ok: true,
        status: 200,
        scope: payload.scope,
        alreadyOptedOut: false,
        reason: 'no_record',
      };
    }
    return {
      ok: true,
      status: 200,
      scope: payload.scope,
      alreadyOptedOut: result.alreadyOptedOut,
    };
  }

  return {
    ok: false,
    status: 400,
    scope: payload.scope,
    alreadyOptedOut: false,
    reason: 'unsupported_scope',
  };
}

function renderHtmlPage(input: {
  title: string;
  heading: string;
  message: string;
  status: 'success' | 'error';
}): string {
  const accent = input.status === 'success' ? '#2ECC71' : '#E8A000';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${input.title}</title>
  <style>
    body { margin: 0; padding: 32px 16px; background: #121614; color: #FFFBF7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; min-height: 100vh; box-sizing: border-box; }
    .card { max-width: 480px; margin: 8vh auto 0; background: #1d2421; border-radius: 16px; padding: 32px; border: 1px solid rgba(196, 184, 176, 0.18); }
    .eyebrow { font-size: 13px; letter-spacing: 0.04em; text-transform: uppercase; color: ${accent}; font-weight: 600; margin: 0 0 8px 0; }
    h1 { margin: 0 0 16px 0; font-size: 24px; line-height: 1.25; font-weight: 700; }
    p { margin: 0 0 16px 0; font-size: 15px; line-height: 1.5; color: #C4B8B0; }
    a { color: ${accent}; text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card">
    <p class="eyebrow">Canopy Trove</p>
    <h1>${input.heading}</h1>
    <p>${input.message}</p>
    <p><a href="https://canopytrove.com">Back to canopytrove.com</a></p>
  </div>
</body>
</html>`;
}

emailUnsubscribeRoutes.get('/email/unsubscribe', async (request: Request, response: Response) => {
  const token = readToken(request);
  const outcome = await performUnsubscribe(token);

  response.status(outcome.status);
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');

  if (!outcome.ok) {
    logger.info(`[emailUnsubscribeRoutes] GET reject reason=${outcome.reason ?? 'unknown'}`);
    response.send(
      renderHtmlPage({
        title: "We couldn't process that link",
        heading: "We couldn't process that link",
        message:
          "The unsubscribe link looks invalid or expired. If you keep getting emails from us and want them to stop, reply to any email or contact askmehere@canopytrove.com and we'll handle it manually.",
        status: 'error',
      }),
    );
    return;
  }

  const heading = outcome.alreadyOptedOut ? "You're already unsubscribed" : "You're unsubscribed";
  const message = outcome.alreadyOptedOut
    ? "You won't receive any more deal-digest emails from Canopy Trove. If they keep showing up, contact askmehere@canopytrove.com."
    : "Got it — we won't send you any more deal-digest emails. If you change your mind, you can re-subscribe in the app any time.";

  response.send(
    renderHtmlPage({
      title: heading,
      heading,
      message,
      status: 'success',
    }),
  );
});

emailUnsubscribeRoutes.post('/email/unsubscribe', async (request: Request, response: Response) => {
  // RFC 8058 one-click unsubscribe. Mailbox providers POST here without
  // user-visible UI; we just need to return 2xx on success.
  const token = readToken(request);
  const outcome = await performUnsubscribe(token);

  if (!outcome.ok) {
    logger.info(`[emailUnsubscribeRoutes] POST reject reason=${outcome.reason ?? 'unknown'}`);
    response.status(outcome.status).json({ ok: false, error: outcome.reason });
    return;
  }

  response.status(200).json({
    ok: true,
    scope: outcome.scope,
    alreadyOptedOut: outcome.alreadyOptedOut,
  });
});
