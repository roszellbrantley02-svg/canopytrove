/**
 * Answer the question "are we getting a few heavy users or many one-time
 * visitors?" by pulling distinct install IDs across the whole dataset
 * and bucketing them by event volume.
 *
 * Also breaks down by platform (web installs vs iOS / Android) since
 * web users churn install IDs every time they clear cookies, use
 * incognito, or switch browsers — so a "web install" undercounts a
 * single human less than an iOS install does.
 */

import * as admin from 'firebase-admin';

admin.initializeApp({ projectId: 'canopy-trove' });
const db = admin.firestore();
db.settings({ databaseId: 'canopytrove' });

async function main() {
  // Pull every event in the dataset window. Backend writes are batched
  // and the receivedAt timestamp anchors to the flush time, not the
  // user's clock.
  const startCutoff = '2026-03-30T00:00:00.000Z';
  const endCutoff = '2026-05-04T00:00:00.000Z';

  console.log(`Pulling all analytics_events between ${startCutoff} and ${endCutoff}...`);

  let lastReceivedAt = startCutoff;
  let totalScanned = 0;
  const installEventCounts = new Map<string, number>();
  const installPlatforms = new Map<string, string>();
  const installFirstSeen = new Map<string, string>();
  const installLastSeen = new Map<string, string>();
  const installSessions = new Map<string, Set<string>>();

  // Page through in chunks of 5000 (Firestore offset/cursor pattern)
  while (true) {
    const snap = await db
      .collection('analytics_events')
      .where('receivedAt', '>=', lastReceivedAt)
      .where('receivedAt', '<', endCutoff)
      .orderBy('receivedAt', 'asc')
      .limit(5000)
      .get();

    if (snap.empty) break;

    for (const doc of snap.docs) {
      const d = doc.data() as Record<string, unknown>;
      const installId = (d.installId as string) ?? null;
      if (!installId) continue;
      const platform = (d.platform as string) ?? 'unknown';
      const sessionId = (d.sessionId as string) ?? null;
      const receivedAt = (d.receivedAt as string) ?? '';

      installEventCounts.set(installId, (installEventCounts.get(installId) ?? 0) + 1);
      installPlatforms.set(installId, platform);
      if (!installFirstSeen.has(installId) || receivedAt < installFirstSeen.get(installId)!) {
        installFirstSeen.set(installId, receivedAt);
      }
      if (!installLastSeen.has(installId) || receivedAt > installLastSeen.get(installId)!) {
        installLastSeen.set(installId, receivedAt);
      }
      if (sessionId) {
        if (!installSessions.has(installId)) installSessions.set(installId, new Set());
        installSessions.get(installId)!.add(sessionId);
      }
    }

    totalScanned += snap.size;
    const lastDoc = snap.docs[snap.docs.length - 1].data() as Record<string, unknown>;
    const newCursor = lastDoc.receivedAt as string;
    if (newCursor === lastReceivedAt) break;
    // Bump to slightly past the cursor to avoid re-pulling the same boundary doc
    lastReceivedAt = newCursor;
    if (snap.size < 5000) break;
  }

  console.log(`Scanned ${totalScanned} events.\n`);

  const installs = [...installEventCounts.entries()].sort((a, b) => b[1] - a[1]);
  const totalInstalls = installs.length;
  const totalEvents = installs.reduce((acc, [, n]) => acc + n, 0);

  console.log(`Total distinct install IDs (devices/browsers/sessions): ${totalInstalls}`);
  console.log(`Total events: ${totalEvents}`);
  console.log('');

  // Platform distribution
  const platformCounts = new Map<string, number>();
  const platformInstalls = new Map<string, number>();
  for (const [installId, count] of installs) {
    const platform = installPlatforms.get(installId) ?? 'unknown';
    platformCounts.set(platform, (platformCounts.get(platform) ?? 0) + count);
    platformInstalls.set(platform, (platformInstalls.get(platform) ?? 0) + 1);
  }

  console.log('By platform:');
  console.log(
    `  ${'platform'.padEnd(10)}${'installs'.padStart(10)}${'events'.padStart(10)}${'evt/inst'.padStart(10)}`,
  );
  for (const [k, v] of [...platformCounts.entries()].sort((a, b) => b[1] - a[1])) {
    const inst = platformInstalls.get(k) ?? 0;
    const ratio = inst > 0 ? (v / inst).toFixed(1) : '0';
    console.log(
      `  ${k.padEnd(10)}${String(inst).padStart(10)}${String(v).padStart(10)}${ratio.padStart(10)}`,
    );
  }
  console.log('');

  // Bucket by event volume — concentration check
  const buckets = [
    { label: '1 event', min: 1, max: 1, count: 0, events: 0 },
    { label: '2-5 events', min: 2, max: 5, count: 0, events: 0 },
    { label: '6-20 events', min: 6, max: 20, count: 0, events: 0 },
    { label: '21-100 events', min: 21, max: 100, count: 0, events: 0 },
    { label: '101-500 events', min: 101, max: 500, count: 0, events: 0 },
    { label: '500+ events', min: 501, max: Infinity, count: 0, events: 0 },
  ];

  for (const [, count] of installs) {
    for (const b of buckets) {
      if (count >= b.min && count <= b.max) {
        b.count += 1;
        b.events += count;
        break;
      }
    }
  }

  console.log('Distribution of installs by event volume:');
  console.log(
    `  ${'bucket'.padEnd(18)}${'installs'.padStart(10)}${'%inst'.padStart(8)}${'events'.padStart(10)}${'%evt'.padStart(8)}`,
  );
  for (const b of buckets) {
    const instPct = ((b.count / totalInstalls) * 100).toFixed(1);
    const evtPct = ((b.events / totalEvents) * 100).toFixed(1);
    console.log(
      `  ${b.label.padEnd(18)}${String(b.count).padStart(10)}${instPct.padStart(8)}${String(b.events).padStart(10)}${evtPct.padStart(8)}`,
    );
  }
  console.log('');

  // Top concentration metrics
  let topNEvents = 0;
  for (let i = 0; i < Math.min(10, installs.length); i += 1) topNEvents += installs[i][1];
  const top10Pct = ((topNEvents / totalEvents) * 100).toFixed(1);

  let top1pctEvents = 0;
  const top1pctCount = Math.max(1, Math.floor(totalInstalls * 0.01));
  for (let i = 0; i < top1pctCount; i += 1) top1pctEvents += installs[i][1];
  const top1pctPct = ((top1pctEvents / totalEvents) * 100).toFixed(1);

  console.log('Concentration:');
  console.log(
    `  Top 1 install:       ${installs[0][1]} events (${((installs[0][1] / totalEvents) * 100).toFixed(1)}% of all)`,
  );
  console.log(`  Top 10 installs:     ${topNEvents} events (${top10Pct}% of all)`);
  console.log(
    `  Top ${top1pctCount} installs (1%): ${top1pctEvents} events (${top1pctPct}% of all)`,
  );
  console.log('');

  // Top 15 install IDs in detail
  console.log('Top 15 installs in detail:');
  console.log(
    `  ${'install'.padEnd(38)}${'platform'.padEnd(10)}${'events'.padStart(8)}${'sess'.padStart(7)}  first → last seen`,
  );
  for (let i = 0; i < Math.min(15, installs.length); i += 1) {
    const [installId, count] = installs[i];
    const platform = installPlatforms.get(installId) ?? '?';
    const sess = installSessions.get(installId)?.size ?? 0;
    const first = installFirstSeen.get(installId)?.slice(0, 10) ?? '?';
    const last = installLastSeen.get(installId)?.slice(0, 10) ?? '?';
    console.log(
      `  ${installId.padEnd(38)}${platform.padEnd(10)}${String(count).padStart(8)}${String(sess).padStart(7)}  ${first} → ${last}`,
    );
  }
  console.log('');

  // The honest visitor estimate
  const oneEventInstalls = buckets[0].count;
  const lightInstalls = buckets[0].count + buckets[1].count;
  const engagedInstalls = buckets[2].count + buckets[3].count + buckets[4].count + buckets[5].count;

  console.log('Honest visitor estimate (read out loud):');
  console.log(`  ${totalInstalls} distinct install IDs across the 35 days.`);
  console.log(`  Of those:`);
  console.log(`    ${oneEventInstalls} did literally one thing (probably bounced or bot)`);
  console.log(`    ${lightInstalls - oneEventInstalls} did 2-5 things (brief casual look)`);
  console.log(`    ${engagedInstalls} did 6+ things (actually engaged with the app)`);
  console.log(`  → Approximate "real engaged visitors": ${engagedInstalls} across the period.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
