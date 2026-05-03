import { Platform } from 'react-native';
import type { AnalyticsMetadata } from '../types/analytics';

// Source attribution for the analytics pipeline. Captures, on web only:
//   - URL UTM parameters from the current page load (utm_source, utm_medium,
//     utm_campaign, utm_term, utm_content)
//   - document.referrer
//
// Persists FIRST-TOUCH attribution to localStorage so every future session
// from the same browser carries both:
//   - currentSource / currentReferrer (this session's entry)
//   - firstSource / firstReferrer    (the original entry for this install)
//
// Returns a metadata bag that gets merged into the `session_start` event,
// so every session is taggable in analytics by where the user originally
// came from + where they came from this time.

const FIRST_TOUCH_STORAGE_KEY = 'canopytrove.firstTouchAttribution.v1';

type WebStorageShim = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

type WebGlobalsShim = {
  location?: { search?: string };
  document?: { referrer?: string };
  localStorage?: WebStorageShim;
};

function getWebGlobals(): WebGlobalsShim | null {
  if (Platform.OS !== 'web') return null;
  if (typeof window === 'undefined') return null;
  return window as unknown as WebGlobalsShim;
}

function readUtmParams(search: string | undefined): Record<string, string> {
  if (!search || typeof search !== 'string') return {};
  // Drop the leading '?' if present
  const trimmed = search.startsWith('?') ? search.slice(1) : search;
  if (!trimmed) return {};
  const out: Record<string, string> = {};
  for (const pair of trimmed.split('&')) {
    const [rawKey, rawVal] = pair.split('=');
    if (!rawKey) continue;
    let key: string;
    try {
      key = decodeURIComponent(rawKey);
    } catch {
      continue;
    }
    if (!key.toLowerCase().startsWith('utm_')) continue;
    let value = '';
    if (rawVal) {
      try {
        value = decodeURIComponent(rawVal.replace(/\+/g, ' '));
      } catch {
        value = rawVal;
      }
    }
    out[key.toLowerCase()] = value.slice(0, 200); // hard cap to defend the analytics row
  }
  return out;
}

function readReferrer(globals: WebGlobalsShim): string | null {
  const ref = globals.document?.referrer?.trim();
  if (!ref) return null;
  // Strip trailing trash + cap length
  return ref.slice(0, 500);
}

function safeReferrerHost(referrer: string | null): string | null {
  if (!referrer) return null;
  try {
    return new URL(referrer).host;
  } catch {
    return null;
  }
}

type AcquisitionSnapshot = {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  term: string | null;
  content: string | null;
  referrer: string | null;
  referrerHost: string | null;
  capturedAt: string;
};

function snapshotFromGlobals(globals: WebGlobalsShim): AcquisitionSnapshot {
  const utm = readUtmParams(globals.location?.search);
  const referrer = readReferrer(globals);
  return {
    source: utm.utm_source ?? null,
    medium: utm.utm_medium ?? null,
    campaign: utm.utm_campaign ?? null,
    term: utm.utm_term ?? null,
    content: utm.utm_content ?? null,
    referrer,
    referrerHost: safeReferrerHost(referrer),
    capturedAt: new Date().toISOString(),
  };
}

function readFirstTouch(globals: WebGlobalsShim): AcquisitionSnapshot | null {
  try {
    const raw = globals.localStorage?.getItem(FIRST_TOUCH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AcquisitionSnapshot;
    if (typeof parsed !== 'object' || !parsed) return null;
    return parsed;
  } catch {
    return null;
  }
}

function persistFirstTouch(globals: WebGlobalsShim, snapshot: AcquisitionSnapshot) {
  try {
    globals.localStorage?.setItem(FIRST_TOUCH_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // localStorage can throw under quota or in private mode — best-effort.
  }
}

function snapshotIsBlank(s: AcquisitionSnapshot): boolean {
  return !s.source && !s.medium && !s.campaign && !s.referrer;
}

/**
 * Returns a metadata bag for `session_start` (and other session-wide events)
 * with current + first-touch attribution. Empty object on native or when no
 * attribution signal is present (direct visit, no UTM, no referrer).
 */
export function getAcquisitionAttributionMetadata(): AnalyticsMetadata {
  const globals = getWebGlobals();
  if (!globals) return {};

  const current = snapshotFromGlobals(globals);
  let firstTouch = readFirstTouch(globals);

  // First time we see ANY attribution signal: persist it as first-touch.
  // If first-touch is already set, never overwrite — that's the whole point.
  if (!firstTouch && !snapshotIsBlank(current)) {
    persistFirstTouch(globals, current);
    firstTouch = current;
  }

  const meta: AnalyticsMetadata = {};
  if (current.source) meta.currentUtmSource = current.source;
  if (current.medium) meta.currentUtmMedium = current.medium;
  if (current.campaign) meta.currentUtmCampaign = current.campaign;
  if (current.term) meta.currentUtmTerm = current.term;
  if (current.content) meta.currentUtmContent = current.content;
  if (current.referrerHost) meta.currentReferrerHost = current.referrerHost;
  if (current.referrer) meta.currentReferrer = current.referrer;

  if (firstTouch && firstTouch !== current) {
    if (firstTouch.source) meta.firstUtmSource = firstTouch.source;
    if (firstTouch.medium) meta.firstUtmMedium = firstTouch.medium;
    if (firstTouch.campaign) meta.firstUtmCampaign = firstTouch.campaign;
    if (firstTouch.referrerHost) meta.firstReferrerHost = firstTouch.referrerHost;
    if (firstTouch.capturedAt) meta.firstAttributionAt = firstTouch.capturedAt;
  } else if (firstTouch === current && !snapshotIsBlank(current)) {
    // Mark this session AS the first-touch so we can identify the moment of
    // acquisition vs all the returning sessions that follow.
    meta.isFirstTouchSession = true;
  }

  return meta;
}

/**
 * Test-only: clear the persisted first-touch snapshot.
 */
export function __resetAcquisitionAttributionForTests() {
  const globals = getWebGlobals();
  try {
    globals?.localStorage?.setItem(FIRST_TOUCH_STORAGE_KEY, '');
  } catch {
    // best effort
  }
}
