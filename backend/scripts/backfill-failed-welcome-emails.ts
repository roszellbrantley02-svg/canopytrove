/**
 * Backfill the 5 welcome emails that failed during the period when Resend was
 * not configured (Apr 5–22, errors: 'not_configured' or 'API key is invalid').
 * Resend is now configured and verified working (proven by Apr 29 send to
 * roszellbrantley02@gmail.com that produced delivery event email.delivered).
 *
 * Targets (4 members + 1 owner):
 *   - member outletproduction39@gmail.com   (uid 8b7IOvGvm1gLqjy8CcJrnyoJCdj2)
 *   - member amandatrayer@gmail.com         (uid HHALO4PLkfbbQIVQVSFpV6zSX0h2)
 *   - member bookylove07@gmail.com          (uid rDXdhMt7tNUFDykzo8RPbI7GLro1)
 *   - member danielletuper88@gmail.com      (uid RU4CIU6AJ0PrMBmcyGQzIJ6N4Bg1)
 *   - owner  rozellbrantley@icloud.com      (uid PTGZVrZuTxZDjst0ihiM079DmQi1, "Rozell's Test Dispensary")
 *
 * Deliberately skipped (not real users):
 *   - owner  applereviewer@canopytrove.com  (Apple reviewer test account)
 *   - owner  askushere@canopytrove.com      (typo of askmehere@; bounces)
 *
 * Usage:
 *   npx ts-node --project backend/tsconfig.json backend/scripts/backfill-failed-welcome-emails.ts
 *   npx ts-node --project backend/tsconfig.json backend/scripts/backfill-failed-welcome-emails.ts --dry-run
 *
 * Required env vars (the same ones Cloud Run uses for runtime sends):
 *   RESEND_API_KEY      — provider key (live)
 *   EMAIL_FROM_ADDRESS  — verified sender (askmehere@canopytrove.com)
 *   EMAIL_REPLY_TO_ADDRESS, EMAIL_FOOTER_ADDRESS
 *   FIREBASE_PROJECT_ID, FIREBASE_DATABASE_ID
 *   STOREFRONT_BACKEND_SOURCE=firestore
 *
 * Pulls them from gcloud secrets / Cloud Run env so backfill matches prod
 * behavior. Refuses to run if RESEND_API_KEY is missing — without it the
 * service would just write another "not_configured" record.
 */

import { syncMemberEmailSubscription } from '../src/services/memberEmailSubscriptionService';
import { sendOwnerWelcomeEmailIfNeeded } from '../src/services/ownerWelcomeEmailService';

const DRY_RUN = process.argv.includes('--dry-run');

type MemberTarget = {
  kind: 'member';
  accountId: string;
  email: string;
  displayName: string | null;
};

type OwnerTarget = {
  kind: 'owner';
  ownerUid: string;
  email: string;
  displayName: string | null;
  companyName: string | null;
};

type Target = MemberTarget | OwnerTarget;

const TARGETS: Target[] = [
  {
    kind: 'member',
    accountId: '8b7IOvGvm1gLqjy8CcJrnyoJCdj2',
    email: 'outletproduction39@gmail.com',
    displayName: null,
  },
  {
    kind: 'member',
    accountId: 'HHALO4PLkfbbQIVQVSFpV6zSX0h2',
    email: 'amandatrayer@gmail.com',
    displayName: null,
  },
  {
    kind: 'member',
    accountId: 'rDXdhMt7tNUFDykzo8RPbI7GLro1',
    email: 'bookylove07@gmail.com',
    displayName: null,
  },
  {
    kind: 'member',
    accountId: 'RU4CIU6AJ0PrMBmcyGQzIJ6N4Bg1',
    email: 'danielletuper88@gmail.com',
    displayName: null,
  },
  {
    kind: 'owner',
    ownerUid: 'PTGZVrZuTxZDjst0ihiM079DmQi1',
    email: 'rozellbrantley@icloud.com',
    displayName: null,
    companyName: "Rozell's Test Dispensary",
  },
];

function assertEnv(name: string) {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v.trim();
}

async function main() {
  // Fail fast if Resend isn't wired up — without these, the service would
  // just write another "not_configured" record and we'd be no better off.
  assertEnv('RESEND_API_KEY');
  assertEnv('EMAIL_FROM_ADDRESS');
  assertEnv('FIREBASE_PROJECT_ID');
  assertEnv('FIREBASE_DATABASE_ID');

  console.log(DRY_RUN ? '=== DRY RUN (no sends) ===\n' : '=== LIVE BACKFILL ===\n');
  console.log(`Targets: ${TARGETS.length}\n`);

  const results: Array<{
    label: string;
    state: string;
    error: string | null;
    sentAt: string | null;
    providerMessageId: string | null;
  }> = [];

  for (const target of TARGETS) {
    const label =
      target.kind === 'owner'
        ? `owner ${target.email} (${target.ownerUid})`
        : `member ${target.email} (${target.accountId})`;

    if (DRY_RUN) {
      console.log(`[dry-run] would send → ${label}`);
      continue;
    }

    try {
      if (target.kind === 'owner') {
        const status = await sendOwnerWelcomeEmailIfNeeded({
          ownerUid: target.ownerUid,
          email: target.email,
          displayName: target.displayName,
          companyName: target.companyName,
        });
        results.push({
          label,
          state: status.welcomeEmailState,
          error: status.welcomeEmailError,
          sentAt: status.welcomeEmailSentAt,
          providerMessageId: null, // owner status type omits this
        });
        console.log(
          `→ ${label}: state=${status.welcomeEmailState} sentAt=${status.welcomeEmailSentAt ?? '(none)'} error=${status.welcomeEmailError ?? '(none)'}`,
        );
      } else {
        const status = await syncMemberEmailSubscription({
          accountId: target.accountId,
          email: target.email,
          displayName: target.displayName,
          subscribed: true,
          source: 'member_signup',
        });
        results.push({
          label,
          state: status.welcomeEmailState,
          error: status.welcomeEmailError,
          sentAt: status.welcomeEmailSentAt,
          providerMessageId: null,
        });
        console.log(
          `→ ${label}: state=${status.welcomeEmailState} sentAt=${status.welcomeEmailSentAt ?? '(none)'} error=${status.welcomeEmailError ?? '(none)'}`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        label,
        state: 'failed',
        error: message,
        sentAt: null,
        providerMessageId: null,
      });
      console.log(`✗ ${label}: ERROR ${message}`);
    }

    // Small spacer between sends so we don't hit Resend's per-second cap
    // (default 10 req/sec for paid tier). 5 targets × 250ms = 1.25s total.
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  if (!DRY_RUN) {
    console.log('\n=== Summary ===');
    const sent = results.filter((r) => r.state === 'sent' || r.sentAt).length;
    const pending = results.filter((r) => r.state === 'pending_provider').length;
    const failed = results.filter((r) => r.state === 'failed' || r.error).length;
    console.log(`sent:    ${sent}`);
    console.log(`pending: ${pending}`);
    console.log(`failed:  ${failed}`);
    if (failed > 0) {
      console.log('\nFailures:');
      for (const r of results.filter((r) => r.state === 'failed' || r.error)) {
        console.log(`  ${r.label}: ${r.error}`);
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
