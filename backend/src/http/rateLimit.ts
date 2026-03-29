import { Request, RequestHandler } from 'express';

type RateLimitOptions = {
  name: string;
  windowMs: number;
  max: number;
  methods?: string[];
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const rateLimitBuckets = new Map<string, RateLimitBucket>();

function getClientIp(request: Request) {
  const forwardedFor = request.header('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  return request.ip || request.socket.remoteAddress || 'unknown';
}

function getBucketKey(request: Request, name: string) {
  return `${name}:${getClientIp(request)}`;
}

function shouldApplyToMethod(method: string, allowedMethods?: string[]) {
  if (!allowedMethods?.length) {
    return true;
  }

  return allowedMethods.includes(method.toUpperCase());
}

function sweepExpiredBuckets(now: number) {
  for (const [key, bucket] of rateLimitBuckets.entries()) {
    if (bucket.resetAt <= now) {
      rateLimitBuckets.delete(key);
    }
  }
}

export function createRateLimitMiddleware(options: RateLimitOptions): RequestHandler {
  const { max, methods, name, windowMs } = options;

  return (request, response, next) => {
    if (request.method === 'OPTIONS' || !shouldApplyToMethod(request.method, methods)) {
      next();
      return;
    }

    const now = Date.now();
    if (rateLimitBuckets.size > 2048) {
      sweepExpiredBuckets(now);
    }

    const bucketKey = getBucketKey(request, name);
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

    const remaining = Math.max(0, max - bucket.count);
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

    response.setHeader('X-RateLimit-Limit', String(max));
    response.setHeader('X-RateLimit-Remaining', String(remaining));
    response.setHeader('X-RateLimit-Reset', String(retryAfterSeconds));

    if (bucket.count > max) {
      response.setHeader('Retry-After', String(retryAfterSeconds));
      response.status(429).json({
        error: 'Too many requests. Please retry shortly.',
      });
      return;
    }

    next();
  };
}

export function clearRateLimitState() {
  rateLimitBuckets.clear();
}
