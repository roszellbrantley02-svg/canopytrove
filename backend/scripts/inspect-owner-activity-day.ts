/**
 * Find every owner-side artifact created or touched on a given day:
 *   - dispensaryClaims with createdAt or updatedAt that day
 *   - ownerProfiles with createdAt or updatedAt that day
 *   - all dispensaryClaims (full audit, sorted by updatedAt desc)
 *
 * Used May 3 2026 to identify which dispensary owner was hammering
 * the owner-portal signup flow on April 29 (3 signup_started events
 * fired in the same second from owner_portal source).
 *
 * Usage:
 *   npx ts-node --project backend/tsconfig.json backend/scripts/inspect-owner-activity-day.ts 2026-04-29
 */

import * as admin from 'firebase-admin';

const dateArg = process.argv[2];
if (!dateArg || !/^\d{4}-\d{2}-\d{2}$/.test(dateArg)) {
  console.error('Usage: inspect-owner-activity-day.ts YYYY-MM-DD');
  process.exit(2);
}

admin.initializeApp({ projectId: 'canopy-trove' });
const db = admin.firestore();
db.settings({ databaseId: 'canopytrove' });

function isOnDay(value: unknown, dateKey: string): boolean {
  if (typeof value !== 'string') return false;
  return value.startsWith(dateKey);
}

async function main() {
  console.log(`Owner-side activity on ${dateArg} (UTC)\n`);

  // 1. ALL dispensaryClaims — small enough collection to scan in memory
  const allClaimsSnap = await db.collection('dispensaryClaims').get();
  console.log(`Total dispensaryClaims docs in collection: ${allClaimsSnap.size}`);
  console.log('');

  const claimsThatDay: Array<{ id: string; data: Record<string, unknown> }> = [];
  for (const doc of allClaimsSnap.docs) {
    const d = doc.data() as Record<string, unknown>;
    if (
      isOnDay(d.createdAt, dateArg) ||
      isOnDay(d.updatedAt, dateArg) ||
      isOnDay(d.submittedAt, dateArg) ||
      isOnDay(d.lastVerificationAttemptAt, dateArg)
    ) {
      claimsThatDay.push({ id: doc.id, data: d });
    }
  }

  if (claimsThatDay.length === 0) {
    console.log('No dispensaryClaims docs touched that day.\n');
  } else {
    console.log(`dispensaryClaims docs touched that day: ${claimsThatDay.length}`);
    for (const { id, data } of claimsThatDay) {
      console.log(`  claim ${id}:`);
      console.log(`    ownerUid:           ${data.ownerUid}`);
      console.log(`    storefrontId:       ${data.storefrontId ?? data.dispensaryId}`);
      console.log(`    claimStatus:        ${data.claimStatus ?? data.status}`);
      console.log(`    createdAt:          ${data.createdAt}`);
      console.log(`    updatedAt:          ${data.updatedAt}`);
      console.log(`    submittedAt:        ${data.submittedAt ?? '(none)'}`);
      console.log(`    lastVerificationAttemptAt: ${data.lastVerificationAttemptAt ?? '(none)'}`);
      console.log(`    bulkClaimBatchId:   ${data.bulkClaimBatchId ?? '(none)'}`);
    }
    console.log('');
  }

  // 2. ownerProfiles touched that day
  const allProfilesSnap = await db.collection('ownerProfiles').get();
  const profilesThatDay: Array<{ id: string; data: Record<string, unknown> }> = [];
  for (const doc of allProfilesSnap.docs) {
    const d = doc.data() as Record<string, unknown>;
    if (isOnDay(d.createdAt, dateArg) || isOnDay(d.updatedAt, dateArg)) {
      profilesThatDay.push({ id: doc.id, data: d });
    }
  }
  console.log(
    `Total ownerProfiles docs in collection: ${allProfilesSnap.size}, touched ${dateArg}: ${profilesThatDay.length}`,
  );
  for (const { id, data } of profilesThatDay) {
    console.log(
      `  ${id}: companyName=${data.companyName ?? '(none)'} email=${data.email ?? '(none)'} createdAt=${data.createdAt} updatedAt=${data.updatedAt}`,
    );
  }
  console.log('');

  // 3. Cross-ref ALL owner uids in claim records with their auth user
  // record so we know whose claims they are.
  const ownerUids = new Set<string>();
  for (const doc of allClaimsSnap.docs) {
    const d = doc.data() as Record<string, unknown>;
    if (typeof d.ownerUid === 'string') ownerUids.add(d.ownerUid);
  }

  console.log(`All owner uids that have claim records (${ownerUids.size}):`);
  for (const uid of ownerUids) {
    try {
      const userRecord = await admin.auth().getUser(uid);
      const claimsForUid = allClaimsSnap.docs.filter(
        (doc) => (doc.data() as Record<string, unknown>).ownerUid === uid,
      );
      console.log(
        `  ${uid}  ${userRecord.email ?? '(no email)'}  ${userRecord.displayName ?? ''}  lastSignIn=${userRecord.metadata.lastSignInTime}  claims=${claimsForUid.length}`,
      );
      for (const claimDoc of claimsForUid) {
        const c = claimDoc.data() as Record<string, unknown>;
        console.log(
          `    -> ${c.storefrontId ?? c.dispensaryId}  status=${c.claimStatus ?? c.status}  createdAt=${c.createdAt}`,
        );
      }
    } catch (error) {
      const code = (error as { code?: string }).code;
      console.log(
        `  ${uid}  ${code === 'auth/user-not-found' ? '(deleted auth user)' : (error as Error).message}`,
      );
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
