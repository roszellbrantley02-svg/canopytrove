/**
 * Inspect every community_safety_state doc + show what's blocked.
 * Pass --clear=<profileId> to wipe blocked authors for a specific
 * profile, or --clear-all to wipe blocks for every profile.
 *
 * The blocks live PER-PROFILE — each member who taps "Hide reviews
 * from this author" on a storefront stores their personal block list
 * here. Clearing makes those previously-hidden reviews visible again.
 *
 * Usage:
 *   npx ts-node --project backend/tsconfig.json backend/scripts/inspect-and-clear-blocks.ts                # inspect only
 *   npx ts-node --project backend/tsconfig.json backend/scripts/inspect-and-clear-blocks.ts --clear=PROFILE_ID
 *   npx ts-node --project backend/tsconfig.json backend/scripts/inspect-and-clear-blocks.ts --clear-all
 */

import * as admin from 'firebase-admin';

const ARGS = process.argv.slice(2);
const CLEAR_ALL = ARGS.includes('--clear-all');
const CLEAR_PROFILE_ARG = ARGS.find((a) => a.startsWith('--clear='));
const CLEAR_PROFILE = CLEAR_PROFILE_ARG ? CLEAR_PROFILE_ARG.replace('--clear=', '') : null;

admin.initializeApp({ projectId: 'canopy-trove' });
const db = admin.firestore();
db.settings({ databaseId: 'canopytrove' });

async function main() {
  const snap = await db.collection('community_safety_state').get();
  console.log(`community_safety_state docs: ${snap.size}\n`);

  if (snap.empty) {
    console.log('No blocks anywhere. Nothing to clear.');
    return;
  }

  let toClearDocs: typeof snap.docs = [];

  for (const doc of snap.docs) {
    const d = doc.data() as Record<string, unknown>;
    const blockedByStorefront = (d.blockedAuthorsByStorefront ?? d.byStorefront ?? {}) as Record<
      string,
      unknown
    >;
    const blockedAuthorIds = (d.blockedAuthorProfileIds ?? []) as string[];
    const totalBlocks =
      Object.values(blockedByStorefront).reduce<number>(
        (acc, v) => acc + (Array.isArray(v) ? v.length : 0),
        0,
      ) + (Array.isArray(blockedAuthorIds) ? blockedAuthorIds.length : 0);

    console.log(`profileId: ${doc.id}`);
    console.log(`  total blocks: ${totalBlocks}`);
    console.log(`  blockedAuthorProfileIds (legacy): ${JSON.stringify(blockedAuthorIds)}`);
    console.log(`  blockedAuthorsByStorefront (per-store):`);
    if (Object.keys(blockedByStorefront).length === 0) {
      console.log('    (none)');
    } else {
      for (const [storefrontId, blocked] of Object.entries(blockedByStorefront)) {
        console.log(`    ${storefrontId}: ${JSON.stringify(blocked)}`);
      }
    }
    console.log(`  updatedAt: ${d.updatedAt ?? '(unknown)'}`);
    console.log('');

    if (CLEAR_ALL) {
      toClearDocs.push(doc);
    } else if (CLEAR_PROFILE && doc.id === CLEAR_PROFILE) {
      toClearDocs.push(doc);
    }
  }

  if (toClearDocs.length === 0) {
    console.log('No --clear flag provided. Nothing was modified.');
    console.log(
      'Pass --clear-all to wipe everything, or --clear=PROFILE_ID for a specific profile.',
    );
    return;
  }

  console.log(`\nWiping blocks for ${toClearDocs.length} profile(s)...\n`);
  for (const doc of toClearDocs) {
    const now = new Date().toISOString();
    await doc.ref.set(
      {
        blockedAuthorsByStorefront: {},
        blockedAuthorProfileIds: [],
        updatedAt: now,
      },
      { merge: true },
    );
    console.log(`  cleared blocks on ${doc.id}`);
  }
  console.log('\nDone.');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
