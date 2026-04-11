import { Request } from 'express';
import { logSecurityEvent } from './securityEventLogger';
import { recordAbuseSignal } from './abuseScoring';

/**
 * BOLA failure tracker per IP address.
 * Stores { failureCount, lastFailureTime } for each IP.
 * Cleaned up periodically to prevent memory leaks.
 */
const bolaFailuresByIp = new Map<string, { count: number; resetTime: number }>();

const BOLA_ALERT_THRESHOLD = 5;
const BOLA_ALERT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const BOLA_CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

// Set up periodic cleanup of stale entries
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of bolaFailuresByIp.entries()) {
    if (now >= data.resetTime) {
      bolaFailuresByIp.delete(ip);
    }
  }
}, BOLA_CLEANUP_INTERVAL_MS);

// Ensure cleanup stops if the process terminates
cleanupInterval.unref?.();

/**
 * Standardized BOLA (Broken Object-Level Authorization) guard.
 *
 * Use this for consistent ownership verification and security logging
 * across all routes that access user-scoped resources.
 *
 * Usage:
 *   const guard = checkResourceOwnership({
 *     resourceType: 'review',
 *     resourceId: review.id,
 *     ownerId: review.profileId,
 *     requesterId: requestProfileId,
 *     request,
 *   });
 *   if (!guard.allowed) {
 *     response.status(403).json({ error: guard.message });
 *     return;
 *   }
 */
export type OwnershipCheckResult = {
  allowed: boolean;
  message: string;
};

function trackAndAlertBolaFailure(ip: string): void {
  const now = Date.now();
  const existing = bolaFailuresByIp.get(ip);

  if (!existing || now >= existing.resetTime) {
    // First failure in window or window expired
    bolaFailuresByIp.set(ip, { count: 1, resetTime: now + BOLA_ALERT_WINDOW_MS });
    return;
  }

  // Increment counter within current window
  existing.count += 1;

  if (existing.count === BOLA_ALERT_THRESHOLD) {
    // Log alert when threshold is reached
    logSecurityEvent({
      event: 'bola_alert',
      ip,
      path: '/ownership-guard',
      method: 'ALERT',
      detail: `BOLA failure threshold reached: ${BOLA_ALERT_THRESHOLD} failed attempts in ${BOLA_ALERT_WINDOW_MS / 1000}s`,
      meta: {
        threshold: BOLA_ALERT_THRESHOLD,
        windowSeconds: BOLA_ALERT_WINDOW_MS / 1000,
      },
    });
  }
}

export function checkResourceOwnership(options: {
  resourceType: string;
  resourceId: string;
  ownerId: string | null;
  requesterId: string | null;
  request: Request;
}): OwnershipCheckResult {
  const { resourceType, resourceId, ownerId, requesterId, request } = options;

  // If the resource has no owner (public), allow access
  if (!ownerId) {
    return { allowed: true, message: '' };
  }

  // If no requester identity, deny access to owned resources
  if (!requesterId) {
    logSecurityEvent({
      event: 'suspicious_payload',
      ip: request.ip || 'unknown',
      path: request.originalUrl,
      method: request.method,
      detail: `Unauthenticated access to owned ${resourceType}: ${resourceId}`,
      meta: { resourceType, resourceId },
    });
    return {
      allowed: false,
      message: `Authentication required to access this ${resourceType}.`,
    };
  }

  // Verify ownership
  if (ownerId !== requesterId) {
    const clientIp = request.ip || 'unknown';
    logSecurityEvent({
      event: 'suspicious_payload',
      ip: clientIp,
      path: request.originalUrl,
      method: request.method,
      userId: requesterId,
      detail: `BOLA attempt on ${resourceType}: ${resourceId} (owner: ${ownerId}, requester: ${requesterId})`,
      meta: { resourceType, resourceId, ownerId, requesterId },
    });
    recordAbuseSignal(clientIp, 5, request.originalUrl);

    // Track BOLA failures per IP and alert if threshold reached
    if (clientIp !== 'unknown') {
      trackAndAlertBolaFailure(clientIp);
    }

    return {
      allowed: false,
      message: `This ${resourceType} belongs to a different account.`,
    };
  }

  return { allowed: true, message: '' };
}

export function clearBolaTrackingState() {
  clearInterval(cleanupInterval);
  bolaFailuresByIp.clear();
}
