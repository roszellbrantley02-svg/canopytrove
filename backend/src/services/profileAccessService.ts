import { Request } from 'express';
import { hasBackendFirebaseConfig, getBackendFirebaseAuth } from '../firebase';
import { AppProfileApiDocument } from '../types';
import { getProfile, saveProfile } from './profileService';

export class ProfileAccessError extends Error {
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

async function getVerifiedRequestAccountId(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    return null;
  }

  const auth = getBackendFirebaseAuth();
  if (!auth || !hasBackendFirebaseConfig) {
    return null;
  }

  try {
    const decodedToken = await auth.verifyIdToken(token);
    return decodedToken.uid;
  } catch {
    throw new ProfileAccessError('Invalid authentication token.', 401);
  }
}

function buildClaimedProfile(profile: AppProfileApiDocument, accountId: string): AppProfileApiDocument {
  return {
    ...profile,
    kind: 'authenticated',
    accountId,
    updatedAt: new Date().toISOString(),
  };
}

function ensureAnonymousAccessAllowed(profile: AppProfileApiDocument, accountId: string | null) {
  if (!accountId && profile.accountId) {
    throw new ProfileAccessError('Signed-in access is required for this profile.', 403);
  }
}

export async function ensureProfileReadAccess(request: Request, profileId: string) {
  const accountId = await getVerifiedRequestAccountId(request);
  const profile = await getProfile(profileId);

  ensureAnonymousAccessAllowed(profile, accountId);

  if (accountId && profile.accountId && profile.accountId !== accountId) {
    throw new ProfileAccessError('This profile belongs to a different account.', 403);
  }

  return {
    accountId,
    profile,
  };
}

export async function ensureProfileWriteAccess(request: Request, profileId: string) {
  const accountId = await getVerifiedRequestAccountId(request);
  const currentProfile = await getProfile(profileId);

  ensureAnonymousAccessAllowed(currentProfile, accountId);

  if (accountId && currentProfile.accountId && currentProfile.accountId !== accountId) {
    throw new ProfileAccessError('This profile belongs to a different account.', 403);
  }

  if (!accountId) {
    return {
      accountId: null,
      profile: currentProfile,
    };
  }

  if (currentProfile.accountId === accountId && currentProfile.kind === 'authenticated') {
    return {
      accountId,
      profile: currentProfile,
    };
  }

  const claimedProfile = await saveProfile(buildClaimedProfile(currentProfile, accountId));
  return {
    accountId,
    profile: claimedProfile,
  };
}

export function getProfileAccessErrorStatus(error: unknown) {
  return error instanceof ProfileAccessError ? error.statusCode : 500;
}
