import { createHash } from 'node:crypto';
import type { Request, RequestHandler } from 'express';
import { getBackendFirebaseDb } from '../firebase';
import { logger } from '../observability/logger';
import { recordAbuseSignal } from './abuseScoring';

/**
 * Per-User Rate Limiting
 *
 * Complements IP-based rate limiting by tracking request counts per
 * authenticated user. This prevents abuse from:
 * - A single user rotating IPs (VPN/proxy)
 * - Credential-stuffing through a compromised account
 * - Automated API abuse from a legitimate session
 *
 * Uses an in-memory sliding window with optional Firestore persistence
 * for sensitive write endpoints.
 */

type UserRateLimitOptions = {
  /** Bucket name for this limiter. */
  name: string;
  /** Time window in milliseconds. */
  windowMs: number;
  /** Maximum requests per user per window. */
  max: number;
  /** Whether to persist to Firestore for cross-instance consistency. */
  persistent?: boolean;
};

type UserBucket = {
  count: number;
  resetAt: number;
};

const USER_RATE_LIMIT_COLLECTION = 'ops_user_rate_limit_buckets';
const userBuckets = new Map<string, UserBucket>();
const MAX_MEMORY_BUCKETS = 4096;

function extractUid(request: Request): string | null {
  // Check for uid attached by recentAuthGuard or other middleware
  const reqWithUid = request as Request & { verifiedUid?: string };
  if (reqWithUid.verifiedUid) {
    return reqWithUid.verifiedUid;
  }

  // Fallback: try to extract from authorization header
  // (This doesn't verify the token — that should happen in auth middleware first)
  return null;
}

function hashUid(uid: string) {
  return createHash('sha256').update(uid, 'utf8').digest('hex').substring(0, 16);
}

function sweepExpiredBuckets(now: number) {
  for (const [key, bucket] of userBuckets.entries()) {
    if (bucket.resetAt <= now) {
      userBuckets.delete(key);
    }
  }
}

function consumeMemoryBucket(bucketKey: string, windowMs: number): UserBucket {
  const now = Date.now();
  if (userBuckets.size > MAX_MEMORY_BUCKETS) {
    sweepExpiredBuckets(now);
  }

  const current = userBuckets.get(bucketKey);
  if (!current || current.resetAt <= now) {
    const bucket: UserBucket = { count: 1, resetAt: now + windowMs };
    userBuckets.set(bucketKey, bucket);
    return bucket;
  }

  current.count += 1;
  return current;
}

async function consumePersistentBucket(
  bucketKey: string,
  windowMs: number,
): Promise<UserBucket | null> {
  const db = getBackendFirebaseDb();
  if (!db) {
    return null;
  }

  const now = Date.now();
  const docId = createHash('sha256').update(bucketKey, 'utf8').digest('hex');
  const bucketRef = db.collection(USER_RATE_LIMIT_COLLECTION).doc(docId);

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(bucketRef);
    const existing = snapshot.exists ? (snapshot.data() as Partial<UserBucket>) : null;
    const existingResetAt =
      typeof existing?.resetAt === 'number' && Number.isFinite(existing.resetAt)
        ? existing.resetAt
        : 0;
    const existingCount =
      typeof existing?.count === 'number' && Number.isFinite(existing.count)
        ? Math.max(0, Math.floor(existing.count))
        : 0;

    const resetAt = existingResetAt > now ? existingResetAt : now + windowMs;
    const count = existingResetAt > now ? existingCount + 1 : 1;

    transaction.set(bucketRef, { count, resetAt }, { merge: true });
    return { count, resetAt };
  });
}

export function createUserRateLimitMiddleware(options: UserRateLimitOptions): RequestHandler {
  const { name, windowMs, max, persistent } = options;

  return async (request, response, next) => {
    if (request.method === 'OPTIONS') {
      next();
      return;
    }

    const uid = extractUid(request);
    if (!uid) {
      // No authenticated user — fall through to IP-based rate limiting
      next();
      return;
    }

    try {
      const bucketKey = `user:${name}:${hashUid(uid)}`;
      let bucket: UserBucket;

      if (persistent) {
        try {
          const persistentResult = await consumePersistentBucket(bucketKey, windowMs);
          bucket = persistentResult ?? consumeMemoryBucket(bucketKey, windowMs);
        } catch (error) {
          logger.warn(`[userRateLimit] persistent bucket failed for "${name}", using memory`, {
            error: error instanceof Error ? error.message : String(error),
          });
          bucket = consumeMemoryBucket(bucketKey, windowMs);
        }
      } else {
        bucket = consumeMemoryBucket(bucketKey, windowMs);
      }

      const now = Date.now();
      const remaining = Math.max(0, max - bucket.count);
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

      response.setHeader('X-UserRateLimit-Limit', String(max));
      response.setHeader('X-UserRateLimit-Remaining', String(remaining));

      if (bucket.count > max) {
        const jitter = Math.floor(Math.random() * Math.min(5, retryAfterSeconds));
        response.setHeader('Retry-After', String(retryAfterSeconds + jitter));

        const ip = request.ip || request.socket.remoteAddress || 'unknown';
        recordAbuseSignal(ip, 3, request.originalUrl);

        response.status(429).json({
          ok: false,
          error: 'Too many requests for this account. Please slow down.',
          code: 'user_rate_limited',
        });
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function clearUserRateLimitState() {
  userBuckets.clear();
}
