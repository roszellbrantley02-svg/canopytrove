/**
 * Frontend client for the multi-location bulk-claim endpoints (Phase 2 PR-D).
 *
 *   GET  /owner-portal/claims/siblings/:dispensaryId
 *   POST /owner-portal/claims/bulk
 *   GET  /owner-portal/claims/bulk/:batchId
 *
 * All three are flag-gated server-side by `bulkClaimEnabled`. When the
 * flag is off, the GET endpoints return `{ ok: false, code: 'feature_disabled' }`
 * and the POST returns the same. The hero card uses that signal to silently
 * hide itself in production until the flag flips.
 */

import { requestJson } from './storefrontBackendHttp';

export type SiblingCandidate = {
  licenseNumber: string;
  licenseeName: string;
  dbaName: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  active: boolean;
  /** Storefront ID in our directory if we resolved it; null otherwise. */
  dispensaryId: string | null;
};

export type SiblingsResponseOk = {
  ok: true;
  primaryDispensaryId: string;
  primaryLicenseeName: string | null;
  siblings: SiblingCandidate[];
  reason: 'storefront_not_found' | 'ocm_match_not_found' | 'ocm_cache_unavailable' | null;
};

export type SiblingsResponseError = {
  ok: false;
  code: 'feature_disabled' | 'invalid_input' | string;
  message?: string;
};

export type SiblingsResponse = SiblingsResponseOk | SiblingsResponseError;

export type BulkClaimSubmissionResponseOk = {
  ok: true;
  batchId: string;
  ownerUid: string;
  primaryDispensaryId: string;
  primaryClaimId: string;
  siblingClaimIds: string[];
  claimIds: string[];
  createdAt: string;
};

export type BulkClaimSubmissionResponseError = {
  ok: false;
  code:
    | 'feature_disabled'
    | 'invalid_input'
    | 'too_many_locations'
    | 'duplicate_locations'
    | 'primary_not_found'
    | 'db_unavailable'
    | string;
  message?: string;
};

export type BulkClaimSubmissionResponse =
  | BulkClaimSubmissionResponseOk
  | BulkClaimSubmissionResponseError;

export async function fetchSiblingLocations(dispensaryId: string): Promise<SiblingsResponse> {
  return requestJson<SiblingsResponse>(
    `/owner-portal/claims/siblings/${encodeURIComponent(dispensaryId)}`,
    { method: 'GET' },
  );
}

export async function submitBulkClaim(input: {
  primaryDispensaryId: string;
  siblingDispensaryIds: string[];
}): Promise<BulkClaimSubmissionResponse> {
  return requestJson<BulkClaimSubmissionResponse>('/owner-portal/claims/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export type BulkClaimBatchStatusResponseOk = {
  ok: true;
  batchId: string;
  ownerUid: string;
  primaryDispensaryId: string;
  claimIds: string[];
  createdAt: string;
  claims: Array<{
    claimId: string;
    dispensaryId: string;
    claimStatus: string;
    shopOwnershipVerified: boolean;
    reviewedAt: string | null;
  }>;
};

export type BulkClaimBatchStatusResponseError = {
  ok: false;
  code: 'feature_disabled' | 'invalid_input' | 'not_found' | string;
  message?: string;
};

export async function fetchBulkClaimBatchStatus(
  batchId: string,
): Promise<BulkClaimBatchStatusResponseOk | BulkClaimBatchStatusResponseError> {
  return requestJson<BulkClaimBatchStatusResponseOk | BulkClaimBatchStatusResponseError>(
    `/owner-portal/claims/bulk/${encodeURIComponent(batchId)}`,
    { method: 'GET' },
  );
}
