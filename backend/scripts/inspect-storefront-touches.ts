/**
 * Forensic for a single storefront — answers "is this real organic
 * discovery or one tester hammering their own home store?" by looking
 * at install / session diversity, day spread, and time-of-day mix
 * across all engagement events that touched this storefront.
 *
 * Usage:
 *   npx ts-node --project backend/tsconfig.json backend/scripts/inspect-storefront-touches.ts ocm-14590-wolcott-the-coughie-shop
 */

import * as admin from 'firebase-admin';

const storefrontId = process.argv[2];
if (!storefrontId) {
  console.error('Usage: inspect-storefront-touches.ts <storefrontId>');
  process.exit(2);
}

admin.initializeApp({ projectId: 'canopy-trove' });
const db = admin.firestore();
db.settings({ databaseId: 'canopytrove' });

async function main() {
  const snap = await db
    .collection('analytics_events')
    .where('storefrontId', '==', storefrontId)
    .limit(5000)
    .get();

  if (snap.empty) {
    console.log(`No events touched ${storefrontId}.`);
    return;
  }

  const installIds = new Map<string, number>();
  const sessionIds = new Map<string, number>();
  const days = new Map<string, number>();
  const platforms = new Map<string, number>();
  const eventTypeCounts = new Map<string, number>();
  const directionsByInstall = new Map<string, number>();
  const directionsBySession = new Map<string, number>();
  const directionsByDay = new Map<string, number>();
  const opensByInstall = new Map<string, number>();
  const hourBuckets = new Array(24).fill(0);

  for (const doc of snap.docs) {
    const d = doc.data() as Record<string, unknown>;
    const installId = (d.installId as string) ?? 'unknown';
    const sessionId = (d.sessionId as string) ?? 'unknown';
    const platform = (d.platform as string) ?? 'unknown';
    const eventType = (d.eventType as string) ?? 'unknown';
    const receivedAt = (d.receivedAt as string) ?? '';
    const day = receivedAt.slice(0, 10);
    const hour = parseInt(receivedAt.slice(11, 13), 10);

    installIds.set(installId, (installIds.get(installId) ?? 0) + 1);
    sessionIds.set(sessionId, (sessionIds.get(sessionId) ?? 0) + 1);
    days.set(day, (days.get(day) ?? 0) + 1);
    platforms.set(platform, (platforms.get(platform) ?? 0) + 1);
    eventTypeCounts.set(eventType, (eventTypeCounts.get(eventType) ?? 0) + 1);
    if (Number.isFinite(hour)) hourBuckets[hour] += 1;

    if (eventType === 'go_now_tapped') {
      directionsByInstall.set(installId, (directionsByInstall.get(installId) ?? 0) + 1);
      directionsBySession.set(sessionId, (directionsBySession.get(sessionId) ?? 0) + 1);
      directionsByDay.set(day, (directionsByDay.get(day) ?? 0) + 1);
    }
    if (eventType === 'storefront_opened') {
      opensByInstall.set(installId, (opensByInstall.get(installId) ?? 0) + 1);
    }
  }

  console.log(`Storefront forensic: ${storefrontId}\n`);
  console.log(`Total events: ${snap.size}`);
  console.log(`Distinct install IDs (devices): ${installIds.size}`);
  console.log(`Distinct sessions (visits): ${sessionIds.size}`);
  console.log(`Distinct days with activity: ${days.size}`);
  console.log('');

  console.log('Events by type:');
  for (const [k, v] of [...eventTypeCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(v).padStart(5)}  ${k}`);
  }
  console.log('');

  console.log('Events by platform:');
  for (const [k, v] of [...platforms.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(v).padStart(5)}  ${k}`);
  }
  console.log('');

  // Top install IDs by event count — concentration vs spread
  const installSorted = [...installIds.entries()].sort((a, b) => b[1] - a[1]);
  console.log(`Top 10 installs by total events (concentration check):`);
  let topNTotal = 0;
  for (let i = 0; i < Math.min(10, installSorted.length); i += 1) {
    const [id, count] = installSorted[i];
    topNTotal += count;
    const pct = ((count / snap.size) * 100).toFixed(1);
    const dirCount = directionsByInstall.get(id) ?? 0;
    const opnCount = opensByInstall.get(id) ?? 0;
    console.log(
      `  ${String(count).padStart(5)} (${pct.padStart(5)}%)  ${id.padEnd(36)}  directions=${dirCount}  opens=${opnCount}`,
    );
  }
  const topNPct = ((topNTotal / snap.size) * 100).toFixed(1);
  console.log(`  ⇒ Top 10 installs account for ${topNPct}% of all events`);
  console.log('');

  // Directions specifically — the highest-intent metric
  console.log(
    `Directions taps (${directionsByInstall.size > 0 ? [...directionsByInstall.values()].reduce((a, b) => a + b, 0) : 0} total):`,
  );
  console.log(`  Distinct devices that tapped directions: ${directionsByInstall.size}`);
  console.log(`  Distinct sessions that tapped directions: ${directionsBySession.size}`);
  console.log(`  Distinct days with directions taps: ${directionsByDay.size}`);
  console.log('');

  console.log(`Top 10 devices by directions taps:`);
  const dirSorted = [...directionsByInstall.entries()].sort((a, b) => b[1] - a[1]);
  for (let i = 0; i < Math.min(10, dirSorted.length); i += 1) {
    const [id, count] = dirSorted[i];
    console.log(`  ${String(count).padStart(4)}  ${id}`);
  }
  console.log('');

  console.log(`Top 10 days by directions taps:`);
  const dayDirSorted = [...directionsByDay.entries()].sort((a, b) => b[1] - a[1]);
  for (let i = 0; i < Math.min(10, dayDirSorted.length); i += 1) {
    const [day, count] = dayDirSorted[i];
    console.log(`  ${String(count).padStart(4)}  ${day}`);
  }
  console.log('');

  // Day spread visualization
  const dayKeys = [...days.keys()].sort();
  const maxDayEvents = Math.max(...days.values());
  console.log(
    `Activity by date (${dayKeys.length} days observed, first ${dayKeys[0]} → last ${dayKeys[dayKeys.length - 1]}):`,
  );
  for (const day of dayKeys) {
    const v = days.get(day) ?? 0;
    const bar = '█'.repeat(Math.round((v / Math.max(1, maxDayEvents)) * 40));
    const dirOnDay = directionsByDay.get(day) ?? 0;
    const dirMark = dirOnDay > 0 ? `  (${dirOnDay} directions)` : '';
    console.log(`  ${day}  ${String(v).padStart(4)}  ${bar}${dirMark}`);
  }
  console.log('');

  console.log('Hour-of-day distribution (UTC):');
  const maxHour = Math.max(...hourBuckets);
  for (let h = 0; h < 24; h += 1) {
    const bar = '█'.repeat(Math.round((hourBuckets[h] / Math.max(1, maxHour)) * 30));
    console.log(
      `  ${String(h).padStart(2, '0')}:00  ${String(hourBuckets[h]).padStart(4)}  ${bar}`,
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
