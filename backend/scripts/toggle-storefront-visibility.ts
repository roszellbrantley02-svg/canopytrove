/**
 * Toggle storefront visibility in the live app.
 *
 * Usage:
 *   npx tsx scripts/toggle-storefront-visibility.ts hide
 *   npx tsx scripts/toggle-storefront-visibility.ts show
 *
 * This moves storefront documents between the live collections and
 * backup collections so the storefront disappears from (or reappears
 * in) the public app without losing any data.
 */
import * as admin from 'firebase-admin';

const FIREBASE_PROJECT_ID = 'canopy-trove';
const FIREBASE_DATABASE_ID = 'canopytrove';
const STOREFRONT_ID = 'test-wolcott-dispensary';

const SUMMARY_COLLECTION = 'storefront_summaries';
const DETAILS_COLLECTION = 'storefront_details';
const BACKUP_SUMMARY_COLLECTION = 'storefront_summaries_hidden';
const BACKUP_DETAILS_COLLECTION = 'storefront_details_hidden';

admin.initializeApp({ projectId: FIREBASE_PROJECT_ID });
const db = admin.firestore();
db.settings({ databaseId: FIREBASE_DATABASE_ID });

async function moveDoc(fromCollection: string, toCollection: string, docId: string, label: string) {
  const sourceRef = db.collection(fromCollection).doc(docId);
  const destRef = db.collection(toCollection).doc(docId);
  const snap = await sourceRef.get();

  if (!snap.exists) {
    console.log(`⏭  ${label} not found in ${fromCollection} — skipping.`);
    return false;
  }

  await destRef.set(snap.data()!);
  await sourceRef.delete();
  console.log(`✅ Moved ${label} from ${fromCollection} → ${toCollection}`);
  return true;
}

async function hide() {
  console.log(`\nHiding storefront "${STOREFRONT_ID}" from the live app...\n`);
  await moveDoc(SUMMARY_COLLECTION, BACKUP_SUMMARY_COLLECTION, STOREFRONT_ID, 'Summary');
  await moveDoc(DETAILS_COLLECTION, BACKUP_DETAILS_COLLECTION, STOREFRONT_ID, 'Details');
  console.log('\n✅ Done. The storefront is now hidden from the public app.');
  console.log('   Run with "show" to restore it later.\n');
}

async function show() {
  console.log(`\nRestoring storefront "${STOREFRONT_ID}" to the live app...\n`);
  await moveDoc(BACKUP_SUMMARY_COLLECTION, SUMMARY_COLLECTION, STOREFRONT_ID, 'Summary');
  await moveDoc(BACKUP_DETAILS_COLLECTION, DETAILS_COLLECTION, STOREFRONT_ID, 'Details');
  console.log('\n✅ Done. The storefront is now visible in the public app again.');
  console.log('   It may take up to 5 minutes for caches to refresh.\n');
}

const action = process.argv[2]?.toLowerCase();

if (action === 'hide') {
  hide()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
} else if (action === 'show') {
  show()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
} else {
  console.error('Usage: npx tsx scripts/toggle-storefront-visibility.ts [hide|show]');
  process.exit(1);
}
