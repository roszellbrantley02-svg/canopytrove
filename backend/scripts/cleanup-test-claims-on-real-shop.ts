/* eslint-disable no-console */
// Cleanup: remove the test-account ownership of the REAL OCM-licensed shop
// `ocm-10923-garnerville-202-cannabis-co`. Created because
// `scripts/setup-demo-owner.mjs` hardcoded a real OCM license number as the
// demo storefront ID, polluting the production Firestore with two
// fully-approved test claims on a shop nobody on this team owns.
//
// Default = dry run. Pass `--execute` to actually delete.
//
//   FIREBASE_DATABASE_ID=canopytrove npx tsx \
//     backend/scripts/cleanup-test-claims-on-real-shop.ts [--execute]

import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const projectId = process.env.GCP_PROJECT || 'canopy-trove';
const databaseId = process.env.FIREBASE_DATABASE_ID || 'canopytrove';
const execute = process.argv.includes('--execute');

if (!getApps().length) {
  initializeApp({ credential: applicationDefault(), projectId });
}
const db = getFirestore(databaseId);
const auth = getAuth();

// `askushere@canopytrove.com` was created by the seed script back when the
// OWNER_PORTAL_ALLOWLIST env var had a typo (askushere vs askmehere). We
// fixed the env var last session; this account is residue and should be
// fully removed (Firestore + Firebase Auth).
const FULL_DELETE_OWNERS = [
  { uid: 'HKT4iAJGR0h7OeufEoB7bp3nCY42', email: 'askushere@canopytrove.com' },
];

// `applereviewer@canopytrove.com` is the Apple App Review credential the
// founder may need to hand over if the reviewer asks. Keep it (Firestore
// owner profile + auth user + verifications) but UNLINK it from the real
// Garnerville shop. A separate re-seed step will re-anchor it on a clearly
// fake demo shop ID.
const UNLINK_OWNERS = [
  { uid: 'rXcZI5eEVKaOYwKM9AZnYMudGyO2', email: 'applereviewer@canopytrove.com' },
];

const REAL_SHOP_ID = 'ocm-10923-garnerville-202-cannabis-co';

async function deleteIfExists(path: string) {
  const ref = db.doc(path);
  const snap = await ref.get();
  if (!snap.exists) {
    console.log(`  · skip (absent): ${path}`);
    return;
  }
  if (!execute) {
    console.log(`  ⌛ would delete:  ${path}`);
    return;
  }
  await ref.delete();
  console.log(`  ✔ deleted:       ${path}`);
}

async function clearOwnerProfileLink(ownerUid: string) {
  const ref = db.collection('ownerProfiles').doc(ownerUid);
  const snap = await ref.get();
  if (!snap.exists) {
    console.log(`  · skip (absent): ownerProfiles/${ownerUid}`);
    return;
  }
  const data = snap.data() as Record<string, unknown>;
  if (data.dispensaryId === null && data.subscriptionStatus === null) {
    console.log(`  · skip (already cleared): ownerProfiles/${ownerUid}`);
    return;
  }
  if (!execute) {
    console.log(
      `  ⌛ would clear:   ownerProfiles/${ownerUid}  (dispensaryId, subscriptionStatus, onboardingStep → null/start)`,
    );
    return;
  }
  await ref.update({
    dispensaryId: null,
    subscriptionStatus: null,
    onboardingStep: 'choose_storefront',
    updatedAt: new Date().toISOString(),
  });
  console.log(`  ✔ cleared:       ownerProfiles/${ownerUid}`);
}

async function deleteAuthUser(uid: string, email: string) {
  let exists = false;
  try {
    await auth.getUser(uid);
    exists = true;
  } catch {
    exists = false;
  }
  if (!exists) {
    console.log(`  · skip (absent): firebase-auth/${email}`);
    return;
  }
  if (!execute) {
    console.log(`  ⌛ would delete:  firebase-auth user ${uid} (${email})`);
    return;
  }
  await auth.deleteUser(uid);
  console.log(`  ✔ deleted:       firebase-auth user ${uid} (${email})`);
}

async function main() {
  console.log('━'.repeat(80));
  console.log(`Cleanup target: ${REAL_SHOP_ID}`);
  console.log(`Mode: ${execute ? '*** EXECUTE — writes will happen ***' : 'DRY RUN'}`);
  console.log('━'.repeat(80));

  // Step 1: unlink BOTH test owners from the real shop (claims + subscriptions
  // pointing at the real shop ID). This is the minimum cleanup that frees the
  // shop for a legitimate owner to claim.
  console.log('\n[1] Drop dispensaryClaims linking test owners to the real shop:');
  for (const owner of [...FULL_DELETE_OWNERS, ...UNLINK_OWNERS]) {
    await deleteIfExists(`dispensaryClaims/${owner.uid}_${REAL_SHOP_ID}`);
  }

  console.log('\n[2] Drop subscriptions referencing the real shop:');
  for (const owner of [...FULL_DELETE_OWNERS, ...UNLINK_OWNERS]) {
    await deleteIfExists(`subscriptions/${owner.uid}`);
  }

  // Step 2: clear `ownerProfiles.dispensaryId` for the unlinked accounts so
  // the owner portal stops showing them as the Garnerville owner. The full
  // delete accounts get their owner profile deleted entirely below.
  console.log('\n[3] Unlink ownerProfiles for accounts we keep:');
  for (const owner of UNLINK_OWNERS) {
    await clearOwnerProfileLink(owner.uid);
  }

  // Step 3: full delete of the typo account. ownerProfiles + verification
  // docs go too — the account is residue of a fixed env-var typo and has
  // no future purpose.
  console.log('\n[4] Full delete of askushere@ residue account:');
  for (const owner of FULL_DELETE_OWNERS) {
    await deleteIfExists(`ownerProfiles/${owner.uid}`);
    await deleteIfExists(`businessVerifications/${owner.uid}`);
    await deleteIfExists(`identityVerifications/${owner.uid}`);
    await deleteAuthUser(owner.uid, owner.email);
  }

  console.log('\n━'.repeat(80));
  if (execute) {
    console.log('Done.');
  } else {
    console.log('Dry run complete. Re-run with --execute to apply.');
  }
}

// FieldValue is imported above to keep the bundle from tree-shaking it; not
// otherwise referenced.
void FieldValue;

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('FAILED', err);
    process.exit(1);
  });
