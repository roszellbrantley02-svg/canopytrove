/**
 * Username Auto-Approval Sweep — one-shot cleanup of legacy pending requests.
 *
 * Before usernameAutoApprovalService shipped, every username request sat
 * in 'pending' until an admin manually approved it. There was no admin
 * tool, so users sat in limbo indefinitely.
 *
 * This sweep runs the auto-approval evaluator against ALL currently-
 * pending requests in batch. Anything that passes the guardrails gets
 * auto-approved (and the user's profile.displayName is updated). Anything
 * that doesn't stays 'pending' for human review — same outcome as if a
 * fresh request had come in today.
 *
 * Designed to be safe to run multiple times — idempotent. Each call
 * re-evaluates only docs that are still 'pending'; previously-approved
 * docs are untouched.
 *
 * Triggered manually via the admin endpoint POST /admin/username-requests/sweep
 * (added in usernameRequestRoutes.ts).
 */

import { logger } from '../observability/logger';
import { getProfile, saveProfile } from './profileService';
import {
  listPendingRequests,
  reviewUsernameRequest,
  type UsernameChangeRequest,
} from './usernameRequestService';
import { evaluateUsernameAutoApproval } from './usernameAutoApprovalService';

export type SweepOutcomeEntry = {
  requestId: string;
  profileId: string;
  requestedDisplayName: string;
  outcome: 'auto_approved' | 'left_pending' | 'failed';
  reason?: string;
};

export type SweepResult = {
  ok: true;
  totalEvaluated: number;
  autoApproved: number;
  leftPending: number;
  failed: number;
  entries: SweepOutcomeEntry[];
};

export async function sweepPendingUsernameRequests(maxToProcess = 200): Promise<SweepResult> {
  const pending = await listPendingRequests(maxToProcess);
  const entries: SweepOutcomeEntry[] = [];
  let autoApproved = 0;
  let leftPending = 0;
  let failed = 0;

  for (const request of pending) {
    const outcome = await processOne(request);
    entries.push(outcome);
    if (outcome.outcome === 'auto_approved') autoApproved++;
    else if (outcome.outcome === 'left_pending') leftPending++;
    else failed++;
  }

  logger.info('[usernameSweep] Completed sweep', {
    totalEvaluated: pending.length,
    autoApproved,
    leftPending,
    failed,
  });

  return {
    ok: true,
    totalEvaluated: pending.length,
    autoApproved,
    leftPending,
    failed,
    entries,
  };
}

async function processOne(request: UsernameChangeRequest): Promise<SweepOutcomeEntry> {
  const baseEntry: Omit<SweepOutcomeEntry, 'outcome'> = {
    requestId: request.id,
    profileId: request.profileId,
    requestedDisplayName: request.requestedDisplayName,
  };

  try {
    const decision = await evaluateUsernameAutoApproval({
      profileId: request.profileId,
      requestedDisplayName: request.requestedDisplayName,
    });

    if (decision.decision !== 'auto_approved') {
      return { ...baseEntry, outcome: 'left_pending', reason: decision.reason };
    }

    const reviewed = await reviewUsernameRequest(request.id, 'approved');
    if (!reviewed) {
      return { ...baseEntry, outcome: 'failed', reason: 'request_disappeared' };
    }

    const profile = await getProfile(request.profileId);
    if (!profile) {
      // Edge case — the profile was deleted between request submission
      // and this sweep. We marked the request approved but can't update
      // a profile that no longer exists. Treat as a soft success.
      logger.warn('[usernameSweep] Profile missing for approved request', {
        requestId: request.id,
        profileId: request.profileId,
      });
      return { ...baseEntry, outcome: 'auto_approved', reason: 'profile_missing' };
    }

    await saveProfile({
      ...profile,
      displayName: reviewed.requestedDisplayName,
      updatedAt: new Date().toISOString(),
    });

    return { ...baseEntry, outcome: 'auto_approved' };
  } catch (error) {
    return {
      ...baseEntry,
      outcome: 'failed',
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}
