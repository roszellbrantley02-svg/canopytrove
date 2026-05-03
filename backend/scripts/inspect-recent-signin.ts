import * as admin from 'firebase-admin';

admin.initializeApp({ projectId: 'canopy-trove' });
const db = admin.firestore();
db.settings({ databaseId: 'canopytrove' });

async function listAllAuthUsers(): Promise<admin.auth.UserRecord[]> {
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
  console.log('=== Total Firebase Auth users + most-recent activity ===');
  const users = await listAllAuthUsers();
  console.log(`Total users: ${users.length}`);

  const recentSignIn = [...users].sort(
    (a, b) => Date.parse(b.metadata.lastSignInTime) - Date.parse(a.metadata.lastSignInTime),
  );
  console.log('\nTop 10 by lastSignInTime:');
  for (const u of recentSignIn.slice(0, 10)) {
    console.log(
      `  ${u.metadata.lastSignInTime}  uid=${u.uid}  email=${u.email ?? '(none)'}  created=${u.metadata.creationTime}`,
    );
  }

  const recentCreate = [...users].sort(
    (a, b) => Date.parse(b.metadata.creationTime) - Date.parse(a.metadata.creationTime),
  );
  console.log('\nTop 10 by creationTime:');
  for (const u of recentCreate.slice(0, 10)) {
    console.log(
      `  ${u.metadata.creationTime}  uid=${u.uid}  email=${u.email ?? '(none)'}  lastSignIn=${u.metadata.lastSignInTime}`,
    );
  }

  // Most recent canopytrove_profile activity
  console.log('\n=== Top 10 canopytrove_profiles by updatedAt ===');
  const profSnap = await db
    .collection('canopytrove_profiles')
    .orderBy('updatedAt', 'desc')
    .limit(10)
    .get();
  for (const doc of profSnap.docs) {
    const d = doc.data() as Record<string, unknown>;
    console.log(
      `  ${d.updatedAt}  id=${doc.id}  kind=${d.kind ?? '(none)'}  accountId=${d.accountId ?? '(none)'}  displayName=${d.displayName ?? '(none)'}  createdAt=${d.createdAt}`,
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
