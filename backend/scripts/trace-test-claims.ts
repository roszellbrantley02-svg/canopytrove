/* eslint-disable no-console */
// Trace every Firestore footprint for the two test owners on the real
// Garnerville shop. Read-only — produces a delete plan, doesn't execute.
//
// Run:
//   FIREBASE_DATABASE_ID=canopytrove npx tsx backend/scripts/trace-test-claims.ts

import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const projectId = process.env.GCP_PROJECT || 'canopy-trove';
const databaseId = process.env.FIREBASE_DATABASE_ID || 'canopytrove';
if (!getApps().length) {
  initializeApp({ credential: applicationDefault(), projectId });
}
const db = getFirestore(databaseId);

const TEST_OWNERS = [
  { uid: 'HKT4iAJGR0h7OeufEoB7bp3nCY42', label: 'askushere@canopytrove.com (typo)' },
  { uid: 'rXcZI5eEVKaOYwKM9AZnYMudGyO2', label: 'applereviewer@canopytrove.com' },
];
const SHOP_ID = 'ocm-10923-garnerville-202-cannabis-co';

const COLLECTIONS_BY_OWNER = [
  'subscriptions',
  'ownerProfiles',
  'owner_portal_alerts',
  'launch_program_owner_trials',
  'launch_program_early_adopters',
  'businessVerifications',
  'identityVerifications',
  'owner_storefront_profile_tools',
];

const COLLECTIONS_BY_OWNER_QUERY = [
  // collection name → field that holds the ownerUid
  { collection: 'dispensaryClaims', field: 'ownerUid' },
  { collection: 'subscriptions', field: 'ownerUid' },
  { collection: 'businessVerifications', field: 'ownerUid' },
  { collection: 'identityVerifications', field: 'ownerUid' },
];

const COLLECTIONS_BY_SHOP_QUERY = [
  { collection: 'dispensaryClaims', field: 'dispensaryId' },
  { collection: 'subscriptions', field: 'dispensaryId' },
];

async function inspectDocByOwner(collection: string, ownerUid: string) {
  const ref = db.collection(collection).doc(ownerUid);
  const snap = await ref.get();
  return snap.exists ? snap.data() : null;
}

async function queryByField(collection: string, field: string, value: string) {
  const snap = await db.collection(collection).where(field, '==', value).get();
  return snap.docs.map((d) => ({ id: d.id, data: d.data() }));
}

async function inspectShopDoc() {
  const shop = await db.collection('dispensaries').doc(SHOP_ID).get();
  const summary = await db.collection('storefront_summaries').doc(SHOP_ID).get();
  const detail = await db.collection('storefront_details').doc(SHOP_ID).get();
  return {
    dispensary: shop.exists ? shop.data() : null,
    summary: summary.exists ? summary.data() : null,
    detail: detail.exists ? detail.data() : null,
  };
}

async function main() {
  console.log('━'.repeat(80));
  console.log(`SHOP: ${SHOP_ID}`);
  console.log('━'.repeat(80));

  const shopDocs = await inspectShopDoc();
  console.log('\ndispensaries/' + SHOP_ID + ':');
  if (!shopDocs.dispensary) {
    console.log('  (does not exist)');
  } else {
    const data = shopDocs.dispensary as Record<string, unknown>;
    console.log(`  name: ${String(data.name ?? '—')}`);
    console.log(`  ownerUid: ${String(data.ownerUid ?? '— (no owner pointer)')}`);
    console.log(`  ocmLicenseNumber: ${String(data.ocmLicenseNumber ?? '—')}`);
    console.log(`  claimStatus: ${String(data.claimStatus ?? '—')}`);
    console.log(`  city/state: ${String(data.city ?? '—')}, ${String(data.state ?? '—')}`);
  }

  console.log('\nstorefront_summaries/' + SHOP_ID + ':');
  if (!shopDocs.summary) {
    console.log('  (does not exist)');
  } else {
    const data = shopDocs.summary as Record<string, unknown>;
    console.log(`  name: ${String(data.name ?? '—')}`);
    console.log(`  city: ${String(data.city ?? '—')}`);
  }

  for (const { collection, field } of COLLECTIONS_BY_SHOP_QUERY) {
    const hits = await queryByField(collection, field, SHOP_ID);
    console.log(`\n${collection} where ${field} == ${SHOP_ID}:  ${hits.length} doc(s)`);
    for (const hit of hits) {
      console.log(`  id: ${hit.id}`);
      const data = hit.data as Record<string, unknown>;
      const summary: Record<string, unknown> = {};
      for (const k of [
        'ownerUid',
        'claimStatus',
        'status',
        'plan',
        'tier',
        'verificationMethod',
        'createdAt',
        'updatedAt',
      ]) {
        if (k in data) summary[k] = data[k];
      }
      console.log(`    ${JSON.stringify(summary)}`);
    }
  }

  for (const owner of TEST_OWNERS) {
    console.log('\n' + '━'.repeat(80));
    console.log(`TEST OWNER: ${owner.uid}`);
    console.log(`            ${owner.label}`);
    console.log('━'.repeat(80));

    for (const collection of COLLECTIONS_BY_OWNER) {
      const data = await inspectDocByOwner(collection, owner.uid);
      console.log(`\n${collection}/${owner.uid}:  ${data ? 'EXISTS' : 'absent'}`);
      if (data) {
        const d = data as Record<string, unknown>;
        const keep: Record<string, unknown> = {};
        for (const k of Object.keys(d)) {
          // Don't echo back potentially-sensitive secrets even on read
          if (k === 'devicePushToken') {
            keep[k] = d[k] ? '<token-present>' : null;
            continue;
          }
          keep[k] = d[k];
        }
        console.log(`    ${JSON.stringify(keep)}`);
      }
    }

    for (const { collection, field } of COLLECTIONS_BY_OWNER_QUERY) {
      const hits = await queryByField(collection, field, owner.uid);
      console.log(`\n${collection} where ${field} == ${owner.uid}:  ${hits.length} doc(s)`);
      for (const hit of hits) {
        console.log(`  id: ${hit.id}`);
        const data = hit.data as Record<string, unknown>;
        const summary: Record<string, unknown> = {};
        for (const k of [
          'dispensaryId',
          'ownerUid',
          'claimStatus',
          'status',
          'plan',
          'tier',
          'verificationMethod',
          'verifiedAt',
          'createdAt',
        ]) {
          if (k in data) summary[k] = data[k];
        }
        console.log(`    ${JSON.stringify(summary)}`);
      }
    }
  }
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('FAILED', err);
    process.exit(1);
  });
