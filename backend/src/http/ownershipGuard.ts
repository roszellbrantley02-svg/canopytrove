import { Request } from 'express';
import { logSecurityEvent } from './securityEventLogger';
import { recordAbuseSignal } from './abuseScoring';

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
    logSecurityEvent({
      event: 'suspicious_payload',
      ip: request.ip || 'unknown',
      path: request.originalUrl,
      method: request.method,
      userId: requesterId,
      detail: `BOLA attempt on ${resourceType}: ${resourceId} (owner: ${ownerId}, requester: ${requesterId})`,
      meta: { resourceType, resourceId, ownerId, requesterId },
    });
    recordAbuseSignal(request.ip || 'unknown', 5, request.originalUrl);
    return {
      allowed: false,
      message: `This ${resourceType} belongs to a different account.`,
    };
  }

  return { allowed: true, message: '' };
}
