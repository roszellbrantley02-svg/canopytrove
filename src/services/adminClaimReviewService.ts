/**
 * Admin Claim Review — frontend service for the manual-queue overflow.
 *
 * The bulk of legitimate claims auto-approve via the backend's
 * claimAutoApprovalService (PR #9). This file handles the rest:
 *
 *   - Owners who skipped shop-phone OTP via "Submit for manual review"
 *   - Storefronts not in the OCM registry (closed, out-of-state, stale
 *     Google listing)
 *   - Claims where auto-approval hit a Firestore error mid-flow
 *
 * Auth model mirrors adminRuntimeService.ts: Firebase Bearer token whose
 * decoded claims include the admin role. The backend's
 * `ensureAdminRuntimeAccess` middleware accepts both `x-admin-api-key`
 * (server-to-server) and Bearer + admin claim (this client path).
 */

import { storefrontApiBaseUrl } from '../config/storefrontSourceConfig';
import { getCanopyTroveAuthIdTokenResult } from './canopyTroveAuthService';

const ADMIN_REQUEST_TIMEOUT_MS = 10_000;

function getAdminBaseUrl() {
  if (!storefrontApiBaseUrl) {
    throw new Error('Storefront API base URL is not configured for admin review.');
  }
  return storefrontApiBaseUrl.replace(/\/+$/, '');
}

async function buildAdminHeaders(includeContentType = false) {
  const idTokenResult = await getCanopyTroveAuthIdTokenResult({ forceRefresh: true });
  if (!idTokenResult?.token) {
    throw new Error('Sign in with an admin account to use the claim review screen.');
  }
  const headers = new Headers({
    Authorization: `Bearer ${idTokenResult.token}`,
  });
  if (includeContentType) {
    headers.set('Content-Type', 'application/json');
  }
  return headers;
}

async function adminRequest<T>(pathname: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ADMIN_REQUEST_TIMEOUT_MS);
  try {
    const headers = await buildAdminHeaders(Boolean(init?.body));
    const response = await fetch(`${getAdminBaseUrl()}${pathname}`, {
      ...init,
      headers,
      signal: controller.signal,
    });
    const text = await response.text();
    const payload = text ? (JSON.parse(text) as { error?: string } & T) : null;
    if (!response.ok) {
      throw new Error(payload?.error?.trim() || `Admin request failed with ${response.status}`);
    }
    return payload as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Admin request timed out.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export type AdminPendingClaim = {
  id: string;
  ownerUid?: string;
  dispensaryId?: string;
  claimStatus?: string;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  reviewNotes?: string | null;
  shopOwnershipVerified?: boolean;
  shopOwnershipVerifiedAt?: string | null;
  shopOwnershipVerifiedPhoneSuffix?: string | null;
  shopClaimNotificationSentAt?: string | null;
  shopClaimNotificationStatus?: string | null;
};

export type AdminReviewQueueResponse = {
  ok: boolean;
  claims: AdminPendingClaim[];
  businessVerifications: unknown[];
  identityVerifications: unknown[];
  storefrontReports: unknown[];
  reviewPhotos: unknown[];
};

/**
 * Fetch the pending-claim queue. Reuses the existing /admin/reviews/queue
 * endpoint that powers other admin surfaces.
 */
export async function fetchAdminClaimQueue(limit = 50) {
  return adminRequest<AdminReviewQueueResponse>(
    `/admin/reviews/queue?limit=${encodeURIComponent(String(limit))}`,
  );
}

export type AdminClaimReviewBody = {
  status: 'approved' | 'rejected' | 'changes_requested';
  reviewNotes?: string | null;
  /**
   * Set true to bypass the shop-ownership-verified gate when admin
   * confirmed ownership out of band (phone call to shop, in-person visit,
   * mailed postcard). Required when approving a claim where
   * shopOwnershipVerified=false (the manual-review-path overflow).
   */
  overrideShopOwnership?: boolean;
};

export type AdminClaimReviewResponse = {
  ok: boolean;
  claimId: string;
  status: string;
};

export async function submitAdminClaimReview(claimId: string, body: AdminClaimReviewBody) {
  return adminRequest<AdminClaimReviewResponse>(
    `/admin/reviews/claims/${encodeURIComponent(claimId)}`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  );
}
