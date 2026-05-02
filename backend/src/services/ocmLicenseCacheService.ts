/**
 * OCM License Cache Service
 *
 * Maintains an hourly-refreshed in-memory cache of the public
 * "Current OCM Licenses" dataset from data.ny.gov. Used for two things:
 *
 *   1. Powering the consumer Verify screen (GET /licenses/verify).
 *   2. Enriching storefront payloads with a "Verified licensed" badge
 *      sourced from the same cache, so every card in the app can show
 *      the trust signal without hitting the SODA API per request.
 *
 * This is separate from ocmLicenseLookupService, which does live
 * per-license lookups for owner verification. This cache is optimized
 * for bulk matching by address / name across thousands of storefronts.
 *
 * Data source: https://data.ny.gov/Economic-Development/Current-OCM-Licenses/jskf-tt3q
 */

import { logger } from '../observability/logger';
import type { OcmLicenseRecord } from './ocmLicenseLookupService';

const OCM_SODA_ENDPOINT = 'https://data.ny.gov/resource/jskf-tt3q.json';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const STALE_SERVE_MS = 6 * 60 * 60 * 1000; // serve stale for up to 6h on refresh failure
const PAGE_SIZE = 5000;
const PAGE_LIMIT = 10; // safety: max 50k records
const FETCH_TIMEOUT_MS = 20_000;

/**
 * Retail dispensary license types we surface to consumers. The OCM dataset
 * also contains cultivator / processor / distributor records that aren't
 * relevant to a "is this shop licensed?" consumer check.
 */
const RETAIL_DISPENSARY_TYPES = new Set(
  [
    'adult-use retail dispensary',
    'conditional adult-use retail dispensary',
    'adult-use on-site consumption',
    'microbusiness',
    'medical cannabis registered organization',
    'registered organization adult-use dispensing',
    'registered organization dispensing',
  ].map((value) => value.toLowerCase()),
);

