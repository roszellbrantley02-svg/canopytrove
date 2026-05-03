/* eslint-disable no-console */
// Two questions, one script:
//   1) Top 50 search queries in the last 30 days (extracted from raw events
//      because analytics_daily_query_metrics is currently empty)
//   2) Real funnel reconstruction from raw analytics_events grouped by
//      installId/sessionId, showing where signup, review, and storefront
//      flows actually leak.
//
// Read-only. Run:
//   FIREBASE_DATABASE_ID=canopytrove npx tsx \
//     backend/scripts/inspect-funnel-and-queries.ts

import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const projectId = process.env.GCP_PROJECT || 'canopy-trove';
const databaseId = process.env.FIREBASE_DATABASE_ID || 'canopytrove';
if (!getApps().length) {
  initializeApp({ credential: applicationDefault(), projectId });
}
const db = getFirestore(databaseId);

const DAYS_BACK = 30;
const SINCE_ISO = new Date(Date.now() - DAYS_BACK * 24 * 60 * 60 * 1000).toISOString();

type EventDoc = {
  eventType?: string;
  installId?: string;
  sessionId?: string;
  occurredAt?: string;
  receivedAt?: string;
  storefrontId?: string;
  metadata?: Record<string, unknown>;
  screen?: string;
};

// Event types relevant to the two questions.
const FUNNEL_EVENT_TYPES = [
  'search_submitted',
  'signup_started',
  'signup_completed',
  'signup_failed',
  'review_started',
  'review_submitted',
  'storefront_impression',
  'storefront_opened',
  'go_now_tapped',
  'website_tapped',
  'phone_tapped',
  'menu_tapped',
];

function pad(s: string | number, w: number) {
  return String(s).padEnd(w);
}
function rpad(n: number, w: number) {
  return String(n).padStart(w);
}
function pct(n: number, d: number) {
  if (d === 0) return '  -- ';
  return ((n / d) * 100).toFixed(1).padStart(4) + '%';
}
function rule(label = '') {
  console.log('\n' + label);
  console.log('-'.repeat(80));
}

function eventTime(e: EventDoc): string {
  return e.occurredAt ?? e.receivedAt ?? '';
}

function isInWindow(e: EventDoc): boolean {
  const t = eventTime(e);
  return Boolean(t) && t >= SINCE_ISO;
}

async function loadEventsByType(types: string[]): Promise<EventDoc[]> {
  // Firestore `in` clause caps at 30. We have <=12, so single query is fine.
  // Cannot also range-filter occurredAt without a composite index; we filter
  // the date in memory. At ~18K events / 30 days this is still fast.
  const snap = await db.collection('analytics_events').where('eventType', 'in', types).get();
  return snap.docs.map((d) => d.data() as EventDoc).filter(isInWindow);
}

// ─────────────────────────────────────────────────────────────────────
// Question 1 — top search queries
// ─────────────────────────────────────────────────────────────────────

function reportTopQueries(events: EventDoc[]) {
  const queries = events.filter((e) => e.eventType === 'search_submitted');
  rule(`[Q1] Top search queries — last ${DAYS_BACK}d (${queries.length} search_submitted events)`);

  if (!queries.length) {
    console.log('  (no search_submitted events in window)');
    return;
  }

  const counts = new Map<string, { count: number; uniqueInstalls: Set<string> }>();
  let withQuery = 0;
  let withoutQuery = 0;

  for (const e of queries) {
    const meta = (e.metadata ?? {}) as Record<string, unknown>;
    // Try a few likely field names — query, q, term, searchTerm, text
    const raw =
      (meta.query as string | undefined) ??
      (meta.q as string | undefined) ??
      (meta.term as string | undefined) ??
      (meta.searchTerm as string | undefined) ??
      (meta.text as string | undefined) ??
      '';
    const query = String(raw).trim().toLowerCase();
    if (!query) {
      withoutQuery += 1;
      continue;
    }
    withQuery += 1;
    const entry = counts.get(query) ?? { count: 0, uniqueInstalls: new Set() };
    entry.count += 1;
    if (e.installId) entry.uniqueInstalls.add(e.installId);
    counts.set(query, entry);
  }

  console.log(`  events with query string: ${withQuery}    without: ${withoutQuery}`);
  console.log(`  unique distinct queries:  ${counts.size}`);
  console.log('');

  if (!counts.size) {
    console.log('  (no extractable query strings — check metadata field name on the writer)');
    return;
  }

  const top = [...counts.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 50);

  console.log(`  ${pad('rank', 4)} ${pad('count', 6)} ${pad('uniq.installs', 14)}  query`);
  top.forEach(([q, v], i) => {
    console.log(
      `  ${pad(String(i + 1), 4)} ${rpad(v.count, 6)} ${rpad(v.uniqueInstalls.size, 14)}  ${q.slice(0, 80)}`,
    );
  });
}

