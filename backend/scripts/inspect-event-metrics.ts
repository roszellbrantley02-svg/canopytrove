/* eslint-disable no-console */
// Per-event metrics + tab-level funnel for the Travel & Events tab.
// Reads raw analytics_events. Aggregates in-memory.
//
// Outputs:
//   1. Tab funnel: events_tab_opened → event_opened (per session) → drive/website/tickets
//   2. Per-event scoreboard: opens, drive-there taps, website taps, ticket taps,
//      with "tap-through rate" = directional taps / opens
//   3. Per-region breakdown: NYC vs Brooklyn vs Hudson Valley vs Finger Lakes
//   4. Per-category breakdown: brand_activation vs consumer vs workshop, etc.
//   5. Source attribution snapshot: where new sessions come from (utm + referrer)
//
// Read-only. Run:
//   FIREBASE_DATABASE_ID=canopytrove npx tsx \
//     backend/scripts/inspect-event-metrics.ts [--days=30]

import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const projectId = process.env.GCP_PROJECT || 'canopy-trove';
const databaseId = process.env.FIREBASE_DATABASE_ID || 'canopytrove';
const daysArg = process.argv.find((a) => a.startsWith('--days='));
const DAYS_BACK = daysArg ? Math.max(1, Number(daysArg.split('=')[1])) : 30;

if (!getApps().length) {
  initializeApp({ credential: applicationDefault(), projectId });
}
const db = getFirestore(databaseId);

const SINCE_ISO = new Date(Date.now() - DAYS_BACK * 24 * 60 * 60 * 1000).toISOString();

type EventRow = {
  eventType?: string;
  installId?: string;
  sessionId?: string;
  occurredAt?: string;
  receivedAt?: string;
  metadata?: Record<string, unknown>;
};

const EVENT_TYPES_OF_INTEREST = [
  'events_tab_opened',
  'event_opened',
  'event_drive_there_tapped',
  'event_website_tapped',
  'event_tickets_tapped',
  'session_start',
];

function eventTime(e: EventRow): string {
  return e.occurredAt ?? e.receivedAt ?? '';
}

function pct(n: number, d: number): string {
  if (d === 0) return '   --';
  return ((n / d) * 100).toFixed(1).padStart(5) + '%';
}

function pad(s: string | number, w: number): string {
  return String(s).padEnd(w);
}
function rpad(n: number, w: number): string {
  return String(n).padStart(w);
}
function rule(label = ''): void {
  console.log('\n' + label);
  console.log('-'.repeat(80));
}

async function loadEvents(): Promise<EventRow[]> {
  // Firestore `in` clause caps at 30; we have 6 types so single query is fine.
  const snap = await db
    .collection('analytics_events')
    .where('eventType', 'in', EVENT_TYPES_OF_INTEREST)
    .get();
  return snap.docs.map((d) => d.data() as EventRow).filter((e) => eventTime(e) >= SINCE_ISO);
}

function getStr(metadata: Record<string, unknown> | undefined, key: string): string | null {
  if (!metadata) return null;
  const value = metadata[key];
  return typeof value === 'string' && value ? value : null;
}

function reportTabFunnel(events: EventRow[]) {
  rule(`[1] Travel & Events tab funnel — last ${DAYS_BACK}d`);

  const tabOpened = events.filter((e) => e.eventType === 'events_tab_opened');
  const eventOpened = events.filter((e) => e.eventType === 'event_opened');
  const driveTapped = events.filter((e) => e.eventType === 'event_drive_there_tapped');
  const websiteTapped = events.filter((e) => e.eventType === 'event_website_tapped');
  const ticketsTapped = events.filter((e) => e.eventType === 'event_tickets_tapped');

  const tabSessions = new Set(tabOpened.map((e) => e.sessionId).filter(Boolean) as string[]);
  const openSessions = new Set(eventOpened.map((e) => e.sessionId).filter(Boolean) as string[]);
  const driveSessions = new Set(driveTapped.map((e) => e.sessionId).filter(Boolean) as string[]);
  const tabInstalls = new Set(tabOpened.map((e) => e.installId).filter(Boolean) as string[]);
  const driveInstalls = new Set(driveTapped.map((e) => e.installId).filter(Boolean) as string[]);

  const directionalTaps = driveTapped.length + websiteTapped.length + ticketsTapped.length;

  console.log(
    `  events_tab_opened          ${rpad(tabOpened.length, 6)} events / ${rpad(tabSessions.size, 4)} sessions / ${rpad(tabInstalls.size, 4)} installs`,
  );
  console.log(
    `  event_opened (any source)  ${rpad(eventOpened.length, 6)} events / ${rpad(openSessions.size, 4)} sessions   ${pct(openSessions.size, tabSessions.size)} of tab sessions`,
  );
  console.log(
    `  event_drive_there_tapped   ${rpad(driveTapped.length, 6)} events / ${rpad(driveSessions.size, 4)} sessions / ${rpad(driveInstalls.size, 4)} installs   ${pct(driveTapped.length, eventOpened.length)} of detail opens`,
  );
  console.log(
    `  event_website_tapped       ${rpad(websiteTapped.length, 6)} events                        ${pct(websiteTapped.length, eventOpened.length)} of detail opens`,
  );
  console.log(
    `  event_tickets_tapped       ${rpad(ticketsTapped.length, 6)} events                        ${pct(ticketsTapped.length, eventOpened.length)} of detail opens`,
  );
  console.log(
    `  ANY directional CTA        ${rpad(directionalTaps, 6)} events                        ${pct(directionalTaps, eventOpened.length)} of detail opens`,
  );
}

