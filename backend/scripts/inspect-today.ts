/**
 * Today-only snapshot — what happened May 3 2026 (UTC) so we can see
 * how the day looks after a heavy ship cycle.
 */

import * as admin from 'firebase-admin';

admin.initializeApp({ projectId: 'canopy-trove' });
const db = admin.firestore();
db.settings({ databaseId: 'canopytrove' });

const TODAY = new Date().toISOString().slice(0, 10);

async function main() {
  console.log(`Today snapshot — ${TODAY} (UTC)\n`);

  // 1. Daily roll-up
  const appDoc = await db.collection('analytics_daily_app_metrics').doc(TODAY).get();
  if (!appDoc.exists) {
    console.log('No daily roll-up for today yet.');
  } else {
    const d = appDoc.data() as Record<string, unknown>;
    console.log('Daily app roll-up (so far):');
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

  // 2. Pull every event today; bucket
  const startOfDay = `${TODAY}T00:00:00.000Z`;
  const endOfDay = `${TODAY}T23:59:59.999Z`;
  const eventsSnap = await db
    .collection('analytics_events')
    .where('receivedAt', '>=', startOfDay)
    .where('receivedAt', '<=', endOfDay)
    .limit(5000)
    .get();

  const installs = new Set<string>();
  const sessions = new Set<string>();
  const platforms = new Map<string, number>();
  const eventTypes = new Map<string, number>();
  const storefrontTouches = new Map<string, Set<string>>();
  const directionsByStore = new Map<string, Set<string>>();
  const phoneByStore = new Map<string, Set<string>>();
  const hourBuckets = new Array(24).fill(0);

  for (const doc of eventsSnap.docs) {
    const d = doc.data() as Record<string, unknown>;
    const installId = (d.installId as string) ?? '';
    const sessionId = (d.sessionId as string) ?? '';
    const platform = (d.platform as string) ?? 'unknown';
    const eventType = (d.eventType as string) ?? '';
    const storefrontId = (d.storefrontId as string) ?? null;
    const receivedAt = (d.receivedAt as string) ?? '';
    const hour = parseInt(receivedAt.slice(11, 13), 10);

    installs.add(installId);
    sessions.add(sessionId);
    platforms.set(platform, (platforms.get(platform) ?? 0) + 1);
    eventTypes.set(eventType, (eventTypes.get(eventType) ?? 0) + 1);
    if (Number.isFinite(hour)) hourBuckets[hour] += 1;

    if (storefrontId) {
      if (!storefrontTouches.has(storefrontId)) storefrontTouches.set(storefrontId, new Set());
      storefrontTouches.get(storefrontId)!.add(installId);
      if (eventType === 'go_now_tapped') {
        if (!directionsByStore.has(storefrontId)) directionsByStore.set(storefrontId, new Set());
        directionsByStore.get(storefrontId)!.add(installId);
      }
      if (eventType === 'phone_tapped') {
        if (!phoneByStore.has(storefrontId)) phoneByStore.set(storefrontId, new Set());
        phoneByStore.get(storefrontId)!.add(installId);
      }
    }
  }

  console.log(`Distinct devices today: ${installs.size}`);
  console.log(`Distinct sessions today: ${sessions.size}`);
  console.log(`Total events sampled: ${eventsSnap.size}`);
  console.log('');

  console.log('Sessions by platform:');
  for (const [k, v] of [...platforms.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(v).padStart(5)}  ${k}`);
  }
  console.log('');

  console.log('Top event types today:');
  for (const [k, v] of [...eventTypes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    console.log(`  ${String(v).padStart(5)}  ${k}`);
  }
  console.log('');

  console.log('Storefronts touched today (top 15 by unique devices):');
  const sortedStores = [...storefrontTouches.entries()]
    .map(([id, devices]) => ({
      id,
      devices: devices.size,
      directions: directionsByStore.get(id)?.size ?? 0,
      phone: phoneByStore.get(id)?.size ?? 0,
    }))
    .sort((a, b) => b.devices - a.devices)
    .slice(0, 15);
  console.log(`  ${'devices'.padStart(8)}${'direc'.padStart(7)}${'phone'.padStart(7)}  storefront`);
  for (const r of sortedStores) {
    console.log(
      `  ${String(r.devices).padStart(8)}${String(r.directions).padStart(7)}${String(r.phone).padStart(7)}  ${r.id}`,
    );
  }
  console.log('');

  console.log('Hour-by-hour today (UTC):');
  const maxHour = Math.max(...hourBuckets, 1);
  for (let h = 0; h < 24; h += 1) {
    if (hourBuckets[h] === 0) continue;
    const bar = '█'.repeat(Math.round((hourBuckets[h] / maxHour) * 30));
    console.log(
      `  ${String(h).padStart(2, '0')}:00  ${String(hourBuckets[h]).padStart(5)}  ${bar}`,
    );
  }
  console.log('');

  // 3. Compare to 35-day daily average
  const recent = await db
    .collection('analytics_daily_app_metrics')
    .orderBy('date', 'desc')
    .limit(35)
    .get();
  let totalSess = 0;
  let totalEvents = 0;
  let n = 0;
  for (const doc of recent.docs) {
    const d = doc.data() as Record<string, unknown>;
    if (doc.id === TODAY) continue;
    totalSess += (d.sessionStartCount as number) ?? 0;
    totalEvents += (d.eventCount as number) ?? 0;
    n += 1;
  }
  console.log(`Comparison vs the prior ${n}-day average:`);
  console.log(`  prior avg sessions/day:  ${(totalSess / Math.max(1, n)).toFixed(1)}`);
  console.log(
    `  today's sessions:        ${appDoc.exists ? ((appDoc.data() as Record<string, unknown>).sessionStartCount ?? 0) : 0}`,
  );
  console.log(`  prior avg events/day:    ${(totalEvents / Math.max(1, n)).toFixed(0)}`);
  console.log(
    `  today's events so far:   ${appDoc.exists ? ((appDoc.data() as Record<string, unknown>).eventCount ?? 0) : 0}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
