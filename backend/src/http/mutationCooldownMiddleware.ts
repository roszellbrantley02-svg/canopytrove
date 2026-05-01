/**
 * Mutation Cooldown Middleware — gate for newly-approved owners.
 *
 * Apply to any owner-portal mutation endpoint. The middleware classifies
 * each request as one of:
 *
 *   - 'paid'    — bypass cooldown entirely (subscriptions, paid promotions,
 *                 review replies). The user spec says paid features must
 *                 publish instantly; holding them is wrong even for
 *                 brand-new accounts.
 *   - 'free'    — gate behind 24h cooldown after claim approval. If the
 *                 owner is in cooldown, queue the mutation in
 *                 pendingOwnerMutations and respond 202 instead of
 *                 executing the route handler.
 *   - 'exempt'  — onboarding/identity flows that aren't workspace edits.
 *                 Always pass through (otherwise the owner couldn't
 *                 complete their own approval).
 *
 * Usage:
 *   router.post(
 *     '/owner-portal/profile-tools',
 *     withMutationCooldown('free', { summary: 'Update profile tools' }),
 *     async (req, res) => { ... }
 *   );
 *
 *   // Register the replay handler at module load so admin "release"
 *   // can re-execute the queued mutation later.
 *   registerCooldownReplay('POST:/owner-portal/profile-tools',
 *     async (ownerUid, body) => {
 *       await applyOwnerProfileToolsUpdate(ownerUid, body);
 *     });
 */

import type { NextFunction, Request, Response } from 'express';
import { logger } from '../observability/logger';
import { resolveVerifiedRequestAccountId } from '../services/profileAccessService';
import {
  getOwnerCooldownStatus,
  queuePendingMutation,
} from '../services/ownerMutationCooldownService';

export type MutationCooldownTag = 'paid' | 'free' | 'exempt';

export type MutationCooldownOptions = {
  /** Short human-readable description of what this mutation does, shown
   * to admin reviewers in the queue UI. */
  summary?: string;
};

/**
 * Express middleware factory that gates a mutation behind the cooldown
 * check. Pass-through for paid + exempt. For free, queues the request
 * if the owner is in their first 24h post-approval window.
 *
 * On queue, responds with HTTP 202:
 *   {
 *     ok: true,
 *     queued: true,
 *     pendingMutationId: string,
 *     cooldownEndsAt: ISO string,
 *     message: "Your edit is queued for admin review and will publish within 24 hours."
 *   }
 *
 * The route handler does NOT run when the mutation is queued. Frontend
 * should treat 202 + queued: true as "your change is saved as pending"
 * and reflect that in the UI (e.g. show a "queued" badge on the field
 * the owner just edited).
 */
export function withMutationCooldown(
  tag: MutationCooldownTag,
  options: MutationCooldownOptions = {},
) {
  return async function mutationCooldownMiddleware(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    // Paid + exempt always pass through. No work to do.
    if (tag !== 'free') {
      next();
      return;
    }

    let ownerUid: string | null = null;
    try {
      ownerUid = await resolveVerifiedRequestAccountId(request);
    } catch (error) {
      // Auth resolution failed — let the route handler deal with it.
      // Cooldown isn't an auth gate; it sits on top of an authenticated
      // request and assumes the route below it will reject unauth.
      next();
      return;
    }

    if (!ownerUid) {
      next();
      return;
    }

    const status = await getOwnerCooldownStatus(ownerUid);
    if (!status.inCooldown) {
      next();
      return;
    }

    // Owner is in cooldown. Queue the mutation and respond 202.
    const body = (typeof request.body === 'object' && request.body ? request.body : {}) as Record<
      string,
      unknown
    >;
    const contentType = request.get('content-type') ?? null;

    try {
      const { id } = await queuePendingMutation({
        ownerUid,
        dispensaryId: status.dispensaryId,
        endpoint: request.originalUrl,
        method: request.method,
        body,
        contentType,
        summary: options.summary ?? null,
      });

      logger.info('[mutationCooldown] Mutation queued for new owner', {
        ownerUid,
        endpoint: request.originalUrl,
        method: request.method,
        mutationId: id,
        cooldownEndsAt: status.cooldownEndsAt,
      });

      response.status(202).json({
        ok: true,
        queued: true,
        pendingMutationId: id,
        cooldownEndsAt: status.cooldownEndsAt,
        message:
          'Your edit is queued for admin review and will publish within 24 hours of your account approval.',
      });
    } catch (error) {
      // Queue write failed — fail-open and let the mutation proceed
      // rather than locking the owner out of their own workspace.
      logger.error('[mutationCooldown] Queue write failed — falling through to handler', {
        ownerUid,
        endpoint: request.originalUrl,
        error: error instanceof Error ? error.message : String(error),
      });
      next();
    }
  };
}
