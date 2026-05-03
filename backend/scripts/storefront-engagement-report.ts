/**
 * Storefront engagement report — produces an outreach-friendly chart of
 * every dispensary we have, joined with their phone number and the
 * engagement metrics we've recorded against them in the app.
 *
 * Joins three Firestore collections:
 *   storefront_summaries          — displayName, city, state
 *   storefront_details            — phone, website
 *   analytics_daily_storefront_metrics — per-day impression/open/tap counters
 *
 * Default output: stores sorted by total impressions desc, filtered to
 * those that have BOTH a phone number AND any non-zero engagement (the
 * actionable list for outreach calls).
 *
 * Flags:
 *   --all              also include stores with 0 engagement (for full inventory)
 *   --no-phone         also include stores without phone numbers
 *   --since=2026-04-01 restrict metrics to events on/after this date (default: all-time)
 *   --top=20           limit to top N rows (default: no limit)
 *   --csv              emit CSV instead of formatted table
 *
 * Usage:
 *   npx ts-node --project backend/tsconfig.json backend/scripts/storefront-engagement-report.ts
 *   npx ts-node --project backend/tsconfig.json backend/scripts/storefront-engagement-report.ts --since=2026-04-01 --top=30
 *   npx ts-node --project backend/tsconfig.json backend/scripts/storefront-engagement-report.ts --csv > stores.csv
 */

import * as admin from 'firebase-admin';

