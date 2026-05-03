/**
 * Backfill the 4 welcome emails that should have fired on signup but
 * didn't, because the previous CanopyTroveSignUpScreen gated the welcome
 * behind the marketing-opt-in checkbox (default off). Discovered May 3
 * 2026 during the post-mortem on the not_configured backfill.
 *
 * Targets (4 members, all real signups without marketing opt-in):
 *   - smolinskialicia@yahoo.com               (uid wlOSCteTM6VwBrNGAcY6QwdZPLj2, Apr 28)
 *   - kabp24g38byfrvbith9@icloud.com          (uid BL9b3X1fwSP5cZegiVWt3160ihw2, Apr 26 — Apple Hide-My-Email relay)
 *   - mb38p24g38bgfuekdeq@icloud.com          (uid jznHId45XCdkyZrJoXUildHteKj1, Apr 26 — Apple Hide-My-Email relay)
 *   - lp24g38b9gfpi1jq2vt@icloud.com          (uid CSBC5CD4sQbEUFzRt289xvkxFSi2, Apr 29 — Apple Hide-My-Email relay)
 *
 * Goes through `syncMemberEmailSubscription({ subscribed: false })` —
 * preserves their (implicit) marketing opt-out while firing the
 * transactional welcome. Now possible because `sendWelcomeEmailIfNeeded`
 * was decoupled from the `subscribed` flag in the same May 3 commit.
 *
 * Includes a foreign-key safety check: skips any uid that no longer
 * resolves to a Firebase Auth user (prevents the orphan-doc re-send
 * issue that hit outletproduction39 in the prior backfill).
 *
 * Usage:
 *   npx ts-node --project backend/tsconfig.json backend/scripts/backfill-missed-signup-welcomes.ts
 *   npx ts-node --project backend/tsconfig.json backend/scripts/backfill-missed-signup-welcomes.ts --dry-run
 */

import * as admin from 'firebase-admin';
import { syncMemberEmailSubscription } from '../src/services/memberEmailSubscriptionService';

const DRY_RUN = process.argv.includes('--dry-run');

type Target = {
  accountId: string;
  email: string;
  displayName: string | null;
};

const TARGETS: Target[] = [
  {
    accountId: 'wlOSCteTM6VwBrNGAcY6QwdZPLj2',
    email: 'smolinskialicia@yahoo.com',
    displayName: null,
  },
  {
    accountId: 'BL9b3X1fwSP5cZegiVWt3160ihw2',
    email: 'kabp24g38byfrvbith9@icloud.com',
    displayName: null,
  },
  {
    accountId: 'jznHId45XCdkyZrJoXUildHteKj1',
    email: 'mb38p24g38bgfuekdeq@icloud.com',
    displayName: null,
  },
  {
    accountId: 'CSBC5CD4sQbEUFzRt289xvkxFSi2',
    email: 'lp24g38b9gfpi1jq2vt@icloud.com',
    displayName: null,
  },
];

function assertEnv(name: string) {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v.trim();
}

async function authUserStillExists(uid: string): Promise<boolean> {
  if (!admin.apps.length) {
    admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
  }
  try {
    await admin.auth().getUser(uid);
    return true;
  } catch (error) {
    if ((error as { code?: string }).code === 'auth/user-not-found') {
      return false;
    }
    throw error;
  }
}

async function main() {
  assertEnv('RESEND_API_KEY');
  assertEnv('EMAIL_FROM_ADDRESS');
  assertEnv('FIREBASE_PROJECT_ID');
  assertEnv('FIREBASE_DATABASE_ID');

  console.log(DRY_RUN ? '=== DRY RUN (no sends) ===\n' : '=== LIVE BACKFILL ===\n');
  console.log(`Targets: ${TARGETS.length}\n`);

  const results: Array<{ label: string; outcome: string; detail: string }> = [];

  for (const target of TARGETS) {
    const label = `${target.email} (${target.accountId})`;

    const exists = await authUserStillExists(target.accountId);
    if (!exists) {
      console.log(`⊘ ${label}: SKIPPED (Firebase Auth user no longer exists)`);
      results.push({ label, outcome: 'skipped', detail: 'auth/user-not-found' });
      continue;
    }

    if (DRY_RUN) {
      console.log(`[dry-run] would send → ${label}`);
      continue;
    }

    try {
      const status = await syncMemberEmailSubscription({
        accountId: target.accountId,
        email: target.email,
        displayName: target.displayName,
        // Preserve implicit marketing opt-out — they signed up without
        // ticking the checkbox. The welcome still fires now because
        // sendWelcomeEmailIfNeeded no longer requires subscribed:true.
        subscribed: false,
        source: 'member_signup',
      });
      console.log(
        `→ ${label}: state=${status.welcomeEmailState} sentAt=${status.welcomeEmailSentAt ?? '(none)'} subscribed=${status.subscribed} error=${status.welcomeEmailError ?? '(none)'}`,
      );
      results.push({
        label,
        outcome: status.welcomeEmailState,
        detail: status.welcomeEmailError ?? '',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`✗ ${label}: ERROR ${message}`);
      results.push({ label, outcome: 'failed', detail: message });
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  if (!DRY_RUN) {
    console.log('\n=== Summary ===');
    const sent = results.filter((r) => r.outcome === 'sent').length;
    const skipped = results.filter((r) => r.outcome === 'skipped').length;
    const failed = results.filter((r) => r.outcome === 'failed').length;
    console.log(`sent:    ${sent}`);
    console.log(`skipped: ${skipped}`);
    console.log(`failed:  ${failed}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
