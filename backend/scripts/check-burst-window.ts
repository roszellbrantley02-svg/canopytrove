/**
 * Check what an install was doing during a specific burst window —
 * are go_now_tapped events isolated, or is everything firing in a
 * tight loop?
 *
 * Usage:
 *   npx ts-node --project backend/tsconfig.json backend/scripts/check-burst-window.ts install-mnm9olul-0zthqfxi 2026-04-06T14:28:00 2026-04-06T14:30:00
 */

import * as admin from 'firebase-admin';

const installId = process.argv[2];
const start = process.argv[3];
const end = process.argv[4];

if (!installId || !start || !end) {
  console.error('Usage: check-burst-window.ts <installId> <startISO> <endISO>');
  process.exit(2);
}

admin.initializeApp({ projectId: 'canopy-trove' });
const db = admin.firestore();
db.settings({ databaseId: 'canopytrove' });

async function main() {
  const snap = await db
    .collection('analytics_events')
    .where('installId', '==', installId)
    .limit(2000)
    .get();

  const startMs = Date.parse(start);
  const endMs = Date.parse(end);

  const inWindow = snap.docs
    .map((d) => d.data() as Record<string, unknown>)
    .filter((d) => {
      const occurredAt = (d.occurredAt as string) ?? '';
      const ms = Date.parse(occurredAt);
      return ms >= startMs && ms <= endMs;
    })
    .sort((a, b) => {
      const aMs = Date.parse((a.occurredAt as string) ?? '');
      const bMs = Date.parse((b.occurredAt as string) ?? '');
      return aMs - bMs;
    });

  console.log(`Install ${installId}, window ${start} → ${end}`);
  console.log(`Total events in window: ${inWindow.length}\n`);

  const byType = new Map<string, number>();
  const sessions = new Set<string>();
  for (const d of inWindow) {
    const t = (d.eventType as string) ?? '?';
    byType.set(t, (byType.get(t) ?? 0) + 1);
    if (typeof d.sessionId === 'string') sessions.add(d.sessionId);
  }

  console.log(`Distinct sessions in window: ${sessions.size}`);
  console.log('');
  console.log('Events by type:');
  for (const [k, v] of [...byType.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(v).padStart(5)}  ${k}`);
  }
  console.log('');

  // Print the chronological event log so we can see ordering
  console.log('Full chronological event log (first 80):');
  for (const d of inWindow.slice(0, 80)) {
    const occ = ((d.occurredAt as string) ?? '').slice(11, 23);
    const t = ((d.eventType as string) ?? '?').padEnd(28);
    const sf = (d.storefrontId as string) ?? '';
    const sc = ((d.metadata as Record<string, unknown> | undefined)?.sourceScreen as string) ?? '';
    const sess = ((d.sessionId as string) ?? '').slice(0, 25);
    console.log(`  ${occ}  ${t}  sess=${sess}  storefront=${sf || '-'}  screen=${sc || '-'}`);
  }
  if (inWindow.length > 80) {
    console.log(`  ... (${inWindow.length - 80} more)`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
