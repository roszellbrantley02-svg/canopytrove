import * as admin from 'firebase-admin';

admin.initializeApp({ projectId: 'canopy-trove' });
const db = admin.firestore();
db.settings({ databaseId: 'canopytrove' });

async function main() {
  // Query a tight window — the index handles a single eventType + receivedAt range.
  const snap = await db
    .collection('analytics_events')
    .where('receivedAt', '>=', '2026-04-06T14:28:00.000Z')
    .where('receivedAt', '<=', '2026-04-06T14:29:00.000Z')
    .limit(50)
    .get();

  const signins = snap.docs.filter(
    (doc) => (doc.data() as Record<string, unknown>).eventType === 'signin',
  );

  for (const doc of signins) {
    const d = doc.data() as Record<string, unknown>;
    console.log(
      `docId=${doc.id}\n  eventId=${d.eventId}\n  occurredAt=${d.occurredAt}\n  receivedAt=${d.receivedAt}\n  installId=${d.installId}\n  sessionId=${d.sessionId}\n  accountId=${d.accountId}\n  metadata=${JSON.stringify(d.metadata)}\n`,
    );
  }
  console.log(`Total signin docs in window: ${signins.length}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
