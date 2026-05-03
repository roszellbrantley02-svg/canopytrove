/**
 * Inspect the most-recent Firebase Auth users and the related Firestore docs
 * (canopytrove_profiles, owner_profiles, owner_welcome_emails,
 * member_email_subscriptions) to confirm whether a recent signup landed and
 * whether the welcome email pipeline fired.
 *
 * Usage:
 *   npx ts-node --project backend/tsconfig.json backend/scripts/inspect-recent-signup.ts
 *   npx ts-node --project backend/tsconfig.json backend/scripts/inspect-recent-signup.ts --hours 6
 *   npx ts-node --project backend/tsconfig.json backend/scripts/inspect-recent-signup.ts --limit 20
 */

import * as admin from 'firebase-admin';

const FIREBASE_PROJECT_ID = 'canopy-trove';
const FIREBASE_DATABASE_ID = 'canopytrove';

function readArg(name: string, fallback: number): number {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  const value = Number.parseInt(process.argv[idx + 1] ?? '', 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const HOURS = readArg('hours', 24);
const LIMIT = readArg('limit', 10);

admin.initializeApp({ projectId: FIREBASE_PROJECT_ID });
const db = admin.firestore();
db.settings({ databaseId: FIREBASE_DATABASE_ID });

async function listRecentAuthUsers(hours: number, max: number) {
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  const collected: admin.auth.UserRecord[] = [];
  let pageToken: string | undefined;

  do {
    const page = await admin.auth().listUsers(1000, pageToken);
    for (const user of page.users) {
      const created = Date.parse(user.metadata.creationTime);
      if (Number.isFinite(created) && created >= cutoff) {
        collected.push(user);
      }
    }
    pageToken = page.pageToken;
  } while (pageToken);

  collected.sort(
    (a, b) => Date.parse(b.metadata.creationTime) - Date.parse(a.metadata.creationTime),
  );
  return collected.slice(0, max);
}

async function getOwnerProfile(uid: string) {
  const snap = await db.collection('owner_profiles').doc(uid).get();
  return snap.exists ? snap.data() : null;
}

async function getOwnerWelcomeEmail(uid: string) {
  const snap = await db.collection('owner_welcome_emails').doc(uid).get();
  return snap.exists ? snap.data() : null;
}

async function getMemberSubscription(email: string) {
  if (!email) return null;
  const snap = await db
    .collection('member_email_subscriptions')
    .where('email', '==', email.toLowerCase())
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0].data();
}

async function findCanopyProfile(uid: string) {
  const snap = await db
    .collection('canopytrove_profiles')
    .where('accountId', '==', uid)
    .limit(3)
    .get();
  return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) }));
}

async function main() {
  console.log(`=== Recent signups (last ${HOURS}h, max ${LIMIT}) ===\n`);
  const users = await listRecentAuthUsers(HOURS, LIMIT);
  if (users.length === 0) {
    console.log('No Firebase Auth users created in the window.\n');
  }

  for (const user of users) {
    console.log(`uid:           ${user.uid}`);
    console.log(`email:         ${user.email ?? '(none)'}`);
    console.log(`displayName:   ${user.displayName ?? '(none)'}`);
    console.log(`emailVerified: ${user.emailVerified}`);
    console.log(
      `provider(s):   ${user.providerData.map((p) => p.providerId).join(', ') || '(none)'}`,
    );
    console.log(`createdAt:     ${user.metadata.creationTime}`);
    console.log(`lastSignedIn:  ${user.metadata.lastSignInTime}`);
    console.log(`disabled:      ${user.disabled}`);
    console.log(`customClaims:  ${JSON.stringify(user.customClaims ?? {})}`);

    const ownerProfile = await getOwnerProfile(user.uid);
    if (ownerProfile) {
      console.log(`owner_profiles/${user.uid}:`);
      console.log(
        `  companyName=${(ownerProfile as { companyName?: string }).companyName ?? '(none)'}`,
      );
      console.log(`  createdAt=${(ownerProfile as { createdAt?: string }).createdAt ?? '(none)'}`);
    } else {
      console.log('owner_profiles: (no doc)');
    }

    const welcome = await getOwnerWelcomeEmail(user.uid);
    if (welcome) {
      console.log('owner_welcome_emails:');
      console.log(
        `  welcomeEmailSentAt=${(welcome as { welcomeEmailSentAt?: string }).welcomeEmailSentAt ?? '(null)'}`,
      );
      console.log(
        `  lastDeliveryEventType=${(welcome as { lastDeliveryEventType?: string }).lastDeliveryEventType ?? '(null)'}`,
      );
      console.log(
        `  lastDeliveryEventAt=${(welcome as { lastDeliveryEventAt?: string }).lastDeliveryEventAt ?? '(null)'}`,
      );
      console.log(
        `  lastWelcomeEmailError=${(welcome as { lastWelcomeEmailError?: string }).lastWelcomeEmailError ?? '(null)'}`,
      );
      console.log(
        `  providerMessageId=${(welcome as { providerMessageId?: string }).providerMessageId ?? '(null)'}`,
      );
    } else {
      console.log('owner_welcome_emails: (no doc — welcome email never requested)');
    }

    if (user.email) {
      const sub = await getMemberSubscription(user.email);
      if (sub) {
        console.log('member_email_subscriptions:');
        console.log(`  status=${(sub as { status?: string }).status ?? '(none)'}`);
        console.log(
          `  welcomeEmailSentAt=${(sub as { welcomeEmailSentAt?: string }).welcomeEmailSentAt ?? '(null)'}`,
        );
      } else {
        console.log('member_email_subscriptions: (no doc)');
      }
    }

    const profiles = await findCanopyProfile(user.uid);
    if (profiles.length > 0) {
      console.log(`canopytrove_profiles (matched accountId, ${profiles.length}):`);
      for (const p of profiles) {
        console.log(
          `  ${p.id} kind=${(p as { kind?: string }).kind ?? '(none)'} displayName=${(p as { displayName?: string }).displayName ?? '(none)'} updatedAt=${(p as { updatedAt?: string }).updatedAt ?? '(none)'}`,
        );
      }
    } else {
      console.log('canopytrove_profiles: (no profile bound to this accountId yet)');
    }

    console.log('');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
