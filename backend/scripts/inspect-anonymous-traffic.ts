/* eslint-disable no-console */
// Snapshot of anonymous / non-owner traffic across the canopytrove DB:
//   1. Firebase Auth: how many anonymous users have ever signed in
//   2. analytics_daily_app_metrics: app-level events over last 30/7/1 days
//   3. analytics_daily_storefront_metrics: aggregated across ALL storefronts
//   4. analytics_daily_search_metrics + signup metrics
//   5. analytics_hourly_storefront_routes: last 24h heat-glow traffic
//   6. productScans: anonymous product scan ingestion (install-ID based)
//   7. Recent analytics_events sample
//
// Read-only. Run:
//   FIREBASE_DATABASE_ID=canopytrove npx tsx \
//     backend/scripts/inspect-anonymous-traffic.ts

import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const projectId = process.env.GCP_PROJECT || 'canopy-trove';
const databaseId = process.env.FIREBASE_DATABASE_ID || 'canopytrove';
if (!getApps().length) {
  initializeApp({ credential: applicationDefault(), projectId });
}
const db = getFirestore(databaseId);
const auth = getAuth();

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}
function ymdNoDash(d: Date) {
  return ymd(d).replace(/-/g, '');
}
function daysAgo(n: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}
function hoursAgo(n: number) {
  return new Date(Date.now() - n * 60 * 60 * 1000);
}
function pad(n: number, w = 6) {
  return String(n).padStart(w);
}
function rule(label = '') {
  console.log('\n' + label);
  console.log('-'.repeat(80));
}

async function countAuthUsers() {
  let total = 0;
  let anonymous = 0;
  let withEmail = 0;
  let appleProvider = 0;
  let googleProvider = 0;
  let phoneProvider = 0;
  let nextPageToken: string | undefined = undefined;
  do {
    const page = await auth.listUsers(1000, nextPageToken);
    for (const u of page.users) {
      total += 1;
      if (u.email) withEmail += 1;
      if (!u.email && !u.phoneNumber && (u.providerData?.length ?? 0) === 0) {
        anonymous += 1;
      }
      for (const p of u.providerData ?? []) {
        if (p.providerId === 'apple.com') appleProvider += 1;
        else if (p.providerId === 'google.com') googleProvider += 1;
        else if (p.providerId === 'phone') phoneProvider += 1;
      }
    }
    nextPageToken = page.pageToken;
  } while (nextPageToken);
  return { total, anonymous, withEmail, appleProvider, googleProvider, phoneProvider };
}

type DailyAppMetric = Record<string, number | string | null | undefined>;

async function sumDailyAppMetrics(daysBack: number) {
  const sinceYmd = ymd(daysAgo(daysBack));
  const snap = await db.collection('analytics_daily_app_metrics').get();
  const acc: Record<string, number> = {};
  let bucketsConsidered = 0;
  for (const doc of snap.docs) {
    const data = doc.data() as DailyAppMetric;
    const date = String(data.date ?? '');
    if (!date || date < sinceYmd) continue;
    bucketsConsidered += 1;
    for (const [k, v] of Object.entries(data)) {
      if (typeof v === 'number') acc[k] = (acc[k] ?? 0) + v;
    }
  }
  return { bucketsConsidered, totalsByField: acc };
}

async function sumStorefrontMetrics(daysBack: number) {
  const sinceYmd = ymd(daysAgo(daysBack));
  const snap = await db.collection('analytics_daily_storefront_metrics').get();
  let impressions = 0;
  let opens = 0;
  let reviewPromptShown = 0;
  let reviewStarted = 0;
  let reviewSubmitted = 0;
  let buckets = 0;
  const storefrontHits = new Set<string>();
  for (const doc of snap.docs) {
    const data = doc.data() as DailyAppMetric & { storefrontId?: string };
    const date = String(data.date ?? '');
    if (!date || date < sinceYmd) continue;
    buckets += 1;
    if (data.storefrontId) storefrontHits.add(String(data.storefrontId));
    impressions += Number(data.impressionCount ?? 0);
    opens += Number(data.openCount ?? 0);
    reviewPromptShown += Number(data.reviewPromptShownCount ?? 0);
    reviewStarted += Number(data.reviewStartedCount ?? 0);
    reviewSubmitted += Number(data.reviewSubmittedCount ?? 0);
  }
  return {
    buckets,
    storefrontsTouched: storefrontHits.size,
    impressions,
    opens,
    reviewPromptShown,
    reviewStarted,
    reviewSubmitted,
  };
}

