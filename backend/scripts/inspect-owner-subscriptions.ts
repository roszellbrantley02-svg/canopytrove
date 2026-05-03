/* eslint-disable no-console */
// One-off: print owner identity + claimed storefront + last 30d + 7d traffic
// for every doc in the `subscriptions` collection.
//
// Run with credentials picked up from ADC or GOOGLE_APPLICATION_CREDENTIALS:
//   FIREBASE_DATABASE_ID=canopytrove npx tsx backend/scripts/inspect-owner-subscriptions.ts
//
// Read-only. Does NOT log p256dh / auth / endpoints — only owner email,
// dispensary name, plan/status, and aggregate route + review counts.

import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const projectId = process.env.GCP_PROJECT || 'canopy-trove';
const databaseId = process.env.FIREBASE_DATABASE_ID || 'canopytrove';

if (!getApps().length) {
  initializeApp({ credential: applicationDefault(), projectId });
}

const db = getFirestore(databaseId);

type SubscriptionDoc = {
  ownerUid?: string;
  dispensaryId?: string | null;
  plan?: string;
  status?: string;
  trialStartedAt?: string;
  trialEndsAt?: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type OwnerProfile = {
  uid?: string;
  email?: string;
  displayName?: string;
  phoneNumber?: string;
  dispensaryId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type Dispensary = {
  name?: string;
  city?: string;
  region?: string;
  state?: string;
  ownerUid?: string;
  ocmLicenseNumber?: string;
};

type DailyMetric = {
  storefrontId?: string;
  date?: string;
  routeStartCount?: number;
  detailViewCount?: number;
  routeStarts?: number;
  detailViews?: number;
};

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return iso;
  }
}

async function loadOwnerProfile(ownerUid: string): Promise<OwnerProfile | null> {
  const snap = await db.collection('ownerProfiles').doc(ownerUid).get();
  if (!snap.exists) return null;
  return snap.data() as OwnerProfile;
}

async function loadAuthEmail(ownerUid: string): Promise<string | null> {
  try {
    const user = await getAuth().getUser(ownerUid);
    return user.email ?? null;
  } catch {
    return null;
  }
}

async function loadDispensary(dispensaryId: string): Promise<Dispensary | null> {
  const snap = await db.collection('dispensaries').doc(dispensaryId).get();
  if (!snap.exists) return null;
  return snap.data() as Dispensary;
}

async function loadStorefrontSummary(dispensaryId: string): Promise<{ name?: string } | null> {
  const snap = await db.collection('storefront_summaries').doc(dispensaryId).get();
  if (!snap.exists) return null;
  return snap.data() as { name?: string };
}

async function sumDailyMetrics(dispensaryId: string, daysBack: number) {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - daysBack);
  const sinceYmd = since.toISOString().slice(0, 10).replace(/-/g, '');
  const snap = await db
    .collection('analytics_daily_storefront_metrics')
    .where('storefrontId', '==', dispensaryId)
    .get();

  let routeStarts = 0;
  let detailViews = 0;
  let dayBuckets = 0;
  for (const doc of snap.docs) {
    const data = doc.data() as DailyMetric;
    const date = data.date;
    if (!date) continue;
    const ymd = date.replace(/-/g, '');
    if (ymd < sinceYmd) continue;
    routeStarts += data.routeStartCount ?? data.routeStarts ?? 0;
    detailViews += data.detailViewCount ?? data.detailViews ?? 0;
    dayBuckets += 1;
  }
  return { routeStarts, detailViews, dayBuckets };
}

async function sumHourlyRoutes(dispensaryId: string, hoursBack: number) {
  const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
  const sinceYmdH = since.toISOString().slice(0, 13).replace(/[-T]/g, '');
  const snap = await db
    .collection('analytics_hourly_storefront_routes')
    .where('storefrontId', '==', dispensaryId)
    .get();

  let routes = 0;
  let hourBuckets = 0;
  for (const doc of snap.docs) {
    const id = doc.id; // {storefrontId}__{YYYYMMDDHH}
    const ymdH = id.split('__')[1];
    if (!ymdH || ymdH < sinceYmdH) continue;
    const data = doc.data() as { count?: number; routeStarts?: number };
    routes += data.count ?? data.routeStarts ?? 0;
    hourBuckets += 1;
  }
  return { routes, hourBuckets };
}

