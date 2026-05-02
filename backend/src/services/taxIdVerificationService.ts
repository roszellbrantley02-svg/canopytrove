/**
 * Tax-ID Verification — Phase 2.5 of the multi-location feature.
 *
 * Additive trust booster. Owner enters their NY business taxpayer ID
 * (TPID). We look it up in the public NYS Department of Taxation and
 * Finance dataset "Registered Retail Dealers of Adult-use Cannabis Products"
 * (gttd-5u6y). On match against the OCM legal entity for one of the owner's
 * claimed storefronts, we tag the owner profile with `taxVerifiedAt` so
 * the UI can render a "Tax-verified" badge.
 *
 * Important: this is NOT a gating verification. It does not affect the
 * claim auto-approval chain (per the dataset findings, gttd-5u6y is sparse
 * — newer 2026-issued sibling licenses haven't registered for tax yet, so
 * relying on TPID match would lock out the very chains we're trying to
 * onboard). Tax verification is an opt-in trust booster only.
 *
 * Privacy: the entered TPID is hashed with `TAX_ID_HASH_SALT` before
 * persistence. Never logged or returned in responses.
 *
 * Dead code by default — flag-gated via `taxIdVerificationEnabled`.
 */

import { createHash } from 'node:crypto';
import { logger } from '../observability/logger';
import { serverConfig } from '../config';
import { getBackendFirebaseDb } from '../firebase';
import { OWNER_PROFILES_COLLECTION } from '../constants/collections';
import { bulkMatchStorefronts } from './ocmLicenseCacheService';
import { backendStorefrontSource } from '../sources';

const SODA_ENDPOINT = 'https://data.ny.gov/resource/gttd-5u6y.json';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const STALE_SERVE_MS = 6 * 60 * 60 * 1000; // serve stale up to 6h on refresh failure
const PAGE_SIZE = 5000;
const PAGE_LIMIT = 5; // safety: max 25k records (gttd-5u6y was ~609 on May 2 2026)
const FETCH_TIMEOUT_MS = 20_000;
const TAX_ID_VERIFICATIONS_COLLECTION = 'taxIdVerifications';

type RawTaxRecord = {
  external_tpid?: string;
  legal_name?: string;
  ocm_license_number?: string;
  physical_address?: string;
  physical_city?: string;
  physical_state?: string;
  physical_zip?: string;
  physical_county?: string;
};

export type TaxRecord = {
  externalTpid: string;
  legalName: string;
  ocmLicenseNumber: string;
  physicalAddress: string | null;
  physicalCity: string | null;
  physicalZip: string | null;
};

type CacheEntry = {
  records: TaxRecord[];
  byTpid: Map<string, TaxRecord[]>;
  byNormalizedLegalName: Map<string, TaxRecord[]>;
  fetchedAt: number;
};

type CacheState = {
  entry: CacheEntry | null;
  refreshInFlight: Promise<CacheEntry | null> | null;
};

const state: CacheState = {
  entry: null,
  refreshInFlight: null,
};

/**
 * Cross-dataset normalization key. The OCM cache stores `entity_name` with
 * mixed casing ("Twisted Cannabis FLX LLC"); gttd-5u6y stores `legal_name`
 * in all caps with trailing punctuation ("TWISTED CANNABIS FLX LLC."). To
 * join, we uppercase + strip common punctuation on BOTH sides. Caller MUST
 * use this same function on every input.
 */
export function normalizeLegalNameForTaxJoin(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.trim().toUpperCase().replace(/[.,]/g, '').replace(/\s+/g, ' ');
  return cleaned || null;
}

function normalizeTpid(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.trim().replace(/\D/g, '');
  return digits || null;
}

function hashTpid(tpid: string): string {
  const salt = serverConfig.taxIdHashSalt ?? '';
  return createHash('sha256').update(`${salt}:${tpid}`).digest('hex');
}

