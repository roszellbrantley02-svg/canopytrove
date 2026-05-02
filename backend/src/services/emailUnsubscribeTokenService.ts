/**
 * One-click email unsubscribe tokens.
 *
 * Used by the deal-digest email pipeline to put a self-contained
 * unsubscribe link in every email. The link encodes the recipient's
 * accountId + the scope (which mailing the link unsubscribes from)
 * inside an HMAC-SHA256-signed token, so the unsubscribe route can
 * trust the link without a database lookup.
 *
 * Token format: base64url(`${accountId}.${scope}`) + `.` + base64url(sig)
 *
 * - accountId: Firebase Auth uid the email was sent to
 * - scope:     'deal_digest' (extensible — add scopes as new mailings ship)
 * - sig:       HMAC-SHA256(secret, payload), where payload is the
 *              base64url-encoded `{accountId}.{scope}` string
 *
 * NO expiry — CAN-SPAM requires unsubscribe links honor for at least 30
 * days; we honor forever as long as the secret is stable. Rotate by
 * changing EMAIL_UNSUBSCRIBE_TOKEN_SECRET (will invalidate all
 * outstanding links — only do this if you have to).
 *
 * Verification is timing-safe via crypto.timingSafeEqual.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export type UnsubscribeScope = 'deal_digest';

export type SignedUnsubscribePayload = {
  accountId: string;
  scope: UnsubscribeScope;
};

const SCOPE_VALUES = new Set<UnsubscribeScope>(['deal_digest']);

function base64UrlEncode(input: string): string {
  return Buffer.from(input, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(input: string): string | null {
  try {
    const padded = input.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (padded.length % 4)) % 4;
    return Buffer.from(padded + '='.repeat(padLength), 'base64').toString('utf8');
  } catch {
    return null;
  }
}

function getSecret(): string | null {
  // Read env at call time so test setups that set the env right before
  // import() see the new value without needing to bust the serverConfig
  // module cache. Production reads are still cheap — process.env access
  // is a Map lookup.
  const secret = process.env.EMAIL_UNSUBSCRIBE_TOKEN_SECRET?.trim();
  return secret && secret.length >= 32 ? secret : null;
}

function getUnsubscribeBaseUrl(): string {
  const value = process.env.EMAIL_UNSUBSCRIBE_BASE_URL?.trim();
  return value || 'https://api.canopytrove.com';
}

function computeSignature(payload: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(payload).digest();
}

/**
 * Mints a token. Returns null if the signing secret is missing or too
 * short — the caller should treat this as "unsubscribe links are not
 * available right now" and either skip the email entirely or fall back
 * to a manual mailto unsubscribe path.
 */
export function signUnsubscribeToken(payload: SignedUnsubscribePayload): string | null {
  const secret = getSecret();
  if (!secret) return null;

  const accountId = payload.accountId.trim();
  if (!accountId) return null;
  if (!SCOPE_VALUES.has(payload.scope)) return null;

  const encodedPayload = base64UrlEncode(`${accountId}.${payload.scope}`);
  const sig = computeSignature(encodedPayload, secret);
  const encodedSig = sig
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `${encodedPayload}.${encodedSig}`;
}

/**
 * Verifies a token and returns the embedded payload, or null if the
 * token is malformed, the signature doesn't match, or the secret is
 * unavailable. Verification is timing-safe.
 */
export function verifyUnsubscribeToken(token: string): SignedUnsubscribePayload | null {
  const secret = getSecret();
  if (!secret) return null;
  if (typeof token !== 'string' || !token.includes('.')) return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encodedPayload, encodedSig] = parts;
  if (!encodedPayload || !encodedSig) return null;

  const expectedSig = computeSignature(encodedPayload, secret);
  let providedSig: Buffer;
  try {
    const padded = encodedSig.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (padded.length % 4)) % 4;
    providedSig = Buffer.from(padded + '='.repeat(padLength), 'base64');
  } catch {
    return null;
  }

  if (providedSig.length !== expectedSig.length) return null;
  if (!timingSafeEqual(providedSig, expectedSig)) return null;

  const decodedPayload = base64UrlDecode(encodedPayload);
  if (!decodedPayload) return null;

  const dotIndex = decodedPayload.lastIndexOf('.');
  if (dotIndex < 1) return null;

  const accountId = decodedPayload.slice(0, dotIndex).trim();
  const scope = decodedPayload.slice(dotIndex + 1).trim();
  if (!accountId) return null;
  if (!SCOPE_VALUES.has(scope as UnsubscribeScope)) return null;

  return { accountId, scope: scope as UnsubscribeScope };
}

/**
 * Builds a fully-qualified unsubscribe URL for a given recipient + scope,
 * suitable for embedding in an email body or List-Unsubscribe header.
 * Returns null if the token signing secret is unavailable.
 */
export function buildUnsubscribeUrl(payload: SignedUnsubscribePayload): string | null {
  const token = signUnsubscribeToken(payload);
  if (!token) return null;
  const baseUrl = getUnsubscribeBaseUrl();
  const trimmed = baseUrl.replace(/\/+$/, '');
  return `${trimmed}/email/unsubscribe?token=${encodeURIComponent(token)}`;
}
