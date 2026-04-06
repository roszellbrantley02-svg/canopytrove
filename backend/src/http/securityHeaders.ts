import { RequestHandler } from 'express';

/**
 * Security headers middleware that sets protective headers on all responses
 * - X-Content-Type-Options: Prevents MIME-type sniffing
 * - X-Frame-Options: Prevents clickjacking
 * - Strict-Transport-Security: Enforces HTTPS (non-localhost only)
 * - Content-Security-Policy: Restricts resource loading
 * - Cache-Control: Prevents caching of sensitive data
 * - Referrer-Policy: Controls referrer information
 * - Permissions-Policy: Disables sensitive browser features
 */
export const securityHeadersMiddleware: RequestHandler = (request, response, next) => {
  // Prevent MIME-type sniffing
  response.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking
  response.setHeader('X-Frame-Options', 'DENY');

  // Enforce HTTPS (except localhost for development)
  if (request.hostname !== 'localhost' && request.hostname !== '127.0.0.1') {
    response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Content Security Policy - very restrictive
  response.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");

  // Prevent caching of sensitive data
  response.setHeader('Cache-Control', 'no-store');

  // Control referrer information
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Disable sensitive browser features
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // Prevent cross-origin window references (mitigates Spectre-class side-channels)
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

  // Prevent unrelated sites from embedding API responses
  response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  next();
};
