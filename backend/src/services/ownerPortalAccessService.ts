import { Request } from 'express';
import { getBackendFirebaseAuth, hasBackendFirebaseConfig } from '../firebase';
import { isOwnerPortalEmailAllowlisted } from './ownerPortalAuthClaimsService';
import { logger } from '../observability/logger';

export class OwnerPortalAccessError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
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

export async function ensureOwnerPortalAccess(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    throw new OwnerPortalAccessError('Owner authentication is required.', 401);
  }

  const auth = getBackendFirebaseAuth();
  if (!auth || !hasBackendFirebaseConfig) {
    throw new OwnerPortalAccessError('Owner authentication is not configured.', 503);
  }

  try {
    // SECURITY: verifyIdToken with checkRevoked=true hits the Firebase server
    // so revoked tokens are rejected immediately instead of waiting out the
    // ~1h cached claim TTL. Slightly slower (~30-80ms) but necessary for
    // owner-scoped routes — the performance cost is cheap insurance against
    // a stale-claim elevation.
    const decodedToken = await auth.verifyIdToken(token, true);
    const role = decodedToken.role;
    const isAdmin = decodedToken.admin === true;
    const isOwnerClaim = role === 'owner' || role === 'admin' || isAdmin;
    if (!isOwnerClaim) {
      throw new OwnerPortalAccessError('This account does not have owner access.', 403);
    }

    // SECURITY: Claims are cached in the ID token for up to 1 hour. A user
    // who was allowlisted, received their claim, and was then removed from
    // the allowlist would still have a valid claim until the token refreshes.
    // Re-verify against the authoritative source (serverConfig.ownerPortalAllowlist)
    // on every owner-gated request. Admin claims bypass the allowlist because
    // admin claims are provisioned out of band by Anthropic/ops personnel.
    const tokenEmail = typeof decodedToken.email === 'string' ? decodedToken.email : null;
    if (!isAdmin && role !== 'admin' && !isOwnerPortalEmailAllowlisted(tokenEmail)) {
      logger.warn('[owner-access] Owner claim present but email no longer allowlisted', {
        ownerUid: decodedToken.uid,
        email: tokenEmail,
      });
      throw new OwnerPortalAccessError(
        'This account is no longer approved for owner access.',
        403,
      );
    }

    return {
      ownerUid: decodedToken.uid,
      ownerEmail: tokenEmail,
    };
  } catch (error) {
    if (error instanceof OwnerPortalAccessError) {
      throw error;
    }
    // Firebase admin throws with code 'auth/id-token-revoked' when
    // checkRevoked catches a revoked token. Surface that as a 401 so the
    // client knows to refresh.
    const maybeFirebaseError = error as { code?: string } | null;
    if (maybeFirebaseError?.code === 'auth/id-token-revoked') {
      throw new OwnerPortalAccessError(
        'Session was revoked. Please sign in again.',
        401,
      );
    }
    throw new OwnerPortalAccessError('Invalid owner authentication token.', 401);
  }
}

/**
 * Verify token validity for claim sync endpoint only.
 * This is used EXCLUSIVELY for the sync-claims route, which is the mechanism
 * that grants initial owner access. Unlike ensureOwnerPortalAccess, this does
 * NOT check for existing owner claims (chicken-and-egg problem).
 */
export async function ensureOwnerPortalClaimSyncAccess(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    throw new OwnerPortalAccessError('Authentication is required.', 401);
  }

  const auth = getBackendFirebaseAuth();
  if (!auth || !hasBackendFirebaseConfig) {
    throw new OwnerPortalAccessError('Authentication is not configured.', 503);
  }

  try {
    const decodedToken = await auth.verifyIdToken(token);
    return {
      ownerUid: decodedToken.uid,
      ownerEmail: typeof decodedToken.email === 'string' ? decodedToken.email : null,
    };
  } catch {
    throw new OwnerPortalAccessError('Invalid authentication token.', 401);
  }
}

export function getOwnerPortalAccessErrorStatus(error: unknown) {
  return error instanceof OwnerPortalAccessError ? error.statusCode : 500;
}
