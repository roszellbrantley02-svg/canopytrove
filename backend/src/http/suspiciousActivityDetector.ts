import type { Request } from 'express';
import { RequestHandler } from 'express';

/**
 * Track failed authentication attempts per IP
 * Structure: IP -> array of timestamps of failed attempts
 */
const failedAuthAttempts = new Map<string, number[]>();

// Configuration
const MAX_FAILED_ATTEMPTS = 10;
const WINDOW_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const BLOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Track of temporarily blocked IPs
 * Structure: IP -> timestamp when block expires
 */
const blockedIps = new Map<string, number>();

/**
 * Get client IP from request
 */
function getClientIp(request: Request): string {
  return request.ip || request.socket.remoteAddress || 'unknown';
}

/**
 * Check if an IP is temporarily blocked
 */
function isIpBlocked(ip: string): boolean {
  const blockExpiry = blockedIps.get(ip);
  if (!blockExpiry) {
    return false;
  }

  const now = Date.now();
  if (blockExpiry <= now) {
    // Block has expired, remove it
    blockedIps.delete(ip);
    return false;
  }

  return true;
}

/**
 * Record a failed authentication attempt for an IP
 * Returns true if the IP should be temporarily blocked
 */
export function recordFailedAuth(ip: string): boolean {
  const now = Date.now();
  const cutoff = now - WINDOW_DURATION_MS;

  // Get existing attempts for this IP
  let attempts = failedAuthAttempts.get(ip) || [];

  // Filter out old attempts outside the window
  attempts = attempts.filter((timestamp) => timestamp > cutoff);

  // Add new attempt
  attempts.push(now);
  failedAuthAttempts.set(ip, attempts);

  // Check if threshold exceeded
  if (attempts.length > MAX_FAILED_ATTEMPTS) {
    // Temporarily block this IP
    blockedIps.set(ip, now + BLOCK_DURATION_MS);
    return true;
  }

  return false;
}

/**
 * Middleware that blocks requests from temporarily blocked IPs
 */
export const suspiciousActivityMiddleware: RequestHandler = (request, response, next) => {
  const clientIp = getClientIp(request);

  if (isIpBlocked(clientIp)) {
    response.status(429).json({
      error: 'Too many failed authentication attempts. Please try again later.',
    });
    return;
  }

  next();
};

/**
 * Clear suspicious activity state (for testing)
 */
export function clearSuspiciousActivityStateForTests(): void {
  failedAuthAttempts.clear();
  blockedIps.clear();
}
