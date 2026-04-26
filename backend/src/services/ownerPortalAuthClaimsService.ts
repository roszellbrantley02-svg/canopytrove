import { OwnerUserDocument } from '../../../src/types/ownerPortal';
import { hasConfiguredOwnerPortalClaimSync, serverConfig } from '../config';
import {
  getBackendFirebaseAuth,
  getBackendFirebaseDb,
  hasBackendFirebaseConfig,
} from '../firebase';

const USERS_COLLECTION = 'users';

export type OwnerPortalAuthClaimRole = 'owner' | 'admin';

export class OwnerPortalAuthClaimsError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}

function createNow() {
  return new Date().toISOString();
}

function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() || null;
}

function isOwnerPortalPrelaunchEnabled() {
  const rawValue =
    process.env.OWNER_PORTAL_PRELAUNCH_ENABLED ??
    process.env.EXPO_PUBLIC_OWNER_PORTAL_PRELAUNCH_ENABLED;

  if (rawValue == null) {
    return serverConfig.ownerPortalPrelaunchEnabled;
  }

  const normalizedValue = rawValue.trim().toLowerCase();
  return normalizedValue === 'true' || normalizedValue === '1';
}

function hasAdminClaim(claims: Record<string, unknown> | undefined) {
  return claims?.admin === true || claims?.role === 'admin';
}

export function isOwnerPortalEmailAllowlisted(email: string | null | undefined) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return false;
  }

  if (!isOwnerPortalPrelaunchEnabled()) {
    return true;
  }

  return serverConfig.ownerPortalAllowlist.includes(normalizedEmail);
}

export function resolveOwnerPortalClaimRole(
  claims: Record<string, unknown> | undefined,
): OwnerPortalAuthClaimRole {
  return hasAdminClaim(claims) ? 'admin' : 'owner';
}

function buildNextCustomClaims(existingClaims: Record<string, unknown> | undefined) {
  const currentClaims = existingClaims ?? {};
  if (hasAdminClaim(currentClaims)) {
    return {
      ...currentClaims,
      admin: true,
      role: 'admin',
    };
  }

  return {
    ...currentClaims,
    role: 'owner',
  };
}

export async function syncOwnerPortalAuthClaims(input: {
  ownerUid: string;
  ownerEmail: string | null;
}) {
  if (!hasBackendFirebaseConfig) {
    throw new OwnerPortalAuthClaimsError('Owner auth claim sync is not configured.', 503);
  }

  if (!hasConfiguredOwnerPortalClaimSync()) {
    throw new OwnerPortalAuthClaimsError(
      'Owner auth claim sync is not configured on the backend.',
      503,
    );
  }

  if (!isOwnerPortalEmailAllowlisted(input.ownerEmail)) {
    throw new OwnerPortalAuthClaimsError('This account is not approved for owner access.', 403);
  }

  const auth = getBackendFirebaseAuth();
  const db = getBackendFirebaseDb();
  if (!auth || !db) {
    throw new OwnerPortalAuthClaimsError('Owner auth claim sync is not configured.', 503);
  }

  const userRecord = await auth.getUser(input.ownerUid);
  const normalizedEmail = normalizeEmail(input.ownerEmail);
  if (!normalizedEmail) {
    throw new OwnerPortalAuthClaimsError('Owner email is required to finalize access.', 400);
  }

  const userRef = db.collection(USERS_COLLECTION).doc(input.ownerUid);
  const existingUserSnapshot = await userRef.get();
  const existingUser = existingUserSnapshot.exists
    ? (existingUserSnapshot.data() as Partial<OwnerUserDocument>)
    : null;

  // Security gate: The allowlist check above (isOwnerPortalEmailAllowlisted) is the
  // authoritative server-side boundary for who can receive owner claims. It checks
  // serverConfig.ownerPortalAllowlist, which is a backend-only config that cannot be
  // modified from the client.
  //
  // We intentionally do NOT require ownerProfiles/{uid} to exist before granting
  // first-time claims. During signup, the client creates the ownerProfile document
  // AFTER claim-sync succeeds (and Firestore rules require the owner claim for that
  // write). Requiring the doc here would create a chicken-and-egg deadlock:
  //   1. Backend refuses claims without ownerProfile → 2. Client can't create
  //   ownerProfile without owner claim → 3. Firestore rules block the write → deadlock.

  const nextClaims = buildNextCustomClaims(userRecord.customClaims);
  const nextRole = resolveOwnerPortalClaimRole(nextClaims);
  const now = createNow();

  await auth.setCustomUserClaims(input.ownerUid, nextClaims);
  await userRef.set(
    {
      uid: input.ownerUid,
      email: normalizedEmail,
      role: nextRole,
      displayName: userRecord.displayName?.trim() || existingUser?.displayName || null,
      accountStatus: existingUser?.accountStatus ?? 'active',
      createdAt: existingUser?.createdAt ?? now,
      lastLoginAt: now,
      updatedAt: now,
    },
    { merge: true },
  );

  return {
    ok: true as const,
    role: nextRole,
    syncedAt: now,
  };
}
