/**
 * Delete a single orphan member_email_subscriptions doc whose accountId
 * no longer resolves to a Firebase Auth user.
 *
 * Background: discovered May 3 2026 that `8b7IOvGvm1gLqjy8CcJrnyoJCdj2`
 * (outletproduction39@gmail.com) had a surviving subscription doc but
 * the auth user was already deleted. The Apr 22 welcome attempt failed
 * with "API key is invalid", so until today there was no actual send —
 * but we then re-sent during the backfill run, which is exactly what a
 * deleted user should NOT receive.
 *
 * Verifies the auth user is genuinely missing before deleting (refuses
 * to delete an active user's record by typo).
 *
 * Usage:
 *   npx ts-node --project backend/tsconfig.json backend/scripts/cleanup-orphan-member-subscription.ts <accountId>
 *   npx ts-node --project backend/tsconfig.json backend/scripts/cleanup-orphan-member-subscription.ts 8b7IOvGvm1gLqjy8CcJrnyoJCdj2 --dry-run
 */

import * as admin from 'firebase-admin';

const accountId = process.argv.find((arg) => arg.match(/^[A-Za-z0-9]{20,30}$/));
const DRY_RUN = process.argv.includes('--dry-run');

if (!accountId) {
  console.error('Usage: cleanup-orphan-member-subscription.ts <accountId> [--dry-run]');
  process.exit(2);
}

admin.initializeApp({ projectId: 'canopy-trove' });
const db = admin.firestore();
db.settings({ databaseId: 'canopytrove' });

async function main() {
  const docRef = db.collection('member_email_subscriptions').doc(accountId!);
  const snap = await docRef.get();
  if (!snap.exists) {
    console.log(`No member_email_subscriptions doc for ${accountId}. Nothing to do.`);
    return;
  }
  const data = snap.data() as Record<string, unknown>;
  console.log(`Found subscription doc:`);
  console.log(`  email=${data.email}`);
  console.log(`  subscribed=${data.subscribed}`);
  console.log(`  createdAt=${data.createdAt}`);
  console.log(`  welcomeEmailSentAt=${data.welcomeEmailSentAt ?? '(none)'}`);

  // Refuse to delete if the auth user actually exists. Belt-and-braces
  // against an accidental delete from a typo.
  let authUserExists = false;
  try {
    await admin.auth().getUser(accountId!);
    authUserExists = true;
  } catch (error) {
    if ((error as { code?: string }).code !== 'auth/user-not-found') {
      throw error;
    }
  }

  if (authUserExists) {
    console.error(
      `ABORT: Firebase Auth user ${accountId} still exists. Refusing to delete a live user's subscription doc.`,
    );
    process.exit(1);
  }

  console.log(`Confirmed: Firebase Auth user ${accountId} no longer exists.`);

  if (DRY_RUN) {
    console.log(`[dry-run] would delete member_email_subscriptions/${accountId}`);
    return;
  }

  await docRef.delete();
  console.log(`Deleted member_email_subscriptions/${accountId}.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
