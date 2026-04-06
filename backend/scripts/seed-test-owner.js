const admin = require('firebase-admin');

const FIREBASE_PROJECT_ID = 'canopy-trove';
const FIREBASE_DATABASE_ID = 'canopytrove';
const OWNER_UID = 'PTGZVrZuTxZDjst0ihiM079DmQi1';
const OWNER_EMAIL = 'rozellbrantley@icloud.com';
const STOREFRONT_ID = 'test-wolcott-dispensary';
const NOW = new Date().toISOString();
const LAT = 43.2217;
const LNG = -76.8169;

admin.initializeApp({ projectId: FIREBASE_PROJECT_ID });
const db = admin.firestore();
db.settings({ databaseId: FIREBASE_DATABASE_ID });

async function main() {
  console.log('Using UID: ' + OWNER_UID);

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

  console.log('Creating storefront details...');
  await db
    .collection('storefront_details')
    .doc(STOREFRONT_ID)
    .set({
      phone: '+13155551234',
      website: 'https://canopytrove.com',
      hours: [
        'Monday: 9:00 AM \u2013 9:00 PM',
        'Tuesday: 9:00 AM \u2013 9:00 PM',
        'Wednesday: 9:00 AM \u2013 9:00 PM',
        'Thursday: 9:00 AM \u2013 9:00 PM',
        'Friday: 9:00 AM \u2013 10:00 PM',
        'Saturday: 10:00 AM \u2013 10:00 PM',
        'Sunday: 10:00 AM \u2013 6:00 PM',
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
    claimedByOwnerUid: OWNER_UID,
    createdAt: NOW,
    updatedAt: NOW,
  });

  console.log('Creating users document...');
  await db.collection('users').doc(OWNER_UID).set(
    {
      uid: OWNER_UID,
      email: OWNER_EMAIL,
      role: 'owner',
      displayName: 'Rozell',
      accountStatus: 'active',
      createdAt: NOW,
      lastLoginAt: NOW,
      updatedAt: NOW,
    },
    { merge: true },
  );

  console.log('Creating owner profile...');
  await db.collection('ownerProfiles').doc(OWNER_UID).set({
    uid: OWNER_UID,
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

  console.log('Creating dispensary claim...');
  await db.collection('dispensaryClaims').doc(OWNER_UID).set({
    ownerUid: OWNER_UID,
    dispensaryId: STOREFRONT_ID,
    claimStatus: 'approved',
    submittedAt: NOW,
    reviewedAt: NOW,
    reviewNotes: 'Auto-approved for test/dev.',
  });

  console.log('');
  console.log('Done! Test owner seeded successfully.');
  console.log('  Storefront: ' + STOREFRONT_ID);
  console.log('  Owner UID:  ' + OWNER_UID);
  console.log('  Email:      ' + OWNER_EMAIL);
  console.log('');
  console.log('Sign out and sign back in to pick up the new claims.');
  process.exit(0);
}

main().catch(function (err) {
  console.error('Seed failed:', err);
  process.exit(1);
});
