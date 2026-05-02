/**
 * Maps Firebase Auth error codes to user-friendly messages with
 * suggested next actions.
 *
 * Why: Firebase's default `.message` strings are technical and scary
 * ("Firebase: The email address is already in use by another account.
 * (auth/email-already-in-use).") and offer no recovery path. Users
 * who see them tend to bail rather than figure out what to do. We
 * built this mapper from the platform-three-reports audit (May 2 2026)
 * which showed 14 signup_started events vs 6 signup_completed events
 * — a 43% completion rate where the lost 8 had likely tripped on one
 * of these errors and abandoned.
 *
 * The returned `recoveryAction` lets the calling screen offer a
 * concrete next step (e.g. "Sign in instead" with the email
 * pre-filled when we detect an already-in-use email).
 */

export type FirebaseAuthErrorRecoveryAction =
  | { kind: 'try_signin'; prefilledEmail: string }
  | { kind: 'reset_password' }
  | { kind: 'retry' }
  | { kind: 'none' };

export type FriendlyAuthError = {
  // The Firebase Auth error code, e.g. "auth/email-already-in-use".
  // Always present so analytics can group failures by code.
  code: string;
  // The user-facing message. Plain English, action-oriented.
  message: string;
  // What the calling screen should offer the user as a next step.
  recoveryAction: FirebaseAuthErrorRecoveryAction;
};

function extractFirebaseErrorCode(error: unknown): string | null {
  if (error && typeof error === 'object' && 'code' in error) {
    const candidate = (error as { code?: unknown }).code;
    if (typeof candidate === 'string' && candidate.startsWith('auth/')) {
      return candidate;
    }
  }
  // Fallback: scrape the code out of the default message format.
  if (error instanceof Error) {
    const match = error.message.match(/\(auth\/[a-z-]+\)/);
    if (match) {
      // match[0] is "(auth/foo-bar)" — strip the parens
      return match[0].slice(1, -1);
    }
  }
  return null;
}

/**
 * Translate any error thrown by a Firebase Auth client SDK call into
 * a friendly, user-facing form. The `attemptedEmail` param is needed
 * for the email-already-in-use recovery path so we can pre-fill the
 * sign-in screen.
 */
export function mapFirebaseAuthError(error: unknown, attemptedEmail: string): FriendlyAuthError {
  const code = extractFirebaseErrorCode(error) ?? 'unknown';
  const trimmedEmail = attemptedEmail.trim();

  switch (code) {
    case 'auth/email-already-in-use':
      return {
        code,
        message: 'This email is already registered. Sign in to use it instead.',
        recoveryAction: { kind: 'try_signin', prefilledEmail: trimmedEmail },
      };

    case 'auth/invalid-email':
      return {
        code,
        message: "That email doesn't look right. Double-check it and try again.",
        recoveryAction: { kind: 'retry' },
      };

    case 'auth/weak-password':
      return {
        code,
        message:
          'Password is too weak. Try at least 8 characters with a mix of letters and numbers.',
        recoveryAction: { kind: 'retry' },
      };

    case 'auth/network-request-failed':
      return {
        code,
        message: 'Connection issue. Check your internet and try again.',
        recoveryAction: { kind: 'retry' },
      };

    case 'auth/too-many-requests':
      return {
        code,
        message: 'Too many attempts from this device. Wait a few minutes and try again.',
        recoveryAction: { kind: 'retry' },
      };

    case 'auth/operation-not-allowed':
      return {
        code,
        message:
          'Email-and-password sign-up is temporarily unavailable. Try again later or contact support.',
        recoveryAction: { kind: 'none' },
      };

    case 'auth/user-disabled':
      return {
        code,
        message:
          'This account has been disabled. Contact support@canopytrove.com if you think this is wrong.',
        recoveryAction: { kind: 'none' },
      };

    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      // These appear on the SIGN-IN screen, not signup. Mapped here
      // so the same helper covers both flows when we wire it into
      // CanopyTroveSignInScreen as a follow-up.
      return {
        code,
        message:
          "Email or password doesn't match. Double-check both, or use 'Forgot password' to reset.",
        recoveryAction: { kind: 'reset_password' },
      };

    case 'unknown':
    default:
      return {
        code,
        message: "We couldn't create your account. Please try again in a moment.",
        recoveryAction: { kind: 'retry' },
      };
  }
}
