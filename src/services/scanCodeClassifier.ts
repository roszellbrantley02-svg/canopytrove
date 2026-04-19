/**
 * Scan Code Classifier (client-side)
 *
 * Lightweight classifier used by VerifyScreen to decide how to route a
 * scanned code BEFORE hitting the backend. The big win is catching
 * generic URL QR codes (Weedmaps, Google Maps, a shop's own site) so
 * we can bounce the user straight to their browser instead of dragging
 * them through a pointless "product" screen.
 *
 * Everything else — UPC/EAN, recognized COA URLs, OCM license text —
 * stays in the existing ScanResult pipeline, which handles backend
 * resolution + rich rendering.
 *
 * Rules must stay in rough sync with backend/src/services/productCatalogService.ts
 * (isCoa + isHttpUrl). Don't be afraid to be more conservative here —
 * if we're unsure we'd rather send the scan through to the backend than
 * open the wrong browser tab.
 */

export type ScanCodeClassification =
  | { kind: 'external_url'; url: string }
  | { kind: 'resolve_via_backend' };

/**
 * Known lab COA domains. Kept short on purpose — we only bypass the
 * browser fallback for URLs that are clearly pointing at lab reports.
 */
const KNOWN_LAB_DOMAINS = [
  'kaychalabs.com',
  'nygreenanalytics.com',
  'proverdelabs.com',
  'keystonestatetesting.com',
  'actlabs.com',
] as const;

/**
 * Path/query segments that strongly indicate a COA document rather
 * than a generic brand/marketing page.
 */
const COA_PATH_HINTS = ['/coa', '/report', '/batch', '/certificate'];
const COA_QUERY_HINTS = ['coa=', 'batch=', 'report=', 'certificate='];

function isHttpUrl(value: string): boolean {
  if (!/^https?:\/\//i.test(value)) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function looksLikeCoaUrl(value: string): boolean {
  try {
    const u = new URL(value);
    const host = u.hostname.toLowerCase();
    if (KNOWN_LAB_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`))) {
      return true;
    }
    const path = u.pathname.toLowerCase();
    if (COA_PATH_HINTS.some((hint) => path.includes(hint))) {
      return true;
    }
    const search = u.search.toLowerCase();
    if (COA_QUERY_HINTS.some((hint) => search.includes(hint))) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Classify a raw scanned code. Returns `external_url` only when we're
 * confident it's a generic web link that should open in the browser.
 * Everything else defers to the backend resolver.
 */
export function classifyScannedCode(rawCode: string): ScanCodeClassification {
  const trimmed = rawCode.trim();
  if (!trimmed) return { kind: 'resolve_via_backend' };

  if (isHttpUrl(trimmed) && !looksLikeCoaUrl(trimmed)) {
    return { kind: 'external_url', url: trimmed };
  }

  return { kind: 'resolve_via_backend' };
}
