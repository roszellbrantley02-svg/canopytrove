import * as admin from 'firebase-admin';
admin.initializeApp({ projectId: 'canopy-trove' });
const db = admin.firestore();
db.settings({ databaseId: 'canopytrove' });
(async () => {
  const profilesSnap = await db.collection('profiles').get();
  console.log(`profiles collection: ${profilesSnap.size} docs`);
  let withAccount = 0;
  let anon = 0;
  const byAccount = new Map<string, string[]>();
  for (const doc of profilesSnap.docs) {
    const d = doc.data() as any;
    if (d.accountId) {
      withAccount += 1;
      if (!byAccount.has(d.accountId)) byAccount.set(d.accountId, []);
      byAccount.get(d.accountId)!.push(doc.id);
    } else {
      anon += 1;
    }
  }
  console.log(`  with accountId: ${withAccount}`);
  console.log(`  anonymous:      ${anon}`);
  console.log('  accounts with >1 profile:');
  for (const [acct, ids] of byAccount) {
    if (ids.length > 1) console.log(`    ${acct}: ${ids.length} profiles`);
  }
  console.log('  accounts with exactly 1 profile:');
  for (const [acct, ids] of byAccount) {
    if (ids.length === 1) console.log(`    ${acct}: ${ids[0]}`);
  }
})()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
