/**
 * Owner Mutation Cooldown — anti-vandalism queue for newly-approved owners.
 *
 * For the first 24 hours after a claim is approved, FREE workspace
 * mutations (hours edits, profile changes, brand roster updates, photo
 * uploads, etc.) are intercepted and queued in `pendingOwnerMutations`
 * instead of being applied immediately. An admin reviews the queue
 * (typically once a day) and either releases or rejects each entry.
 *
 * PAID mutations (subscription activations, paid promotions, review
 * replies) bypass the cooldown entirely — if a hijacker is willing to
 * burn money to sneak edits through, that's a payment trail you can
 * claw back through Stripe, plus it's a strong signal it's a real
 * owner. Either way, paid stuff publishes instantly.
 *
 * Threat model: even if a bad actor somehow defeats the shop-phone OTP
 * and the alert call, they cannot deface a listing publicly because
 * everything they edit sits in the holding queue. The legitimate owner
 * gets the alert call within 60 sec and you see the queued attempt in
 * the admin digest the next morning.
 *
 * Why this is asymmetric (favors legit owners over bad actors):
 *   - Legit owner: doesn't notice. Most owners don't change settings
 *     the same day they claim. Within 24h, queue auto-clears and
 *     mutations go live in real time.
 *   - Bad actor: every public edit is gated by admin review for the
 *     first 24h. Vandalism is impossible during the window when the
 *     legit owner is most likely to spot the hijack and email support.
 *
 * Replay registry: each queued mutation type registers a replay handler
 * at module load. When admin releases a queued entry, we look up the
 * handler and re-execute the mutation with the original body. This
 * keeps the cooldown service decoupled from the per-endpoint logic.
 */

import { getBackendFirebaseDb } from '../firebase';
import { logger } from '../observability/logger';

const DISPENSARY_CLAIMS_COLLECTION = 'dispensaryClaims';
const PENDING_OWNER_MUTATIONS_COLLECTION = 'pendingOwnerMutations';

const COOLDOWN_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export type CooldownStatus = {
  /** True if owner is within the 24h window after claim approval. */
  inCooldown: boolean;
  /** When the cooldown ends (ISO string), or null if not in cooldown. */
  cooldownEndsAt: string | null;
  /** Most recently approved dispensary id for this owner, or null. */
  dispensaryId: string | null;
  /** When the claim was approved (ISO string), or null. */
  approvedAt: string | null;
};

export type PendingMutationStatus = 'pending' | 'released' | 'rejected';

export type PendingMutationDocument = {
  ownerUid: string;
  dispensaryId: string | null;
  endpoint: string;
  method: string;
  body: Record<string, unknown>;
  contentType: string | null;
  queuedAt: string;
  status: PendingMutationStatus;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewerNotes: string | null;
  /** Optional human-readable description supplied by the route. */
  summary: string | null;
};

/**
 * Replay handler signature. Each route that integrates with the cooldown
 * queue registers one of these — it's what the admin "release" endpoint
 * calls to re-execute the originally-queued mutation against the live
 * data store.
 */
export type CooldownReplayHandler = (
  ownerUid: string,
  body: Record<string, unknown>,
) => Promise<void>;

const replayRegistry = new Map<string, CooldownReplayHandler>();

/**
 * Register a replay handler for a particular endpoint key. Endpoint key
 * should match the path pattern the middleware records (e.g.
 * "POST:/owner-portal/profile-tools").
 *
 * Call this at module load — once per endpoint. Re-registering overwrites
 * the previous handler, which is intentional (hot-reload friendly).
 */
export function registerCooldownReplay(endpointKey: string, handler: CooldownReplayHandler): void {
  replayRegistry.set(endpointKey, handler);
}

export function getReplayHandler(endpointKey: string): CooldownReplayHandler | undefined {
  return replayRegistry.get(endpointKey);
}

/**
 * Compute the cooldown status for an owner. Looks up their most-recent
 * approved claim and checks whether `reviewedAt` falls within the
 * cooldown window.
 *
 * Returns inCooldown=false if:
 *   - DB unavailable
 *   - Owner has no approved claims (still in onboarding)
 *   - Most recent claim was approved more than 24h ago
 */