async function sumHourlyRoutes(hoursBack: number) {
  const sinceH = hoursAgo(hoursBack).toISOString().slice(0, 13).replace(/[-T]/g, '');
  const snap = await db.collection('analytics_hourly_storefront_routes').get();
  let routes = 0;
  let buckets = 0;
  const hot = new Map<string, number>();
  for (const doc of snap.docs) {
    const id = doc.id;
    const ymdH = id.split('__')[1];
    if (!ymdH || ymdH < sinceH) continue;
    buckets += 1;
    const data = doc.data() as { count?: number; routeStarts?: number; storefrontId?: string };
    const c = data.count ?? data.routeStarts ?? 0;
    routes += c;
    if (data.storefrontId) hot.set(data.storefrontId, (hot.get(data.storefrontId) ?? 0) + c);
  }
  const top5 = [...hot.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  return { routes, buckets, top5 };
}

async function sumSearchMetrics(daysBack: number) {
  const sinceYmd = ymd(daysAgo(daysBack));
  const snap = await db.collection('analytics_daily_search_metrics').get();
  let searches = 0;
  let buckets = 0;
  for (const doc of snap.docs) {
    const data = doc.data() as DailyAppMetric;
    const date = String(data.date ?? '');
    if (!date || date < sinceYmd) continue;
    buckets += 1;
    for (const [k, v] of Object.entries(data)) {
      if (typeof v === 'number' && k.toLowerCase().includes('count')) searches += v;
    }
  }
  return { searches, buckets };
}

async function sumSignupMetrics(daysBack: number) {
  const sinceYmd = ymd(daysAgo(daysBack));
  const snap = await db.collection('analytics_daily_signup_metrics').get();
  const acc: Record<string, number> = {};
  let buckets = 0;
  for (const doc of snap.docs) {
    const data = doc.data() as DailyAppMetric;
    const date = String(data.date ?? '');
    if (!date || date < sinceYmd) continue;
    buckets += 1;
    for (const [k, v] of Object.entries(data)) {
      if (typeof v === 'number') acc[k] = (acc[k] ?? 0) + v;
    }
  }
  return { buckets, totalsByField: acc };
}

async function countProductScans() {
  // Anonymous-by-install-id ingestion. Not date-bucketed; we just count.
  try {
    const snap = await db.collection('productScans').get();
    let withInstallId = 0;
    let withoutInstallId = 0;
    const installs = new Set<string>();
    const last24 = hoursAgo(24).toISOString();
    let last24Count = 0;
    for (const doc of snap.docs) {
      const d = doc.data() as { installId?: string; createdAt?: string };
      if (d.installId) {
        withInstallId += 1;
        installs.add(d.installId);
      } else {
        withoutInstallId += 1;
      }
      if (d.createdAt && d.createdAt >= last24) last24Count += 1;
    }
    return {
      total: snap.size,
      uniqueInstalls: installs.size,
      withInstallId,
      withoutInstallId,
      last24Count,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

async function recentAnalyticsEvents(limit: number) {
  try {
    const snap = await db
      .collection('analytics_events')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();
    return snap.docs.map((d) => {
      const data = d.data() as { eventType?: string; timestamp?: string; userId?: string };
      return {
        eventType: data.eventType ?? '?',
        when: data.timestamp ?? '?',
        userId: data.userId ? data.userId.slice(0, 8) + '...' : 'anonymous',
      };
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

async function main() {
  console.log('='.repeat(80));
  console.log('Canopy Trove — anonymous / aggregate traffic snapshot');
  console.log(`canopy-trove / ${databaseId}    as of ${new Date().toISOString()}`);
  console.log('='.repeat(80));

  rule('[1] Firebase Auth users');
  const users = await countAuthUsers();
  console.log(`  total users:           ${pad(users.total, 6)}`);
  console.log(`  anonymous (no email/phone/provider): ${pad(users.anonymous, 6)}`);
  console.log(`  with email:            ${pad(users.withEmail, 6)}`);
  console.log(
    `  by provider:           apple=${users.appleProvider}  google=${users.googleProvider}  phone=${users.phoneProvider}`,
  );

  rule('[2] App-level daily metrics');
  for (const daysBack of [30, 7, 1]) {
    const m = await sumDailyAppMetrics(daysBack);
    console.log(`  last ${pad(daysBack, 2)}d  ─ ${m.bucketsConsidered} day buckets`);
    if (Object.keys(m.totalsByField).length === 0) {
      console.log(`    (no numeric counters in any matching doc)`);
    } else {
      for (const [k, v] of Object.entries(m.totalsByField)) {
        if (k === 'date') continue;
        console.log(`    ${k.padEnd(28)} ${pad(v, 6)}`);
      }
    }
  }

  rule('[3] Storefront-level daily metrics (aggregated across ALL shops)');
  for (const daysBack of [30, 7, 1]) {
    const m = await sumStorefrontMetrics(daysBack);
    console.log(
      `  last ${pad(daysBack, 2)}d  ─ ${m.buckets} day buckets across ${m.storefrontsTouched} storefronts`,
    );
    console.log(`    impressions:          ${pad(m.impressions, 6)}`);
    console.log(`    opens:                ${pad(m.opens, 6)}`);
    console.log(`    reviewPromptShown:    ${pad(m.reviewPromptShown, 6)}`);
    console.log(`    reviewStarted:        ${pad(m.reviewStarted, 6)}`);
    console.log(`    reviewSubmitted:      ${pad(m.reviewSubmitted, 6)}`);
  }

  rule('[4] Hourly route-start activity (drives the heat-glow visual)');
  const h = await sumHourlyRoutes(24);
  console.log(`  last 24h: ${h.routes} route starts across ${h.buckets} hour buckets`);
  if (h.top5.length) {
    console.log(`  top storefronts:`);
    for (const [id, c] of h.top5) console.log(`    ${pad(c, 4)}  ${id}`);
  }

  rule('[5] Search activity');
  for (const daysBack of [30, 7]) {
    const s = await sumSearchMetrics(daysBack);
    console.log(
      `  last ${pad(daysBack, 2)}d  ${pad(s.searches, 6)} searches  (${s.buckets} day buckets)`,
    );
  }

  rule('[6] Signup activity');
  for (const daysBack of [30, 7]) {
    const s = await sumSignupMetrics(daysBack);
    console.log(`  last ${pad(daysBack, 2)}d  ─ ${s.buckets} day buckets`);
    if (Object.keys(s.totalsByField).length === 0) {
      console.log(`    (no numeric counters)`);
    } else {
      for (const [k, v] of Object.entries(s.totalsByField)) {
        if (k === 'date') continue;
        console.log(`    ${k.padEnd(28)} ${pad(v, 6)}`);
      }
    }
  }

  rule('[7] Anonymous product scans');
  const scans = await countProductScans();
  if ('error' in scans) {
    console.log(`  (query failed: ${scans.error})`);
  } else {
    console.log(`  total scan docs:       ${pad(scans.total, 6)}`);
    console.log(`  unique install IDs:    ${pad(scans.uniqueInstalls, 6)}`);
    console.log(
      `  with installId / no installId:  ${scans.withInstallId} / ${scans.withoutInstallId}`,
    );
    console.log(`  in last 24h:           ${pad(scans.last24Count, 6)}`);
  }

  rule('[8] Latest 10 analytics_events');
  const ev = await recentAnalyticsEvents(10);
  if ('error' in ev) {
    console.log(`  (query failed: ${ev.error})`);
  } else if (ev.length === 0) {
    console.log(`  (no events in collection)`);
  } else {
    for (const e of ev) {
      console.log(`  ${e.when}  ${e.eventType.padEnd(24)} user=${e.userId}`);
    }
  }
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('FAILED', err);
    process.exit(1);
  });
