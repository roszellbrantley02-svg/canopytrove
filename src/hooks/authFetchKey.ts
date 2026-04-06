import type { CanopyTroveAuthSession } from '../types/identity';

/**
 * Derives a stable key from auth session state that only changes when the
 * authentication level actually changes (guest ↔ authenticated). This prevents
 * data-fetching effects from re-running when auth transitions from 'checking'
 * to 'signed-out' or 'anonymous' — both of which produce the same public API
 * response — avoiding unnecessary fetch cancellations on initial page load.
 */
export function deriveAuthFetchKey(authSession: CanopyTroveAuthSession): string {
  if (authSession.status === 'authenticated') {
    return `authenticated:${authSession.uid}`;
  }

  // 'checking', 'signed-out', 'anonymous', and 'disabled' all resolve to
  // guest-level API access (no auth token or anonymous token). Collapsing
  // them into a single key prevents the initial 'checking' → 'signed-out'
  // transition from triggering an effect re-run.
  return 'guest';
}
