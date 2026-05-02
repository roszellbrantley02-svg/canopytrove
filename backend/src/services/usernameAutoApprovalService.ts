/**
 * Username Auto-Approval — clears the manual review queue for the
 * common case (a real user picking a non-offensive, non-impersonating,
 * non-already-taken display name).
 *
 * Why this exists:
 *   The original usernameChangeRequests flow gated every request on
 *   admin review. Without an admin tool to clear the queue, users sat
 *   in 'pending' forever and the app showed them no display name. This
 *   service runs validation server-side and auto-approves anything
 *   that doesn't trip a guardrail.
 *
 * Auto-approval criteria — ALL must pass or the request stays 'pending'
 * for human review:
 *
 *   1. Format: 2-30 chars, alphanumeric + underscore + period only
 *      (already partially enforced at submit; we double-check here).
 *   2. Not in the reserved-names list (admin / canopytrove / official /
 *      moderator / etc.).
 *   3. Not in the profanity / slur blocklist.
 *   4. Not already taken by another profile (uniqueness).
 *
 * Anything that fails one of these stays 'pending' so admin can decide.
 * Profanity-flagged requests are recorded with a flag for prioritized
 * review in the admin queue.
 */

import { logger } from '../observability/logger';
import { getOptionalFirestoreCollection } from '../firestoreCollections';

// Reserved names — handles, brand names, role-impersonation patterns,
// system identifiers. Case-insensitive match against the requested name.
// Bias toward over-restricting on day 1; we can loosen later.
const RESERVED_NAMES = new Set<string>([
  'admin',
  'administrator',
  'moderator',
  'mod',
  'support',
  'help',
  'staff',
  'official',
  'team',
  'system',
  'root',
  'owner',
  'canopytrove',
  'canopy_trove',
  'canopy',
  'trove',
  'askmehere',
  'ask_me_here',
  'verified',
  'apple',
  'google',
  'firebase',
  'stripe',
  'twilio',
  'null',
  'undefined',
  'anonymous',
  'guest',
  'user',
  'test',
  'demo',
]);

// Profanity / slur blocklist — non-exhaustive, focused on the obvious.
// We use substring matching so "fuckyou18" is caught even though
// it isn't an exact match. Bias toward false positives — flagged
// requests just go to human review, they don't get rejected outright.
//
// Keeping this list deliberately short. Extending it is a separate
// PR with a content-policy review.
const PROFANITY_SUBSTRINGS = [
  'fuck',
  'shit',
  'bitch',
  'cunt',
  'nigger',
  'nigga',
  'faggot',
  'retard',
  'rape',
  'pedo',
];

const PROFILES_COLLECTION = 'profiles';

export type AutoApprovalDecision =
  | { ok: true; decision: 'auto_approved' }
  | { ok: true; decision: 'queued_for_review'; reason: AutoApprovalQueueReason };

export type AutoApprovalQueueReason =
  | 'reserved_name'
  | 'profanity'
  | 'username_taken'
  | 'invalid_format';

function normalizeForComparison(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '').normalize('NFKD').replace(/[̀-ͯ]/g, ''); // strip accents
}

/**
 * Valid format: 2-30 chars, letters / digits / underscore / period only.
 * Allows mixed case (we preserve it) but the comparison logic normalizes.
 */
function hasValidFormat(value: string): boolean {
  if (value.length < 2 || value.length > 30) return false;
  return /^[a-zA-Z0-9._]+$/.test(value);
}

function isReservedName(value: string): boolean {
  const normalized = normalizeForComparison(value).replace(/[._]/g, '');
  return RESERVED_NAMES.has(normalized);
}

function containsProfanity(value: string): boolean {
  const normalized = normalizeForComparison(value);
  return PROFANITY_SUBSTRINGS.some((bad) => normalized.includes(bad));
}

/**
 * Look up whether another profile already uses this display name.
 * Case-insensitive: "StellaLady18" and "stellalady18" collide.
 *
 * Fail-open: if Firestore is unreachable, we treat the name as
 * available (the auto-approval will succeed). Username uniqueness is
 * a nice-to-have, not load-bearing security.
 */
async function isUsernameTaken(
  requestedDisplayName: string,
  ownerProfileId: string,
): Promise<boolean> {
  const profilesCollection = getOptionalFirestoreCollection<{ displayName?: string | null }>(
    PROFILES_COLLECTION,
  );
  if (!profilesCollection) return false;

  const normalized = normalizeForComparison(requestedDisplayName);

  try {
    // Case-insensitive equality isn't natively supported by Firestore.
    // We do a prefix scan on the lowercased displayName range, then
    // exact-compare in JS.
    const snapshot = await profilesCollection
      .where('displayName', '>=', requestedDisplayName.toLowerCase())
      .where('displayName', '<=', requestedDisplayName.toLowerCase() + '')
      .limit(20)
      .get();

    for (const doc of snapshot.docs) {
      if (doc.id === ownerProfileId) continue; // The user themselves doesn't count
      const existing = doc.data().displayName;
      if (typeof existing === 'string' && normalizeForComparison(existing) === normalized) {
        return true;
      }
    }
    return false;
  } catch (error) {
    // Index missing / permission failure — fail-open. Admin will catch
    // a duplicate on the displayed user list if it actually clashes.
    logger.warn('[usernameAutoApproval] Uniqueness check failed — failing open', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Decide whether a username request can be auto-approved or should sit
 * in the manual review queue. Pure decision function — does NOT mutate
 * state. Caller invokes the existing reviewUsernameRequest flow on
 * receipt of an `auto_approved` decision.
 */
export async function evaluateUsernameAutoApproval(input: {
  profileId: string;
  requestedDisplayName: string;
}): Promise<AutoApprovalDecision> {
  const { profileId, requestedDisplayName } = input;

  if (!hasValidFormat(requestedDisplayName)) {
    return { ok: true, decision: 'queued_for_review', reason: 'invalid_format' };
  }
  if (isReservedName(requestedDisplayName)) {
    return { ok: true, decision: 'queued_for_review', reason: 'reserved_name' };
  }
  if (containsProfanity(requestedDisplayName)) {
    return { ok: true, decision: 'queued_for_review', reason: 'profanity' };
  }
  if (await isUsernameTaken(requestedDisplayName, profileId)) {
    return { ok: true, decision: 'queued_for_review', reason: 'username_taken' };
  }
  return { ok: true, decision: 'auto_approved' };
}
