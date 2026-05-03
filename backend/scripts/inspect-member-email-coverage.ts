/**
 * Cross-reference every Firebase Auth user against the four signals that
 * decide whether they should have a welcome email or a member subscription:
 *   - has email at all (anonymous Auth users won't)
 *   - subscribed in member_email_subscriptions (deal-digest opt-in)
 *   - has owner_welcome_emails record (owner-portal users)
 *   - has canopytrove_profiles row bound by accountId (active app session)
 *
 * Output answers "did 11 of 16 accounts get deleted, or were they never
 * eligible for a welcome email in the first place?"
 */

import * as admin from 'firebase-admin';

admin.initializeApp({ projectId: 'canopy-trove' });
const db = admin.firestore();
db.settings({ databaseId: 'canopytrove' });

async function listAllAuthUsers(): Promise<admin.auth.UserRecord[]> {
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
  const users = await listAllAuthUsers();
  console.log(`Total Firebase Auth users: ${users.length}\n`);

  const memberSnap = await db.collection('member_email_subscriptions').get();
  const ownerSnap = await db.collection('owner_welcome_emails').get();
  const profileSnap = await db.collection('canopytrove_profiles').get();

  const memberByAccountId = new Map<string, Record<string, unknown>>();
  for (const doc of memberSnap.docs) {
    memberByAccountId.set(doc.id, doc.data() as Record<string, unknown>);
  }

  const ownerByUid = new Map<string, Record<string, unknown>>();
  for (const doc of ownerSnap.docs) {
    ownerByUid.set(doc.id, doc.data() as Record<string, unknown>);
  }

  const profilesByAccountId = new Map<string, Record<string, unknown>[]>();
  for (const doc of profileSnap.docs) {
    const data = doc.data() as Record<string, unknown>;
    const accountId = typeof data.accountId === 'string' ? data.accountId : null;
    if (!accountId) continue;
    if (!profilesByAccountId.has(accountId)) {
      profilesByAccountId.set(accountId, []);
    }
    profilesByAccountId.get(accountId)!.push({ id: doc.id, ...data });
  }

  console.log('Per-user breakdown (sorted oldest first):\n');
  const sorted = [...users].sort(
    (a, b) => Date.parse(a.metadata.creationTime) - Date.parse(b.metadata.creationTime),
  );

  let bucketAnonymous = 0;
  let bucketHasMember = 0;
  let bucketHasOwner = 0;
  let bucketHasProfile = 0;
  let bucketEmailNoSubscription = 0;

  for (const u of sorted) {
    const member = memberByAccountId.get(u.uid);
    const owner = ownerByUid.get(u.uid);
    const profiles = profilesByAccountId.get(u.uid) ?? [];

    if (!u.email) bucketAnonymous += 1;
    if (member) bucketHasMember += 1;
    if (owner) bucketHasOwner += 1;
    if (profiles.length > 0) bucketHasProfile += 1;
    if (u.email && !member && !owner) bucketEmailNoSubscription += 1;

    const flags = [
      u.email ? 'EMAIL' : 'ANON',
      member ? 'member-sub' : '',
      owner ? 'owner-sub' : '',
      profiles.length > 0 ? `profile×${profiles.length}` : '',
    ]
      .filter(Boolean)
      .join(' · ');

    console.log(
      `${u.metadata.creationTime}  ${u.uid.padEnd(28)}  ${(u.email ?? '(anonymous)').padEnd(40)}  [${flags}]`,
    );
    if (member) {
      console.log(
        `    member: subscribed=${member.subscribed} welcomeSent=${member.welcomeEmailSentAt ?? '(none)'} unsubscribedAt=${member.unsubscribedAt ?? '(none)'}`,
      );
    }
    if (owner) {
      console.log(
        `    owner:  companyName=${owner.companyName ?? '(none)'} welcomeSent=${owner.welcomeEmailSentAt ?? '(none)'}`,
      );
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Total auth users:                                 ${users.length}`);
  console.log(`Anonymous Firebase Auth (no email):               ${bucketAnonymous}`);
  console.log(`Has member_email_subscriptions doc:               ${bucketHasMember}`);
  console.log(`Has owner_welcome_emails doc:                     ${bucketHasOwner}`);
  console.log(`Has canopytrove_profiles bound by accountId:      ${bucketHasProfile}`);
  console.log(`Has email but NO welcome record (member or owner): ${bucketEmailNoSubscription}`);
  console.log('');
  console.log('member_email_subscriptions docs whose accountId does NOT match any auth user:');
  let orphan = 0;
  const allUids = new Set(users.map((u) => u.uid));
  for (const [accountId, data] of memberByAccountId) {
    if (!allUids.has(accountId)) {
      orphan += 1;
      console.log(`  ${accountId}  email=${data.email ?? '(none)'} createdAt=${data.createdAt}`);
    }
  }
  if (orphan === 0) {
    console.log('  (none — all member subs map to a live auth user)');
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
