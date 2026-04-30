import { createHash } from 'node:crypto';
import { Request, RequestHandler, Response } from 'express';
import { serverConfig } from '../config';
import { getBackendFirebaseDb } from '../firebase';
import { logger } from '../observability/logger';
import { recordAbuseSignal } from './abuseScoring';

type RateLimitOptions = {
  name: string;
  windowMs: number;
  max: number;
  methods?: string[];
  persistent?: boolean;
  abuseSignalPoints?: number;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const rateLimitBuckets = new Map<string, RateLimitBucket>();
const RATE_LIMIT_COLLECTION = 'ops_rate_limit_buckets';
const MAX_MEMORY_BUCKETS = parseInt(process.env.RATE_LIMIT_MAX_BUCKETS || '2048', 10);

function getClientIp(request: Request) {
  return request.ip || request.socket.remoteAddress || 'unknown';
}

function hashClientIp(ip: string) {
  const pepper = serverConfig.rateLimitPepper ?? 'canopytrove-dev-pepper';
  const hash = createHash('sha256')
    .update(ip + pepper, 'utf8')
    .digest('hex');
  return hash.substring(0, 16);
}

function getBucketKey(request: Request, name: string) {
  const hashedIp = hashClientIp(getClientIp(request));
  return `${name}:${hashedIp}`;
}

function shouldApplyToMethod(method: string, allowedMethods?: string[]) {
  if (!allowedMethods?.length) {
    return true;
  }

  return allowedMethods.includes(method.toUpperCase());
}

function sweepExpiredBuckets(now: number) {
  const keysToDelete: string[] = [];
  for (const [key, bucket] of rateLimitBuckets.entries()) {
    if (bucket.resetAt <= now) {
      keysToDelete.push(key);
    }
  }
  // Delete in separate pass to avoid modifying Map during iteration
  for (const key of keysToDelete) {
    rateLimitBuckets.delete(key);
  }
}

function shouldUsePersistentBuckets(options: RateLimitOptions) {
  if (typeof options.persistent === 'boolean') {
    return options.persistent;
  }

  // In test/mock environments, always use memory buckets so
  // clearRateLimitState() can reliably reset state between tests.
  if (process.env.NODE_ENV === 'test' || process.env.STOREFRONT_BACKEND_SOURCE === 'mock') {
    return false;
  }

  if (!options.methods?.length) {
    return true;
  }

  return options.methods.some((method) => method.toUpperCase() !== 'GET');
}

function hashBucketKey(bucketKey: string) {
  return createHash('sha256').update(bucketKey, 'utf8').digest('hex');
}

async function consumePersistentBucket(bucketKey: string, windowMs: number) {
  const db = getBackendFirebaseDb();
  if (!db) {
    return null;
  }

  const now = Date.now();
  const bucketRef = db.collection(RATE_LIMIT_COLLECTION).doc(hashBucketKey(bucketKey));

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(bucketRef);
    const existing = snapshot.exists ? (snapshot.data() as Partial<RateLimitBucket>) : null;
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

    transaction.set(
      bucketRef,
      {
        count,
        resetAt,
      },
      { merge: true },
    );

    return {
      count,
      resetAt,
    } satisfies RateLimitBucket;
  });
}

let lastCapacityWarningAt = 0;
const CAPACITY_WARNING_INTERVAL_MS = 60_000;

function consumeMemoryBucket(bucketKey: string, windowMs: number) {
  const now = Date.now();
  if (rateLimitBuckets.size > MAX_MEMORY_BUCKETS) {
    sweepExpiredBuckets(now);
  }

  // Log warning at most once per minute when memory buckets are near
  // capacity. Without throttling this fires on every bucket-touching
  // request once we cross 80%, drowning Cloud Logging at the worst
  // possible moment.
  const bucketCapacityPercent = (rateLimitBuckets.size / MAX_MEMORY_BUCKETS) * 100;
  if (bucketCapacityPercent >= 80 && now - lastCapacityWarningAt >= CAPACITY_WARNING_INTERVAL_MS) {
    lastCapacityWarningAt = now;
    logger.warn(`Rate limit memory buckets at ${bucketCapacityPercent.toFixed(1)}% capacity`, {
      current: rateLimitBuckets.size,
      max: MAX_MEMORY_BUCKETS,
    });
  }

  const currentBucket = rateLimitBuckets.get(bucketKey);

  let bucket = currentBucket;
  if (!bucket || bucket.resetAt <= now) {
    bucket = {
      count: 0,
      resetAt: now + windowMs,
    };
    rateLimitBuckets.set(bucketKey, bucket);
  }

  bucket.count += 1;
  return bucket;
}

export function createRateLimitMiddleware(options: RateLimitOptions): RequestHandler {
  const { abuseSignalPoints = 2, max, methods, name, windowMs } = options;
  const persistent = shouldUsePersistentBuckets(options);

  return async (request, response, next) => {
    if (request.method === 'OPTIONS' || !shouldApplyToMethod(request.method, methods)) {
      next();
      return;
    }

    try {
      const bucketKey = getBucketKey(request, name);
      let bucket: RateLimitBucket;

      if (persistent) {
        try {
          const persistentResult = await consumePersistentBucket(bucketKey, windowMs);
          bucket = persistentResult ?? consumeMemoryBucket(bucketKey, windowMs);
        } catch (persistentError) {
          logger.warn(
            `[rateLimit] persistent bucket failed for "${name}", falling back to memory`,
            {
              error:
                persistentError instanceof Error
                  ? persistentError.message
                  : String(persistentError),
            },
          );
          bucket = consumeMemoryBucket(bucketKey, windowMs);
        }
      } else {
        bucket = consumeMemoryBucket(bucketKey, windowMs);
      }

      const now = Date.now();
      const remaining = Math.max(0, max - bucket.count);
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

      response.setHeader('X-RateLimit-Limit', String(max));
      response.setHeader('X-RateLimit-Remaining', String(remaining));
      response.setHeader('X-RateLimit-Reset', String(retryAfterSeconds));

      if (bucket.count > max) {
        const jitter = Math.floor(Math.random() * Math.min(5, retryAfterSeconds));
        response.setHeader('Retry-After', String(retryAfterSeconds + jitter));

        if (abuseSignalPoints > 0) {
          const ip = getClientIp(request);
          recordAbuseSignal(ip, abuseSignalPoints, request.originalUrl);
        }

        const payload = {
          error: 'Too many requests. Please retry shortly.',
        };

        if (
          typeof (response as Response).status === 'function' &&
          typeof (response as Response).json === 'function'
        ) {
          (response as Response).status(429).json(payload);
          return;
        }

        response.statusCode = 429;
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify(payload));
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function clearRateLimitState() {
  rateLimitBuckets.clear();
}
