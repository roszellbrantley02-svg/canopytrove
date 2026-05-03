/**
 * Forensic look at a single high-traffic day. Pulls every signal we
 * record (session sources, search queries, screen views, signup paths,
 * referrers/UTMs) so we can answer "what happened?" for a spike.
 *
 * Usage:
 *   npx ts-node --project backend/tsconfig.json backend/scripts/inspect-spike-day.ts 2026-04-29
 */

import * as admin from 'firebase-admin';

const dateArg = process.argv[2];
if (!dateArg || !/^\d{4}-\d{2}-\d{2}$/.test(dateArg)) {
  console.error('Usage: inspect-spike-day.ts YYYY-MM-DD');
  process.exit(2);
}

admin.initializeApp({ projectId: 'canopy-trove' });
const db = admin.firestore();
db.settings({ databaseId: 'canopytrove' });

async function main() {
  const dateKey = dateArg;
  const startOfDay = `${dateKey}T00:00:00.000Z`;
  const endOfDay = `${dateKey}T23:59:59.999Z`;

  console.log(`Forensic report for ${dateKey} (UTC)\n`);

  // 1. Daily roll-up for context
  const appMetricsDoc = await db.collection('analytics_daily_app_metrics').doc(dateKey).get();
  if (appMetricsDoc.exists) {
    const d = appMetricsDoc.data() as Record<string, unknown>;
    console.log('Daily app roll-up:');
    console.log(`  sessions:       ${d.sessionStartCount ?? 0}`);
    console.log(`  app opens:      ${d.appOpenCount ?? 0}`);
    console.log(`  screen views:   ${d.screenViewCount ?? 0}`);
    console.log(`  sign-ins:       ${d.signInCount ?? 0}`);
    console.log(
      `  signups attempted/completed/failed: ${d.signupStartedCount ?? 0} / ${d.signupCompletedCount ?? 0} / ${d.signupFailedCount ?? 0}`,
    );
    console.log(
      `  reviews started/submitted: ${d.reviewStartedCount ?? 0} / ${d.reviewSubmittedCount ?? 0}`,
    );
    console.log(`  total events:   ${d.eventCount ?? 0}`);
    console.log('');
  }

  // 2. Search query roll-up — what were people searching for?
  const searchMetricsDoc = await db.collection('analytics_daily_search_metrics').doc(dateKey).get();
  if (searchMetricsDoc.exists) {
    const d = searchMetricsDoc.data() as Record<string, unknown>;
    console.log('Search activity:');
    console.log(`  searches submitted: ${d.searchSubmittedCount ?? 0}`);
    console.log(
      `  location prompts shown / granted / denied: ${d.locationPromptShownCount ?? 0} / ${d.locationGrantedCount ?? 0} / ${d.locationDeniedCount ?? 0}`,
    );
    console.log('');
  }

  // Avoid composite index — fetch all that-day docs and sort in memory.
  const querySnap = await db
    .collection('analytics_daily_query_metrics')
    .where('date', '==', dateKey)
    .get();
  if (!querySnap.empty) {
    const sorted = querySnap.docs
      .map((doc) => doc.data() as Record<string, unknown>)
      .sort((a, b) => ((b.submittedCount as number) ?? 0) - ((a.submittedCount as number) ?? 0))
      .slice(0, 20);
    console.log('Top 20 search queries that day:');
    for (const d of sorted) {
      console.log(`  ${String(d.submittedCount ?? 0).padStart(4)}× "${d.query}"`);
    }
    console.log('');
  }

  // 3. Pull every event for the day in one range query (avoids needing
  // a composite eventType+receivedAt index), then bucket in-memory.
  const allEventsSnap = await db
    .collection('analytics_events')
    .where('receivedAt', '>=', startOfDay)
    .where('receivedAt', '<=', endOfDay)
    .limit(5000)
    .get();
  const sessionStartDocs = allEventsSnap.docs.filter(
    (d) => (d.data() as Record<string, unknown>).eventType === 'session_start',
  );
  const sessionStartSnap = { docs: sessionStartDocs, size: sessionStartDocs.length } as const;

  console.log(`session_start events: ${sessionStartSnap.size} sampled\n`);

  const sourceCounts = new Map<string, number>();
  const referrerCounts = new Map<string, number>();
  const utmCounts = new Map<string, number>();
  const platformCounts = new Map<string, number>();

  for (const doc of sessionStartSnap.docs) {
    const d = doc.data() as Record<string, unknown>;
    const meta = (d.metadata ?? {}) as Record<string, unknown>;
    const platform = (d.platform as string) ?? 'unknown';
    platformCounts.set(platform, (platformCounts.get(platform) ?? 0) + 1);

    const source = (meta.source as string) ?? (meta.trafficSource as string) ?? null;
    if (source) sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);

    const referrer = (meta.referrer as string) ?? (meta.referer as string) ?? null;
    if (referrer) referrerCounts.set(referrer, (referrerCounts.get(referrer) ?? 0) + 1);

    const utmSource = (meta.utmSource as string) ?? (meta.utm_source as string) ?? null;
    const utmCampaign = (meta.utmCampaign as string) ?? (meta.utm_campaign as string) ?? null;
    if (utmSource || utmCampaign) {
      const key = `utm_source=${utmSource ?? '(none)'} utm_campaign=${utmCampaign ?? '(none)'}`;
      utmCounts.set(key, (utmCounts.get(key) ?? 0) + 1);
    }
  }

  console.log('Sessions by platform:');
  for (const [k, v] of [...platformCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(v).padStart(4)}  ${k}`);
  }
  console.log('');

  if (sourceCounts.size > 0) {
    console.log('Sessions by source metadata:');
    for (const [k, v] of [...sourceCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
      console.log(`  ${String(v).padStart(4)}  ${k}`);
    }
    console.log('');
  }

  if (referrerCounts.size > 0) {
    console.log('Sessions by referrer:');
    for (const [k, v] of [...referrerCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
      console.log(`  ${String(v).padStart(4)}  ${k}`);
    }
    console.log('');
  }

  if (utmCounts.size > 0) {
    console.log('Sessions by UTM:');
    for (const [k, v] of [...utmCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
      console.log(`  ${String(v).padStart(4)}  ${k}`);
    }
    console.log('');
  }

  // 4. Hourly distribution to spot the burst window
  const hourBuckets = new Array(24).fill(0);
  for (const doc of sessionStartSnap.docs) {
    const d = doc.data() as Record<string, unknown>;
    const ts = (d.receivedAt as string) ?? '';
    const hour = parseInt(ts.slice(11, 13), 10);
    if (Number.isFinite(hour)) hourBuckets[hour] += 1;
  }
  console.log('Sessions by hour (UTC):');
  const maxBucket = Math.max(...hourBuckets);
  for (let h = 0; h < 24; h += 1) {
    const bar = '#'.repeat(Math.round((hourBuckets[h] / Math.max(1, maxBucket)) * 40));
    console.log(
      `  ${String(h).padStart(2, '0')}:00  ${String(hourBuckets[h]).padStart(4)}  ${bar}`,
    );
  }
  console.log('');

  // 5. Sign-up + sign-in events that day (filter from already-fetched set)
  const signupDocs = allEventsSnap.docs.filter((doc) => {
    const t = (doc.data() as Record<string, unknown>).eventType as string;
    return ['signup_started', 'signup_completed', 'signup_failed', 'signin'].includes(t);
  });
  console.log(`signup_* / signin events that day: ${signupDocs.length}`);
  const accountIds = new Set<string>();
  for (const doc of signupDocs) {
    const d = doc.data() as Record<string, unknown>;
    const meta = JSON.stringify(d.metadata ?? {});
    const accountId = (d.accountId as string) ?? (d.userId as string) ?? null;
    if (accountId) accountIds.add(accountId);
    console.log(
      `  ${(d.receivedAt as string).slice(11, 19)}  ${(d.eventType as string).padEnd(20)}  acct=${accountId ?? '(none)'}  ${meta}`,
    );
  }
  console.log('');

  // 5b. Lookup the owner-side claimers + which storefronts they were
  // trying to claim that day.
  if (accountIds.size > 0) {
    console.log(`Account IDs that signed in/up that day (${accountIds.size}):`);
    for (const accountId of accountIds) {
      try {
        const userRecord = await admin.auth().getUser(accountId);
        console.log(
          `  ${accountId}  email=${userRecord.email ?? '(none)'}  displayName=${userRecord.displayName ?? '(none)'}  created=${userRecord.metadata.creationTime}`,
        );

        // Cross-ref to owner_storefront_claims (the claim ledger)
        const claimSnap = await db
          .collection('owner_storefront_claims')
          .where('ownerUid', '==', accountId)
          .get();
        if (!claimSnap.empty) {
          for (const claimDoc of claimSnap.docs) {
            const c = claimDoc.data() as Record<string, unknown>;
            console.log(
              `    claim ${claimDoc.id}  storefrontId=${c.storefrontId ?? c.dispensaryId ?? '?'}  status=${c.claimStatus ?? c.status ?? '?'}  createdAt=${c.createdAt ?? '?'}`,
            );
          }
        }

        // Cross-ref to owner_profiles (the company info)
        const profileSnap = await db.collection('owner_profiles').doc(accountId).get();
        if (profileSnap.exists) {
          const p = profileSnap.data() as Record<string, unknown>;
          console.log(
            `    owner_profile  companyName=${p.companyName ?? '(none)'}  email=${p.email ?? '(none)'}`,
          );
        }
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code === 'auth/user-not-found') {
          console.log(`  ${accountId}  (auth user not found — deleted?)`);
        } else {
          console.log(`  ${accountId}  (lookup error: ${(error as Error).message})`);
        }
      }
    }
    console.log('');
  }

  // 6. Top screens viewed that day (filter from already-fetched set)
  const screenViewDocs = allEventsSnap.docs.filter(
    (doc) => (doc.data() as Record<string, unknown>).eventType === 'screen_view',
  );
  const screenCounts = new Map<string, number>();
  for (const doc of screenViewDocs) {
    const d = doc.data() as Record<string, unknown>;
    const meta = (d.metadata ?? {}) as Record<string, unknown>;
    const name = (meta.screenName as string) ?? (meta.screen as string) ?? 'unknown';
    screenCounts.set(name, (screenCounts.get(name) ?? 0) + 1);
  }
  console.log(`screen_view events sampled: ${screenViewDocs.length}`);
  console.log('Top screens viewed:');
  for (const [k, v] of [...screenCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`  ${String(v).padStart(5)}  ${k}`);
  }

  // 7. Storefronts engaged that day (impressions + opens)
  const storefrontMetricsSnap = await db
    .collection('analytics_daily_storefront_metrics')
    .where('date', '==', dateKey)
    .get();
  const storefrontDayRows = storefrontMetricsSnap.docs
    .map((doc) => doc.data() as Record<string, unknown>)
    .sort((a, b) => ((b.impressionCount as number) ?? 0) - ((a.impressionCount as number) ?? 0));
  console.log('');
  console.log(`Top 15 storefronts engaged that day (out of ${storefrontDayRows.length} total):`);
  console.log(`  ${'Impr'.padStart(5)}${'Opens'.padStart(7)}${'Direc'.padStart(7)}  storefront`);
  for (const row of storefrontDayRows.slice(0, 15)) {
    console.log(
      `  ${String((row.impressionCount as number) ?? 0).padStart(5)}${String((row.openCount as number) ?? 0).padStart(7)}${String((row.goNowTapCount as number) ?? 0).padStart(7)}  ${row.storefrontId}`,
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
