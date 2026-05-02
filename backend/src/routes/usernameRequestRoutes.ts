import { Router } from 'express';
import { serverConfig } from '../config';
import { createRateLimitMiddleware } from '../http/rateLimit';
import { parseProfileIdParam } from '../http/validation';
import { logger } from '../observability/logger';
import { ensureProfileWriteAccess } from '../services/profileAccessService';
import { getProfile, saveProfile } from '../services/profileService';
import {
  getPendingRequestForProfile,
  listPendingRequests,
  reviewUsernameRequest,
  submitUsernameChangeRequest,
} from '../services/usernameRequestService';
import { evaluateUsernameAutoApproval } from '../services/usernameAutoApprovalService';
import { sweepPendingUsernameRequests } from '../services/usernameAutoApprovalSweep';
import { ensureAdminApiKeyMatch } from '../http/adminAccess';

export const usernameRequestRoutes = Router();

usernameRequestRoutes.use(
  createRateLimitMiddleware({
    name: 'username-write',
    windowMs: 60_000,
    max: serverConfig.writeRateLimitPerMinute,
    methods: ['POST', 'PUT'],
  }),
);

/** Submit a username change request. Requires authenticated user. */
usernameRequestRoutes.post('/profiles/:profileId/username-requests', async (request, response) => {
  const profileId = parseProfileIdParam(request.params.profileId);
  const { accountId, profile } = await ensureProfileWriteAccess(request, profileId);

  if (!accountId) {
    response.status(403).json({
      ok: false,
      error: 'You must be signed in to request a username change.',
    });
    return;
  }

  const body = request.body as { requestedDisplayName?: unknown };
  const requestedDisplayName =
    typeof body.requestedDisplayName === 'string' ? body.requestedDisplayName.trim() : '';

  if (!requestedDisplayName || requestedDisplayName.length < 2) {
    response.status(422).json({
      ok: false,
      error: 'Username must be at least 2 characters.',
    });
    return;
  }

  if (requestedDisplayName.length > 30) {
    response.status(422).json({
      ok: false,
      error: 'Username must be 30 characters or fewer.',
    });
    return;
  }

  // Reject if the requested name looks like an email.
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requestedDisplayName)) {
    response.status(422).json({
      ok: false,
      error: 'Username cannot be an email address.',
    });
    return;
  }

  try {
    const result = await submitUsernameChangeRequest(
      profileId,
      accountId,
      profile.displayName,
      requestedDisplayName,
    );

    // Auto-approval: real users picking non-offensive, non-impersonating
    // names should get their display name immediately, not sit waiting
    // for an admin who may never look. Anything that trips a guardrail
    // (reserved name, profanity, already-taken, weird format) stays
    // 'pending' for human review — same behavior as before this change
    // for those edge cases.
    const autoApproval = await evaluateUsernameAutoApproval({
      profileId,
      requestedDisplayName,
    });

    if (autoApproval.decision === 'auto_approved') {
      try {
        const reviewed = await reviewUsernameRequest(result.id, 'approved');
        if (reviewed) {
          await saveProfile({
            ...profile,
            displayName: reviewed.requestedDisplayName,
            updatedAt: new Date().toISOString(),
          });
          logger.info('[usernameRequest] Auto-approved', {
            requestId: reviewed.id,
            profileId,
            displayName: reviewed.requestedDisplayName,
          });
          response.status(201).json({ ok: true, request: reviewed, autoApproved: true });
          return;
        }
      } catch (autoErr) {
        // Fall through to the normal pending response — admin can
        // approve manually. Don't fail the user's request because the
        // auto-approval optimization tripped.
        logger.warn('[usernameRequest] Auto-approval failed — leaving pending', {
          requestId: result.id,
          profileId,
          error: autoErr instanceof Error ? autoErr.message : String(autoErr),
        });
      }
    } else {
      logger.info('[usernameRequest] Queued for manual review', {
        requestId: result.id,
        profileId,
        reason: autoApproval.decision === 'queued_for_review' ? autoApproval.reason : 'unknown',
      });
    }

    response.status(201).json({
      ok: true,
      request: result,
      autoApproved: false,
    });
  } catch (error) {
    response.status(409).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unable to submit request.',
    });
  }
});

/** Check if the user has a pending username request. */
usernameRequestRoutes.get(
  '/profiles/:profileId/username-requests/pending',
  async (request, response) => {
    const profileId = parseProfileIdParam(request.params.profileId);
    await ensureProfileWriteAccess(request, profileId);

    const pending = await getPendingRequestForProfile(profileId);
    response.json({
      hasPending: Boolean(pending),
      request: pending,
    });
  },
);

/** Admin: List all pending username requests. */
usernameRequestRoutes.get(
  '/admin/username-requests',
  ensureAdminApiKeyMatch,
  async (_request, response) => {
    const requests = await listPendingRequests(50);
    response.json({ items: requests, total: requests.length });
  },
);

/**
 * Admin: One-shot sweep of all pending username requests through the
 * auto-approval evaluator. Anything that passes the guardrails (no
 * profanity, no reserved name, not already taken, valid format) gets
 * auto-approved and the user's profile.displayName is set immediately.
 *
 * Safe to call repeatedly — idempotent. Useful right after deploy to
 * unblock legacy pending requests that piled up before auto-approval
 * shipped.
 */
usernameRequestRoutes.post(
  '/admin/username-requests/sweep',
  ensureAdminApiKeyMatch,
  async (request, response) => {
    const body = (request.body && typeof request.body === 'object' ? request.body : {}) as {
      maxToProcess?: unknown;
    };
    const maxToProcess =
      typeof body.maxToProcess === 'number' && body.maxToProcess > 0 && body.maxToProcess <= 1000
        ? body.maxToProcess
        : 200;

    try {
      const result = await sweepPendingUsernameRequests(maxToProcess);
      response.json(result);
    } catch (error) {
      logger.error('[usernameRequest] Sweep failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      response.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : 'Sweep failed.',
      });
    }
  },
);

/** Admin: Approve or reject a username request. */
usernameRequestRoutes.put(
  '/admin/username-requests/:requestId',
  ensureAdminApiKeyMatch,
  async (request, response) => {
    const requestId = Array.isArray(request.params.requestId)
      ? request.params.requestId[0]
      : request.params.requestId;
    const body = request.body as { decision?: unknown };
    const decision = body.decision;

    if (decision !== 'approved' && decision !== 'rejected') {
      response.status(422).json({
        ok: false,
        error: 'Decision must be "approved" or "rejected".',
      });
      return;
    }

    const result = await reviewUsernameRequest(requestId, decision);
    if (!result) {
      response.status(404).json({ ok: false, error: 'Request not found.' });
      return;
    }

    // If approved, update the profile display name.
    if (decision === 'approved') {
      const profile = await getProfile(result.profileId);
      await saveProfile({
        ...profile,
        displayName: result.requestedDisplayName,
        updatedAt: new Date().toISOString(),
      });
    }

    response.json({ ok: true, request: result });
  },
);
