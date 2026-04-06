/**
 * Seed a test owner account with a fake dispensary near Wolcott, NY.
 *
 * Usage (from project root):
 *   npx ts-node --project backend/tsconfig.json backend/scripts/seed-test-owner.ts
 *
 * Prerequisites:
 *   - GOOGLE_APPLICATION_CREDENTIALS or Application Default Credentials configured
 *   - The Firebase Auth user for the email must already exist
 */

import * as admin from 'firebase-admin';

// ── Config ─────────────────────────────────────────────────────────────
const FIREBASE_PROJECT_ID = 'canopy-trove';
const FIREBASE_DATABASE_ID = 'canopytrove';

const OWNER_EMAIL = 'rozellbrantley@icloud.com';
const STOREFRONT_ID = 'test-wolcott-dispensary';
const NOW = new Date().toISOString();

// Wolcott, NY coordinates (roughly Main St area)
const LAT = 43.2217;
const LNG = -76.8169;

// ── Initialize Firebase Admin ──────────────────────────────────────────
admin.initializeApp({ projectId: FIREBASE_PROJECT_ID });
const db = admin.firestore();
db.settings({ databaseId: FIREBASE_DATABASE_ID });

async function main() {
  // 1. Look up the Firebase Auth user to get their UID
  console.log(`Looking up Firebase Auth user for ${OWNER_EMAIL}...`);
  let userRecord: admin.auth.UserRecord;
  try {
    userRecord = await admin.auth().getUserByEmail(OWNER_EMAIL);
  } catch (err) {
    console.error(
      `Could not find Firebase Auth user for ${OWNER_EMAIL}. ` +
        'Make sure the account exists in Firebase Authentication first.',
    );
    process.exit(1);
  }
  const ownerUid = userRecord.uid;
  console.log(`Found user: uid=${ownerUid}`);

  // 2. Set custom claims so the app recognizes them as an owner
  console.log('Setting custom claims (role: owner)...');
  await admin.auth().setCustomUserClaims(ownerUid, { role: 'owner' });

  // 3. Seed storefront_summaries
  console.log('Creating storefront summary...');
  await db.collection('storefront_summaries').doc(STOREFRONT_ID).set({
    licenseId: 'TEST-WOL-001',
    marketId: 'wolcott-ny',
    displayName: "Rozell's Test Dispensary",
    legalName: "Rozell's Test Dispensary LLC",
    addressLine1: '5898 Main St',
    city: 'Wolcott',
    state: 'NY',
    zip: '14590',
    latitude: LAT,
    longitude: LNG,
    distanceMiles: 0,
    travelMinutes: 0,
    rating: 4.5,
    reviewCount: 3,
    openNow: true,
    isVerified: true,
    mapPreviewLabel: "Rozell's Test Dispensary",
    promotionText: null,
    promotionBadges: [],
    promotionExpiresAt: null,
    activePromotionId: null,
    activePromotionCount: 0,
    favoriteFollowerCount: 2,
    menuUrl: null,
    verifiedOwnerBadgeLabel: 'Verified Owner',
    ownerFeaturedBadges: [],
    ownerCardSummary: 'Test dispensary for development and QA.',
    premiumCardVariant: 'standard',
    promotionPlacementSurfaces: [],
    promotionPlacementScope: null,
    placeId: null,
    thumbnailUrl: null,
  });

  // 4. Seed storefront_details
  console.log('Creating storefront details...');
  await db
    .collection('storefront_details')
    .doc(STOREFRONT_ID)
    .set({
      phone: '+13155551234',
      website: 'https://canopytrove.com',
      hours: [
        'Monday: 9:00 AM – 9:00 PM',
        'Tuesday: 9:00 AM – 9:00 PM',
        'Wednesday: 9:00 AM – 9:00 PM',
        'Thursday: 9:00 AM – 9:00 PM',
        'Friday: 9:00 AM – 10:00 PM',
        'Saturday: 10:00 AM – 10:00 PM',
        'Sunday: 10:00 AM – 6:00 PM',
      ],
      openNow: true,
      hasOwnerClaim: true,
      menuUrl: null,
      verifiedOwnerBadgeLabel: 'Verified Owner',
      favoriteFollowerCount: 2,
      ownerFeaturedBadges: [],
      appReviewCount: 0,
      appReviews: [],
      photoUrls: [],
      amenities: ['Parking', 'Wheelchair Accessible'],
      editorialSummary: 'A test dispensary near Wolcott, NY for development and QA.',
      routeMode: 'preview',
    });

  // 5. Seed dispensaries (the "claimable" registry)
  console.log('Creating dispensary registry entry...');
  await db.collection('dispensaries').doc(STOREFRONT_ID).set({
    displayName: "Rozell's Test Dispensary",
    legalName: "Rozell's Test Dispensary LLC",
    addressLine1: '5898 Main St',
    city: 'Wolcott',
    state: 'NY',
    zip: '14590',
    latitude: LAT,
    longitude: LNG,
    claimedByOwnerUid: ownerUid,
    createdAt: NOW,
    updatedAt: NOW,
  });

  // 6. Seed users document
  console.log('Creating users document...');
  await db
    .collection('users')
    .doc(ownerUid)
    .set(
      {
        uid: ownerUid,
        email: OWNER_EMAIL,
        role: 'owner',
        displayName: userRecord.displayName?.trim() || 'Rozell',
        accountStatus: 'active',
        createdAt: NOW,
        lastLoginAt: NOW,
        updatedAt: NOW,
      },
      { merge: true },
    );

  // 7. Seed ownerProfiles
  console.log('Creating owner profile...');
  await db.collection('ownerProfiles').doc(ownerUid).set({
    uid: ownerUid,
    legalName: "Rozell's Test Dispensary LLC",
    phone: '+13155551234',
    companyName: "Rozell's Test Dispensary",
    identityVerificationStatus: 'verified',
    businessVerificationStatus: 'verified',
    dispensaryId: STOREFRONT_ID,
    additionalLocationIds: [],
    onboardingStep: 'completed',
    subscriptionStatus: 'trial',
    badgeLevel: 0,
    earnedBadgeIds: [],
    selectedBadgeIds: [],
    createdAt: NOW,
    updatedAt: NOW,
  });

  // 8. Seed dispensaryClaims
  console.log('Creating dispensary claim...');
  await db.collection('dispensaryClaims').doc(ownerUid).set({
    ownerUid,
    dispensaryId: STOREFRONT_ID,
    claimStatus: 'approved',
    submittedAt: NOW,
    reviewedAt: NOW,
    reviewNotes: 'Auto-approved for test/dev.',
  });

  console.log('\n✅ Done! Test owner seeded successfully.');
  console.log(`   Storefront: ${STOREFRONT_ID} ("Rozell's Test Dispensary" near Wolcott, NY)`);
  console.log(`   Owner UID:  ${ownerUid}`);
  console.log(`   Email:      ${OWNER_EMAIL}`);
  console.log('\nSign out and sign back in to pick up the new claims.\n');

  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
