/**
 * Setup Demo Owner Portal Account
 *
 * Creates ONE owner portal account for Apple App Review:
 *   applereviewer@canopytrove.com — credential the founder hands to Apple if
 *   the reviewer asks for owner-portal access.
 *
 * The account is wired to a CLEARLY FAKE storefront ID
 * (`demo-canopytrove-dispensary`) so it can't be confused with — or
 * accidentally claim — any real OCM-licensed dispensary in Firestore.
 *
 * Earlier versions of this script targeted `ocm-10923-garnerville-202-...`,
 * which IS a real OCM license number. Two test accounts ended up holding
 * approved claims on that real shop in production until cleanup ran on
 * 2026-05-03 (see backend/scripts/cleanup-test-claims-on-real-shop.ts).
 * The OCM_PREFIX_GUARD below refuses to run if anyone re-points DEMO_STOREFRONT_ID
 * back at a real OCM record.
 *
 * Uses gcloud Application Default Credentials.
 *
 * Usage:
 *   node scripts/setup-demo-owner.mjs
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// ── Configuration ──────────────────────────────────────────────────────────

const PROJECT_ID = 'canopy-trove';
const DATABASE_ID = 'canopytrove';

// CRITICAL: must NOT start with `ocm-` (OCM-licensed real shops use that
// prefix). The OCM_PREFIX_GUARD below enforces this.
const DEMO_STOREFRONT_ID = 'demo-canopytrove-dispensary';
const DEMO_STOREFRONT_NAME = 'Canopy Demo Dispensary';
const DEMO_STOREFRONT_CITY = 'Demo City';
const DEMO_STOREFRONT_REGION = 'NY';

const accounts = [
  {
    uid: 'rXcZI5eEVKaOYwKM9AZnYMudGyO2',
    email: 'applereviewer@canopytrove.com',
    displayName: 'Apple Reviewer',
    legalName: 'Apple Review Account',
    companyName: 'Canopy Demo Dispensary LLC',
  },
];

// ── Safety gate: refuse to seed onto a real OCM-licensed shop ──────────────

function assertSafeStorefrontId(id) {
  if (typeof id !== 'string' || !id.trim()) {
    throw new Error('DEMO_STOREFRONT_ID must be a non-empty string.');
  }
  if (id.startsWith('ocm-')) {
    throw new Error(
      `Refusing to seed demo data onto "${id}". IDs starting with "ocm-" are real ` +
        `OCM-licensed dispensaries pulled from the NY public registry. Pick a clearly ` +
        `fake ID like "demo-..." or "test-...".`,
    );
  }
}

assertSafeStorefrontId(DEMO_STOREFRONT_ID);

// ── Firebase init ──────────────────────────────────────────────────────────

let app;
try {
  app = initializeApp({
    credential: applicationDefault(),
    projectId: PROJECT_ID,
  });
  console.log('  Using Application Default Credentials (gcloud).');
} catch (err) {
  console.error(
    '\n[FAIL]  Firebase init failed: ' +
      err.message +
      '\n' +
      '   Run: gcloud auth application-default login\n',
  );
  process.exit(1);
}

const auth = getAuth(app);
const db = getFirestore(app, DATABASE_ID);

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

function demoStorefrontSummary() {
  return {
    storefrontId: DEMO_STOREFRONT_ID,
    name: DEMO_STOREFRONT_NAME,
    city: DEMO_STOREFRONT_CITY,
    region: DEMO_STOREFRONT_REGION,
    state: 'NY',
    address: '1 Demo Lane',
    isDemo: true, // explicit flag so any future filtering can skip demos
    hidden: true, // hide from public discovery — owners only see this in their portal
    createdAt: now,
    updatedAt: now,
  };
}

// ── Main ───────────────────────────────────────────────────────────────────

async function setupAccount(account) {
  const label = account.email;
  console.log(`\n> Setting up ${label}...`);

  try {
    await auth.setCustomUserClaims(account.uid, { role: 'owner' });
    console.log(`  [OK] Custom claims set (role: owner)`);
  } catch (err) {
    console.error(`  [FAIL] Custom claims failed: ${err.message}`);
  }

  try {
    await db.collection('ownerProfiles').doc(account.uid).set(ownerProfile(account));
    console.log(`  [OK] Owner profile created`);
  } catch (err) {
    console.error(`  [FAIL] Owner profile failed: ${err.message}`);
  }

  const claimId = `${account.uid}_${DEMO_STOREFRONT_ID}`;
  try {
    await db.collection('dispensaryClaims').doc(claimId).set(dispensaryClaim(account));
    console.log(`  [OK] Dispensary claim created (${claimId})`);
  } catch (err) {
    console.error(`  [FAIL] Dispensary claim failed: ${err.message}`);
  }

  try {
    await db
      .collection('businessVerifications')
      .doc(account.uid)
      .set(businessVerification(account));
    console.log(`  [OK] Business verification created`);
  } catch (err) {
    console.error(`  [FAIL] Business verification failed: ${err.message}`);
  }

  try {
    await db
      .collection('identityVerifications')
      .doc(account.uid)
      .set(identityVerification(account));
    console.log(`  [OK] Identity verification created`);
  } catch (err) {
    console.error(`  [FAIL] Identity verification failed: ${err.message}`);
  }

  try {
    await db.collection('subscriptions').doc(account.uid).set(subscription(account));
    console.log(`  [OK] Trial subscription created (30 days)`);
  } catch (err) {
    console.error(`  [FAIL] Subscription failed: ${err.message}`);
  }
}

async function ensureDemoStorefrontSummary() {
  console.log(`\n> Ensuring demo storefront summary (${DEMO_STOREFRONT_ID})...`);
  try {
    await db.collection('storefront_summaries').doc(DEMO_STOREFRONT_ID).set(demoStorefrontSummary());
    console.log(`  [OK] storefront_summaries/${DEMO_STOREFRONT_ID} written (isDemo=true, hidden=true)`);
  } catch (err) {
    console.error(`  [FAIL] storefront summary failed: ${err.message}`);
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('Canopy Trove - Demo Owner Portal Setup');
  console.log('='.repeat(60));
  console.log(`Project:    ${PROJECT_ID}`);
  console.log(`Database:   ${DATABASE_ID}`);
  console.log(`Storefront: ${DEMO_STOREFRONT_NAME} (${DEMO_STOREFRONT_ID})`);

  await ensureDemoStorefrontSummary();

  for (const account of accounts) {
    await setupAccount(account);
  }

  console.log('\n' + '-'.repeat(60));
  console.log('Demo credentials for Apple review notes:\n');
  console.log('  Email:    applereviewer@canopytrove.com');
  console.log('  Password: CanopyReview2026!\n');
  console.log('-'.repeat(60));
  console.log('Done. Apple reviewer account is ready for the Owner Portal.\n');
}

main().catch((err) => {
  console.error('\n[FAIL]  Setup failed:', err.message);
  process.exit(1);
});
