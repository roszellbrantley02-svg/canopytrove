import * as admin from 'firebase-admin';

const FIREBASE_PROJECT_ID = 'canopy-trove';
const FIREBASE_DATABASE_ID = 'canopytrove';
const OWNER_UID = 'PTGZVrZuTxZDjst0ihiM079DmQi1';
const STOREFRONT_ID = 'test-wolcott-dispensary';

admin.initializeApp({ projectId: FIREBASE_PROJECT_ID });
const db = admin.firestore();
db.settings({ databaseId: FIREBASE_DATABASE_ID });

async function main() {
  const now = new Date().toISOString();

  // 1. Fix ownerProfile subscriptionStatus
  const profileRef = db.collection('ownerProfiles').doc(OWNER_UID);
  const profileSnap = await profileRef.get();
  if (!profileSnap.exists) {
    console.error('❌ ownerProfile not found for', OWNER_UID);
    process.exit(1);
  }
  const profileData = profileSnap.data()!;
  console.log('Current ownerProfile subscriptionStatus:', profileData.subscriptionStatus);
  console.log(
    'Current ownerProfile businessVerificationStatus:',
    profileData.businessVerificationStatus,
  );
  console.log(
    'Current ownerProfile identityVerificationStatus:',
    profileData.identityVerificationStatus,
  );

  // 2. Read subscription
  const subRef = db.collection('subscriptions').doc(OWNER_UID);
  const subSnap = await subRef.get();
  const subData = subSnap.exists ? subSnap.data()! : null;
  if (subData) {
    console.log('Current subscription status:', subData.status, '| tier:', subData.tier);
  }

  // 3. Update ownerProfile — sync subscriptionStatus and verification statuses
  await profileRef.set(
    {
      subscriptionStatus: subData?.status ?? 'active',
      businessVerificationStatus: 'approved',
      identityVerificationStatus: 'approved',
    },
    { merge: true },
  );
  console.log('✅ Updated ownerProfile: subscriptionStatus=active, both verifications=approved');

  // 4. Create or update businessVerifications doc
  const bizRef = db.collection('businessVerifications').doc(OWNER_UID);
  const bizSnap = await bizRef.get();
  if (!bizSnap.exists) {
    await bizRef.set({
      ownerUid: OWNER_UID,
      storefrontId: STOREFRONT_ID,
      verificationStatus: 'approved',
      submittedAt: now,
      reviewedAt: now,
      reviewNote: 'Test owner — auto-approved for development.',
    });
    console.log('✅ Created businessVerifications doc (approved)');
  } else {
    console.log('businessVerifications already exists:', bizSnap.data()?.verificationStatus);
    await bizRef.set({ verificationStatus: 'approved', reviewedAt: now }, { merge: true });
    console.log('✅ Updated businessVerifications to approved');
  }

  // 5. Create or update identityVerifications doc
  const idRef = db.collection('identityVerifications').doc(OWNER_UID);
  const idSnap = await idRef.get();
  if (!idSnap.exists) {
    await idRef.set({
      ownerUid: OWNER_UID,
      storefrontId: STOREFRONT_ID,
      verificationStatus: 'approved',
      submittedAt: now,
      reviewedAt: now,
      reviewNote: 'Test owner — auto-approved for development.',
    });
    console.log('✅ Created identityVerifications doc (approved)');
  } else {
    console.log('identityVerifications already exists:', idSnap.data()?.verificationStatus);
    await idRef.set({ verificationStatus: 'approved', reviewedAt: now }, { merge: true });
    console.log('✅ Updated identityVerifications to approved');
  }

  // 6. Verify subscription has dispensaryId matching storefront
  if (subData && subData.dispensaryId !== STOREFRONT_ID) {
    await subRef.set({ dispensaryId: STOREFRONT_ID }, { merge: true });
    console.log('✅ Fixed subscription.dispensaryId to match storefront');
  }

  console.log('\n✅ All done. Owner is now fully verified with Pro tier.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
