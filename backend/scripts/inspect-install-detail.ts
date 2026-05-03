/**
 * Forensic detail on a single install_id — pulls every event in
 * chronological order so we can see whether the activity pattern
 * looks like a heavy real user, the founder's own usage during
 * launch QA, or a UI bug auto-firing the same event repeatedly.
 *
 * Usage:
 *   npx ts-node --project backend/tsconfig.json backend/scripts/inspect-install-detail.ts install-mnm9olul-0zthqfxi
 */

import * as admin from 'firebase-admin';

const installId = process.argv[2];
if (!installId) {
  console.error('Usage: inspect-install-detail.ts <installId>');
  process.exit(2);
}

admin.initializeApp({ projectId: 'canopy-trove' });
const db = admin.firestore();
db.settings({ databaseId: 'canopytrove' });

async function main() {
  const snap = await db
    .collection('analytics_events')
    .where('installId', '==', installId)
    .limit(5000)
    .get();

  if (snap.empty) {
    console.log(`No events for ${installId}.`);
    return;
  }

  const docs = snap.docs.sort((a, b) => {
    const aTs = (a.data() as Record<string, unknown>).receivedAt as string;
    const bTs = (b.data() as Record<string, unknown>).receivedAt as string;
    return aTs < bTs ? -1 : aTs > bTs ? 1 : 0;
  });

  const eventTypeCounts = new Map<string, number>();
  const eventsByDay = new Map<string, number>();
  const sessions = new Set<string>();
  const directionsByStorefront = new Map<string, number>();
  let firstReceivedAt: string | null = null;
  let lastReceivedAt: string | null = null;
  for (const doc of docs) {
    const d = doc.data() as Record<string, unknown>;
    const eventType = (d.eventType as string) ?? '?';
    const receivedAt = (d.receivedAt as string) ?? '';
    const day = receivedAt.slice(0, 10);
    if (!firstReceivedAt) firstReceivedAt = receivedAt;
    lastReceivedAt = receivedAt;
    eventTypeCounts.set(eventType, (eventTypeCounts.get(eventType) ?? 0) + 1);
    eventsByDay.set(day, (eventsByDay.get(day) ?? 0) + 1);
    if (typeof d.sessionId === 'string') sessions.add(d.sessionId);
    if (eventType === 'go_now_tapped' && typeof d.storefrontId === 'string') {
      directionsByStorefront.set(
        d.storefrontId,
        (directionsByStorefront.get(d.storefrontId) ?? 0) + 1,
      );
    }
  }

  console.log(`Install detail: ${installId}\n`);
  console.log(`Total events: ${docs.length}`);
  console.log(`Distinct sessions: ${sessions.size}`);
  console.log(`Active window: ${firstReceivedAt?.slice(0, 19)} → ${lastReceivedAt?.slice(0, 19)}`);
  console.log(`Active days: ${eventsByDay.size}`);
  const platform = (docs[0].data() as Record<string, unknown>).platform;
  console.log(`Platform: ${platform}`);
  console.log('');

  console.log('Top event types:');
  for (const [k, v] of [...eventTypeCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    console.log(`  ${String(v).padStart(5)}  ${k}`);
  }
  console.log('');

  if (directionsByStorefront.size > 0) {
    console.log('Directions taps by storefront:');
    for (const [k, v] of [...directionsByStorefront.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(v).padStart(4)}  ${k}`);
    }
    console.log('');
  }

  // Density: events per day, max events in any 1-minute window
  console.log('Events per day:');
  for (const [day, count] of [...eventsByDay.entries()].sort()) {
    const bar = '█'.repeat(Math.min(40, Math.round(count / 20)));
    console.log(`  ${day}  ${String(count).padStart(5)}  ${bar}`);
  }
  console.log('');

  // Show a sample of go_now_tapped events to see if they're spread out
  // or auto-fired in a tight window (would point at a UI bug).
  const directionsDocs = docs.filter(
    (d) => (d.data() as Record<string, unknown>).eventType === 'go_now_tapped',
  );
  if (directionsDocs.length > 0) {
    console.log(`First 30 go_now_tapped events for this install (in order):`);
    for (const doc of directionsDocs.slice(0, 30)) {
      const d = doc.data() as Record<string, unknown>;
      console.log(
        `  ${(d.receivedAt as string).slice(11, 23)}  ${(d.occurredAt as string).slice(11, 23)}  storefront=${d.storefrontId}  sessionId=${(d.sessionId as string)?.slice(0, 30)}`,
      );
    }
    if (directionsDocs.length > 30) {
      console.log(`  ... (${directionsDocs.length - 30} more)`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