// ─────────────────────────────────────────────────────────────────────
// Question 2 — funnel reconstruction
// ─────────────────────────────────────────────────────────────────────

function reportSignupFunnel(events: EventDoc[]) {
  rule(`[Q2a] Signup funnel — last ${DAYS_BACK}d`);
  const started = events.filter((e) => e.eventType === 'signup_started');
  const completed = events.filter((e) => e.eventType === 'signup_completed');
  const failed = events.filter((e) => e.eventType === 'signup_failed');

  const startedInstalls = new Set(started.map((e) => e.installId).filter(Boolean) as string[]);
  const completedInstalls = new Set(completed.map((e) => e.installId).filter(Boolean) as string[]);
  const failedInstalls = new Set(failed.map((e) => e.installId).filter(Boolean) as string[]);

  console.log(
    `  signup_started:    ${rpad(started.length, 6)} events / ${rpad(startedInstalls.size, 4)} installs`,
  );
  console.log(
    `  signup_completed:  ${rpad(completed.length, 6)} events / ${rpad(completedInstalls.size, 4)} installs   completion rate: ${pct(completed.length, started.length)}`,
  );
  console.log(
    `  signup_failed:     ${rpad(failed.length, 6)} events / ${rpad(failedInstalls.size, 4)} installs   failure rate:    ${pct(failed.length, started.length)}`,
  );

  // installs that started but never completed AND never failed → silent abandon
  const silentlyAbandoned = [...startedInstalls].filter(
    (i) => !completedInstalls.has(i) && !failedInstalls.has(i),
  );
  console.log(
    `  silently abandoned (started, no completed, no failed): ${rpad(silentlyAbandoned.length, 4)} installs   ${pct(silentlyAbandoned.length, startedInstalls.size)} of starters`,
  );

  if (failed.length) {
    const errorBuckets = new Map<string, number>();
    for (const e of failed) {
      const code = String(
        (e.metadata as Record<string, unknown> | undefined)?.errorCode ?? 'unknown_error',
      );
      errorBuckets.set(code, (errorBuckets.get(code) ?? 0) + 1);
    }
    console.log(`\n  signup_failed errorCode breakdown:`);
    for (const [code, n] of [...errorBuckets.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${rpad(n, 4)}  ${code}`);
    }
  }
}

function reportReviewFunnel(events: EventDoc[]) {
  rule(`[Q2b] Review funnel — last ${DAYS_BACK}d`);
  const started = events.filter((e) => e.eventType === 'review_started');
  const submitted = events.filter((e) => e.eventType === 'review_submitted');

  const startedInstalls = new Set(started.map((e) => e.installId).filter(Boolean) as string[]);
  const submittedInstalls = new Set(submitted.map((e) => e.installId).filter(Boolean) as string[]);

  console.log(
    `  review_started:    ${rpad(started.length, 6)} events / ${rpad(startedInstalls.size, 4)} installs`,
  );
  console.log(
    `  review_submitted:  ${rpad(submitted.length, 6)} events / ${rpad(submittedInstalls.size, 4)} installs   completion rate: ${pct(submitted.length, started.length)}`,
  );

  // For each install that started a review, measure time-to-submit (or
  // time-to-abandonment). Only meaningful when paired by install + storefront
  // since one user might write multiple reviews — pair by (installId, storefrontId).
  type Pair = {
    installId: string;
    storefrontId: string;
    startedAt: string;
    submittedAt: string | null;
  };
  const pairs: Pair[] = [];
  const startedByKey = new Map<string, string>();
  for (const e of started.sort((a, b) => eventTime(a).localeCompare(eventTime(b)))) {
    if (!e.installId || !e.storefrontId) continue;
    const key = `${e.installId}::${e.storefrontId}`;
    if (!startedByKey.has(key)) startedByKey.set(key, eventTime(e));
  }
  const submittedByKey = new Map<string, string>();
  for (const e of submitted) {
    if (!e.installId || !e.storefrontId) continue;
    const key = `${e.installId}::${e.storefrontId}`;
    submittedByKey.set(key, eventTime(e));
  }
  for (const [key, startedAt] of startedByKey) {
    const [installId, storefrontId] = key.split('::');
    pairs.push({
      installId: installId!,
      storefrontId: storefrontId!,
      startedAt,
      submittedAt: submittedByKey.get(key) ?? null,
    });
  }

  const completed = pairs.filter((p) => p.submittedAt);
  const abandoned = pairs.filter((p) => !p.submittedAt);

  console.log(`\n  pair-level (install + storefront):  ${rpad(pairs.length, 4)} review attempts`);
  console.log(
    `    completed:  ${rpad(completed.length, 4)}   ${pct(completed.length, pairs.length)}`,
  );
  console.log(
    `    abandoned:  ${rpad(abandoned.length, 4)}   ${pct(abandoned.length, pairs.length)}  ← the 90% leak`,
  );

  if (completed.length) {
    const durationsSec = completed
      .map((p) => (new Date(p.submittedAt!).getTime() - new Date(p.startedAt).getTime()) / 1000)
      .filter((n) => n >= 0 && n < 24 * 60 * 60);
    if (durationsSec.length) {
      const sorted = [...durationsSec].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const p25 = sorted[Math.floor(sorted.length * 0.25)];
      const p75 = sorted[Math.floor(sorted.length * 0.75)];
      console.log(
        `\n  time-to-submit (completed reviews, sec):  p25=${p25?.toFixed(0)}  median=${median?.toFixed(0)}  p75=${p75?.toFixed(0)}`,
      );
    }
  }
}

function reportStorefrontFunnel(events: EventDoc[]) {
  rule(`[Q2c] Storefront engagement funnel — last ${DAYS_BACK}d`);
  const counts = {
    impression: events.filter((e) => e.eventType === 'storefront_impression').length,
    opened: events.filter((e) => e.eventType === 'storefront_opened').length,
    goNow: events.filter((e) => e.eventType === 'go_now_tapped').length,
    website: events.filter((e) => e.eventType === 'website_tapped').length,
    phone: events.filter((e) => e.eventType === 'phone_tapped').length,
    menu: events.filter((e) => e.eventType === 'menu_tapped').length,
  };
  const directional = counts.goNow + counts.website + counts.phone + counts.menu;

  console.log(`  impressions      ${rpad(counts.impression, 6)}`);
  console.log(
    `  opened (detail)  ${rpad(counts.opened, 6)}     ${pct(counts.opened, counts.impression)} of impressions`,
  );
  console.log(`  ── interactions on the detail page ──`);
  console.log(
    `  go_now_tapped    ${rpad(counts.goNow, 6)}     ${pct(counts.goNow, counts.opened)} of opens`,
  );
  console.log(
    `  website_tapped   ${rpad(counts.website, 6)}     ${pct(counts.website, counts.opened)} of opens`,
  );
  console.log(
    `  phone_tapped     ${rpad(counts.phone, 6)}     ${pct(counts.phone, counts.opened)} of opens`,
  );
  console.log(
    `  menu_tapped      ${rpad(counts.menu, 6)}     ${pct(counts.menu, counts.opened)} of opens`,
  );
  console.log(
    `  ANY directional  ${rpad(directional, 6)}     ${pct(directional, counts.opened)} of opens`,
  );

  // Per-install conversion: of installs that opened a detail page, what %
  // tapped a directional CTA on any storefront in the window?
  const openedInstalls = new Set(
    events
      .filter((e) => e.eventType === 'storefront_opened')
      .map((e) => e.installId)
      .filter(Boolean) as string[],
  );
  const directionalEventTypes = new Set([
    'go_now_tapped',
    'website_tapped',
    'phone_tapped',
    'menu_tapped',
  ]);
  const directionalInstalls = new Set(
    events
      .filter((e) => e.eventType && directionalEventTypes.has(e.eventType))
      .map((e) => e.installId)
      .filter(Boolean) as string[],
  );
  const installsThatBoth = [...openedInstalls].filter((i) => directionalInstalls.has(i));
  console.log(
    `\n  installs that opened ≥1 detail page:                        ${rpad(openedInstalls.size, 4)}`,
  );
  console.log(
    `  installs that ALSO tapped a directional CTA:                ${rpad(installsThatBoth.length, 4)}   ${pct(installsThatBoth.length, openedInstalls.size)}`,
  );
}

// ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(80));
  console.log(`Funnel + queries snapshot — last ${DAYS_BACK} days (since ${SINCE_ISO})`);
  console.log(`canopy-trove / ${databaseId}    as of ${new Date().toISOString()}`);
  console.log('='.repeat(80));

  const events = await loadEventsByType(FUNNEL_EVENT_TYPES);
  console.log(`\nLoaded ${events.length} matching events from analytics_events.`);

  reportTopQueries(events);
  reportSignupFunnel(events);
  reportReviewFunnel(events);
  reportStorefrontFunnel(events);

  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('FAILED', err);
    process.exit(1);
  });
