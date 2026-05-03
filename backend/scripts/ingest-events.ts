/* eslint-disable no-console */
// Auto-ingest events from public sources for the Travel & Events tab.
//
// Source list (extend this as more dispensaries publish their calendars):
//   1. yerbabuena.nyc/events — Yerba Buena Brooklyn brand activations
//
// Removed sources:
//   - cannabis.ny.gov/cannabis-control-board-meetings (2026-05-04)
//     Removed because public CCB meetings are policy/regulator content that
//     doesn't appeal to the average consumer using the Travel & Events tab.
//     The parser code (parseOcmCcb + buildOcmCcbEventDoc) is left in the
//     file for future reuse if we ever build an "owner news" or "industry
//     calendar" surface.
//
// The script fetches each source's HTML, extracts events with a small per-source
// parser, normalizes them into the EventDoc shape, and upserts each event by a
// deterministic id derived from the source + the event's stable fields. So
// re-running on schedule:
//   - Refreshes title/time/description/etc. when the source updates
//   - Doesn't create duplicates
//   - Doesn't touch other curated events
//
// Default = dry run. Pass `--execute` to write to Firestore.
//
//   FIREBASE_DATABASE_ID=canopytrove npx tsx \
//     backend/scripts/ingest-events.ts [--execute] [--source=yerba-buena|ocm-ccb|all]

import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { EVENTS_COLLECTION_NAME } from '../src/constants/collections';
import type { EventDoc } from '../src/services/eventsService';

const projectId = process.env.GCP_PROJECT || 'canopy-trove';
const databaseId = process.env.FIREBASE_DATABASE_ID || 'canopytrove';
const execute = process.argv.includes('--execute');
const sourceArg = (process.argv.find((a) => a.startsWith('--source=')) ?? '--source=all').split(
  '=',
)[1];

if (!getApps().length) {
  initializeApp({ credential: applicationDefault(), projectId });
}
const db = getFirestore(databaseId);

const NOW_ISO = new Date().toISOString();
const HTTP_HEADERS: HeadersInit = {
  // Polite UA: identifies us, points back to the company so site operators
  // can reach out if they want to ask us to back off or to provide a feed.
  'User-Agent': 'CanopyTroveEventsBot/1.0 (+https://canopytrove.com; askmehere@canopytrove.com)',
  Accept: 'text/html,application/xhtml+xml',
};
const FETCH_TIMEOUT_MS = 12_000;

