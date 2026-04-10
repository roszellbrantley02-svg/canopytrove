/**
 * OCM License Lookup Service
 *
 * Queries the NY Office of Cannabis Management public license registry
 * via the data.ny.gov SODA API to verify dispensary license numbers.
 *
 * Dataset: "Current OCM Licenses" (jskf-tt3q)
 * Docs:    https://data.ny.gov/Economic-Development/Current-OCM-Licenses/jskf-tt3q
 *
 * This data is public, open, and explicitly designed for verification —
 * the OCM requires licensed dispensaries to display a verification QR code.
 */

import { logger } from '../observability/logger';

const OCM_SODA_ENDPOINT = 'https://data.ny.gov/resource/jskf-tt3q.json';
const LOOKUP_TIMEOUT_MS = 10_000;

export type OcmLicenseRecord = {
  license_number: string;
  license_type: string;
  licensee_name: string;
  dba_name?: string;
  license_status: string;
  issue_date?: string;
  expiration_date?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
};

export type OcmLookupResult = {
  found: boolean;
  active: boolean;
  record: OcmLicenseRecord | null;
  matchScore: OcmMatchScore | null;
  error: string | null;
};

export type OcmMatchScore = {
  licenseMatch: boolean;
  nameMatch: boolean;
  statusActive: boolean;
  confidence: 'high' | 'medium' | 'low' | 'none';
};

/**
 * Look up a license number in the OCM public registry.
 */
export async function lookupOcmLicense(licenseNumber: string): Promise<OcmLookupResult> {
  const cleanLicense = licenseNumber.trim().toUpperCase();

  if (!cleanLicense) {
    return {
      found: false,
      active: false,
      record: null,
      matchScore: null,
      error: 'Empty license number',
    };
  }

  try {
    const url = `${OCM_SODA_ENDPOINT}?$where=upper(license_number)='${encodeSODAString(cleanLicense)}'&$limit=5`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);

    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      logger.warn('OCM SODA API returned non-200', { status: response.status });
      return {
        found: false,
        active: false,
        record: null,
        matchScore: null,
        error: `OCM API returned ${response.status}`,
      };
    }

    const records: OcmLicenseRecord[] = await response.json();

    if (!records.length) {
      return { found: false, active: false, record: null, matchScore: null, error: null };
    }

    const record = records[0];
    const active = isActiveLicenseStatus(record.license_status);

    return {
      found: true,
      active,
      record,
      matchScore: null, // Populated by verifyOwnerAgainstOcm
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown OCM lookup error';
    logger.error('OCM license lookup failed', { err: message, licenseNumber: cleanLicense });
    return { found: false, active: false, record: null, matchScore: null, error: message };
  }
}

/**
 * Verify an owner's submitted business information against the OCM registry.
 * Returns a match score indicating confidence level.
 */
export async function verifyOwnerAgainstOcm(input: {
  licenseNumber: string;
  businessName: string;
  storefrontName?: string;
}): Promise<OcmLookupResult> {
  const lookup = await lookupOcmLicense(input.licenseNumber);

  if (!lookup.found || !lookup.record) {
    return lookup;
  }

  const record = lookup.record;
  const licenseMatch = true; // Already matched by license number query
  const statusActive = isActiveLicenseStatus(record.license_status);
  const nameMatch = fuzzyBusinessNameMatch(
    input.businessName,
    record.licensee_name,
    record.dba_name,
    input.storefrontName,
  );

  let confidence: OcmMatchScore['confidence'] = 'none';
  if (licenseMatch && statusActive && nameMatch) {
    confidence = 'high';
  } else if (licenseMatch && statusActive) {
    confidence = 'medium'; // License is valid but name doesn't match well
  } else if (licenseMatch && nameMatch) {
    confidence = 'low'; // License exists but isn't active
  }

  return {
    ...lookup,
    matchScore: { licenseMatch, nameMatch, statusActive, confidence },
  };
}

/**
 * Determine the auto-verification decision based on OCM lookup results.
 */
export function resolveAutoVerificationDecision(result: OcmLookupResult): {
  autoApprove: boolean;
  autoReject: boolean;
  requiresManualReview: boolean;
  reason: string;
} {
  if (result.error) {
    return {
      autoApprove: false,
      autoReject: false,
      requiresManualReview: true,
      reason: `OCM lookup failed: ${result.error}. Queued for manual review.`,
    };
  }

  if (!result.found) {
    return {
      autoApprove: false,
      autoReject: false,
      requiresManualReview: true,
      reason: 'License number not found in OCM registry. Queued for manual review.',
    };
  }

  const score = result.matchScore;

  if (score?.confidence === 'high') {
    return {
      autoApprove: true,
      autoReject: false,
      requiresManualReview: false,
      reason: 'License verified: active license, business name matches OCM registry.',
    };
  }

  if (score?.confidence === 'medium') {
    return {
      autoApprove: false,
      autoReject: false,
      requiresManualReview: true,
      reason:
        'License is active in OCM but business name does not closely match. Queued for manual review.',
    };
  }

  if (score && !score.statusActive) {
    return {
      autoApprove: false,
      autoReject: false,
      requiresManualReview: true,
      reason: `License found but status is not active (${result.record?.license_status}). Queued for manual review.`,
    };
  }

  return {
    autoApprove: false,
    autoReject: false,
    requiresManualReview: true,
    reason: 'Low confidence match. Queued for manual review.',
  };
}

// --- Helpers ---

function isActiveLicenseStatus(status: string | undefined): boolean {
  if (!status) return false;
  const normalized = status.trim().toLowerCase();
  return normalized === 'active' || normalized === 'approved' || normalized === 'issued';
}

/**
 * Fuzzy match the owner's submitted business name against OCM licensee name / DBA.
 * Handles common variations: LLC, Inc, Corp, DBA, trailing whitespace, etc.
 */
function fuzzyBusinessNameMatch(
  submittedName: string,
  licenseeName: string,
  dbaName?: string,
  storefrontName?: string,
): boolean {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[.,'"]/g, '')
      .replace(/\b(llc|inc|corp|corporation|company|co|ltd|dba)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

  const submitted = normalize(submittedName);
  const licensee = normalize(licenseeName);
  const dba = dbaName ? normalize(dbaName) : '';
  const storefront = storefrontName ? normalize(storefrontName) : '';

  // Direct match against licensee name or DBA
  if (submitted === licensee || submitted === dba) return true;
  if (storefront && (storefront === licensee || storefront === dba)) return true;

  // Substring containment (either direction)
  if (submitted.length >= 4 && licensee.length >= 4) {
    if (submitted.includes(licensee) || licensee.includes(submitted)) return true;
  }
  if (dba && submitted.length >= 4 && dba.length >= 4) {
    if (submitted.includes(dba) || dba.includes(submitted)) return true;
  }
  if (storefront && storefront.length >= 4) {
    if (storefront.includes(licensee) || licensee.includes(storefront)) return true;
    if (dba && (storefront.includes(dba) || dba.includes(storefront))) return true;
  }

  return false;
}

/** Escape a string for use in a SODA $where clause. */
function encodeSODAString(value: string): string {
  return value.replace(/'/g, "''");
}
