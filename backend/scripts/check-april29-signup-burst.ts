import * as admin from 'firebase-admin';
admin.initializeApp({ projectId: 'canopy-trove' });
const db = admin.firestore();
db.settings({ databaseId: 'canopytrove' });
(async () => {
  const snap = await db
    .collection('analytics_events')
    .where('receivedAt', '>=', '2026-04-29T09:56:50.000Z')
    .where('receivedAt', '<=', '2026-04-29T09:57:10.000Z')
    .limit(20)
    .get();
  for (const doc of snap.docs) {
    const d = doc.data() as Record<string, unknown>;
    console.log(
      `${(d.receivedAt as string).slice(11, 23)}  ${d.eventType}  installId=${d.installId}  sessionId=${(d.sessionId as string)?.slice(0, 30)}  ${JSON.stringify(d.metadata)}`,
    );
  }
  console.log(`\n${snap.size} docs in 20-second window`);
})()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