export async function getOwnerCooldownStatus(ownerUid: string): Promise<CooldownStatus> {
  const db = getBackendFirebaseDb();
  if (!db) {
    return { inCooldown: false, cooldownEndsAt: null, dispensaryId: null, approvedAt: null };
  }

  try {
    const snap = await db
      .collection(DISPENSARY_CLAIMS_COLLECTION)
      .where('ownerUid', '==', ownerUid)
      .where('claimStatus', '==', 'approved')
      .get();

    if (snap.empty) {
      return { inCooldown: false, cooldownEndsAt: null, dispensaryId: null, approvedAt: null };
    }

    // If the owner has multiple approved claims (multi-location operator),
    // use the MOST RECENT approval as the cooldown anchor. Once they've
    // been approved for one shop and 24h has passed without incident,
    // adding a second shop shouldn't re-trigger the cooldown.
    type ApprovedClaim = { dispensaryId: string; reviewedAt: string };
    let latestApproved: ApprovedClaim | null = null;
    for (const doc of snap.docs) {
      const data = doc.data() as {
        dispensaryId?: string;
        reviewedAt?: string | null;
      };
      const reviewedAt = typeof data.reviewedAt === 'string' ? data.reviewedAt : null;
      const dispensaryId = typeof data.dispensaryId === 'string' ? data.dispensaryId : null;
      if (!reviewedAt || !dispensaryId) continue;
      const candidate: ApprovedClaim = { dispensaryId, reviewedAt };
      if (latestApproved === null || reviewedAt > latestApproved.reviewedAt) {
        latestApproved = candidate;
      }
    }

    if (latestApproved === null) {
      return { inCooldown: false, cooldownEndsAt: null, dispensaryId: null, approvedAt: null };
    }

    const winner: ApprovedClaim = latestApproved;
    const approvedMs = new Date(winner.reviewedAt).getTime();
    if (!Number.isFinite(approvedMs)) {
      return { inCooldown: false, cooldownEndsAt: null, dispensaryId: null, approvedAt: null };
    }

    const cooldownEndsMs = approvedMs + COOLDOWN_DURATION_MS;
    const inCooldown = Date.now() < cooldownEndsMs;
    return {
      inCooldown,
      cooldownEndsAt: inCooldown ? new Date(cooldownEndsMs).toISOString() : null,
      dispensaryId: winner.dispensaryId,
      approvedAt: winner.reviewedAt,
    };
  } catch (error) {
    // Cooldown is a defense-in-depth signal, NOT a hard gate. If the DB
    // query fails, fail-open (let the mutation proceed) so a Firestore
    // hiccup doesn't lock all new owners out of their own workspace.
    logger.warn('[ownerMutationCooldown] Failed to compute cooldown status — failing open', {
      ownerUid,
      error: error instanceof Error ? error.message : String(error),
    });
    return { inCooldown: false, cooldownEndsAt: null, dispensaryId: null, approvedAt: null };
  }
}

/**
 * Persist a queued mutation to Firestore. Returns the new doc id so the
 * middleware can include it in the 202 response (frontend can poll for
 * status / show "queued for review" UI).
 */
export async function queuePendingMutation(input: {
  ownerUid: string;
  dispensaryId: string | null;
  endpoint: string;
  method: string;
  body: Record<string, unknown>;
  contentType: string | null;
  summary: string | null;
}): Promise<{ id: string; doc: PendingMutationDocument }> {
  const db = getBackendFirebaseDb();
  if (!db) {
    throw new Error('Backend database is unavailable.');
  }

  const now = new Date().toISOString();
  const doc: PendingMutationDocument = {
    ownerUid: input.ownerUid,
    dispensaryId: input.dispensaryId,
    endpoint: input.endpoint,
    method: input.method,
    body: input.body,
    contentType: input.contentType,
    queuedAt: now,
    status: 'pending',
    reviewedAt: null,
    reviewedBy: null,
    reviewerNotes: null,
    summary: input.summary,
  };

  const ref = await db.collection(PENDING_OWNER_MUTATIONS_COLLECTION).add(doc);
  return { id: ref.id, doc };
}

