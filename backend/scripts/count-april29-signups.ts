import * as admin from 'firebase-admin';
admin.initializeApp({ projectId: 'canopy-trove' });
const db = admin.firestore();
db.settings({ databaseId: 'canopytrove' });
(async () => {
  const snap = await db
    .collection('analytics_events')
    .where('receivedAt', '>=', '2026-04-29T00:00:00.000Z')
    .where('receivedAt', '<=', '2026-04-29T23:59:59.999Z')
    .limit(5000)
    .get();
  const signupStartedDocs = snap.docs.filter(
    (d) => (d.data() as any).eventType === 'signup_started',
  );
  const signinDocs = snap.docs.filter((d) => (d.data() as any).eventType === 'signin');
  console.log('All signup_started docs Apr 29 (', signupStartedDocs.length, '):');
  for (const doc of signupStartedDocs) {
    const d = doc.data() as any;
    console.log(
      `  receivedAt=${d.receivedAt}  occurredAt=${d.occurredAt}  eventId=${d.eventId}  installId=${d.installId}  meta=${JSON.stringify(d.metadata)}`,
    );
  }
  console.log('\nAll signin docs Apr 29 (', signinDocs.length, '):');
  for (const doc of signinDocs) {
    const d = doc.data() as any;
    console.log(
      `  receivedAt=${d.receivedAt}  occurredAt=${d.occurredAt}  eventId=${d.eventId}  installId=${d.installId}  acct=${d.accountId}  meta=${JSON.stringify(d.metadata)}`,
    );
  }
  console.log(`\nTotal events Apr 29: ${snap.size}`);
})()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