async function fetchAndIndex(): Promise<CacheEntry> {
  const records: TaxRecord[] = [];
  for (let page = 0; page < PAGE_LIMIT; page += 1) {
    const offset = page * PAGE_SIZE;
    const url = `${SODA_ENDPOINT}?$limit=${PAGE_SIZE}&$offset=${offset}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let rawBatch: RawTaxRecord[] = [];
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Tax SODA returned ${response.status}`);
      }
      rawBatch = (await response.json()) as RawTaxRecord[];
    } finally {
      clearTimeout(timeout);
    }
    for (const raw of rawBatch) {
      if (!raw.external_tpid || !raw.legal_name || !raw.ocm_license_number) continue;
      records.push({
        externalTpid: String(raw.external_tpid).trim(),
        legalName: String(raw.legal_name).trim(),
        ocmLicenseNumber: String(raw.ocm_license_number).trim(),
        physicalAddress: raw.physical_address ?? null,
        physicalCity: raw.physical_city ?? null,
        physicalZip: raw.physical_zip ?? null,
      });
    }
    if (rawBatch.length < PAGE_SIZE) break;
  }

  const byTpid = new Map<string, TaxRecord[]>();
  const byNormalizedLegalName = new Map<string, TaxRecord[]>();
  for (const record of records) {
    const tpidList = byTpid.get(record.externalTpid) ?? [];
    tpidList.push(record);
    byTpid.set(record.externalTpid, tpidList);

    const nameKey = normalizeLegalNameForTaxJoin(record.legalName);
    if (nameKey) {
      const nameList = byNormalizedLegalName.get(nameKey) ?? [];
      nameList.push(record);
      byNormalizedLegalName.set(nameKey, nameList);
    }
  }

  logger.info('Tax-ID cache refreshed', {
    total: records.length,
    uniqueTpids: byTpid.size,
    uniqueLegalNames: byNormalizedLegalName.size,
  });

  return {
    records,
    byTpid,
    byNormalizedLegalName,
    fetchedAt: Date.now(),
  };
}

async function ensureRefresh(): Promise<CacheEntry | null> {
  if (state.refreshInFlight) return state.refreshInFlight;
  const promise = (async () => {
    try {
      const entry = await fetchAndIndex();
      state.entry = entry;
      return entry;
    } catch (err) {
      logger.error('Tax-ID cache refresh failed', {
        err: err instanceof Error ? err.message : String(err),
      });
      return state.entry;
    } finally {
      state.refreshInFlight = null;
    }
  })();
  state.refreshInFlight = promise;
  return promise;
}

async function getCacheSnapshot(): Promise<CacheEntry | null> {
  const existing = state.entry;
  const now = Date.now();
  if (existing && now - existing.fetchedAt < CACHE_TTL_MS) return existing;
  if (existing && now - existing.fetchedAt < STALE_SERVE_MS) {
    void ensureRefresh();
    return existing;
  }
  return ensureRefresh();
}

export async function findTaxRecordsByTpid(tpid: string): Promise<TaxRecord[]> {
  const normalized = normalizeTpid(tpid);
  if (!normalized) return [];
  const snapshot = await getCacheSnapshot();
  if (!snapshot) return [];
  return snapshot.byTpid.get(normalized) ?? [];
}

export type TaxIdVerificationResult =
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
    }
  | {
      ok: false;
      code: 'feature_disabled' | 'invalid_input' | 'salt_missing' | 'db_unavailable';
      message: string;
    };

/**
 * Verify an owner's NY business TPID against the gttd-5u6y dataset. On
 * match the owner profile gets `taxVerifiedAt` set; the entered TPID is
 * hashed and stored in `taxIdVerifications/{ownerUid}` for audit. Never
 * stores or logs the raw TPID.
 */