/**
 * List pending mutations for admin review. Returns the most recent first.
 * Optional ownerUid filter scopes to a specific owner.
 */
export async function listPendingMutations(filters?: {
  ownerUid?: string;
  status?: PendingMutationStatus;
  limit?: number;
}): Promise<Array<{ id: string; doc: PendingMutationDocument }>> {
  const db = getBackendFirebaseDb();
  if (!db) return [];

  let query = db
    .collection(PENDING_OWNER_MUTATIONS_COLLECTION)
    .orderBy('queuedAt', 'desc') as FirebaseFirestore.Query;
  if (filters?.ownerUid) {
    query = query.where('ownerUid', '==', filters.ownerUid);
  }
  if (filters?.status) {
    query = query.where('status', '==', filters.status);
  }
  query = query.limit(filters?.limit ?? 100);

  const snap = await query.get();
  return snap.docs.map((doc) => ({ id: doc.id, doc: doc.data() as PendingMutationDocument }));
}

export type ReleaseMutationResult =
  | { ok: true; status: 'released'; replayed: boolean; replayError: string | null }
  | { ok: false; reason: 'not_found' | 'not_pending' | 'no_replay_handler' | 'db_unavailable' };

/**
 * Admin release: re-execute the queued mutation and mark the doc
 * 'released'. Replay errors don't undo the status update — the admin
 * still made the decision; we just log the failure for follow-up.
 */
export async function releasePendingMutation(input: {
  mutationId: string;
  reviewerUid: string;
  reviewerNotes?: string;
}): Promise<ReleaseMutationResult> {
  const db = getBackendFirebaseDb();
  if (!db) return { ok: false, reason: 'db_unavailable' };

  const ref = db.collection(PENDING_OWNER_MUTATIONS_COLLECTION).doc(input.mutationId);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, reason: 'not_found' };

  const data = snap.data() as PendingMutationDocument;
  if (data.status !== 'pending') return { ok: false, reason: 'not_pending' };

  const endpointKey = `${data.method.toUpperCase()}:${data.endpoint}`;
  const handler = getReplayHandler(endpointKey);
  if (!handler) {
    logger.error('[ownerMutationCooldown] No replay handler for queued mutation', {
      mutationId: input.mutationId,
      endpointKey,
    });
    return { ok: false, reason: 'no_replay_handler' };
  }

  let replayError: string | null = null;
  try {
    await handler(data.ownerUid, data.body);
  } catch (error) {
    replayError = error instanceof Error ? error.message : String(error);
    logger.error('[ownerMutationCooldown] Replay handler threw — marking released anyway', {
      mutationId: input.mutationId,
      endpointKey,
      error: replayError,
    });
  }

  const now = new Date().toISOString();
  await ref.set(
    {
      status: 'released',
      reviewedAt: now,
      reviewedBy: input.reviewerUid,
      reviewerNotes: input.reviewerNotes ?? null,
    },
    { merge: true },
  );

  return { ok: true, status: 'released', replayed: replayError === null, replayError };
}

export type RejectMutationResult =
  | { ok: true; status: 'rejected' }
  | { ok: false; reason: 'not_found' | 'not_pending' | 'db_unavailable' };

/**
 * Admin reject: mark the doc 'rejected', do not replay. Used when admin
 * suspects the mutation is hijacker activity or otherwise shouldn't go
 * live.
 */
export async function rejectPendingMutation(input: {
  mutationId: string;
  reviewerUid: string;
  reviewerNotes?: string;
}): Promise<RejectMutationResult> {
  const db = getBackendFirebaseDb();
  if (!db) return { ok: false, reason: 'db_unavailable' };

  const ref = db.collection(PENDING_OWNER_MUTATIONS_COLLECTION).doc(input.mutationId);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, reason: 'not_found' };

  const data = snap.data() as PendingMutationDocument;
  if (data.status !== 'pending') return { ok: false, reason: 'not_pending' };

  const now = new Date().toISOString();
  await ref.set(
    {
      status: 'rejected',
      reviewedAt: now,
      reviewedBy: input.reviewerUid,
      reviewerNotes: input.reviewerNotes ?? null,
    },
    { merge: true },
  );

  return { ok: true, status: 'rejected' };
}