type CacheEntry = {
  records: OcmLicenseRecord[];
  byLicenseNumber: Map<string, OcmLicenseRecord>;
  byNormalizedAddress: Map<string, OcmLicenseRecord[]>;
  byNormalizedName: Map<string, OcmLicenseRecord[]>;
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

export type VerificationMatch = {
  licensed: boolean;
  confidence: 'exact' | 'address' | 'name' | 'fuzzy' | 'none';
  record: OcmLicenseRecord | null;
  asOf: string;
  source: 'ocm_public_records';
};

export type VerifyInput = {
  licenseNumber?: string;
  address?: string;
  city?: string;
  zip?: string;
  name?: string;
};

export async function getOcmCacheSnapshot(): Promise<CacheEntry | null> {
  const existing = state.entry;
  const now = Date.now();

  if (existing && now - existing.fetchedAt < CACHE_TTL_MS) {
    return existing;
  }

  // Serve stale while refreshing if we have something usable
  if (existing && now - existing.fetchedAt < STALE_SERVE_MS) {
    void ensureRefresh();
    return existing;
  }

  return ensureRefresh();
}

async function ensureRefresh(): Promise<CacheEntry | null> {
  if (state.refreshInFlight) return state.refreshInFlight;

  const promise = (async () => {
    try {
      const fresh = await fetchAndIndex();
      state.entry = fresh;
      return fresh;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'OCM cache refresh failed';
      logger.error('OCM license cache refresh failed', { err: message });
      // Keep serving whatever we had
      return state.entry;
    } finally {
      state.refreshInFlight = null;
    }
  })();

  state.refreshInFlight = promise;
  return promise;
}

/**
 * The current data.ny.gov SODA schema for `jskf-tt3q` uses these
 * field names. State changed the schema sometime before May 2 2026
 * and we kept reading the old names (`address`, `licensee_name`,
 * `dba_name`, `issue_date`) which all came back undefined — silently
 * leaving every storefront unverified. Re-confirmed against the live
 * API on May 2 2026 by curling
 * https://data.ny.gov/resource/jskf-tt3q.json?$limit=1.
 */
export type RawSodaOcmRecord = {
  license_number?: string;
  license_type?: string;
  license_status?: string;
  entity_name?: string;
  dba?: string;
  address_line_1?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  issued_date?: string;
  expiration_date?: string;
  // Tolerant fallbacks for the OLD field names in case state ever
  // restores them or returns mixed shapes during a transition.
  licensee_name?: string;
  dba_name?: string;
  address?: string;
  issue_date?: string;
};

export function normalizeRawSodaRecord(raw: RawSodaOcmRecord): OcmLicenseRecord | null {
  // license_number is the one field that's stable across every schema
  // shape we've seen. If it's missing, the record isn't useful.
  if (!raw.license_number) return null;
  return {
    license_number: raw.license_number,
    license_type: raw.license_type ?? '',
    license_status: raw.license_status ?? '',
    licensee_name: raw.entity_name ?? raw.licensee_name ?? '',
    dba_name: raw.dba ?? raw.dba_name,
    address: raw.address_line_1 ?? raw.address,
    city: raw.city,
    state: raw.state,
    zip_code: raw.zip_code,
    issue_date: raw.issued_date ?? raw.issue_date,
    expiration_date: raw.expiration_date,
  };
}

async function fetchAndIndex(): Promise<CacheEntry> {
  const records: OcmLicenseRecord[] = [];
  for (let page = 0; page < PAGE_LIMIT; page += 1) {
    const offset = page * PAGE_SIZE;
    const url = `${OCM_SODA_ENDPOINT}?$limit=${PAGE_SIZE}&$offset=${offset}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let rawBatch: RawSodaOcmRecord[] = [];
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`OCM SODA returned ${response.status}`);
      }
      rawBatch = (await response.json()) as RawSodaOcmRecord[];
    } finally {
      clearTimeout(timeout);
    }
    // Map every raw record into our internal shape. Skips records
    // missing license_number (rare but possible during state's data
    // entry workflow).
    for (const raw of rawBatch) {
      const normalized = normalizeRawSodaRecord(raw);
      if (normalized) records.push(normalized);
    }
    if (rawBatch.length < PAGE_SIZE) break;
  }

  const byLicenseNumber = new Map<string, OcmLicenseRecord>();
  const byNormalizedAddress = new Map<string, OcmLicenseRecord[]>();
  const byNormalizedName = new Map<string, OcmLicenseRecord[]>();

  for (const record of records) {
    if (!isConsumerFacingRetailType(record.license_type)) continue;
    if (record.license_number) {
      byLicenseNumber.set(record.license_number.trim().toUpperCase(), record);
    }
    const addrKey = normalizeAddressKey(record.address, record.zip_code);
    if (addrKey) {
      const list = byNormalizedAddress.get(addrKey) ?? [];
      list.push(record);
      byNormalizedAddress.set(addrKey, list);
    }
    for (const candidate of [record.licensee_name, record.dba_name]) {
      const nameKey = normalizeNameKey(candidate);
      if (!nameKey) continue;
      const list = byNormalizedName.get(nameKey) ?? [];
      list.push(record);
      byNormalizedName.set(nameKey, list);
    }
  }

  logger.info('OCM license cache refreshed', {
    total: records.length,
    retailIndexed: byLicenseNumber.size,
    uniqueAddresses: byNormalizedAddress.size,
    uniqueNames: byNormalizedName.size,
  });

  return {
    records,
    byLicenseNumber,
    byNormalizedAddress,
    byNormalizedName,
    fetchedAt: Date.now(),
  };
}

export async function verifyAgainstCache(input: VerifyInput): Promise<VerificationMatch> {
  const snapshot = await getOcmCacheSnapshot();
  const asOf = snapshot ? new Date(snapshot.fetchedAt).toISOString() : new Date(0).toISOString();

  if (!snapshot) {
    return {
      licensed: false,
      confidence: 'none',
      record: null,
      asOf,
      source: 'ocm_public_records',
    };
  }

  // License number match — strongest signal
  if (input.licenseNumber) {
    const hit = snapshot.byLicenseNumber.get(input.licenseNumber.trim().toUpperCase());
    if (hit && isActiveStatus(hit.license_status)) {
      return {
        licensed: true,
        confidence: 'exact',
        record: hit,
        asOf,
        source: 'ocm_public_records',
      };
    }
  }

  // Address match
  if (input.address) {
    const addrKey = normalizeAddressKey(input.address, input.zip);
    if (addrKey) {
      const hits = snapshot.byNormalizedAddress.get(addrKey) ?? [];
      const active = hits.find((hit) => isActiveStatus(hit.license_status));
      if (active) {
        return {
          licensed: true,
          confidence: 'address',
          record: active,
          asOf,
          source: 'ocm_public_records',
        };
      }
    }
  }

  // Name match — lowest confidence, only consider when paired with city/zip proximity
  if (input.name) {
    const nameKey = normalizeNameKey(input.name);
    if (nameKey) {
      const hits = snapshot.byNormalizedName.get(nameKey) ?? [];
      const active = hits.find((hit) => {
        if (!isActiveStatus(hit.license_status)) return false;
        if (input.zip && hit.zip_code) {
          return hit.zip_code.trim().slice(0, 5) === input.zip.trim().slice(0, 5);
        }
        return true;
      });
      if (active) {
        return {
          licensed: true,
          confidence: input.zip ? 'name' : 'fuzzy',
          record: active,
          asOf,
          source: 'ocm_public_records',
        };
      }
    }
  }

  return {
    licensed: false,
    confidence: 'none',
    record: null,
    asOf,
    source: 'ocm_public_records',
  };
}

// --- Normalization helpers ---

function isConsumerFacingRetailType(raw: string | undefined): boolean {
  if (!raw) return false;
  const lowered = raw.trim().toLowerCase();
  if (RETAIL_DISPENSARY_TYPES.has(lowered)) return true;
  // Substring catch for variants like "Adult-Use Retail Dispensary – Provisional"
  if (lowered.includes('retail dispensary')) return true;
  if (lowered.includes('dispensing')) return true;
  if (lowered.includes('microbusiness')) return true;
  return false;
}

function isActiveStatus(status: string | undefined): boolean {
  if (!status) return false;
  const normalized = status.trim().toLowerCase();
  return (
    normalized === 'active' ||
    normalized === 'approved' ||
    normalized === 'issued' ||
    normalized === 'operational'
  );
}

const STREET_ABBREV: Record<string, string> = {
  street: 'st',
  str: 'st',
  avenue: 'ave',
  av: 'ave',
  boulevard: 'blvd',
  road: 'rd',
  drive: 'dr',
  lane: 'ln',
  court: 'ct',
  place: 'pl',
  highway: 'hwy',
  parkway: 'pkwy',
  terrace: 'ter',
  square: 'sq',
  north: 'n',
  south: 's',
  east: 'e',
  west: 'w',
};

function normalizeAddressKey(address: string | undefined, zip: string | undefined): string | null {
  if (!address) return null;
  const base = address.toLowerCase().replace(/[.,#]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!base) return null;
  const parts = base
    .split(' ')
    .map((token) => STREET_ABBREV[token] ?? token)
    .filter(Boolean);
  const zipPart = zip ? zip.trim().slice(0, 5) : '';
  return `${parts.join(' ')}|${zipPart}`;
}

function normalizeNameKey(name: string | undefined): string | null {
  if (!name) return null;
  const cleaned = name
    .toLowerCase()
    .replace(/[.,'"]/g, '')
    .replace(/\b(llc|inc|corp|corporation|company|co|ltd|dba)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || null;
}

/**
 * Bulk match a list of storefront (address + name + zip) tuples against the
 * cache in a single pass. Returns a map keyed by the caller-provided id.
 */
export async function bulkMatchStorefronts(
  inputs: Array<{ id: string; address: string; zip: string; name?: string }>,
): Promise<Map<string, VerificationMatch>> {
  const snapshot = await getOcmCacheSnapshot();
  const results = new Map<string, VerificationMatch>();
  const asOf = snapshot ? new Date(snapshot.fetchedAt).toISOString() : new Date(0).toISOString();

  for (const input of inputs) {
    if (!snapshot) {
      results.set(input.id, {
        licensed: false,
        confidence: 'none',
        record: null,
        asOf,
        source: 'ocm_public_records',
      });
      continue;
    }

    const addrKey = normalizeAddressKey(input.address, input.zip);
    let match: OcmLicenseRecord | null = null;
    let confidence: VerificationMatch['confidence'] = 'none';

    if (addrKey) {
      const hits = snapshot.byNormalizedAddress.get(addrKey) ?? [];
      const active = hits.find((hit) => isActiveStatus(hit.license_status));
      if (active) {
        match = active;
        confidence = 'address';
      }
    }

    if (!match && input.name) {
      const nameKey = normalizeNameKey(input.name);
      if (nameKey) {
        const hits = snapshot.byNormalizedName.get(nameKey) ?? [];
        const active = hits.find((hit) => {
          if (!isActiveStatus(hit.license_status)) return false;
          if (input.zip && hit.zip_code) {
            return hit.zip_code.trim().slice(0, 5) === input.zip.trim().slice(0, 5);
          }
          return false;
        });
        if (active) {
          match = active;
          confidence = 'name';
        }
      }
    }

    results.set(input.id, {
      licensed: Boolean(match),
      confidence,
      record: match,
      asOf,
      source: 'ocm_public_records',
    });
  }

  return results;
}

/** Test / admin helper: force a refresh. */
export async function refreshOcmCacheNow(): Promise<void> {
  state.entry = null;
  await ensureRefresh();
}

/** Test-only helper: clear in-memory cache state between isolated test cases. */
export function clearOcmLicenseCacheForTests(): void {
  if (process.env.NODE_ENV !== 'test') {
    return;
  }

  state.entry = null;
  state.refreshInFlight = null;
}
