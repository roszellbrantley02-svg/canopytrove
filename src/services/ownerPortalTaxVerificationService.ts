/**
 * Frontend client for the Tax-ID verification endpoint (Phase 2.5).
 *
 *   POST /owner-portal/tax-verification
 *
 * Backend hashes the entered TPID with TAX_ID_HASH_SALT before persistence.
 * The raw TPID never appears in the response or in any persistent store —
 * this client should also avoid logging it. On match, the owner profile
 * gets `taxVerifiedAt` set, which the badge renderer reads.
 *
 * Flag-gated server-side (taxIdVerificationEnabled). When the flag is off,
 * the endpoint responds with `{ ok: false, code: 'feature_disabled' }`.
 * The screen surfaces that as a friendly "feature not yet available" message.
 */

import { requestJson } from './storefrontBackendHttp';

export type TaxIdVerificationResponseOk =
  | {
      ok: true;
      matched: true;
      taxVerifiedAt: string;
      legalName: string;
      tpidLicenseCount: number;
    }
  | {
      ok: true;
      matched: false;
      reason:
        | 'tpid_not_found'
        | 'storefront_not_found'
        | 'ocm_match_not_found'
        | 'legal_name_mismatch';
    };

export type TaxIdVerificationResponseError = {
  ok: false;
  code: 'feature_disabled' | 'invalid_input' | 'salt_missing' | 'db_unavailable' | string;
  message?: string;
};

export type TaxIdVerificationResponse =
  | TaxIdVerificationResponseOk
  | TaxIdVerificationResponseError;

export async function submitOwnerTaxVerification(input: {
  tpid: string;
  primaryDispensaryId: string;
}): Promise<TaxIdVerificationResponse> {
  return requestJson<TaxIdVerificationResponse>('/owner-portal/tax-verification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}
