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
 * Phase 1 implementation plan:
 * - POST to `https://canopytrove-scraper-XXXX.run.app/render`
 *   with body `{ websiteUrl, respectRobotsTxt }`
 * - Service-to-service auth via Cloud Run audience token
 * - Returns ScrapedWebsiteContent or a structured failure
 *
 * Until the scraper service exists, this throws so any caller that
 * wires it up prematurely fails loudly instead of returning fake data.
 */
export async function scrapeWebsite(_options: ScrapeWebsiteOptions): Promise<ScrapeWebsiteResult> {
  // TODO(phase-1): wire to canopytrove-scraper service.
  //   1. Get the scraper service URL from env var SCRAPER_SERVICE_URL
  //   2. Mint a Cloud Run service-to-service ID token
  //   3. POST /render with the URL
  //   4. Map response to ScrapeWebsiteResult
  //   5. On 5xx, retry once with exponential backoff
  //   6. On 4xx, surface as 'invalid_url' or 'antibot_blocked'
  throw new Error(
    'aiShopWebsiteScraperService.scrapeWebsite: not implemented yet — see docs/AI_SHOP_BOOTSTRAP.md phase 1',
  );
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