async function fetchHtml(url: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: HTTP_HEADERS, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// ─── Yerba Buena Brooklyn parser ──────────────────────────────────────
// The Yerba Buena events page renders one card per upcoming event with the
// brand name, date, and time window. The exact HTML markup can change; this
// parser uses a permissive set of regexes targeting a few stable patterns
// (heading text + date string + time range) and is designed to fail-soft —
// when the structure changes, the parser logs and returns 0 events rather
// than throwing.
type YerbaEvent = {
  brand: string;
  startsAt: string;
  endsAt: string;
};

function parseYerbaBuena(html: string): YerbaEvent[] {
  const events: YerbaEvent[] = [];
  // Match patterns like: "Birdies @ Yerba Buena ... Thursday, May 7 ... 3:30 PM - 6:30 PM"
  // Heuristic: split on event card delimiters then look for date + time pair.
  const cardSplits = html.split(/<article|<li class="event|<div class="event/i).slice(1);
  for (const card of cardSplits) {
    const titleMatch = card.match(/>\s*([A-Za-z0-9&'\-. ]+?)\s*@\s*Yerba Buena\s*</i);
    const dateMatch = card.match(
      /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:,?\s+(\d{4}))?/,
    );
    const timeMatch = card.match(
      /(\d{1,2}:?\d{0,2})\s*(AM|PM)\s*[–—\-]\s*(\d{1,2}:?\d{0,2})\s*(AM|PM)/i,
    );
    if (!titleMatch || !dateMatch || !timeMatch) continue;

    const brand = titleMatch[1]!.trim();
    const month = monthIndex(dateMatch[1]!);
    const day = Number(dateMatch[2]);
    const year = dateMatch[3] ? Number(dateMatch[3]) : new Date().getUTCFullYear();
    const start = composeIso(year, month, day, timeMatch[1]!, timeMatch[2]!);
    const end = composeIso(year, month, day, timeMatch[3]!, timeMatch[4]!);
    if (!start || !end) continue;

    events.push({ brand, startsAt: start, endsAt: end });
  }
  return events;
}

function monthIndex(name: string): number {
  return [
    'january',
    'february',
    'march',
    'april',
    'may',
    'june',
    'july',
    'august',
    'september',
    'october',
    'november',
    'december',
  ].indexOf(name.toLowerCase());
}

function composeIso(
  year: number,
  monthIdx: number,
  day: number,
  time: string,
  ampm: string,
): string | null {
  if (monthIdx < 0) return null;
  const [hStr, mStr] = time.split(':');
  let hour = Number(hStr);
  const minute = mStr ? Number(mStr) : 0;
  const upper = ampm.toUpperCase();
  if (upper === 'PM' && hour < 12) hour += 12;
  if (upper === 'AM' && hour === 12) hour = 0;
  // Always emit -04:00 (ET DST) — the Travel & Events tab is NY-only.
  // Refine if we ever ingest non-ET sources.
  return `${year.toString().padStart(4, '0')}-${(monthIdx + 1)
    .toString()
    .padStart(2, '0')}-${day.toString().padStart(2, '0')}T${hour
    .toString()
    .padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00-04:00`;
}

function buildYerbaBuenaEventDoc(e: YerbaEvent): EventDoc {
  // Stable id keyed on date + brand slug — re-runs upsert without dupes.
  const date = e.startsAt.slice(0, 10);
  const brandSlug = e.brand
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return {
    id: `yerba-buena-${brandSlug}-${date}`,
    title: `${e.brand} @ Yerba Buena`,
    summary: `In-store brand activation at Yerba Buena Brooklyn featuring ${e.brand}. Meet the brand reps, sample, and shop on-site.`,
    description: `Yerba Buena (292 Atlantic Ave, Brooklyn) is hosting ${e.brand} for an in-store activation. Talk to brand reps, learn about the product line, and pick up the same day.\n\nIngested automatically from yerbabuena.nyc/events on ${NOW_ISO.slice(0, 10)}.`,
    category: 'brand_activation',
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    timezone: 'America/New_York',
    allDay: false,
    isMultiDay: false,
    venueName: 'Yerba Buena Dispensary',
    addressLine1: '292 Atlantic Avenue',
    city: 'Brooklyn',
    region: 'Brooklyn',
    state: 'NY',
    zip: '11201',
    placeId: null,
    latitude: 40.6904,
    longitude: -73.9926,
    hasDrivableLocation: true,
    organizerName: 'Yerba Buena',
    websiteUrl: 'https://yerbabuena.nyc/events',
    ticketUrl: null,
    isFree: true,
    priceLabel: 'Free entry',
    ageRestriction: '21+',
    photoUrl: null,
    tags: ['Brand activation', 'Brooklyn', 'Consumer', 'Free', e.brand],
    source: 'imported',
    hidden: false,
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO,
  };
}

// ─── OCM CCB monthly schedule parser ──────────────────────────────────
// The cannabis.ny.gov CCB meetings page lists upcoming meetings as a table
// or card list with date + city. We extract month/day/year + city to
// produce one EventDoc per future meeting.
type OcmCcbEvent = {
  startsAt: string;
  endsAt: string;
  city: string;
  region: string | null;
};

function parseOcmCcb(html: string): OcmCcbEvent[] {
  const events: OcmCcbEvent[] = [];
  const monthNames =
    'January|February|March|April|May|June|July|August|September|October|November|December';
  // Look for "Month D, YYYY" + a city label nearby. Common patterns observed:
  // "May 7, 2026" "Long Island" / "June 4, 2026 ... NYC" / "Garden City, NY"
  const dateRe = new RegExp(`(${monthNames})\\s+(\\d{1,2})(?:,\\s+(\\d{4}))?`, 'gi');
  let match: RegExpExecArray | null;
  while ((match = dateRe.exec(html)) !== null) {
    const month = monthIndex(match[1]!);
    const day = Number(match[2]);
    const year = match[3] ? Number(match[3]) : new Date().getUTCFullYear();
    if (month < 0) continue;

    // Look at the next 240 chars for a city label
    const window = html.slice(match.index, match.index + 240);
    const cityMatch = window.match(
      /(NYC|New York|Albany|Rochester|Newburgh|Long Island|Garden City|Buffalo|Syracuse)/i,
    );
    if (!cityMatch) continue;

    const startsAt = composeIso(year, month, day, '10', 'AM');
    const endsAt = composeIso(year, month, day, '1', 'PM');
    if (!startsAt || !endsAt) continue;

    const cityRaw = cityMatch[1]!.trim();
    let city = cityRaw;
    let region: string | null = null;
    if (/^Long Island$/i.test(cityRaw)) {
      city = 'Garden City';
      region = 'Long Island';
    } else if (/^Garden City$/i.test(cityRaw)) {
      region = 'Long Island';
    } else if (/^NYC$/i.test(cityRaw) || /^New York$/i.test(cityRaw)) {
      city = 'New York';
      region = 'NYC';
    } else if (/^Albany$/i.test(cityRaw)) {
      region = 'Capital District';
    } else if (/^Rochester$/i.test(cityRaw) || /^Buffalo$/i.test(cityRaw)) {
      region = 'Western NY';
    } else if (/^Newburgh$/i.test(cityRaw)) {
      region = 'Hudson Valley';
    }

    // Dedupe — sometimes a date appears twice on the page (heading + table)
    const dupe = events.some((e) => e.startsAt === startsAt);
    if (!dupe) events.push({ startsAt, endsAt, city, region });
  }
  return events;
}

function buildOcmCcbEventDoc(e: OcmCcbEvent): EventDoc {
  const date = e.startsAt.slice(0, 10);
  const cityLabel = e.region ?? e.city;
  const citySlug = cityLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return {
    id: `ocm-ccb-${date}-${citySlug}`,
    title: `NY Cannabis Control Board — ${cityLabel} Public Meeting`,
    summary: `OCM's monthly public board meeting, this month in ${cityLabel}. Open to the public + public comment period.`,
    description: `The Cannabis Control Board (CCB) holds its monthly public meeting in ${cityLabel} this month. Agenda items include regulatory updates, licensing decisions, and policy direction for New York's adult-use cannabis market. Public comment period included.\n\nExact venue and time-of-day are announced on cannabis.ny.gov a few days before the meeting. Live-streamed; in-person attendance is also welcome (pre-register via the OCM site).\n\nIngested automatically from cannabis.ny.gov/cannabis-control-board-meetings on ${NOW_ISO.slice(0, 10)}.`,
    category: 'advocacy',
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    timezone: 'America/New_York',
    allDay: false,
    isMultiDay: false,
    venueName: `NY Office of Cannabis Management — ${cityLabel}`,
    addressLine1: null,
    city: e.city,
    region: e.region,
    state: 'NY',
    zip: null,
    placeId: null,
    latitude: null,
    longitude: null,
    hasDrivableLocation: false,
    organizerName: 'NY Office of Cannabis Management',
    websiteUrl: 'https://cannabis.ny.gov/cannabis-control-board-meetings',
    ticketUrl: null,
    isFree: true,
    priceLabel: 'Free / public meeting',
    ageRestriction: 'All ages',
    photoUrl: null,
    tags: ['Public meeting', 'OCM', 'Policy', 'Free', cityLabel, 'Live-streamed'],
    source: 'imported',
    hidden: false,
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO,
  };
}

// ─── Source registry ──────────────────────────────────────────────────
type Source = {
  key: string;
  url: string;
  parse: (html: string) => EventDoc[];
};

const SOURCES: Source[] = [
  {
    key: 'yerba-buena',
    url: 'https://yerbabuena.nyc/events',
    parse: (html) => parseYerbaBuena(html).map(buildYerbaBuenaEventDoc),
  },
];

type IngestSourceResult = {
  written: number;
  skipped: number;
  parsed: number;
  respectedManual: number;
};

async function ingestSource(source: Source): Promise<IngestSourceResult> {
  console.log(`\n[source: ${source.key}]  fetching ${source.url}`);
  let html: string;
  try {
    html = await fetchHtml(source.url);
  } catch (err) {
    console.log(`  [fail] fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    return { written: 0, skipped: 0, parsed: 0, respectedManual: 0 };
  }
  let parsed: EventDoc[];
  try {
    parsed = source.parse(html);
  } catch (err) {
    console.log(`  [fail] parser threw: ${err instanceof Error ? err.message : String(err)}`);
    return { written: 0, skipped: 0, parsed: 0, respectedManual: 0 };
  }

  // Filter past events out at ingest time — sweeper will handle drift later.
  const cutoffIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const upcoming = parsed.filter((e) => (e.endsAt ?? e.startsAt) >= cutoffIso);

  console.log(`  parsed=${parsed.length}  upcoming=${upcoming.length}`);
  let written = 0;
  let skipped = 0;
  let respectedManual = 0;
  for (const e of upcoming) {
    // Curation-respect rule: if a doc with the same id already exists AND
    // its source is 'curated', leave it alone. The auto-parser uses default
    // values (e.g. 10 AM time) when the page doesn't surface specifics; a
    // hand-curated entry with a verified 11 AM time should not get clobbered.
    let respectExisting = false;
    try {
      const existing = await db.collection(EVENTS_COLLECTION_NAME).doc(e.id).get();
      if (existing.exists && (existing.data() as { source?: string }).source === 'curated') {
        respectExisting = true;
      }
    } catch {
      // best-effort — if read fails, fall through to write attempt
    }

    if (respectExisting) {
      respectedManual += 1;
      console.log(`  [skip-manual] ${e.id}  (curated entry exists, leaving as-is)`);
      continue;
    }

    if (!execute) {
      console.log(`  [dry] would upsert  ${e.id}  ("${e.title}")  ${e.startsAt}`);
      continue;
    }
    try {
      await db.collection(EVENTS_COLLECTION_NAME).doc(e.id).set(e, { merge: true });
      written += 1;
      console.log(`  [ok]  upserted     ${e.id}`);
    } catch (err) {
      skipped += 1;
      console.log(`  [fail] ${e.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { written, skipped, parsed: parsed.length, respectedManual };
}

async function main() {
  console.log('='.repeat(80));
  console.log(`Mode: ${execute ? '*** EXECUTE — writes will happen ***' : 'DRY RUN'}`);
  console.log(`Target: canopy-trove / ${databaseId} / ${EVENTS_COLLECTION_NAME}`);
  console.log(`Source filter: ${sourceArg}`);
  console.log('='.repeat(80));

  const selected = sourceArg === 'all' ? SOURCES : SOURCES.filter((s) => s.key === sourceArg);
  if (!selected.length) {
    console.log(
      `No matching sources for "${sourceArg}". Valid: ${SOURCES.map((s) => s.key).join(', ')}, all`,
    );
    process.exit(2);
  }

  let totalWritten = 0;
  let totalParsed = 0;
  let totalRespected = 0;
  for (const source of selected) {
    const r = await ingestSource(source);
    totalWritten += r.written;
    totalParsed += r.parsed;
    totalRespected += r.respectedManual;
  }

  console.log('');
  console.log('-'.repeat(80));
  if (execute) {
    console.log(
      `Ingest complete: ${totalParsed} parsed across sources, ${totalWritten} upserted, ${totalRespected} manual-curated entries left untouched.`,
    );
  } else {
    console.log(`Dry run complete: ${totalParsed} parsed. Re-run with --execute to apply.`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('FAILED', err);
    process.exit(1);
  });
