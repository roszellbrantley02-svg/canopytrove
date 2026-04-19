/**
 * Product COA (Certificate of Analysis) Catalog Service
 *
 * Parses COA URLs into a normalized ProductCOA shape.
 * Supports six NY lab URL formats plus a generic fallback.
 *
 * Most parsers extract only URL-derived fields (brand, batch, lab)
 * since full COA pages are behind PDF viewers or React apps.
 * HTML/PDF parsing is marked as TODO for future enhancement.
 */

import { logger } from '../observability/logger';
import type { LabName, ProductCOA } from '../types';

const FETCH_TIMEOUT_MS = 2_500;
const USER_AGENT =
  'Mozilla/5.0 (compatible; CanopyTrove/1.0; +https://canopytrove.com) like Safari/537.36';

/**
 * Detect which lab a COA URL belongs to based on domain/path patterns.
 */
export function detectLab(url: string): LabName | null {
  try {
    const urlObj = new URL(url);
    const host = urlObj.hostname.toLowerCase();
    const path = urlObj.pathname.toLowerCase();

    // Kaycha Labs: coa.kaychalabs.com/...
    if (host.includes('kaychalabs')) return 'kaycha_labs';
    if (host.includes('kaycha')) return 'kaycha_labs';

    // NY Green Analytics: nygreenanalytics.com/reports/...
    if (host.includes('nygreenanalytics') || host.includes('ny-green')) return 'ny_green_analytics';

    // ProVerde Laboratories: proverdelabs.com/coa/...
    if (host.includes('proverde')) return 'proverde_laboratories';

    // Keystone State Testing: keystonestatetesting.com/...
    if (host.includes('keystone') && host.includes('testing')) return 'keystone_state_testing';

    // ACT Laboratories: actlabs.com/coa/... or similar
    if (host.includes('actlabs') || (host.includes('act') && host.includes('lab')))
      return 'act_laboratories';

    // If we can't match, return null to signal "not a recognized lab"
    return null;
  } catch {
    return null;
  }
}

/**
 * Parse a Kaycha Labs COA URL.
 *
 * URL pattern: coa.kaychalabs.com/reports/{reportId}
 *
 * Currently extracts:
 *   - labName: 'kaycha_labs'
 *   - batchId from URL path if available
 *   - coaUrl and retrievedAt
 *
 * TODO: Fetch the COA page and parse HTML for brand, product, THC%, CBD%, etc.
 *       Most Kaycha COAs are behind a React app or PDF viewer.
 */