const ARGS = process.argv.slice(2);
const INCLUDE_ALL = ARGS.includes('--all');
const INCLUDE_NO_PHONE = ARGS.includes('--no-phone');
const EMIT_CSV = ARGS.includes('--csv');
const SINCE = (() => {
  const arg = ARGS.find((a) => a.startsWith('--since='));
  return arg ? arg.replace('--since=', '').replaceAll('-', '').slice(0, 8) : null;
})();
const TOP = (() => {
  const arg = ARGS.find((a) => a.startsWith('--top='));
  if (!arg) return null;
  const n = Number.parseInt(arg.replace('--top=', ''), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
})();

admin.initializeApp({ projectId: 'canopy-trove' });
const db = admin.firestore();
db.settings({ databaseId: 'canopytrove' });

type Aggregated = {
  storefrontId: string;
  displayName: string;
  city: string;
  state: string;
  phone: string | null;
  impressions: number;
  opens: number;
  directionsTaps: number;
  phoneTaps: number;
  websiteTaps: number;
  menuTaps: number;
  reviewsStarted: number;
  reviewsSubmitted: number;
  daysWithActivity: number;
  firstSeen: string | null;
  lastSeen: string | null;
};

function fmt(n: number): string {
  if (n >= 1000) return n.toLocaleString();
  return String(n);
}

function pad(s: string, width: number, align: 'left' | 'right' = 'left'): string {
  // naive pad — works for ASCII; emojis would throw the column off but we have none
  if (s.length >= width) return s.slice(0, width);
  const space = ' '.repeat(width - s.length);
  return align === 'right' ? space + s : s + space;
}

async function main() {
  const [summariesSnap, detailsSnap, metricsSnap] = await Promise.all([
    db.collection('storefront_summaries').get(),
    db.collection('storefront_details').get(),
    db.collection('analytics_daily_storefront_metrics').get(),
  ]);

  // Index summaries (storefront name + location)
  const summaryById = new Map<string, { displayName: string; city: string; state: string }>();
  for (const doc of summariesSnap.docs) {
    const d = doc.data() as Record<string, unknown>;
    summaryById.set(doc.id, {
      displayName: (d.displayName as string) ?? doc.id,
      city: (d.city as string) ?? '',
      state: (d.state as string) ?? '',
    });
  }

  // Index details (phone)
  const phoneById = new Map<string, string | null>();
  for (const doc of detailsSnap.docs) {
    const d = doc.data() as Record<string, unknown>;
    const phone = typeof d.phone === 'string' ? d.phone.trim() || null : null;
    phoneById.set(doc.id, phone);
  }

  // Aggregate metrics across all daily docs
  const byStorefront = new Map<string, Aggregated>();
  for (const doc of metricsSnap.docs) {
    const d = doc.data() as Record<string, unknown>;
    const storefrontId = (d.storefrontId as string) ?? '';
    if (!storefrontId) continue;
    const dateKey = (d.date as string) ?? '';
    if (SINCE && dateKey.replaceAll('-', '') < SINCE) continue;

    const summary = summaryById.get(storefrontId) ?? {
      displayName: storefrontId,
      city: '',
      state: '',
    };

    const existing =
      byStorefront.get(storefrontId) ??
      ({
        storefrontId,
        displayName: summary.displayName,
        city: summary.city,
        state: summary.state,
        phone: phoneById.get(storefrontId) ?? null,
        impressions: 0,
        opens: 0,
        directionsTaps: 0,
        phoneTaps: 0,
        websiteTaps: 0,
        menuTaps: 0,
        reviewsStarted: 0,
        reviewsSubmitted: 0,
        daysWithActivity: 0,
        firstSeen: null,
        lastSeen: null,
      } satisfies Aggregated);

    existing.impressions += (d.impressionCount as number) ?? 0;
    existing.opens += (d.openCount as number) ?? 0;
    existing.directionsTaps += (d.goNowTapCount as number) ?? 0;
    existing.phoneTaps += (d.phoneTapCount as number) ?? 0;
    existing.websiteTaps += (d.websiteTapCount as number) ?? 0;
    existing.menuTaps += (d.menuTapCount as number) ?? 0;
    existing.reviewsStarted += (d.reviewStartedCount as number) ?? 0;
    existing.reviewsSubmitted += (d.reviewSubmittedCount as number) ?? 0;
    existing.daysWithActivity += 1;
    if (!existing.firstSeen || dateKey < existing.firstSeen) existing.firstSeen = dateKey;
    if (!existing.lastSeen || dateKey > existing.lastSeen) existing.lastSeen = dateKey;

    byStorefront.set(storefrontId, existing);
  }

  let rows = [...byStorefront.values()];

  // Optional: include stores with NO engagement (only useful with --all)
  if (INCLUDE_ALL) {
    for (const [storefrontId, summary] of summaryById) {
      if (byStorefront.has(storefrontId)) continue;
      rows.push({
        storefrontId,
        displayName: summary.displayName,
        city: summary.city,
        state: summary.state,
        phone: phoneById.get(storefrontId) ?? null,
        impressions: 0,
        opens: 0,
        directionsTaps: 0,
        phoneTaps: 0,
        websiteTaps: 0,
        menuTaps: 0,
        reviewsStarted: 0,
        reviewsSubmitted: 0,
        daysWithActivity: 0,
        firstSeen: null,
        lastSeen: null,
      });
    }
  }

  // Filter to stores with phone numbers (default behavior) — if you want
  // outreach calls, no phone = no actionable row.
  if (!INCLUDE_NO_PHONE) {
    rows = rows.filter((r) => r.phone);
  }

  // Sort by total touches (impressions + all taps), desc
  rows.sort((a, b) => {
    const ta =
      a.impressions + a.opens + a.directionsTaps + a.phoneTaps + a.websiteTaps + a.menuTaps;
    const tb =
      b.impressions + b.opens + b.directionsTaps + b.phoneTaps + b.websiteTaps + b.menuTaps;
    return tb - ta;
  });

  if (TOP) rows = rows.slice(0, TOP);

  if (EMIT_CSV) {
    const header = [
      'storefrontId',
      'displayName',
      'city',
      'state',
      'phone',
      'impressions',
      'opens',
      'directions',
      'phoneTaps',
      'websiteTaps',
      'menuTaps',
      'reviewsStarted',
      'reviewsSubmitted',
      'firstSeen',
      'lastSeen',
    ];
    console.log(header.join(','));
    for (const r of rows) {
      const phoneCsv = (r.phone ?? '').replace(/,/g, '');
      const nameCsv = r.displayName.replace(/,/g, ';');
      console.log(
        [
          r.storefrontId,
          `"${nameCsv}"`,
          r.city,
          r.state,
          phoneCsv,
          r.impressions,
          r.opens,
          r.directionsTaps,
          r.phoneTaps,
          r.websiteTaps,
          r.menuTaps,
          r.reviewsStarted,
          r.reviewsSubmitted,
          r.firstSeen ?? '',
          r.lastSeen ?? '',
        ].join(','),
      );
    }
    return;
  }

  // Formatted table
  const totals = rows.reduce(
    (acc, r) => ({
      impressions: acc.impressions + r.impressions,
      opens: acc.opens + r.opens,
      directionsTaps: acc.directionsTaps + r.directionsTaps,
      phoneTaps: acc.phoneTaps + r.phoneTaps,
      websiteTaps: acc.websiteTaps + r.websiteTaps,
      menuTaps: acc.menuTaps + r.menuTaps,
      reviewsStarted: acc.reviewsStarted + r.reviewsStarted,
      reviewsSubmitted: acc.reviewsSubmitted + r.reviewsSubmitted,
    }),
    {
      impressions: 0,
      opens: 0,
      directionsTaps: 0,
      phoneTaps: 0,
      websiteTaps: 0,
      menuTaps: 0,
      reviewsStarted: 0,
      reviewsSubmitted: 0,
    },
  );

  const filterDescription = [
    INCLUDE_ALL ? 'all stores (incl. zero-engagement)' : 'engaged stores only',
    INCLUDE_NO_PHONE ? 'all phone status' : 'with phone number',
    SINCE ? `since ${SINCE.slice(0, 4)}-${SINCE.slice(4, 6)}-${SINCE.slice(6, 8)}` : 'all-time',
    TOP ? `top ${TOP}` : 'unlimited',
  ].join(' · ');

  console.log(`Storefront engagement report — ${filterDescription}`);
  console.log(`Generated ${new Date().toISOString()}\n`);

  const colName = 36;
  const colCity = 16;
  const colPhone = 16;
  const colNum = 7;

  const header =
    pad('Store', colName) +
    pad('City', colCity) +
    pad('Phone', colPhone) +
    pad('Impr', colNum, 'right') +
    pad('Open', colNum, 'right') +
    pad('Direc', colNum, 'right') +
    pad('Call', colNum, 'right') +
    pad('Web', colNum, 'right') +
    pad('Menu', colNum, 'right') +
    pad('RvSub', colNum, 'right');
  console.log(header);
  console.log('-'.repeat(header.length));

  for (const r of rows) {
    console.log(
      pad(r.displayName, colName) +
        pad(r.city, colCity) +
        pad(r.phone ?? '(none)', colPhone) +
        pad(fmt(r.impressions), colNum, 'right') +
        pad(fmt(r.opens), colNum, 'right') +
        pad(fmt(r.directionsTaps), colNum, 'right') +
        pad(fmt(r.phoneTaps), colNum, 'right') +
        pad(fmt(r.websiteTaps), colNum, 'right') +
        pad(fmt(r.menuTaps), colNum, 'right') +
        pad(fmt(r.reviewsSubmitted), colNum, 'right'),
    );
  }

  console.log('-'.repeat(header.length));
  console.log(
    pad(`TOTALS (${rows.length} stores)`, colName) +
      pad('', colCity) +
      pad('', colPhone) +
      pad(fmt(totals.impressions), colNum, 'right') +
      pad(fmt(totals.opens), colNum, 'right') +
      pad(fmt(totals.directionsTaps), colNum, 'right') +
      pad(fmt(totals.phoneTaps), colNum, 'right') +
      pad(fmt(totals.websiteTaps), colNum, 'right') +
      pad(fmt(totals.menuTaps), colNum, 'right') +
      pad(fmt(totals.reviewsSubmitted), colNum, 'right'),
  );

  console.log(`\nLegend:`);
  console.log(`  Impr   = card impressions (storefront seen in browse/nearby/hot deals)`);
  console.log(`  Open   = full storefront detail page opened`);
  console.log(`  Direc  = "Get Directions" tapped (intent to visit)`);
  console.log(`  Call   = phone-tap (highest-intent — these called the store)`);
  console.log(`  Web    = website link tapped`);
  console.log(`  Menu   = menu link tapped`);
  console.log(`  RvSub  = reviews submitted by app users`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