function reportEventScoreboard(events: EventRow[]) {
  rule(`[2] Per-event scoreboard — last ${DAYS_BACK}d (sorted by detail opens)`);

  // Aggregate per eventId. We pull eventId from metadata.
  type EventStats = {
    title: string;
    city: string;
    region: string;
    category: string;
    opens: number;
    drives: number;
    websites: number;
    tickets: number;
  };
  const byId = new Map<string, EventStats>();

  function bumpFromEvent(
    e: EventRow,
    field: keyof Omit<EventStats, 'title' | 'city' | 'region' | 'category'>,
  ) {
    const id = getStr(e.metadata, 'eventId');
    if (!id) return;
    const existing = byId.get(id) ?? {
      title: getStr(e.metadata, 'eventTitle') ?? id,
      city: getStr(e.metadata, 'eventCity') ?? '?',
      region: getStr(e.metadata, 'eventRegion') ?? '?',
      category: getStr(e.metadata, 'eventCategory') ?? '?',
      opens: 0,
      drives: 0,
      websites: 0,
      tickets: 0,
    };
    existing[field] += 1;
    // Keep title/city/etc fresh from latest event in case earlier ones lacked them
    existing.title = getStr(e.metadata, 'eventTitle') ?? existing.title;
    existing.city = getStr(e.metadata, 'eventCity') ?? existing.city;
    existing.region = getStr(e.metadata, 'eventRegion') ?? existing.region;
    existing.category = getStr(e.metadata, 'eventCategory') ?? existing.category;
    byId.set(id, existing);
  }

  for (const e of events) {
    if (e.eventType === 'event_opened') bumpFromEvent(e, 'opens');
    else if (e.eventType === 'event_drive_there_tapped') bumpFromEvent(e, 'drives');
    else if (e.eventType === 'event_website_tapped') bumpFromEvent(e, 'websites');
    else if (e.eventType === 'event_tickets_tapped') bumpFromEvent(e, 'tickets');
  }

  if (byId.size === 0) {
    console.log('  (no per-event analytics yet — frontend ships event firing in the next deploy)');
    return;
  }

  const ranked = [...byId.entries()]
    .map(([id, stats]) => ({ id, ...stats }))
    .sort((a, b) => b.opens - a.opens);

  console.log(
    `  ${pad('opens', 6)} ${pad('drives', 7)} ${pad('site', 5)} ${pad('tix', 4)} ${pad('CTR', 6)}  ${pad('region', 14)} ${pad('city', 12)} title`,
  );
  console.log('  ' + '─'.repeat(78));
  for (const r of ranked.slice(0, 25)) {
    const directional = r.drives + r.websites + r.tickets;
    const ctr = pct(directional, r.opens);
    const cityClipped = r.city.slice(0, 12);
    const regionClipped = r.region.slice(0, 14);
    const titleClipped = r.title.slice(0, 38);
    console.log(
      `  ${rpad(r.opens, 6)} ${rpad(r.drives, 7)} ${rpad(r.websites, 5)} ${rpad(r.tickets, 4)} ${ctr}  ${pad(regionClipped, 14)} ${pad(cityClipped, 12)} ${titleClipped}`,
    );
  }
}

function reportRegionBreakdown(events: EventRow[]) {
  rule(`[3] Per-region engagement — last ${DAYS_BACK}d`);

  type RegionStats = { opens: number; drives: number; websites: number; tickets: number };
  const byRegion = new Map<string, RegionStats>();

  for (const e of events) {
    const region = getStr(e.metadata, 'eventRegion');
    if (!region) continue;
    const stats = byRegion.get(region) ?? { opens: 0, drives: 0, websites: 0, tickets: 0 };
    if (e.eventType === 'event_opened') stats.opens += 1;
    else if (e.eventType === 'event_drive_there_tapped') stats.drives += 1;
    else if (e.eventType === 'event_website_tapped') stats.websites += 1;
    else if (e.eventType === 'event_tickets_tapped') stats.tickets += 1;
    byRegion.set(region, stats);
  }

  if (byRegion.size === 0) {
    console.log('  (no per-event analytics yet)');
    return;
  }

  console.log(
    `  ${pad('region', 18)} ${pad('opens', 6)} ${pad('drives', 7)} ${pad('site', 5)} ${pad('tix', 4)} ${pad('CTR', 6)}`,
  );
  console.log('  ' + '─'.repeat(60));
  const sorted = [...byRegion.entries()].sort((a, b) => b[1].opens - a[1].opens);
  for (const [region, stats] of sorted) {
    const directional = stats.drives + stats.websites + stats.tickets;
    console.log(
      `  ${pad(region, 18)} ${rpad(stats.opens, 6)} ${rpad(stats.drives, 7)} ${rpad(stats.websites, 5)} ${rpad(stats.tickets, 4)} ${pct(directional, stats.opens)}`,
    );
  }
}

