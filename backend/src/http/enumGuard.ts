import { logger } from '../observability/logger';

/**
 * Anti-Enumeration Guard
 *
 * OWASP recommends that authentication and account-lookup responses
 * should be:
 * 1. Generic — same message for "user exists" and "user does not exist"
 * 2. Uniform-timed — same response latency regardless of outcome
 *
 * This prevents attackers from enumerating valid accounts by observing
 * differences in response messages or timing.
 *
 * Usage: Wrap any handler that could reveal whether an account exists.
 */

type EnumGuardOptions = {
  /** Minimum response time in milliseconds. Default: 250ms. */
  minResponseTimeMs?: number;
  /** Maximum jitter added to the minimum in milliseconds. Default: 150ms. */
  maxJitterMs?: number;
};

const DEFAULT_MIN_RESPONSE_TIME_MS = 250;
const DEFAULT_MAX_JITTER_MS = 150;

/**
 * Adds uniform timing to a handler's response.
 * Ensures the response takes at least `minResponseTimeMs + random jitter`
 * regardless of how fast the actual logic completes.
 */
export async function withUniformTiming<T>(
  handler: () => Promise<T>,
  options?: EnumGuardOptions,
): Promise<T> {
  const minTime = options?.minResponseTimeMs ?? DEFAULT_MIN_RESPONSE_TIME_MS;
  const maxJitter = options?.maxJitterMs ?? DEFAULT_MAX_JITTER_MS;
  const targetTime = minTime + Math.floor(Math.random() * maxJitter);
  const startTime = Date.now();

  const result = await handler();

  const elapsed = Date.now() - startTime;
  const remaining = targetTime - elapsed;
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }

  return result;
}

/**
 * Standard generic error messages for auth-related endpoints.
 * Using the same message prevents user enumeration.
 */
export const GENERIC_AUTH_MESSAGES = {
  /** For login failures — never reveal whether the email exists. */
  loginFailed: 'Invalid email or password.',
  /** For password reset requests — always confirm, never reveal account existence. */
  resetRequested: 'If an account with that email exists, a password reset link has been sent.',
  /** For signup when account already exists — don't reveal it. */
  signupGeneric: 'If this email is available, you will receive a confirmation shortly.',
  /** For email verification resend. */
  verificationSent: 'If an account with that email exists, a verification email has been sent.',
  /** For account lookup (e.g., "forgot email"). */
  accountLookup:
    'If an account matching those details exists, we will send instructions to the associated email.',
} as const;

/**
 * Wraps a handler to return a generic success response regardless
 * of whether the underlying operation found a matching account.
 *
 * Example:
 * ```ts
 * router.post('/auth/forgot-password', async (req, res) => {
 *   const result = await withGenericResponse(
 *     () => sendPasswordResetEmail(req.body.email),
 *     GENERIC_AUTH_MESSAGES.resetRequested,
 *   );
 *   res.json(result);
 * });
 * ```
 */
export async function withGenericResponse<T>(
  handler: () => Promise<T>,
  genericMessage: string,
  options?: EnumGuardOptions,
): Promise<{ ok: true; message: string }> {
  try {
    await withUniformTiming(handler, options);
  } catch (error) {
    // Log the error internally but never expose it to the client
    logger.warn('[enumGuard] Suppressed error in generic response handler', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return { ok: true, message: genericMessage };
}
