/**
 * Brand Page Resolver Service
 *
 * When a QR scan lands us on a brand's marketing URL (not a recognized NY
 * lab domain), we fetch the page and look for an embedded link/iframe
 * pointing to one of our known labs. If we find one, we delegate to
 * parseCoa() so the shopper gets verified lab data in-app even though
 * they scanned the brand's site.
 *
 * This is intentionally *just* the chain-through path. We do not scrape
 * potency or terpenes from the brand's own page — if chain-through fails,
 * the caller falls back to offering a "Visit brand site" button instead.
 *
 * Fail-soft: any fetch/parse error returns { outcome: 'none' } so the
 * caller falls back to existing unrecognized_lab behavior. Never throws.
 *
 * Safety:
 *   - SSRF guard: rejects localhost / RFC1918 / link-local / metadata IPs.
 *   - Size cap: aborts after MAX_HTML_BYTES to prevent memory blow-ups.
 *   - Timeout: tight budget so scans stay sub-second.
 *   - Content-type check: refuses non-HTML responses.
 */

import { logger } from '../observability/logger';
import { detectLab, parseCoa } from './productCatalogService';
import type { ProductCOA } from '../types';

const FETCH_TIMEOUT_MS = 2_500;
const MAX_HTML_BYTES = 1_000_000; // 1 MB — plenty for a product page, cheap if abused.
const USER_AGENT =
  'Mozilla/5.0 (compatible; CanopyTrove/1.0; +https://canopytrove.com) like Safari/537.36';

export type BrandPageResolution =
  | { outcome: 'chained_to_known_lab'; coa: ProductCOA; sourceLabUrl: string }
  | { outcome: 'none' };

/**
 * Reject URLs that could be used for SSRF or that are obviously unsafe to
 * fetch server-side. Returns the URL object if safe, null otherwise.
 */
function parseSafeUrl(rawUrl: string): URL | null {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;

    const host = u.hostname.toLowerCase();

    // Block localhost and loopback
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0') {
      return null;
    }

    // Block AWS/GCP instance metadata service
    if (host === '169.254.169.254' || host === 'metadata.google.internal') return null;

    // Block RFC1918 private ranges
    if (/^10\./.test(host)) return null;
    if (/^192\.168\./.test(host)) return null;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return null;

    // Block link-local
    if (/^169\.254\./.test(host)) return null;
    if (host.startsWith('fe80:')) return null;

    return u;
  } catch {
    return null;
  }
}

/**
 * Fetch an HTML page with timeout + size cap + content-type check.
 * Returns the HTML body as a string, or null on any failure.
 */
async function fetchHtml(url: URL): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      logger.debug('[brandPageResolver] Non-OK response', {
        url: url.toString(),
        status: response.status,
      });
      return null;
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (
      !contentType.includes('text/html') &&
      !contentType.includes('application/xhtml') &&
      !contentType.includes('text/plain')
    ) {
      return null;
    }

    const reader = response.body?.getReader();
    if (!reader) return null;

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_HTML_BYTES) {
        await reader.cancel().catch(() => undefined);
        logger.debug('[brandPageResolver] Response exceeded size cap', {
          url: url.toString(),
          cap: MAX_HTML_BYTES,
        });
        break;
      }
      chunks.push(value);
    }

    const combined = new Uint8Array(totalBytes > MAX_HTML_BYTES ? MAX_HTML_BYTES : totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      if (offset + chunk.byteLength > combined.length) {
        combined.set(chunk.subarray(0, combined.length - offset), offset);
        break;
      }
      combined.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder('utf-8', { fatal: false }).decode(combined);
  } catch (err) {
    logger.debug('[brandPageResolver] Fetch failed', {
      url: url.toString(),
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Pull every src/href URL out of an HTML document. Cheap regex-based —
 * good enough for our purposes since we only need to identify whether any
 * of them belong to a known lab domain.
 */
function extractAllLinks(html: string, baseUrl: URL): string[] {
  const results = new Set<string>();
  const pattern = /(?:src|href)\s*=\s*["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const raw = match[1];
    if (!raw) continue;
    if (raw.startsWith('#') || raw.startsWith('javascript:') || raw.startsWith('data:')) continue;
    if (raw.startsWith('mailto:') || raw.startsWith('tel:')) continue;
    try {
      const resolved = new URL(raw, baseUrl);
      if (resolved.protocol === 'http:' || resolved.protocol === 'https:') {
        results.add(resolved.toString());
      }
    } catch {
      // skip malformed
    }
  }
  return Array.from(results);
}

/**
 * Main entry point. Resolves a brand-site URL to either:
 *   - a chained-through known-lab COA (as if they'd scanned the lab URL), or
 *   - no useful info ({ outcome: 'none' }) — caller should fall back to
 *     offering a "Visit brand site" button.
 *
 * Never throws; all errors become { outcome: 'none' }.
 */
export async function resolveBrandPage(rawUrl: string): Promise<BrandPageResolution> {
  const safeUrl = parseSafeUrl(rawUrl);
  if (!safeUrl) {
    return { outcome: 'none' };
  }

  const html = await fetchHtml(safeUrl);
  if (!html) {
    return { outcome: 'none' };
  }

  try {
    const links = extractAllLinks(html, safeUrl);
    for (const link of links) {
      if (!detectLab(link)) continue;
      const coa = await parseCoa(link);
      if (coa) {
        logger.info('[brandPageResolver] Chained to known lab', {
          brandUrl: safeUrl.toString(),
          sourceLabUrl: link,
          labName: coa.labName,
        });
        return {
          outcome: 'chained_to_known_lab',
          coa,
          sourceLabUrl: link,
        };
      }
    }
  } catch (err) {
    logger.debug('[brandPageResolver] Chain-through attempt failed', {
      brandUrl: safeUrl.toString(),
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return { outcome: 'none' };
}
