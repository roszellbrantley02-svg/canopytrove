import type { OwnerPortalAuthClaimsSyncResponse } from '../types/ownerPortal';
import { getCanopyTroveAuthIdTokenResult } from './canopyTroveAuthService';
import { requestJson } from './storefrontBackendHttp';

export type OwnerPortalClaimRole = 'owner' | 'admin';

export function getOwnerPortalClaimRole(
  claims: Record<string, unknown> | undefined,
): OwnerPortalClaimRole | null {
  if (claims?.admin === true || claims?.role === 'admin') {
    return 'admin';
  }

  if (claims?.role === 'owner') {
    return 'owner';
  }

  return null;
}

export async function getCurrentOwnerPortalClaimRole(options?: { forceRefresh?: boolean }) {
  const tokenResult = await getCanopyTroveAuthIdTokenResult({
    forceRefresh: options?.forceRefresh,
  });

  return getOwnerPortalClaimRole(tokenResult?.claims);
}

export async function syncOwnerPortalAuthClaims() {
  return requestJson<OwnerPortalAuthClaimsSyncResponse>('/owner-portal/auth/sync-claims', {
    method: 'POST',
  });
}

export async function ensureOwnerPortalSessionReady() {
  const existingRole = await getCurrentOwnerPortalClaimRole();
  if (existingRole) {
    return {
      ok: true as const,
      role: existingRole,
      syncedAt: null,
    };
  }

  await syncOwnerPortalAuthClaims();
  const nextRole = await getCurrentOwnerPortalClaimRole({
    forceRefresh: true,
  });
  if (!nextRole) {
    throw new Error('Owner access could not be finalized. Sign in again and retry.');
  }

  return {
    ok: true as const,
    role: nextRole,
    syncedAt: new Date().toISOString(),
  };
}