export async function verifyOwnerTaxId(input: {
  ownerUid: string;
  tpid: string;
  /**
   * Storefront whose OCM legal-entity name should match the tax record.
   * Typically the owner's primary storefront (the one whose OTP they
   * just verified).
   */
  primaryDispensaryId: string;
}): Promise<TaxIdVerificationResult> {
  if (!serverConfig.taxIdVerificationEnabled) {
    return { ok: false, code: 'feature_disabled', message: 'Tax-ID verification is not enabled.' };
  }
  if (!serverConfig.taxIdHashSalt) {
    return {
      ok: false,
      code: 'salt_missing',
      message: 'TAX_ID_HASH_SALT must be configured before verification.',
    };
  }
  const normalizedTpid = normalizeTpid(input.tpid);
  if (!normalizedTpid) {
    return { ok: false, code: 'invalid_input', message: 'tpid is required.' };
  }
  if (!input.ownerUid || !input.primaryDispensaryId) {
    return {
      ok: false,
      code: 'invalid_input',
      message: 'ownerUid and primaryDispensaryId are required.',
    };
  }

  const db = getBackendFirebaseDb();
  if (!db) {
    return { ok: false, code: 'db_unavailable', message: 'Backend database is unavailable.' };
  }

  // Step 1 — find tax records for this TPID.
  const taxRecords = await findTaxRecordsByTpid(normalizedTpid);
  if (taxRecords.length === 0) {
    return { ok: true, matched: false, reason: 'tpid_not_found' };
  }

  // Step 2 — load the primary storefront and match it to OCM to get its
  // legal entity name.
  const summaries = await backendStorefrontSource.getSummariesByIds([input.primaryDispensaryId]);
  const primarySummary = summaries.find((summary) => summary.id === input.primaryDispensaryId);
  if (!primarySummary) {
    return { ok: true, matched: false, reason: 'storefront_not_found' };
  }
  const ocmMatches = await bulkMatchStorefronts([
    {
      id: primarySummary.id,
      address: primarySummary.addressLine1,
      zip: primarySummary.zip,
      name: primarySummary.displayName || primarySummary.legalName,
    },
  ]);
  const ocmRecord = ocmMatches.get(input.primaryDispensaryId)?.record;
  if (!ocmRecord || !ocmRecord.licensee_name) {
    return { ok: true, matched: false, reason: 'ocm_match_not_found' };
  }

  // Step 3 — cross-dataset name match. OCM has mixed case, tax has all caps —
  // both sides go through normalizeLegalNameForTaxJoin.
  const ocmKey = normalizeLegalNameForTaxJoin(ocmRecord.licensee_name);
  const matched = taxRecords.find(
    (record) => normalizeLegalNameForTaxJoin(record.legalName) === ocmKey,
  );
  if (!matched) {
    return { ok: true, matched: false, reason: 'legal_name_mismatch' };
  }

  // Step 4 — persist hashed TPID + tag owner profile. Never write the raw TPID.
  const taxVerifiedAt = new Date().toISOString();
  const tpidHash = hashTpid(normalizedTpid);
  const verificationRef = db.collection(TAX_ID_VERIFICATIONS_COLLECTION).doc(input.ownerUid);
  const ownerRef = db.collection(OWNER_PROFILES_COLLECTION).doc(input.ownerUid);
  await Promise.all([
    verificationRef.set(
      {
        ownerUid: input.ownerUid,
        tpidHash,
        legalName: matched.legalName,
        ocmLicenseNumber: matched.ocmLicenseNumber,
        primaryDispensaryId: input.primaryDispensaryId,
        verifiedAt: taxVerifiedAt,
        tpidLicenseCount: taxRecords.length,
      },
      { merge: true },
    ),
    ownerRef.set({ taxVerifiedAt, updatedAt: taxVerifiedAt }, { merge: true }),
  ]);

  logger.info('[taxIdVerification] Owner tax-ID verified', {
    ownerUid: input.ownerUid,
    primaryDispensaryId: input.primaryDispensaryId,
    legalName: matched.legalName,
    tpidLicenseCount: taxRecords.length,
  });

  return {
    ok: true,
    matched: true,
    taxVerifiedAt,
    legalName: matched.legalName,
    tpidLicenseCount: taxRecords.length,
  };
}

/** Test-only: clear cache state. */
export function clearTaxIdCacheForTests(): void {
  if (process.env.NODE_ENV !== 'test') return;
  state.entry = null;
  state.refreshInFlight = null;
}
