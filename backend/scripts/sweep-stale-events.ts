/* eslint-disable no-console */
// Stale-event sweeper for the Travel & Events tab.
//
// Marks `hidden: true` on any event whose `endsAt` is more than STALE_AFTER_DAYS
// in the past. Stale events stay in Firestore for audit / restore but stop
// surfacing in the Travel & Events list (the public API's `upcoming` filter
// already hides past events; the `all` filter respects `hidden`).
//
// Idempotent — safe to re-run; only writes to docs that need flipping.
// Runs nightly via .github/workflows/refresh-events.yml.
//
// Default = dry run. Pass `--execute` to apply. Pass `--days=N` to override
// the staleness window (default 7).
//
//   FIREBASE_DATABASE_ID=canopytrove npx tsx \
//     backend/scripts/sweep-stale-events.ts [--execute] [--days=7]

import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { EVENTS_COLLECTION_NAME } from '../src/constants/collections';

const projectId = process.env.GCP_PROJECT || 'canopy-trove';
const databaseId = process.env.FIREBASE_DATABASE_ID || 'canopytrove';
const execute = process.argv.includes('--execute');
const daysArg = process.argv.find((a) => a.startsWith('--days='));
const STALE_AFTER_DAYS = daysArg ? Math.max(0, Number(daysArg.split('=')[1])) : 7;

if (!getApps().length) {
  initializeApp({ credential: applicationDefault(), projectId });
}
const db = getFirestore(databaseId);

type EventRow = {
  id: string;
  title?: string;
  endsAt?: string;
  startsAt?: string;
  hidden?: boolean;
};

async function main() {
  const cutoffMs = Date.now() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;
  const cutoffIso = new Date(cutoffMs).toISOString();

  console.log('='.repeat(80));
  console.log(`Mode: ${execute ? '*** EXECUTE — writes will happen ***' : 'DRY RUN'}`);
  console.log(`Target: canopy-trove / ${databaseId} / ${EVENTS_COLLECTION_NAME}`);
  console.log(`Stale cutoff: events with endsAt < ${cutoffIso} (${STALE_AFTER_DAYS}d ago)`);
  console.log('='.repeat(80));
  console.log('');

  const snap = await db.collection(EVENTS_COLLECTION_NAME).get();
  const all = snap.docs.map((d) => ({ id: d.id, ...(d.data() as EventRow) }));

  let alreadyHidden = 0;
  let willHide = 0;
  let stillFresh = 0;
  let missingDate = 0;

  for (const e of all) {
    const dateRef = e.endsAt ?? e.startsAt;
    if (!dateRef) {
      missingDate += 1;
      continue;
    }
    if (dateRef >= cutoffIso) {
      stillFresh += 1;
      continue;
    }
    if (e.hidden === true) {
      alreadyHidden += 1;
      continue;
    }
    willHide += 1;
    const action = execute ? '[ok] hiding   ' : '[dry] would hide';
    console.log(`  ${action} ${e.id}  ("${e.title ?? '?'}")  endsAt=${dateRef}`);

    if (execute) {
      try {
        await db.collection(EVENTS_COLLECTION_NAME).doc(e.id).update({
          hidden: true,
          updatedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.log(`  [fail] ${e.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  console.log('');
  console.log('-'.repeat(80));
  console.log(`Summary: ${all.length} total events`);
  console.log(`  ${stillFresh.toString().padStart(4)}  fresh (endsAt within ${STALE_AFTER_DAYS}d)`);
  console.log(
    `  ${willHide.toString().padStart(4)}  ${execute ? 'hidden this run' : 'would hide'}`,
  );
  console.log(`  ${alreadyHidden.toString().padStart(4)}  already hidden`);
  console.log(`  ${missingDate.toString().padStart(4)}  missing date (skipped)`);
  console.log('');
  if (!execute) console.log('Re-run with --execute to apply.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('FAILED', err);
    process.exit(1);
  });
