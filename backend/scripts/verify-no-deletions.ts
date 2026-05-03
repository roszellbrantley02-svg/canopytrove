/**
 * Verify nothing got deleted that shouldn't have. Audits:
 *   - All Firebase Auth users still present
 *   - All member_email_subscriptions docs still present (including
 *     count diff from earlier in the day)
 *   - All ownerProfiles + dispensaryClaims still present
 */

import * as admin from 'firebase-admin';

admin.initializeApp({ projectId: 'canopy-trove' });
const db = admin.firestore();
db.settings({ databaseId: 'canopytrove' });

async function listAllAuthUsers() {
  const all: admin.auth.UserRecord[] = [];
  let pageToken: string | undefined;
  do {
    const page = await admin.auth().listUsers(1000, pageToken);
    all.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);
  return all;
}

async function main() {
  console.log('Verifying nothing was deleted that should not have been.\n');

  const users = await listAllAuthUsers();
  console.log(`Firebase Auth users: ${users.length}`);
  console.log('  All UIDs and emails:');
  for (const u of users.sort(
    (a, b) => Date.parse(a.metadata.creationTime) - Date.parse(b.metadata.creationTime),
  )) {
    console.log(`    ${u.metadata.creationTime}  ${u.uid}  ${u.email ?? '(anonymous)'}`);
  }
  console.log('');

  const memberSnap = await db.collection('member_email_subscriptions').get();
  console.log(`member_email_subscriptions docs: ${memberSnap.size}`);
  console.log('  All:');
  for (const doc of memberSnap.docs.sort((a, b) => {
    const ad = (a.data() as Record<string, unknown>).createdAt as string;
    const bd = (b.data() as Record<string, unknown>).createdAt as string;
    return ad < bd ? -1 : 1;
  })) {
    const d = doc.data() as Record<string, unknown>;
    console.log(
      `    ${d.createdAt}  ${doc.id}  email=${d.email}  subscribed=${d.subscribed}  welcomeSent=${d.welcomeEmailSentAt ?? '(none)'}`,
    );
  }
  console.log('');

  const ownerProfilesSnap = await db.collection('ownerProfiles').get();
  console.log(`ownerProfiles docs: ${ownerProfilesSnap.size}`);
  for (const doc of ownerProfilesSnap.docs) {
    const d = doc.data() as Record<string, unknown>;
    console.log(`    ${doc.id}  email=${d.email}  companyName=${d.companyName ?? '(none)'}`);
  }
  console.log('');

  const claimsSnap = await db.collection('dispensaryClaims').get();
  console.log(`dispensaryClaims docs: ${claimsSnap.size}`);
  for (const doc of claimsSnap.docs) {
    const d = doc.data() as Record<string, unknown>;
    console.log(
      `    ${doc.id}  ownerUid=${d.ownerUid}  storefrontId=${d.storefrontId ?? d.dispensaryId}  status=${d.claimStatus ?? d.status}`,
    );
  }
  console.log('');

  const ownerWelcomeSnap = await db.collection('owner_welcome_emails').get();
  console.log(`owner_welcome_emails docs: ${ownerWelcomeSnap.size}`);
  for (const doc of ownerWelcomeSnap.docs) {
    const d = doc.data() as Record<string, unknown>;
    console.log(`    ${doc.id}  email=${d.email}  welcomeSent=${d.welcomeEmailSentAt ?? '(none)'}`);
  }
  console.log('');

  console.log('Summary:');
  console.log(`  Firebase Auth users:                 ${users.length}`);
  console.log(`  member_email_subscriptions docs:     ${memberSnap.size}`);
  console.log(`  ownerProfiles docs:                  ${ownerProfilesSnap.size}`);
  console.log(`  dispensaryClaims docs:               ${claimsSnap.size}`);
  console.log(`  owner_welcome_emails docs:           ${ownerWelcomeSnap.size}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
