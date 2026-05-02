/**
 * Daily deal-digest email orchestrator.
 *
 * Called once per day from the cron at /admin/dispatch-deal-digests.
 * Walks every profile, filters to those eligible for a digest today,
 * builds + sends one email per eligible profile via Resend, and logs
 * the send for idempotence.
 *
 * Eligibility filter (in this order; first-failure is recorded as
 * the skip reason for diagnostics):
 *   1. Profile has accountId (skip anonymous — no email path)
 *   2. Account has a member_email_subscriptions record where
 *      subscribed=true AND dealDigestOptOut=false
 *   3. Profile has at least one savedStorefrontIds entry
 *   4. At least one of those saved storefronts has a non-empty
 *      promotionText TODAY
 *   5. We have not already sent today's digest to this account
 *      (deal_digest_email_log idempotence guard)
 *
 * Behavior is fail-soft per profile: one profile's failure does not
 * stop the rest of the run. The endpoint returns counts the cron logs
 * for monitoring.
 *
 * Feature-flagged behind serverConfig.dealDigestsEnabled. When the
 * flag is false the orchestrator returns immediately with
 * { enabled: false } and never touches Firestore or Resend. This is
 * the safe default — the cron can be wired up first, then flipped on
 * after smoke-testing.
 */
import { serverConfig } from '../config';
import { logger } from '../observability/logger';
import { listProfiles } from './profileService';
import { getRouteState } from './routeStateService';
import { getStorefrontSummariesByIds } from '../storefrontService';
import { sendTransactionalEmail } from './emailDeliveryService';
import { getDealDigestEligibility } from './memberEmailSubscriptionService';
import { buildDealDigestEmail, type DealDigestShop } from './dealDigestEmailTemplate';
import { getUtcDayKey, recordDigestSent, wasDigestSentToday } from './dealDigestLogService';
import { buildUnsubscribeUrl } from './emailUnsubscribeTokenService';

// Tuneables. Conservative defaults; revisit once we have real volume.
const PROFILE_PAGE_SIZE = 500;
const PROFILE_MAX_PAGES = 50; // upper bound: 25k profiles per cron run
const PER_PROFILE_CONCURRENCY = 25;

type SkipReason =
  | 'feature_flag_off'
  | 'missing_required_config'
  | 'anonymous_profile'
  | 'subscription_not_found'
  | 'no_email'
  | 'globally_unsubscribed'
  | 'deal_digest_opt_out'
  | 'no_saved_storefronts'
  | 'no_active_deals'
  | 'already_sent_today'
  | 'send_failed'
  | 'token_signing_failed';

export type DealDigestDispatchResult = {
  enabled: boolean;
  utcDayKey: string;
  totalProfilesScanned: number;
  digestsSent: number;
  skipsByReason: Record<SkipReason, number>;
  errors: Array<{
    profileId: string;
    accountId: string | null;
    error: string;
  }>;
};

function emptyCounts(): Record<SkipReason, number> {
  return {
    feature_flag_off: 0,
    missing_required_config: 0,
    anonymous_profile: 0,
    subscription_not_found: 0,
    no_email: 0,
    globally_unsubscribed: 0,
    deal_digest_opt_out: 0,
    no_saved_storefronts: 0,
    no_active_deals: 0,
    already_sent_today: 0,
    send_failed: 0,
    token_signing_failed: 0,
  };
}

function todayLabel(now = new Date()): string {
  // Format like "Saturday, May 2" in ET. We compute from UTC and let
  // Intl format in America/New_York since "everyone is in NY" per the
  // current product audience.
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(now);
}

function shopFromSummary(summary: {
  id: string;
  displayName: string;
  city?: string | null;
  promotionText?: string | null;
}): DealDigestShop | null {
  const promo = summary.promotionText?.trim();
  if (!promo) return null;
  const baseUrl = serverConfig.webAppBaseUrl ?? 'https://app.canopytrove.com';
  const trimmedBase = baseUrl.replace(/\/+$/, '');
  return {
    storefrontId: summary.id,
    displayName: summary.displayName,
    city: summary.city ?? null,
    promotionText: promo,
    storefrontUrl: `${trimmedBase}/storefronts/${encodeURIComponent(summary.id)}`,
  };
}

