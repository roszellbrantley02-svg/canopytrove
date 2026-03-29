import { Request } from 'express';
import { getBackendFirebaseAuth, hasBackendFirebaseConfig } from '../firebase';

export class OwnerPortalAccessError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
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
    return {
      ownerUid: decodedToken.uid,
      ownerEmail: typeof decodedToken.email === 'string' ? decodedToken.email : null,
    };
  } catch {
    throw new OwnerPortalAccessError('Invalid owner authentication token.', 401);
  }
}

export function getOwnerPortalAccessErrorStatus(error: unknown) {
  return error instanceof OwnerPortalAccessError ? error.statusCode : 500;
}
