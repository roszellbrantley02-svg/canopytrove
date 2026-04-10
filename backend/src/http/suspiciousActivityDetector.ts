import type { Request } from 'express';
import { RequestHandler } from 'express';
import { logSecurityEvent } from './securityEventLogger';
import { recordAbuseSignal } from './abuseScoring';
import { logger } from '../observability/logger';
import { getBackendFirebaseDb } from '../firebase';

/**
 * Distributed abuse protection backed by Firestore.
 *
 * Tracks failed authentication attempts and temporarily blocks IPs that
 * exceed the threshold. State is stored in Firestore so it persists across
 * Cloud Run instance restarts and propagates across all instances.
 *
 * Collection: `ops_auth_abuse` (one document per IP)
 * Document shape:
 *   {
 *     attempts: number[]    — timestamps of recent failed attempts
 *     blockedUntil: number  — epoch ms when the block expires (0 = not blocked)
 *     updatedAt: number     — last write timestamp
 *   }
 *
 * Documents with no recent activity are automatically pruned by a TTL check
 * on read. Firestore TTL policies can also be configured for belt-and-suspenders.
 */

const AUTH_ABUSE_COLLECTION = 'ops_auth_abuse';

// Configuration
const MAX_FAILED_ATTEMPTS = 10;
const WINDOW_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const BLOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutes

// ── In-memory fallback for when Firestore is unavailable ────────────────────
const memoryFailedAttempts = new Map<string, number[]>();
const memoryBlockedIps = new Map<string, number>();

type AbuseDoc = {
  attempts: number[];
  blockedUntil: number;
  updatedAt: number;
};

/**
 * Get client IP from request
 */
function getClientIp(request: Request): string {
  return request.ip || request.socket.remoteAddress || 'unknown';
}

/**
 * Sanitize an IP string into a safe Firestore document ID.
 * IPv6 and mapped addresses may contain colons and dots.
 */
function ipToDocId(ip: string): string {
  return ip.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Check if an IP is temporarily blocked.
 * Reads from Firestore first, falls back to in-memory.
 */
async function isIpBlocked(ip: string): Promise<boolean> {
  const db = getBackendFirebaseDb();
  if (db) {
    try {
      const docRef = db.collection(AUTH_ABUSE_COLLECTION).doc(ipToDocId(ip));
      const snap = await docRef.get();
      if (!snap.exists) return false;

      const data = snap.data() as AbuseDoc | undefined;
      if (!data) return false;

      const now = Date.now();
      if (data.blockedUntil > now) {
        return true;
      }

      // Block expired — clear it in the background
      if (data.blockedUntil > 0) {
        void docRef.update({ blockedUntil: 0, updatedAt: now });
      }

      return false;
    } catch {
      // Firestore unavailable — fall through to in-memory
    }
  }

  // In-memory fallback
  const blockExpiry = memoryBlockedIps.get(ip);
  if (!blockExpiry) return false;

  if (blockExpiry <= Date.now()) {
    memoryBlockedIps.delete(ip);
    return false;
  }

  return true;
}

/**
 * Record a failed authentication attempt for an IP.
 * Returns true if the IP should be temporarily blocked.
 */
export async function recordFailedAuth(ip: string): Promise<boolean> {
  const now = Date.now();
  const cutoff = now - WINDOW_DURATION_MS;

  // Log and score regardless of storage backend
  logSecurityEvent({
    event: 'auth_failure',
    ip,
    path: 'auth',
    method: 'POST',
    detail: `Failed auth attempt within window`,
    meta: {},
  });
  recordAbuseSignal(ip, 3, 'auth');

  const db = getBackendFirebaseDb();
  if (db) {
    try {
      const docRef = db.collection(AUTH_ABUSE_COLLECTION).doc(ipToDocId(ip));
      const snap = await docRef.get();
      const existing = snap.exists ? (snap.data() as AbuseDoc) : null;

      let attempts = existing?.attempts?.filter((t) => t > cutoff) ?? [];
      attempts.push(now);

      const shouldBlock = attempts.length > MAX_FAILED_ATTEMPTS;
      const blockedUntil = shouldBlock ? now + BLOCK_DURATION_MS : (existing?.blockedUntil ?? 0);

      await docRef.set(
        {
          attempts,
          blockedUntil,
          updatedAt: now,
        },
        { merge: true },
      );

      if (shouldBlock) {
        logSecurityEvent({
          event: 'ip_blocked',
          ip,
          path: 'auth',
          method: 'POST',
          detail: `IP blocked after ${attempts.length} failed attempts`,
          meta: { attemptCount: attempts.length },
        });
      }

      return shouldBlock;
    } catch {
      // Firestore unavailable — fall through to in-memory
    }
  }

  // In-memory fallback
  let attempts = memoryFailedAttempts.get(ip) || [];
  attempts = attempts.filter((t) => t > cutoff);
  attempts.push(now);
  memoryFailedAttempts.set(ip, attempts);

  if (attempts.length > MAX_FAILED_ATTEMPTS) {
    memoryBlockedIps.set(ip, now + BLOCK_DURATION_MS);
    return true;
  }

  return false;
}

/**
 * Middleware that blocks requests from temporarily blocked IPs.
 */
export const suspiciousActivityMiddleware: RequestHandler = (request, response, next) => {
  const clientIp = getClientIp(request);

  void isIpBlocked(clientIp)
    .catch((e) => {
      logger.error('[suspiciousActivity] isIpBlocked check failed', {
        error: e instanceof Error ? e.message : String(e),
      });
      return false;
    })
    .then((blocked) => {
      if (blocked) {
        logSecurityEvent({
          event: 'ip_blocked',
          ip: clientIp,
          path: request.originalUrl,
          method: request.method,
          detail: 'IP temporarily blocked due to repeated auth failures',
        });

        response.status(429).json({
          error: 'Too many failed authentication attempts. Please try again later.',
        });
        return;
      }

      next();
    });
};

/**
 * Clear suspicious activity state (for testing)
 */
export function clearSuspiciousActivityStateForTests(): void {
  memoryFailedAttempts.clear();
  memoryBlockedIps.clear();
}
