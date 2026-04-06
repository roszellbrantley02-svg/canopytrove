import { getBackendFirebaseAuth, hasBackendFirebaseConfig } from '../firebase';
import { logger } from '../observability/logger';
import { logSecurityEvent } from '../http/securityEventLogger';

/**
 * Session Revocation Service
 *
 * OWASP recommends invalidating all existing sessions after:
 * - Password reset
 * - Email change
 * - MFA enrollment/removal
 * - Account compromise detection
 *
 * Firebase Auth provides `revokeRefreshTokens(uid)` which invalidates
 * all refresh tokens for a user. After revocation, existing ID tokens
 * remain valid until they expire (up to 1 hour), but new token refreshes
 * will fail. For immediate enforcement, use `verifyIdToken(token, true)`
 * which checks the revocation status.
 *
 * This service wraps that capability with logging and error handling.
 */

type RevocationReason =
  | 'password_reset'
  | 'email_change'
  | 'mfa_change'
  | 'account_compromise'
  | 'admin_action'
  | 'account_deletion';

type RevocationResult =
  | { ok: true; uid: string; reason: RevocationReason }
  | { ok: false; uid: string; reason: RevocationReason; error: string };

export async function revokeAllUserSessions(
  uid: string,
  reason: RevocationReason,
  meta?: { ip?: string; path?: string },
): Promise<RevocationResult> {
  if (!hasBackendFirebaseConfig) {
    logger.warn('[sessionRevocation] Firebase not configured, skipping revocation', {
      uid,
      reason,
    });
    return { ok: false, uid, reason, error: 'Firebase not configured' };
  }

  const auth = getBackendFirebaseAuth();
  if (!auth) {
    logger.warn('[sessionRevocation] Firebase Auth not available, skipping revocation', {
      uid,
      reason,
    });
    return { ok: false, uid, reason, error: 'Firebase Auth not available' };
  }

  try {
    await auth.revokeRefreshTokens(uid);

    logSecurityEvent({
      event: 'auth_failure', // Reusing closest available event type
      ip: meta?.ip ?? 'system',
      path: meta?.path ?? '/internal/session-revocation',
      method: 'POST',
      userId: uid,
      detail: `All sessions revoked: ${reason}`,
      meta: { reason, action: 'session_revocation' },
    });

    logger.info('[sessionRevocation] Sessions revoked', { uid, reason });
    return { ok: true, uid, reason };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[sessionRevocation] Failed to revoke sessions', {
      uid,
      reason,
      error: message,
    });
    return { ok: false, uid, reason, error: message };
  }
}

/**
 * Verify a token with revocation check enabled.
 * This adds a Firestore read per verification call, so use it only
 * for sensitive endpoints — not for every API request.
 */
export async function verifyTokenWithRevocationCheck(token: string) {
  if (!hasBackendFirebaseConfig) {
    return null;
  }

  const auth = getBackendFirebaseAuth();
  if (!auth) {
    return null;
  }

  try {
    // Second argument `true` enables revocation check
    return await auth.verifyIdToken(token, true);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // Firebase throws a specific error when token is revoked
    if (message.includes('auth/id-token-revoked')) {
      return null;
    }

    throw error;
  }
}
