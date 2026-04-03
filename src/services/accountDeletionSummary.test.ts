import { describe, expect, it } from 'vitest';
import { buildCanopyTroveAccountDeletionSummary } from './accountDeletionSummary';

describe('buildCanopyTroveAccountDeletionSummary', () => {
  it('returns a partial deletion warning when login removal needs a recent sign-in', () => {
    const result = buildCanopyTroveAccountDeletionSummary({
      isAuthenticatedAccount: true,
      authDeletionResult: {
        ok: false,
        reason: 'requires-recent-login',
        message: 'Sign in again, then retry account deletion to finish removing the login itself.',
      },
    });

    expect(result.ok).toBe(false);
    expect(result.partial).toBe(true);
    expect(result.reason).toBe('requires-recent-login');
    expect(result.message).toContain('login still exists');
  });

  it('returns a clean local-reset message for guest sessions', () => {
    const result = buildCanopyTroveAccountDeletionSummary({
      isAuthenticatedAccount: false,
      authDeletionResult: {
        ok: true,
        reason: null,
        message: null,
      },
    });

    expect(result.ok).toBe(true);
    expect(result.partial).toBe(false);
    expect(result.message).toContain('Local Canopy Trove profile data was reset');
  });
});
