import { CanopyTroveAuthDeletionResult } from './canopyTroveAuthService';

export function buildCanopyTroveAccountDeletionSummary(input: {
  isAuthenticatedAccount: boolean;
  authDeletionResult: CanopyTroveAuthDeletionResult;
}) {
  if (!input.isAuthenticatedAccount) {
    return {
      ok: true,
      partial: false,
      reason: null,
      message: 'Local Canopy Trove profile data was reset on this device.',
    } as const;
  }

  if (input.authDeletionResult.ok) {
    return {
      ok: true,
      partial: false,
      reason: null,
      message: 'Canopy Trove removed the account data path and deleted the login.',
    } as const;
  }

  if (input.authDeletionResult.reason === 'requires-recent-login') {
    return {
      ok: false,
      partial: true,
      reason: input.authDeletionResult.reason,
      message:
        'Canopy Trove cleared your profile data, but the login still exists. Sign in again and retry account deletion to finish removing the login itself.',
    } as const;
  }

  return {
    ok: false,
    partial: true,
    reason: input.authDeletionResult.reason,
    message:
      'Canopy Trove cleared your profile data, but could not finish removing the login itself. Sign in again and retry, or contact support if it keeps failing.',
  } as const;
}
