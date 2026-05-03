import * as admin from 'firebase-admin';

admin.initializeApp({ projectId: 'canopy-trove' });
const db = admin.firestore();
db.settings({ databaseId: 'canopytrove' });

async function main() {
  console.log('=== Recent member_email_subscriptions (top 10 by updatedAt) ===');
  const memberSnap = await db
    .collection('member_email_subscriptions')
    .orderBy('updatedAt', 'desc')
    .limit(10)
    .get();
  for (const doc of memberSnap.docs) {
    const d = doc.data() as Record<string, unknown>;
    console.log({
      id: doc.id,
      email: d.email,
      status: d.status,
      welcomeEmailSentAt: d.welcomeEmailSentAt,
      lastDeliveryEventType: d.lastDeliveryEventType,
      providerMessageId: d.providerMessageId,
      lastWelcomeEmailError: d.lastWelcomeEmailError,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    });
  }
  console.log('');
  console.log('=== Recent owner_welcome_emails (top 10 by updatedAt) ===');
  const ownerSnap = await db
    .collection('owner_welcome_emails')
    .orderBy('updatedAt', 'desc')
    .limit(10)
    .get();
  if (ownerSnap.empty) {
    console.log('(empty collection)');
  }
  for (const doc of ownerSnap.docs) {
    const d = doc.data() as Record<string, unknown>;
    console.log({
      uid: doc.id,
      email: d.email,
      displayName: d.displayName,
      companyName: d.companyName,
      welcomeEmailSentAt: d.welcomeEmailSentAt,
      lastDeliveryEventType: d.lastDeliveryEventType,
      providerMessageId: d.providerMessageId,
      lastWelcomeEmailError: d.lastWelcomeEmailError,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    });
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
