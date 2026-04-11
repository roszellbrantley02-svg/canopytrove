import { Request } from 'express';
import { getBackendFirebaseAuth, hasBackendFirebaseConfig } from '../firebase';

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
    const decodedToken = await auth.verifyIdToken(token);
    // SECURITY: Verify the user already has an owner or admin claim.
    // Without this check, any authenticated user can access owner endpoints.
    const role = decodedToken.role;
    const isAdmin = decodedToken.admin === true;
    const isOwner = role === 'owner' || role === 'admin' || isAdmin;
    if (!isOwner) {
      throw new OwnerPortalAccessError('This account does not have owner access.', 403);
    }
    return {
      ownerUid: decodedToken.uid,
      ownerEmail: typeof decodedToken.email === 'string' ? decodedToken.email : null,
    };
  } catch (error) {
    if (error instanceof OwnerPortalAccessError) {
      throw error;
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
