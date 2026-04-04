/**
 * Setup Demo Owner Portal Accounts
 *
 * Creates two owner portal accounts for Apple review:
 *   1. applereviewer@canopytrove.com — demo account for Apple's reviewer
 *   2. askushere@canopytrove.com    — your own owner account
 *
 * Uses the Firebase CLI's stored credentials (from `firebase login`),
 * so no gcloud auth is needed.
 *
 * Usage:
 *   node scripts/setup-demo-owner.mjs
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// ── Configuration ──────────────────────────────────────────────────────────

const PROJECT_ID = 'canopy-trove';
const DEMO_STOREFRONT_ID = 'ocm-10923-garnerville-202-cannabis-co';
const DEMO_STOREFRONT_NAME = '202 Cannabis Co.';

const accounts = [
  {
    uid: 'rXcZI5eEVKaOYwKM9AZnYMudGyO2',
    email: 'applereviewer@canopytrove.com',
    displayName: 'Apple Reviewer',
    legalName: 'Apple Review Account',
    companyName: 'Demo Dispensary LLC',
  },
  {
    uid: 'HKT4iAJGR0h7OeufEoB7bp3nCY42',
    email: 'askushere@canopytrove.com',
    displayName: 'Canopy Trove Owner',
    legalName: 'Canopy Trove Owner',
    companyName: 'Canopy Trove',
  },
];

// ── Firebase init (uses gcloud ADC) ────────────────────────────────────────

let app;
try {
  app = initializeApp({
    credential: applicationDefault(),
    projectId: PROJECT_ID,
  });
  console.log('  Using Application Default Credentials (gcloud).');
} catch (err) {
  console.error(
    '\n❌  Firebase init failed: ' + err.message + '\n' +
      '   Run: gcloud auth application-default login\n'
  );
  process.exit(1);
}

const auth = getAuth(app);
const db = getFirestore(app, 'canopytrove');

// ── Helpers ────────────────────────────────────────────────────────────────

const now = new Date().toISOString();

function ownerProfile(account) {
  return {
    uid: account.uid,
    legalName: account.legalName,
    phone: null,
    companyName: account.companyName,
    identityVerificationStatus: 'verified',
    businessVerificationStatus: 'verified',
    dispensaryId: DEMO_STOREFRONT_ID,
    onboardingStep: 'completed',
    subscriptionStatus: 'trial',
    badgeLevel: 0,
    earnedBadgeIds: [],
    selectedBadgeIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

function dispensaryClaim(account) {
  return {
    ownerUid: account.uid,
    dispensaryId: DEMO_STOREFRONT_ID,
    claimStatus: 'approved',
    submittedAt: now,
    reviewedAt: now,
    reviewNotes: 'Demo account — auto-approved for Apple review.',
  };
}

function businessVerification(account) {
  return {
    ownerUid: account.uid,
    verificationStatus: 'verified',
    verificationSource: 'owner_upload',
    submittedAt: now,
    reviewedAt: now,
    adminNotes: 'Demo account — auto-verified for Apple review.',
  };
}

function identityVerification(account) {
  return {
    ownerUid: account.uid,
    verificationStatus: 'verified',
    provider: 'manual_review',
    providerReferenceId: null,
    submittedAt: now,
    reviewedAt: now,
    adminNotes: 'Demo account — auto-verified for Apple review.',
  };
}

function subscription(account) {
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 30);
  return {
    ownerUid: account.uid,
    dispensaryId: DEMO_STOREFRONT_ID,
    status: 'trial',
    plan: 'monthly',
    trialStartedAt: now,
    trialEndsAt: trialEnd.toISOString(),
    currentPeriodStart: now,
    currentPeriodEnd: trialEnd.toISOString(),
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    createdAt: now,
    updatedAt: now,
  };
}

// ── Main ───────────────────────────────────────────────────────────────────

async function setupAccount(account) {
  const label = account.email;
  console.log(`\n▸ Setting up ${label}…`);

  // 1. Set custom claims (role: owner)
  try {
    await auth.setCustomUserClaims(account.uid, { role: 'owner' });
    console.log(`  ✔ Custom claims set (role: owner)`);
  } catch (err) {
    console.error(`  ✖ Custom claims failed: ${err.message}`);
  }

  // 2. Owner profile
  try {
    await db
      .collection('ownerProfiles')
      .doc(account.uid)
      .set(ownerProfile(account));
    console.log(`  ✔ Owner profile created`);
  } catch (err) {
    console.error(`  ✖ Owner profile failed: ${err.message}`);
  }

  // 3. Dispensary claim
  const claimId = `${account.uid}_${DEMO_STOREFRONT_ID}`;
  try {
    await db
      .collection('dispensaryClaims')
      .doc(claimId)
      .set(dispensaryClaim(account));
    console.log(`  ✔ Dispensary claim created (${claimId})`);
  } catch (err) {
    console.error(`  ✖ Dispensary claim failed: ${err.message}`);
  }

  // 4. Business verification
  try {
    await db
      .collection('businessVerifications')
      .doc(account.uid)
      .set(businessVerification(account));
    console.log(`  ✔ Business verification created`);
  } catch (err) {
    console.error(`  ✖ Business verification failed: ${err.message}`);
  }

  // 5. Identity verification
  try {
    await db
      .collection('identityVerifications')
      .doc(account.uid)
      .set(identityVerification(account));
    console.log(`  ✔ Identity verification created`);
  } catch (err) {
    console.error(`  ✖ Identity verification failed: ${err.message}`);
  }

  // 6. Subscription (trial)
  try {
    await db
      .collection('subscriptions')
      .doc(account.uid)
      .set(subscription(account));
    console.log(`  ✔ Trial subscription created (30 days)`);
  } catch (err) {
    console.error(`  ✖ Subscription failed: ${err.message}`);
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  Canopy Trove — Demo Owner Portal Setup             ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(`Project:    ${PROJECT_ID}`);
  console.log(`Storefront: ${DEMO_STOREFRONT_NAME} (${DEMO_STOREFRONT_ID})`);

  for (const account of accounts) {
    await setupAccount(account);
  }

  console.log('\n────────────────────────────────────────────────────────');
  console.log('Demo credentials for Apple review notes:\n');
  console.log('  Email:    applereviewer@canopytrove.com');
  console.log('  Password: CanopyReview2026!\n');
  console.log('Your own account:\n');
  console.log('  Email:    askushere@canopytrove.com');
  console.log('  Password: CanopyOwner2026!\n');
  console.log('────────────────────────────────────────────────────────');
  console.log('✅  Done. Both accounts are ready for the Owner Portal.\n');
}

main().catch((err) => {
  console.error('\n❌  Setup failed:', err.message);
  process.exit(1);
});