async function countRecentReviews(dispensaryId: string, daysBack: number) {
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
  // Single-field equality avoids needing the composite (storefrontId, createdAt) index.
  // For the small data sizes we have today, in-memory date filtering is fine.
  try {
    const snap = await db
      .collection('storefront_app_reviews')
      .where('storefrontId', '==', dispensaryId)
      .get();
    let count = 0;
    for (const doc of snap.docs) {
      const data = doc.data() as { createdAt?: string };
      if (data.createdAt && data.createdAt >= since) count += 1;
    }
    return { count, total: snap.size };
  } catch (err) {
    return { count: -1, total: -1, error: err instanceof Error ? err.message : String(err) };
  }
}

async function inspectAll() {
  const subs = await db.collection('subscriptions').get();
  console.log(`Found ${subs.size} subscription docs in canopytrove DB.\n`);

  for (const subDoc of subs.docs) {
    const sub = subDoc.data() as SubscriptionDoc;
    const ownerUid = subDoc.id;
    const dispensaryId = sub.dispensaryId ?? null;

    console.log('━'.repeat(80));
    console.log(`OWNER UID:  ${ownerUid}`);

    const [profile, authEmail] = await Promise.all([
      loadOwnerProfile(ownerUid),
      loadAuthEmail(ownerUid),
    ]);
    console.log(`  email:    ${profile?.email ?? authEmail ?? '— (no profile/auth email)'}`);
    console.log(`  name:     ${profile?.displayName ?? '— (no display name)'}`);
    console.log(`  phone:    ${profile?.phoneNumber ?? '—'}`);
    console.log(`  signed up: ${fmtDate(profile?.createdAt)}`);

    console.log(`\nSUBSCRIPTION:`);
    console.log(`  plan:     ${sub.plan ?? '—'}`);
    console.log(`  status:   ${sub.status ?? '—'}`);
    if (sub.status === 'trial') {
      console.log(
        `  trial:    started ${fmtDate(sub.trialStartedAt)}  →  ends ${fmtDate(sub.trialEndsAt)}`,
      );
    } else {
      console.log(
        `  period:   ${fmtDate(sub.currentPeriodStart)}  →  ${fmtDate(sub.currentPeriodEnd)}`,
      );
    }
    console.log(`  stripeCustomer:     ${sub.stripeCustomerId ?? 'none (trial, no card on file)'}`);
    console.log(`  stripeSubscription: ${sub.stripeSubscriptionId ?? 'none'}`);

    if (!dispensaryId) {
      console.log(`\nSTOREFRONT:  — (no dispensaryId on subscription)`);
      console.log('');
      continue;
    }

    const [shop, summary] = await Promise.all([
      loadDispensary(dispensaryId),
      loadStorefrontSummary(dispensaryId),
    ]);
    const shopName = shop?.name ?? summary?.name ?? '— (not found)';
    const where = [shop?.city, shop?.region, shop?.state].filter(Boolean).join(', ');

    console.log(`\nSTOREFRONT (${dispensaryId}):`);
    console.log(`  name:     ${shopName}`);
    console.log(`  where:    ${where || '—'}`);
    console.log(`  license:  ${shop?.ocmLicenseNumber ?? '—'}`);

    const [d30, d7, h24, reviews30] = await Promise.all([
      sumDailyMetrics(dispensaryId, 30),
      sumDailyMetrics(dispensaryId, 7),
      sumHourlyRoutes(dispensaryId, 24),
      countRecentReviews(dispensaryId, 30),
    ]);

    console.log(`\nTRAFFIC (per analytics):`);
    console.log(
      `  last 30d: ${d30.routeStarts.toString().padStart(4)} route starts, ${d30.detailViews.toString().padStart(4)} detail views   (${d30.dayBuckets} day buckets)`,
    );
    console.log(
      `  last  7d: ${d7.routeStarts.toString().padStart(4)} route starts, ${d7.detailViews.toString().padStart(4)} detail views   (${d7.dayBuckets} day buckets)`,
    );
    console.log(
      `  last 24h: ${h24.routes.toString().padStart(4)} route starts (hourly aggregator, ${h24.hourBuckets} hour buckets)`,
    );
    if (reviews30.count >= 0) {
      console.log(
        `  reviews in last 30d: ${reviews30.count}  (all-time total: ${reviews30.total})`,
      );
    } else {
      console.log(`  reviews in last 30d: — (query failed)`);
    }
    console.log('');
  }
}

inspectAll()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('FAILED', err);
    process.exit(1);
  });
