import { createHash, timingSafeEqual } from 'node:crypto';
import type { Request, RequestHandler } from 'express';
import { serverConfig } from '../config';
import { getBackendFirebaseAuth, hasBackendFirebaseConfig } from '../firebase';
import { recordFailedAuth } from './suspiciousActivityDetector';

function getExpectedAdminApiKey() {
  return process.env.ADMIN_API_KEY?.trim() || serverConfig.adminApiKey;
}

function getBearerToken(request: Request) {
  const authorizationHeader = request.header('authorization')?.trim();
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(/\s+/, 2);
  if (!token || scheme.toLowerCase() !== 'bearer') {
    return null;
  }

  return token;
}

function hasAdminClaims(claims: Record<string, unknown> | undefined) {
  return claims?.admin === true || claims?.role === 'admin';
}

function createSecretDigest(value: string) {
  return createHash('sha256').update(value, 'utf8').digest();
}

function matchesAdminApiKey(
  providedApiKey: string | null | undefined,
  expectedApiKey: string | null,
) {
  if (!providedApiKey || !expectedApiKey) {
    return false;
  }

  const providedDigest = createSecretDigest(providedApiKey.trim());
  const expectedDigest = createSecretDigest(expectedApiKey.trim());
  return timingSafeEqual(providedDigest, expectedDigest);
}

export const ensureAdminApiKeyConfigured: RequestHandler = (_request, response, next) => {
  if (getExpectedAdminApiKey()) {
    next();
    return;
  }

  response.status(503).json({
    ok: false,
    error: 'Admin routes are not configured. Missing: ADMIN_API_KEY.',
  });
};

export const ensureAdminApiKeyMatch: RequestHandler = (request, response, next) => {
  const expectedApiKey = getExpectedAdminApiKey();
  if (!expectedApiKey) {
    response.status(503).json({
      ok: false,
      error: 'Admin routes are not configured. Missing: ADMIN_API_KEY.',
    });
    return;
  }

  const providedApiKey = request.header('x-admin-api-key')?.trim();
  if (!matchesAdminApiKey(providedApiKey, expectedApiKey)) {
    const clientIp = request.ip || request.socket.remoteAddress || 'unknown';
    recordFailedAuth(clientIp);
    response.status(401).json({
      ok: false,
      error: 'Invalid admin API key.',
    });
    return;
  }

  next();
};

export const ensureAdminRuntimeAccessConfigured: RequestHandler = (_request, response, next) => {
  if (hasBackendFirebaseConfig || getExpectedAdminApiKey()) {
    next();
    return;
  }

  response.status(503).json({
    ok: false,
    error: 'Admin runtime routes are not configured. Missing Firebase admin auth or ADMIN_API_KEY.',
  });
};

export const ensureAdminRuntimeAccess: RequestHandler = async (request, response, next) => {
  const expectedApiKey = getExpectedAdminApiKey();
  const providedApiKey = request.header('x-admin-api-key')?.trim();
  if (matchesAdminApiKey(providedApiKey, expectedApiKey)) {
    next();
    return;
  }

  const token = getBearerToken(request);
  if (!token) {
    const clientIp = request.ip || request.socket.remoteAddress || 'unknown';
    recordFailedAuth(clientIp);
    response.status(401).json({
      ok: false,
      error: 'Admin authentication is required.',
    });
    return;
  }

  if (!hasBackendFirebaseConfig) {
    response.status(503).json({
      ok: false,
      error: 'Admin bearer authentication is not configured.',
    });
    return;
  }

  const auth = getBackendFirebaseAuth();
  if (!auth) {
    response.status(503).json({
      ok: false,
      error: 'Admin bearer authentication is not configured.',
    });
    return;
  }

  try {
    const decodedToken = await auth.verifyIdToken(token);
    if (!hasAdminClaims(decodedToken as unknown as Record<string, unknown>)) {
      const clientIp = request.ip || request.socket.remoteAddress || 'unknown';
      recordFailedAuth(clientIp);
      response.status(403).json({
        ok: false,
        error: 'Admin account access is required.',
      });
      return;
    }

    next();
  } catch {
    const clientIp = request.ip || request.socket.remoteAddress || 'unknown';
    recordFailedAuth(clientIp);
    response.status(401).json({
      ok: false,
      error: 'Invalid admin authentication token.',
    });
  }
};
