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
 *   - SSRF guard: rejects localhost / RFC1918 / link-local / metadata IPs
 *     based on the *resolved* IP, not the hostname string (prevents DNS
 *     rebinding via attacker-controlled DNS records).
 *   - Manual redirect handling: each Location hop is re-validated against
 *     the SSRF rules (prevents 302-to-metadata bypass).
 *   - Size cap: aborts after MAX_HTML_BYTES to prevent memory blow-ups.
 *   - Timeout: tight budget so scans stay sub-second.
 *   - Content-type check: refuses non-HTML responses.
 */

import { lookup as dnsLookup } from 'node:dns/promises';
import type { LookupAddress } from 'node:dns';
import { logger } from '../observability/logger';
import { detectLab, parseCoa } from './productCatalogService';
import type { ProductCOA } from '../types';

const FETCH_TIMEOUT_MS = 2_500;
const MAX_HTML_BYTES = 1_000_000; // 1 MB — plenty for a product page, cheap if abused.
const MAX_REDIRECTS = 5;
const USER_AGENT =
  'Mozilla/5.0 (compatible; CanopyTrove/1.0; +https://canopytrove.com) like Safari/537.36';

export type BrandPageResolution =
  | { outcome: 'chained_to_known_lab'; coa: ProductCOA; sourceLabUrl: string }
  | { outcome: 'none' };

/**
 * Returns true if the literal IP address (v4 or v6) is in a range we refuse
 * to send server-side requests to (loopback, link-local, RFC1918, ULA,
 * IPv4-mapped IPv6, cloud metadata IPs, CGNAT). Exported only for tests.
 */
export function isBlockedIp(ip: string): boolean {
  if (!ip) return true;
  const lower = ip.toLowerCase();

  // IPv4 dotted-decimal
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(lower);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 10) return true; // RFC1918
    if (a === 127) return true; // loopback
    if (a === 169 && b === 254) return true; // link-local + AWS/GCP metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
    if (a === 192 && b === 168) return true; // RFC1918
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast + reserved
    return false;
  }

  // IPv6
  if (lower === '::' || lower === '::1') return true;
  if (lower.startsWith('fe80:') || lower.startsWith('fe80::')) return true; // link-local
  // Unique Local Addresses fc00::/7 — first byte is fc or fd
  if (/^f[cd][0-9a-f]{0,2}:/.test(lower)) return true;
  // IPv4-mapped IPv6 (::ffff:a.b.c.d) — recurse on the embedded IPv4
  const mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(lower);
  if (mapped) return isBlockedIp(mapped[1]);
  // 6to4 (2002::/16) — high 32 bits encode an IPv4. If those bits map to a
  // blocked IPv4 range we reject. Format: 2002:wwxx:yyzz:...
  const sixToFour = /^2002:([0-9a-f]{1,4}):([0-9a-f]{1,4}):/.exec(lower);
  if (sixToFour) {
    const high = parseInt(sixToFour[1].padStart(4, '0'), 16);
    const low = parseInt(sixToFour[2].padStart(4, '0'), 16);
    const a = (high >> 8) & 0xff;
    const b = high & 0xff;
    const c = (low >> 8) & 0xff;
    const d = low & 0xff;
    if (isBlockedIp(`${a}.${b}.${c}.${d}`)) return true;
  }
  return false;
}

/**
 * Reject URLs that could be used for SSRF or that are obviously unsafe to
 * fetch server-side. Resolves the hostname to an IP and validates the IP
 * (so attacker-controlled DNS pointing at private space is caught).
 * Returns the URL object if safe, null otherwise.
 */
async function parseSafeUrl(rawUrl: string): Promise<URL | null> {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;

  const host = u.hostname.toLowerCase();

  // Belt: cheap hostname-string check catches the obvious literal cases
  // before we even spend a DNS round-trip.
  if (host === 'localhost' || host === 'metadata.google.internal') return null;

  // Suspenders: resolve and validate against block ranges. Catches DNS
  // rebinding (attacker DNS resolving public-looking name → 127.0.0.1).
  // We resolve all addresses and reject if ANY is in a blocked range —
  // an attacker who points a host at both a public IP and a private one
  // shouldn't get to pick which we connect to.
  let addresses: LookupAddress[];
  try {
    // `all: true` selects the array overload of dnsLookup. TypeScript's
    // overload resolution can't narrow the union return type purely from
    // the option object, so we annotate the destination explicitly.
    addresses = await dnsLookup(host, { all: true, verbatim: true });
  } catch {
    return null;
  }
  if (!addresses.length) return null;
  for (const { address } of addresses) {
    if (isBlockedIp(address)) return null;
  }
  return u;
}

/**
 * Fetch an HTML page with timeout + size cap + content-type check + manual
 * redirect handling. Each redirect Location is re-validated through
 * parseSafeUrl so a 302 to http://169.254.169.254/ can't bypass the SSRF
 * guard. Returns the HTML body as a string, or null on any failure.
 */
async function fetchHtml(initialUrl: URL): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    let current = initialUrl;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const response = await fetch(current.toString(), {
        method: 'GET',
        redirect: 'manual',
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: controller.signal,
      });

      // Manual redirect handling: re-validate every Location hop.
      if (response.status >= 300 && response.status < 400 && response.status !== 304) {
        if (hop === MAX_REDIRECTS) {
          logger.debug('[brandPageResolver] Redirect cap hit', { url: current.toString() });
          return null;
        }
        const location = response.headers.get('location');
        if (!location) return null;
        let nextUrlString: string;
        try {
          nextUrlString = new URL(location, current).toString();
        } catch {
          return null;
        }
        const nextSafe = await parseSafeUrl(nextUrlString);
        if (!nextSafe) {
          logger.debug('[brandPageResolver] Redirect blocked by SSRF guard', {
            from: current.toString(),
            to: nextUrlString,
          });
          return null;
        }
        current = nextSafe;
        continue;
      }

      if (!response.ok) {
        logger.debug('[brandPageResolver] Non-OK response', {
          url: current.toString(),
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
            url: current.toString(),
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
    }
    return null;
  } catch (err) {
    logger.debug('[brandPageResolver] Fetch failed', {
      url: initialUrl.toString(),
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
  const safeUrl = await parseSafeUrl(rawUrl);
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