async function parseKaychaLabsCoa(url: string): Promise<ProductCOA | null> {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;

    // Try to extract report ID or batch ID from path
    // Pattern: /reports/{id} or /reports/{id}/...
    let batchId: string | undefined;
    const pathMatch = pathname.match(/\/reports\/([a-zA-Z0-9\-_]+)/);
    if (pathMatch && pathMatch[1]) {
      batchId = pathMatch[1];
    }

    return {
      labName: 'kaycha_labs',
      batchId,
      coaUrl: url,
      retrievedAt: new Date().toISOString(),
    };
  } catch (err) {
    logger.warn('[productCatalog] Failed to parse Kaycha Labs COA', {
      url,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Parse a NY Green Analytics COA URL.
 *
 * URL pattern: nygreenanalytics.com/reports/{reportId}
 *
 * Currently extracts:
 *   - labName: 'ny_green_analytics'
 *   - batchId from URL path if available
 *
 * TODO: Fetch page and extract brand, product, THC%, CBD%, test results.
 */
async function parseNyGreenAnalyticsCoa(url: string): Promise<ProductCOA | null> {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;

    let batchId: string | undefined;
    const pathMatch = pathname.match(/\/reports\/([a-zA-Z0-9\-_]+)/);
    if (pathMatch && pathMatch[1]) {
      batchId = pathMatch[1];
    }

    return {
      labName: 'ny_green_analytics',
      batchId,
      coaUrl: url,
      retrievedAt: new Date().toISOString(),
    };
  } catch (err) {
    logger.warn('[productCatalog] Failed to parse NY Green Analytics COA', {
      url,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Parse a ProVerde Laboratories COA URL.
 *
 * URL pattern: proverdelabs.com/coa/{reportId}
 *
 * Currently extracts:
 *   - labName: 'proverde_laboratories'
 *   - batchId from URL path if available
 *
 * TODO: Fetch page and extract brand, product, cannabinoid %, terpenes, contaminants.
 */
async function parseProVerdeCoa(url: string): Promise<ProductCOA | null> {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;

    let batchId: string | undefined;
    const pathMatch = pathname.match(/\/coa\/([a-zA-Z0-9\-_]+)/);
    if (pathMatch && pathMatch[1]) {
      batchId = pathMatch[1];
    }

    return {
      labName: 'proverde_laboratories',
      batchId,
      coaUrl: url,
      retrievedAt: new Date().toISOString(),
    };
  } catch (err) {
    logger.warn('[productCatalog] Failed to parse ProVerde COA', {
      url,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Parse a Keystone State Testing COA URL.
 *
 * URL pattern: keystonestatetesting.com/coa/{id} or similar
 *
 * Currently extracts:
 *   - labName: 'keystone_state_testing'
 *   - batchId from URL path if available
 *
 * TODO: Fetch page and extract brand, product, test results, pass/fail status.
 */
async function parseKeystoneStateTestingCoa(url: string): Promise<ProductCOA | null> {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const search = urlObj.search;

    let batchId: string | undefined;
    // Try common patterns: /coa/{id}, /test/{id}, ?id=..., ?batch=...
    const pathMatch = pathname.match(/\/(?:coa|test|reports?)\/([a-zA-Z0-9\-_]+)/);
    if (pathMatch && pathMatch[1]) {
      batchId = pathMatch[1];
    } else {
      const idParam = new URLSearchParams(search).get('id');
      if (idParam) batchId = idParam;
    }

    return {
      labName: 'keystone_state_testing',
      batchId,
      coaUrl: url,
      retrievedAt: new Date().toISOString(),
    };
  } catch (err) {
    logger.warn('[productCatalog] Failed to parse Keystone State Testing COA', {
      url,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Parse an ACT Laboratories COA URL.
 *
 * URL pattern: actlabs.com/coa/{id} or similar
 *
 * Currently extracts:
 *   - labName: 'act_laboratories'
 *   - batchId from URL path if available
 *
 * TODO: Fetch page and extract brand, product, cannabinoid %, terpenes, pass/fail.
 */
async function parseActLaboratoriesCoa(url: string): Promise<ProductCOA | null> {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const search = urlObj.search;

    let batchId: string | undefined;
    const pathMatch = pathname.match(/\/(?:coa|reports)?\/([a-zA-Z0-9\-_]+)/);
    if (pathMatch && pathMatch[1]) {
      batchId = pathMatch[1];
    } else {
      const idParam = new URLSearchParams(search).get('id');
      if (idParam) batchId = idParam;
    }

    return {
      labName: 'act_laboratories',
      batchId,
      coaUrl: url,
      retrievedAt: new Date().toISOString(),
    };
  } catch (err) {
    logger.warn('[productCatalog] Failed to parse ACT Laboratories COA', {
      url,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Generic COA URL parser for unrecognized labs.
 *
 * Attempts to extract any identifiable batch/brand tokens from the URL
 * path or query string using common patterns.
 *
 * Returns what can be derived from URL alone without fetching.
 */
async function parseGenericCoa(url: string): Promise<ProductCOA | null> {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const search = urlObj.search;

    let batchId: string | undefined;
    let brandName: string | undefined;

    // Try to extract common identifier patterns from path
    // e.g., /coa/123abc, /report/batch-xyz, /product/...
    const pathMatch = pathname.match(
      /\/(?:coa|report|reports|batch|product|test)\/([a-zA-Z0-9\-_\.]+)/i,
    );
    if (pathMatch && pathMatch[1]) {
      batchId = pathMatch[1];
    }

    // Try query parameters: id, batch, product, brand
    const params = new URLSearchParams(search);
    if (!batchId) {
      const idParam = params.get('id') || params.get('batch') || params.get('coa');
      if (idParam) batchId = idParam;
    }
    if (!brandName) {
      const brandParam = params.get('brand') || params.get('product');
      if (brandParam) brandName = brandParam;
    }

    return {
      labName: 'generic',
      brandName,
      batchId,
      coaUrl: url,
      retrievedAt: new Date().toISOString(),
    };
  } catch (err) {
    logger.warn('[productCatalog] Failed to parse generic COA URL', {
      url,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Main entry point: parse a COA URL into a ProductCOA object.
 *
 * Returns null if the URL is not recognized as a valid COA URL.
 * Never throws — always returns a structured result or null.
 */
export async function parseCoa(url: string): Promise<ProductCOA | null> {
  if (!url || typeof url !== 'string') {
    return null;
  }

  // Normalize and validate
  const trimmedUrl = url.trim();
  if (!trimmedUrl.match(/^https?:\/\//i)) {
    return null;
  }

  try {
    if (!isCoa(trimmedUrl)) {
      return null;
    }

    const lab = detectLab(trimmedUrl);

    // Route to appropriate parser based on detected lab
    switch (lab) {
      case 'kaycha_labs':
        return await parseKaychaLabsCoa(trimmedUrl);
      case 'ny_green_analytics':
        return await parseNyGreenAnalyticsCoa(trimmedUrl);
      case 'proverde_laboratories':
        return await parseProVerdeCoa(trimmedUrl);
      case 'keystone_state_testing':
        return await parseKeystoneStateTestingCoa(trimmedUrl);
      case 'act_laboratories':
        return await parseActLaboratoriesCoa(trimmedUrl);
      case null:
        // Not a recognized lab domain, try generic parser
        return await parseGenericCoa(trimmedUrl);
      default:
        return null;
    }
  } catch (err) {
    logger.warn('[productCatalog] Unexpected error parsing COA URL', {
      url: trimmedUrl,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Check if a URL string looks like it could be a COA URL.
 * Used by scanIngestionService to route scanned codes.
 */
/**
 * Check if a scanned string looks like a UPC, EAN, or ITF retail barcode.
 * Common cannabis product packaging carries these for inventory.
 *  - UPC-E: 8 digits
 *  - UPC-A: 12 digits
 *  - EAN-13: 13 digits
 *  - ITF-14: 14 digits
 */
export function isUpc(code: string): boolean {
  if (!code || typeof code !== 'string') return false;
  const trimmed = code.trim();
  if (!/^\d+$/.test(trimmed)) return false;
  const len = trimmed.length;
  return len === 8 || len === 12 || len === 13 || len === 14;
}

/**
 * Build a minimal ProductCOA shell from a UPC scan when we don't yet have
 * the product in our catalog. Frontend will surface the soft-prompt
 * crowdsource flow so the next user gets a richer answer.
 */
export function buildUpcOnlyCoa(upc: string): ProductCOA {
  return {
    labName: 'unknown_lab',
    upc: upc.trim(),
    retrievedAt: new Date().toISOString(),
  };
}

/**
 * Build an "unknown_lab" ProductCOA from any URL we can't confidently
 * route to a known lab parser. Treats the URL as evidence of a product
 * scan (vs total garbage) so the user isn't dumped to manual entry.
 */
export function buildUnknownLabCoa(url: string): ProductCOA {
  return {
    labName: 'unknown_lab',
    coaUrl: url.trim(),
    retrievedAt: new Date().toISOString(),
  };
}

/**
 * Lighter-touch URL check: any well-formed http(s) URL is plausible
 * product scan content (brand microsite, COA, etc.). Used as a fallback
 * after isCoa() so we still classify it as a product instead of unknown.
 */
export function isHttpUrl(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;
  try {
    // eslint-disable-next-line no-new
    new URL(trimmed);
    return true;
  } catch {
    return false;
  }
}

export function isCoa(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed.match(/^https?:\/\//i)) return false;

  const lab = detectLab(trimmed);
  // Recognized lab or URL has coa-like patterns
  if (lab) return true;

  // Check for generic COA patterns: /coa, /report, ?id=, /batch, etc.
  try {
    const urlObj = new URL(trimmed);
    const pathname = urlObj.pathname.toLowerCase();
    const search = urlObj.search.toLowerCase();

    return (
      pathname.includes('/coa') ||
      pathname.includes('/report') ||
      pathname.includes('/batch') ||
      search.includes('coa=') ||
      search.includes('batch=') ||
      search.includes('id=') ||
      search.includes('report=')
    );
  } catch {
    return false;
  }
}
