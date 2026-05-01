/**
 * Admin endpoints for the owner-mutation cooldown queue.
 *
 *   GET    /admin/owner-mutations/pending  → list queued mutations
 *   POST   /admin/owner-mutations/:id/release → re-execute the mutation
 *   POST   /admin/owner-mutations/:id/reject  → mark rejected, no replay
 *
 * All endpoints inherit the admin api-key gate from adminRoutes.
 */

import { Router } from 'express';
import { logger } from '../observability/logger';
import {
  listPendingMutations,
  rejectPendingMutation,
  releasePendingMutation,
  type PendingMutationStatus,
} from '../services/ownerMutationCooldownService';

export const adminOwnerMutationCooldownRoutes = Router();

function parseLimit(value: unknown, fallback = 50): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(200, Math.floor(parsed));
}

function parseStatus(value: unknown): PendingMutationStatus | undefined {
  if (value === 'pending' || value === 'released' || value === 'rejected') return value;
  return undefined;
}

adminOwnerMutationCooldownRoutes.get(
  '/admin/owner-mutations/pending',
  async (request, response) => {
    try {
      const ownerUid =
        typeof request.query.ownerUid === 'string' ? request.query.ownerUid : undefined;
      const status = parseStatus(request.query.status) ?? 'pending';
      const limit = parseLimit(request.query.limit);

      const items = await listPendingMutations({ ownerUid, status, limit });
      response.json({
        ok: true,
        count: items.length,
        items,
      });
    } catch (error) {
      logger.error('[adminOwnerMutationCooldown] list failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      response.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to list pending mutations.',
      });
    }
  },
);

adminOwnerMutationCooldownRoutes.post(
  '/admin/owner-mutations/:id/release',
  async (request, response) => {
    try {
      const mutationId = request.params.id;
      const body = (typeof request.body === 'object' && request.body ? request.body : {}) as Record<
        string,
        unknown
      >;
      const reviewerUid = typeof body.reviewerUid === 'string' ? body.reviewerUid.trim() : 'admin';
      const reviewerNotes =
        typeof body.reviewerNotes === 'string' ? body.reviewerNotes.trim() : undefined;

      const result = await releasePendingMutation({
        mutationId,
        reviewerUid,
        reviewerNotes,
      });

      if (!result.ok) {
        const statusCode =
          result.reason === 'not_found'
            ? 404
            : result.reason === 'not_pending'
              ? 409
              : result.reason === 'no_replay_handler'
                ? 422
                : 503;
        response.status(statusCode).json({ ok: false, reason: result.reason });
        return;
      }

      response.json({
        ok: true,
        status: result.status,
        replayed: result.replayed,
        replayError: result.replayError,
      });
    } catch (error) {
      logger.error('[adminOwnerMutationCooldown] release failed', {
        mutationId: request.params.id,
        error: error instanceof Error ? error.message : String(error),
      });
      response.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to release mutation.',
      });
    }
  },
);

adminOwnerMutationCooldownRoutes.post(
  '/admin/owner-mutations/:id/reject',
  async (request, response) => {
    try {
      const mutationId = request.params.id;
      const body = (typeof request.body === 'object' && request.body ? request.body : {}) as Record<
        string,
        unknown
      >;
      const reviewerUid = typeof body.reviewerUid === 'string' ? body.reviewerUid.trim() : 'admin';
      const reviewerNotes =
        typeof body.reviewerNotes === 'string' ? body.reviewerNotes.trim() : undefined;

      const result = await rejectPendingMutation({
        mutationId,
        reviewerUid,
        reviewerNotes,
      });

      if (!result.ok) {
        const statusCode =
          result.reason === 'not_found' ? 404 : result.reason === 'not_pending' ? 409 : 503;
        response.status(statusCode).json({ ok: false, reason: result.reason });
        return;
      }

      response.json({ ok: true, status: result.status });
    } catch (error) {
      logger.error('[adminOwnerMutationCooldown] reject failed', {
        mutationId: request.params.id,
        error: error instanceof Error ? error.message : String(error),
      });
      response.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to reject mutation.',
      });
    }
  },
);
