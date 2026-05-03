/**
 * Client wrapper around the separate canopytrove-scraper Cloud Run service.
 *
 * The actual Playwright + Chromium runtime lives in a SEPARATE Cloud Run
 * service (`canopytrove-scraper`) so its 1.5 GB Playwright base image
 * doesn't bloat the main API image and so we can scale memory/concurrency
 * independently. See docs/AI_SHOP_BOOTSTRAP.md for the full architecture.
 *
 * This file is the API-side HTTP client + retry/timeout logic. The actual
 * scraping code lives in a separate package (planned: `services/scraper/`)
 * that runs on its own Cloud Run service with `mcr.microsoft.com/playwright`
 * as the Docker base.
 *
 * Phase 1 status: SCAFFOLD ONLY — the real scraper service does not yet
 * exist. The function shape is real; the implementation throws
 * `not_implemented` until phase-1 build wires up Browserless OR our own
 * scraper.
 */

import type { ScrapedWebsiteContent } from '../types/aiShopBootstrap';

export type ScrapeWebsiteOptions = {
  websiteUrl: string;
  // Hard wall-clock cap. Cloud Run max is 60 minutes; for owner-facing
  // bootstrap UX we should never wait more than 90s.
  timeoutMs?: number;
  // Whether to honor robots.txt. Default true. Owner-claim flow constitutes
  // consent for their own site, so we still honor robots out of safety.
  respectRobotsTxt?: boolean;
};

export type ScrapeWebsiteResult =
  | { ok: true; content: ScrapedWebsiteContent }
  | {
      ok: false;
      reason:
        | 'robots_blocked'
        | 'timeout'
        | 'unreachable'
        | 'antibot_blocked'
        | 'invalid_url'
        | 'service_unavailable'
        | 'unknown';
      message: string;
    };

const DEFAULT_TIMEOUT_MS = 90_000;

/**
 * Submit a URL to the scraper service and wait for the rendered content.
 *
 * Service-to-service auth: when running on Cloud Run, we mint an
 * audience token via the metadata server. Locally (for testing),
 * setting SCRAPER_ALLOW_UNAUTH=1 skips auth.
 *
 * Env vars consumed:
 *   SCRAPER_SERVICE_URL    — base URL of canopytrove-scraper Cloud Run service
 *   SCRAPER_ALLOW_UNAUTH   — '1' to skip ID-token minting (local dev only)
 */
export async function scrapeWebsite(options: ScrapeWebsiteOptions): Promise<ScrapeWebsiteResult> {
  const validation = validateScrapeUrl(options.websiteUrl);
  if (!validation.ok) {
    return {
      ok: false,
      reason: 'invalid_url',
      message: `Invalid URL (${validation.reason ?? 'unknown'}).`,
    };
  }

  const baseUrl = (process.env.SCRAPER_SERVICE_URL ?? '').replace(/\/+$/, '');
  if (!baseUrl) {
    return {
      ok: false,
      reason: 'service_unavailable',
      message: 'SCRAPER_SERVICE_URL is not configured.',
    };
  }

  const renderUrl = `${baseUrl}/render`;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let authHeader: Record<string, string> = {};
  if (process.env.SCRAPER_ALLOW_UNAUTH !== '1') {
    try {
      const idToken = await mintCloudRunIdToken(baseUrl);
      authHeader = { Authorization: `Bearer ${idToken}` };
    } catch (error) {
      return {
        ok: false,
        reason: 'service_unavailable',
        message: `Failed to mint scraper auth token: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(renderUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader,
      },
      body: JSON.stringify({
        websiteUrl: options.websiteUrl,
        respectRobotsTxt: options.respectRobotsTxt !== false,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeout);
    const message = error instanceof Error ? error.message : String(error);
    if (/aborted/i.test(message)) {
      return { ok: false, reason: 'timeout', message };
    }
    return { ok: false, reason: 'service_unavailable', message };
  }
  clearTimeout(timeout);

  let json: unknown;
  try {
    json = await response.json();
  } catch (error) {
    return {
      ok: false,
      reason: 'service_unavailable',
      message: `Scraper returned non-JSON response (${response.status}).`,
    };
  }

  if (!response.ok) {
    const payload = json as { reason?: string; message?: string; error?: string; detail?: string };
    const reason = mapHttpReason(response.status, payload.reason);
    // Surface `detail` when present — that's where the scraper puts
    // the underlying exception text (e.g. "browserType.launch:
    // Executable doesn't exist"). Without this, the API just sees
    // a generic "render threw" and the owner has no actionable info.
    const detailedMessage =
      payload.detail || payload.message || payload.error || `Scraper returned ${response.status}`;
    return {
      ok: false,
      reason,
      message: detailedMessage,
    };
  }

  const payload = json as { ok: boolean; content?: ScrapedWebsiteContent };
  if (!payload.ok || !payload.content) {
    return {
      ok: false,
      reason: 'unknown',
      message: 'Scraper returned ok=false without content.',
    };
  }

  return { ok: true, content: payload.content };
}

type ScrapeFailureReason = Extract<ScrapeWebsiteResult, { ok: false }>['reason'];

function mapHttpReason(status: number, serverReason: string | undefined): ScrapeFailureReason {
  if (serverReason === 'robots_blocked') return 'robots_blocked';
  if (serverReason === 'timeout') return 'timeout';
  if (serverReason === 'antibot_blocked') return 'antibot_blocked';
  if (serverReason === 'unreachable') return 'unreachable';
  if (status === 422) return 'unreachable';
  if (status === 403) return 'antibot_blocked';
  if (status === 400) return 'invalid_url';
  if (status >= 500) return 'service_unavailable';
  return 'unknown';
}

/**
 * Mint a Cloud Run-style ID token for service-to-service auth. On
 * Cloud Run / GCE this hits the metadata server; off-cloud (local dev),
 * uses application default credentials. Lazy-loads google-auth-library
 * so the dependency is only required when the auth path actually runs.
 */
async function mintCloudRunIdToken(targetAudience: string): Promise<string> {
  // Dynamic import keeps google-auth-library out of the cold-start path
  // for non-scraper code paths.
  const { GoogleAuth } = await import('google-auth-library');
  const auth = new GoogleAuth();
  const client = await auth.getIdTokenClient(targetAudience);
  const headers = (await client.getRequestHeaders(targetAudience)) as unknown;
  // google-auth-library returns either a plain object or a Headers
  // instance depending on version; normalize either way.
  let authHeader = '';
  if (headers && typeof (headers as Headers).get === 'function') {
    authHeader = (headers as Headers).get('Authorization') ?? '';
  } else if (headers && typeof headers === 'object') {
    const obj = headers as Record<string, string>;
    authHeader = obj['Authorization'] ?? obj['authorization'] ?? '';
  }
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    throw new Error('GoogleAuth returned empty Authorization header.');
  }
  return token;
}

/**
 * Light synchronous validation we can do without spinning up Playwright.
 * Used to reject obviously invalid input before the scraper is invoked.
 */
export function validateScrapeUrl(websiteUrl: string): {
  ok: boolean;
  reason?: 'empty' | 'invalid_protocol' | 'invalid_url';
} {
  const trimmed = websiteUrl.trim();
  if (!trimmed) return { ok: false, reason: 'empty' };
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, reason: 'invalid_url' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'invalid_protocol' };
  }
  return { ok: true };
}

export { DEFAULT_TIMEOUT_MS };
