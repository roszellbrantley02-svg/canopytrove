import type { Request } from 'express';
import { RequestHandler } from 'express';
import { logger } from '../observability/logger';

/**
 * Audit log entry for write operations
 */
interface AuditLogEntry {
  type: 'audit_log';
  timestamp: string;
  method: string;
  path: string;
  userId: string | null;
  ip: string;
  requestId: string | null;
  statusCode: number;
}

/**
 * Extract authenticated user ID from request headers
 */
function extractUserId(request: Request): string | null {
  // Try custom test header first
  const testUserId = request.header('x-canopy-test-account-id');
  if (testUserId) {
    return testUserId.trim();
  }

  // Try Firebase UID from header
  const firebaseUid = request.header('x-firebase-uid');
  if (firebaseUid) {
    return firebaseUid.trim();
  }

  return null;
}

/**
 * Get client IP from request
 */
function getClientIp(request: Request): string {
  return request.ip || request.socket.remoteAddress || 'unknown';
}

/**
 * Check if request is a write operation
 */
function isWriteOperation(method: string): boolean {
  return ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method.toUpperCase());
}

/**
 * Create audit log middleware that logs write operations
 */
export function createAuditLogMiddleware(): RequestHandler {
  return (request, response, next) => {
    const startedAt = process.hrtime.bigint();
    const requestId = response.getHeader('X-CanopyTrove-Request-Id');
    const originalEnd = response.end.bind(response);

    response.end = ((...args: Parameters<typeof response.end>) => {
      // Only log write operations
      if (isWriteOperation(request.method)) {
        const auditEntry: AuditLogEntry = {
          type: 'audit_log',
          timestamp: new Date().toISOString(),
          method: request.method,
          path: request.originalUrl,
          userId: extractUserId(request),
          ip: getClientIp(request),
          requestId: typeof requestId === 'string' ? requestId : null,
          statusCode: response.statusCode,
        };

        logger.info('audit_log', auditEntry as unknown as Record<string, unknown>);
      }

      return originalEnd(...args);
    }) as typeof response.end;

    next();
  };
}
