/**
 * Reconcile all the "count" numbers across the system so we know
 * what 22, 110, 16, 8 actually mean.
 */

import * as admin from 'firebase-admin';

admin.initializeApp({ projectId: 'canopy-trove' });
const db = admin.firestore();
db.settings({ databaseId: 'canopytrove' });

async function listAllAuthUsers() {
  const all: admin.auth.UserRecord[] = [];
  let pageToken: string | undefined;
  do {
    const page = await admin.auth().listUsers(1000, pageToken);
    all.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);
  return all;
}

async function main() {
  // Different ways of counting "people"
  const auth = await listAllAuthUsers();
  const authedWithEmail = auth.filter((u) => u.email);
  const authedAnonymous = auth.filter((u) => !u.email);

  // canopytrove_profiles — one doc per logical profile
  const profilesSnap = await db.collection('canopytrove_profiles').get();
  const profilesByKind = new Map<string, number>();
  const profilesByAccountId = new Map<string, number>();
  let profilesWithAccount = 0;
  let profilesAnonymous = 0;
  for (const doc of profilesSnap.docs) {
    const d = doc.data() as Record<string, unknown>;
    const kind = (d.kind as string) ?? '(none)';
    profilesByKind.set(kind, (profilesByKind.get(kind) ?? 0) + 1);
    const accountId = d.accountId as string | null;
    if (accountId) {
      profilesWithAccount += 1;
      profilesByAccountId.set(accountId, (profilesByAccountId.get(accountId) ?? 0) + 1);
    } else {
      profilesAnonymous += 1;
    }
  }

  // route_state — written on every storefront-related action
  const routeStateSnap = await db.collection('route_state').get();

  // gamification_state — written on every gamification event
  const gamificationSnap = await db.collection('gamification_state').get();

  // community_safety_state — written when user opens storefront detail
  const safetySnap = await db.collection('community_safety_state').get();

  // member_email_subscriptions — only if user opted into emails
  const memberSnap = await db.collection('member_email_subscriptions').get();

  // Distinct install IDs in analytics_events (real device count)
  const eventsSnap = await db.collection('analytics_events').limit(5000).get();
  const installs = new Set<string>();
  for (const doc of eventsSnap.docs) {
    const id = (doc.data() as Record<string, unknown>).installId as string | undefined;
    if (id) installs.add(id);
  }

  console.log('=== Reconciling all the counts ===\n');

  console.log('Firebase Auth (people who created an account):');
  console.log(`  Total:           ${auth.length}`);
  console.log(`  With email:      ${authedWithEmail.length}`);
  console.log(
    `  Anonymous:       ${authedAnonymous.length}  (web sessions where Firebase auto-creates an anonymous user)`,
  );
  console.log('');

  console.log('canopytrove_profiles (one per logical profile):');
  console.log(`  Total:           ${profilesSnap.size}`);
  for (const [k, v] of profilesByKind) console.log(`  kind=${k}:  ${v}`);
  console.log(`  With accountId:  ${profilesWithAccount}`);
  console.log(`  Anonymous:       ${profilesAnonymous}`);
  console.log('  Profiles per account (accounts with >1 profile):');
  for (const [accountId, count] of profilesByAccountId) {
    if (count > 1) console.log(`    ${accountId}:  ${count} profiles`);
  }
  console.log('');

  console.log('Side-collections (created lazily when user does X):');
  console.log(
    `  route_state docs:               ${routeStateSnap.size}  (created when user saves/visits a storefront)`,
  );
  console.log(
    `  gamification_state docs:        ${gamificationSnap.size}  (created when user earns first reward)`,
  );
  console.log(
    `  community_safety_state docs:    ${safetySnap.size}  (created when user opens storefront detail)`,
  );
  console.log(
    `  member_email_subscriptions docs: ${memberSnap.size}  (created when user opts in to emails)`,
  );
  console.log('');

  console.log('Distinct install IDs in analytics_events (sample first 5000 events):');
  console.log(`  ${installs.size} unique browsers/devices`);
  console.log('');

  console.log('=== Honest interpretation ===');
  console.log('  16 Firebase Auth users = 10 real signups + 6 anonymous web auto-creates');
  console.log(
    `  ${profilesSnap.size} canopytrove_profiles = one per browser/device that used the app`,
  );
  console.log(
    `  ${safetySnap.size} community_safety_state docs = profiles that opened any storefront detail`,
  );
  console.log('  110 install IDs (from earlier full scan) = total unique browsers across 35 days');
  console.log(
    '  → Real distinct human visitors: somewhere between ~80 and ~110 (some had multiple browsers)',
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