function reportCategoryBreakdown(events: EventRow[]) {
  rule(`[4] Per-category engagement — last ${DAYS_BACK}d`);

  const byCat = new Map<string, { opens: number; directional: number }>();
  for (const e of events) {
    const cat = getStr(e.metadata, 'eventCategory');
    if (!cat) continue;
    const stats = byCat.get(cat) ?? { opens: 0, directional: 0 };
    if (e.eventType === 'event_opened') stats.opens += 1;
    else if (
      e.eventType === 'event_drive_there_tapped' ||
      e.eventType === 'event_website_tapped' ||
      e.eventType === 'event_tickets_tapped'
    ) {
      stats.directional += 1;
    }
    byCat.set(cat, stats);
  }

  if (byCat.size === 0) {
    console.log('  (no per-event analytics yet)');
    return;
  }

  console.log(`  ${pad('category', 22)} ${pad('opens', 6)} ${pad('CTAs', 6)} ${pad('CTR', 6)}`);
  console.log('  ' + '─'.repeat(50));
  for (const [cat, stats] of [...byCat.entries()].sort((a, b) => b[1].opens - a[1].opens)) {
    console.log(
      `  ${pad(cat, 22)} ${rpad(stats.opens, 6)} ${rpad(stats.directional, 6)} ${pct(stats.directional, stats.opens)}`,
    );
  }
}

function reportSourceAttribution(events: EventRow[]) {
  rule(`[5] Source attribution — sessions with UTM/referrer (last ${DAYS_BACK}d)`);

  const sessionStarts = events.filter((e) => e.eventType === 'session_start');
  if (sessionStarts.length === 0) {
    console.log('  (no session_start events in window)');
    return;
  }

  let withAnyAttribution = 0;
  let firstTouchSessions = 0;
  const utmSources = new Map<string, number>();
  const referrerHosts = new Map<string, number>();
  const utmCampaigns = new Map<string, number>();

  for (const s of sessionStarts) {
    const m = s.metadata ?? {};
    const cur = getStr(m, 'currentUtmSource');
    const ref = getStr(m, 'currentReferrerHost');
    const camp = getStr(m, 'currentUtmCampaign');
    if (cur || ref) withAnyAttribution += 1;
    if (m.isFirstTouchSession === true) firstTouchSessions += 1;
    if (cur) utmSources.set(cur, (utmSources.get(cur) ?? 0) + 1);
    if (ref) referrerHosts.set(ref, (referrerHosts.get(ref) ?? 0) + 1);
    if (camp) utmCampaigns.set(camp, (utmCampaigns.get(camp) ?? 0) + 1);
  }

  console.log(
    `  total sessions:                ${rpad(sessionStarts.length, 6)}  (${withAnyAttribution} with any attribution = ${pct(withAnyAttribution, sessionStarts.length)})`,
  );
  console.log(`  sessions marked first-touch:   ${rpad(firstTouchSessions, 6)}`);

  if (utmSources.size > 0) {
    console.log(`\n  Top UTM sources:`);
    for (const [src, n] of [...utmSources.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
      console.log(`    ${rpad(n, 4)}  ${src}`);
    }
  } else {
    console.log(`\n  Top UTM sources:  (none yet — wire UTMs on inbound links + wait)`);
  }

  if (referrerHosts.size > 0) {
    console.log(`\n  Top referrer hosts:`);
    for (const [host, n] of [...referrerHosts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
      console.log(`    ${rpad(n, 4)}  ${host}`);
    }
  } else {
    console.log(`\n  Top referrer hosts:  (none yet)`);
  }

  if (utmCampaigns.size > 0) {
    console.log(`\n  Top UTM campaigns:`);
    for (const [camp, n] of [...utmCampaigns.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
      console.log(`    ${rpad(n, 4)}  ${camp}`);
    }
  }
}

async function main() {
  console.log('='.repeat(80));
  console.log(`Travel & Events analytics + source attribution snapshot`);
  console.log(`canopy-trove / ${databaseId}    last ${DAYS_BACK}d (since ${SINCE_ISO})`);
  console.log('='.repeat(80));

  const events = await loadEvents();
  console.log(`\nLoaded ${events.length} relevant events from analytics_events.`);

  reportTabFunnel(events);
  reportEventScoreboard(events);
  reportRegionBreakdown(events);
  reportCategoryBreakdown(events);
  reportSourceAttribution(events);

  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('FAILED', err);
    process.exit(1);
  });