async function processProfile(input: {
  profileId: string;
  accountId: string | null;
  utcDayKey: string;
  todayLabelText: string;
  footerAddress: string;
}): Promise<{ outcome: 'sent' | 'skipped'; reason: SkipReason | 'sent' }> {
  const { profileId, accountId, utcDayKey, todayLabelText, footerAddress } = input;

  if (!accountId) {
    return { outcome: 'skipped', reason: 'anonymous_profile' };
  }

  const eligibility = await getDealDigestEligibility(accountId);
  if (!eligibility) {
    return { outcome: 'skipped', reason: 'subscription_not_found' };
  }
  if (!eligibility.eligible) {
    if (eligibility.reason === 'no_email') {
      return { outcome: 'skipped', reason: 'no_email' };
    }
    if (eligibility.reason === 'globally_unsubscribed') {
      return { outcome: 'skipped', reason: 'globally_unsubscribed' };
    }
    return { outcome: 'skipped', reason: 'deal_digest_opt_out' };
  }

  if (await wasDigestSentToday(accountId, utcDayKey)) {
    return { outcome: 'skipped', reason: 'already_sent_today' };
  }

  const routeState = await getRouteState(profileId);
  const savedIds = routeState.savedStorefrontIds ?? [];
  if (!savedIds.length) {
    return { outcome: 'skipped', reason: 'no_saved_storefronts' };
  }

  const summaries = await getStorefrontSummariesByIds(savedIds);
  const shops = summaries
    .map(shopFromSummary)
    .filter((shop): shop is DealDigestShop => shop !== null);
  if (!shops.length) {
    return { outcome: 'skipped', reason: 'no_active_deals' };
  }

  const unsubscribeUrl = buildUnsubscribeUrl({
    accountId,
    scope: 'deal_digest',
  });
  if (!unsubscribeUrl) {
    return { outcome: 'skipped', reason: 'token_signing_failed' };
  }

  const email = buildDealDigestEmail({
    recipientName: eligibility.displayName,
    shops,
    unsubscribeUrl,
    footerAddress,
    todayLabel: todayLabelText,
  });

  const sendResult = await sendTransactionalEmail({
    to: eligibility.email,
    subject: email.subject,
    html: email.html,
    text: email.text,
    idempotencyKey: `deal_digest:${accountId}:${utcDayKey}`,
    tags: [
      { name: 'kind', value: 'deal_digest' },
      { name: 'utc_day', value: utcDayKey },
    ],
  });

  if (!sendResult.ok) {
    logger.warn(`[dealDigestEmailService] send failed for ${accountId}`, {
      provider: sendResult.provider,
      code: sendResult.code,
      message: sendResult.message,
    });
    return { outcome: 'skipped', reason: 'send_failed' };
  }

  await recordDigestSent({
    accountId,
    profileId,
    shopCount: shops.length,
    providerMessageId: sendResult.id,
    utcDayKey,
  });

  return { outcome: 'sent', reason: 'sent' };
}

async function processBatch(
  batch: Array<{ profileId: string; accountId: string | null }>,
  context: {
    utcDayKey: string;
    todayLabelText: string;
    footerAddress: string;
  },
  result: DealDigestDispatchResult,
) {
  const settled = await Promise.allSettled(
    batch.map(({ profileId, accountId }) =>
      processProfile({
        profileId,
        accountId,
        utcDayKey: context.utcDayKey,
        todayLabelText: context.todayLabelText,
        footerAddress: context.footerAddress,
      }),
    ),
  );

  settled.forEach((settledResult, index) => {
    const { profileId, accountId } = batch[index];
    if (settledResult.status === 'rejected') {
      result.errors.push({
        profileId,
        accountId,
        error:
          settledResult.reason instanceof Error
            ? settledResult.reason.message
            : String(settledResult.reason),
      });
      return;
    }
    if (settledResult.value.outcome === 'sent') {
      result.digestsSent += 1;
      return;
    }
    const reason = settledResult.value.reason as SkipReason;
    result.skipsByReason[reason] = (result.skipsByReason[reason] ?? 0) + 1;
  });
}

export async function dispatchDealDigestEmails(): Promise<DealDigestDispatchResult> {
  const result: DealDigestDispatchResult = {
    enabled: false,
    utcDayKey: getUtcDayKey(),
    totalProfilesScanned: 0,
    digestsSent: 0,
    skipsByReason: emptyCounts(),
    errors: [],
  };

  if (!serverConfig.dealDigestsEnabled) {
    result.skipsByReason.feature_flag_off += 1;
    logger.info('[dealDigestEmailService] dispatch skipped: feature flag off');
    return result;
  }

  const footerAddress = serverConfig.emailFooterAddress?.trim();
  if (!footerAddress) {
    logger.warn(
      '[dealDigestEmailService] dispatch aborted: EMAIL_FOOTER_ADDRESS missing (CAN-SPAM requires a real mailing address in every email)',
    );
    result.skipsByReason.missing_required_config += 1;
    return result;
  }
  if (!serverConfig.emailUnsubscribeTokenSecret) {
    logger.warn(
      '[dealDigestEmailService] dispatch aborted: EMAIL_UNSUBSCRIBE_TOKEN_SECRET missing',
    );
    result.skipsByReason.missing_required_config += 1;
    return result;
  }

  result.enabled = true;
  const todayLabelText = todayLabel();

  let cursor: string | undefined;
  for (let page = 0; page < PROFILE_MAX_PAGES; page += 1) {
    const profiles = await listProfiles(PROFILE_PAGE_SIZE, cursor);
    if (!profiles.length) break;
    result.totalProfilesScanned += profiles.length;

    // Drain the page in batches so we don't fan out 500 Firestore +
    // Resend calls at once.
    for (let i = 0; i < profiles.length; i += PER_PROFILE_CONCURRENCY) {
      const batch = profiles.slice(i, i + PER_PROFILE_CONCURRENCY).map((p) => ({
        profileId: p.id,
        accountId: p.accountId ?? null,
      }));
      await processBatch(
        batch,
        {
          utcDayKey: result.utcDayKey,
          todayLabelText,
          footerAddress,
        },
        result,
      );
    }

    cursor = profiles[profiles.length - 1]?.id;
    if (!cursor || profiles.length < PROFILE_PAGE_SIZE) break;
  }

  logger.info('[dealDigestEmailService] dispatch complete', {
    utcDayKey: result.utcDayKey,
    totalProfilesScanned: result.totalProfilesScanned,
    digestsSent: result.digestsSent,
    skipsByReason: result.skipsByReason,
    errorCount: result.errors.length,
  });

  return result;
}
