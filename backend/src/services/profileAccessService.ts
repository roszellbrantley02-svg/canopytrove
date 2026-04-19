import { Request } from 'express';
import { hasBackendFirebaseConfig, getBackendFirebaseAuth } from '../firebase';
import { AppProfileApiDocument } from '../types';
import { getProfile, getProfileRecord, saveProfile } from './profileService';
import { logSecurityEvent } from '../http/securityEventLogger';
import { recordAbuseSignal } from '../http/abuseScoring';

export type VerifiedRequestRole = 'member' | 'owner' | 'admin' | null;

export type VerifiedRequestIdentity = {
  accountId: string | null;
  role: VerifiedRequestRole;
  /**
   * True when the bearer token was minted via Firebase Anonymous Auth
   * (sign_in_provider === 'anonymous'). Anonymous accounts have no email,
   * no password, no identity proof — they're functionally equivalent to a
   * session cookie. Use `ensureRealMemberWriteAccess` on any endpoint that
   * should not accept anonymous auth writes (reviews, helpful votes,
   * reports, favorites, content submissions).
   */
  isAnonymousAuth: boolean;
};

export class ProfileAccessError extends Error {
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

/**
 * Test bypass safety mechanism.
 *
 * Test authentication headers (x-canopy-test-account-id, Bearer test-*)
 * are ONLY active when BOTH conditions are true:
 *   1. NODE_ENV === 'test'  — set during test runs
 *   2. K_SERVICE is NOT set — K_SERVICE is always set by Cloud Run
 *
 * This means test bypass is impossible in production on Cloud Run,
 * even if NODE_ENV were accidentally set to 'test'.
 */
function isTestEnvironment() {
  return process.env.NODE_ENV === 'test' && !process.env.K_SERVICE;
}

function getTestRequestAccountId(request: Request, allowTestHeader: boolean) {
  if (!allowTestHeader || !isTestEnvironment()) {
    return null;
  }

  const accountId = request.header('x-canopy-test-account-id')?.trim();
  return accountId || null;
}

function getTestBearerIdentity(request: Request): VerifiedRequestIdentity | undefined {
  if (!isTestEnvironment()) {
    return undefined;
  }

  const token = getBearerToken(request);
  if (!token) {
    return undefined;
  }

  if (token.startsWith('test-authenticated:')) {
    const accountId = token.slice('test-authenticated:'.length).trim();
    return {
      accountId: accountId || null,
      role: accountId ? 'member' : null,
      isAnonymousAuth: false,
    };
  }

  if (token.startsWith('test-anonymous:')) {
    const accountId = token.slice('test-anonymous:'.length).trim();
    return {
      accountId: accountId || null,
      role: accountId ? 'member' : null,
      isAnonymousAuth: true,
    };
  }

  if (token.startsWith('test-owner:')) {
    const accountId = token.slice('test-owner:'.length).trim();
    return {
      accountId: accountId || null,
      role: accountId ? 'owner' : null,
      isAnonymousAuth: false,
    };
  }

  if (token.startsWith('test-admin:')) {
    const accountId = token.slice('test-admin:'.length).trim();
    return {
      accountId: accountId || null,
      role: accountId ? 'admin' : null,
      isAnonymousAuth: false,
    };
  }

  if (token.startsWith('test-invalid')) {
    return {
      accountId: null,
      role: null,
      isAnonymousAuth: false,
    };
  }

  return undefined;
}

function resolveVerifiedRequestRole(decodedToken: Record<string, unknown>): VerifiedRequestRole {
  if (decodedToken.admin === true || decodedToken.role === 'admin') {
    return 'admin';
  }

  if (decodedToken.role === 'owner') {
    return 'owner';
  }

  return 'member';
}

function isAnonymousSignInProvider(decodedToken: Record<string, unknown>): boolean {
  const firebase = decodedToken.firebase;
  if (!firebase || typeof firebase !== 'object') return false;
  const provider = (firebase as { sign_in_provider?: unknown }).sign_in_provider;
  return provider === 'anonymous';
}

export async function resolveVerifiedRequestIdentity(
  request: Request,
  options?: {
    allowTestHeader?: boolean;
    invalidTokenBehavior?: 'throw' | 'ignore';
  },
): Promise<VerifiedRequestIdentity> {
  const testAccountId = getTestRequestAccountId(request, options?.allowTestHeader ?? false);
  if (testAccountId) {
    return {
      accountId: testAccountId,
      role: 'member',
      isAnonymousAuth: false,
    };
  }

  const testBearerIdentity = getTestBearerIdentity(request);
  if (testBearerIdentity !== undefined) {
    return testBearerIdentity;
  }

  const token = getBearerToken(request);
  if (!token) {
    return {
      accountId: null,
      role: null,
      isAnonymousAuth: false,
    };
  }

  const auth = getBackendFirebaseAuth();
  if (!auth || !hasBackendFirebaseConfig) {
    return {
      accountId: null,
      role: null,
      isAnonymousAuth: false,
    };
  }

  try {
    const decodedToken = await auth.verifyIdToken(token);
    const claims = decodedToken as Record<string, unknown>;
    return {
      accountId: decodedToken.uid,
      role: resolveVerifiedRequestRole(claims),
      isAnonymousAuth: isAnonymousSignInProvider(claims),
    };
  } catch {
    if (options?.invalidTokenBehavior === 'ignore') {
      return {
        accountId: null,
        role: null,
        isAnonymousAuth: false,
      };
    }

    logSecurityEvent({
      event: 'auth_failure',
      ip: request.ip || 'unknown',
      path: request.originalUrl,
      method: request.method,
      detail: 'Invalid Firebase auth token',
    });
    recordAbuseSignal(request.ip || 'unknown', 3, request.originalUrl);

    throw new ProfileAccessError('Invalid authentication token.', 401);
  }
}

export async function resolveVerifiedRequestAccountId(
  request: Request,
  options?: {
    allowTestHeader?: boolean;
    invalidTokenBehavior?: 'throw' | 'ignore';
  },
) {
  const identity = await resolveVerifiedRequestIdentity(request, options);
  return identity.accountId;
}

function buildClaimedProfile(
  profile: AppProfileApiDocument,
  accountId: string,
): AppProfileApiDocument {
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
  const accountId = await resolveVerifiedRequestAccountId(request);
  const profile = await getProfile(profileId);

  ensureAnonymousAccessAllowed(profile, accountId);

  if (accountId && profile.accountId && profile.accountId !== accountId) {
    logSecurityEvent({
      event: 'suspicious_payload',
      ip: request.ip || 'unknown',
      path: request.originalUrl,
      method: request.method,
      userId: accountId,
      detail: `BOLA: profile ${profileId} owned by ${profile.accountId}, accessed by ${accountId}`,
    });
    recordAbuseSignal(request.ip || 'unknown', 5, request.originalUrl);
    throw new ProfileAccessError('This profile belongs to a different account.', 403);
  }

  return {
    accountId,
    profile,
  };
}

export async function ensureProfileWriteAccess(request: Request, profileId: string) {
  const accountId = await resolveVerifiedRequestAccountId(request);
  const { profile: currentProfile, exists: profileExists } = await getProfileRecord(profileId);

  ensureAnonymousAccessAllowed(currentProfile, accountId);

  if (accountId && currentProfile.accountId && currentProfile.accountId !== accountId) {
    logSecurityEvent({
      event: 'suspicious_payload',
      ip: request.ip || 'unknown',
      path: request.originalUrl,
      method: request.method,
      userId: accountId,
      detail: `BOLA: profile ${profileId} owned by ${currentProfile.accountId}, modified by ${accountId}`,
    });
    recordAbuseSignal(request.ip || 'unknown', 5, request.originalUrl);
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

  if (profileExists) {
    logSecurityEvent({
      event: 'suspicious_payload',
      ip: request.ip || 'unknown',
      path: request.originalUrl,
      method: request.method,
      userId: accountId,
      detail: `Anonymous profile takeover blocked for ${profileId} by ${accountId}`,
    });
    recordAbuseSignal(request.ip || 'unknown', 4, request.originalUrl);
    throw new ProfileAccessError(
      'This profile already exists as a guest profile and must be upgraded locally before linking to a signed-in account.',
      409,
    );
  }

  const claimedProfile = await saveProfile(buildClaimedProfile(currentProfile, accountId));
  return {
    accountId,
    profile: claimedProfile,
  };
}

export async function ensureAuthenticatedProfileWriteAccess(
  request: Request,
  profileId: string,
  message = 'You must be signed in to perform this action.',
) {
  const accountId = await resolveVerifiedRequestAccountId(request);
  if (!accountId) {
    throw new ProfileAccessError(message, 403);
  }

  return ensureProfileWriteAccess(request, profileId) as Promise<{
    accountId: string;
    profile: AppProfileApiDocument;
  }>;
}

/**
 * Like ensureAuthenticatedProfileWriteAccess, but additionally rejects
 * Firebase anonymous-auth tokens. Use on routes where the authenticated
 * identity matters — content submissions (reviews, reports, comments),
 * favorites, follows, claim-backed features, etc.
 *
 * Reason: Firebase anonymous auth mints a bearer token for any device with
 * zero identity proof. Without this gate, an attacker can create unlimited
 * anonymous accounts from a single device, bypass any per-account limit,
 * and flood content — undetectable as the same human.
 */
export async function ensureRealMemberWriteAccess(
  request: Request,
  profileId: string,
  message = 'This action requires a signed-in account. Please sign in with email or a social provider.',
) {
  const identity = await resolveVerifiedRequestIdentity(request);
  if (!identity.accountId) {
    throw new ProfileAccessError(message, 403);
  }
  if (identity.isAnonymousAuth) {
    logSecurityEvent({
      event: 'auth_failure',
      ip: request.ip || 'unknown',
      path: request.originalUrl,
      method: request.method,
      userId: identity.accountId,
      detail: 'Anonymous-auth account blocked from non-anonymous write endpoint.',
    });
    throw new ProfileAccessError(message, 403);
  }

  return ensureProfileWriteAccess(request, profileId) as Promise<{
    accountId: string;
    profile: AppProfileApiDocument;
  }>;
}

export function getProfileAccessErrorStatus(error: unknown) {
  return error instanceof ProfileAccessError ? error.statusCode : 500;
}
