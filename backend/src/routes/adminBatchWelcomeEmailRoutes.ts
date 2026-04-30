import { Router } from 'express';
import { getBackendFirebaseAuth, hasBackendFirebaseConfig } from '../firebase';
import { sendOwnerWelcomeEmailIfNeeded } from '../services/ownerWelcomeEmailService';
import { syncMemberEmailSubscription } from '../services/memberEmailSubscriptionService';
import { getOwnerProfileCollection } from '../services/ownerPortalWorkspaceCollections';

export const adminBatchWelcomeEmailRoutes = Router();

type BatchResult = {
  uid: string;
  email: string;
  type: 'owner' | 'member';
  result: 'sent' | 'already_sent' | 'skipped' | 'failed';
  error?: string;
};

const DEFAULT_USERS_PER_BATCH = 500;
const MAX_USERS_PER_BATCH = 1000; // Firebase Admin's listUsers cap.

function parsePositiveIntParam(value: unknown, fallback: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(max, Math.floor(parsed));
}

adminBatchWelcomeEmailRoutes.post('/batch-welcome-emails', async (request, response) => {
  if (!hasBackendFirebaseConfig) {
    response.status(503).json({
      ok: false,
      error: 'Firebase auth is not configured.',
    });
    return;
  }

  const auth = getBackendFirebaseAuth();
  if (!auth) {
    response.status(503).json({
      ok: false,
      error: 'Firebase auth is not available.',
    });
    return;
  }

  const dryRun = request.query.dryRun === 'true';
  const typeFilter =
    typeof request.query.type === 'string' ? request.query.type.trim().toLowerCase() : null;
  // Single-page-per-request: previously this looped through ALL Firebase
  // Auth users in one request, which (a) hit the global 30s request
  // timeout long before completing for any non-trivial user base, (b)
  // accumulated a result object per user in memory, and (c) had no
  // resume capability on partial failure. Caller now drives pagination
  // by passing back the returned nextPageToken until it's null.
  const usersPerBatch = parsePositiveIntParam(
    request.query.maxUsers,
    DEFAULT_USERS_PER_BATCH,
    MAX_USERS_PER_BATCH,
  );
  const incomingPageToken =
    typeof request.query.pageToken === 'string' && request.query.pageToken.trim()
      ? request.query.pageToken.trim()
      : undefined;
  const results: BatchResult[] = [];
  const ownerProfileCollection = getOwnerProfileCollection();

  // Collect all owner UIDs so we know who is an owner vs a regular member.
  // Owner profile count is bounded (~hundreds), so a single full read is
  // fine — unlike the user list which is unbounded.
  const ownerUids = new Set<string>();
  if (ownerProfileCollection) {
    const ownerSnapshots = await ownerProfileCollection.get();
    for (const doc of ownerSnapshots.docs) {
      ownerUids.add(doc.id);
    }
  }

  // Process a single page of users. Caller resumes via nextPageToken.
  let nextPageToken: string | null;
  {
    const listResult = await auth.listUsers(usersPerBatch, incomingPageToken);
    nextPageToken = listResult.pageToken ?? null;

    for (const userRecord of listResult.users) {
      const email = userRecord.email?.trim();
      if (!email) {
        results.push({
          uid: userRecord.uid,
          email: '',
          type: 'member',
          result: 'skipped',
          error: 'No email address on account.',
        });
        continue;
      }

      const isOwner = ownerUids.has(userRecord.uid);

      if (
        typeFilter &&
        ((typeFilter === 'member' && isOwner) || (typeFilter === 'owner' && !isOwner))
      ) {
        results.push({
          uid: userRecord.uid,
          email,
          type: isOwner ? 'owner' : 'member',
          result: 'skipped',
          error: `Skipped — type filter is "${typeFilter}".`,
        });
        continue;
      }

      if (isOwner) {
        // Owner welcome email
        if (dryRun) {
          results.push({
            uid: userRecord.uid,
            email,
            type: 'owner',
            result: 'skipped',
            error: 'Dry run — would send owner welcome email.',
          });
          continue;
        }

        try {
          let companyName: string | null = null;
          if (ownerProfileCollection) {
            const profileSnapshot = await ownerProfileCollection.doc(userRecord.uid).get();
            if (profileSnapshot.exists) {
              const profile = profileSnapshot.data();
              companyName = profile?.companyName?.trim() || null;
            }
          }

          const status = await sendOwnerWelcomeEmailIfNeeded({
            ownerUid: userRecord.uid,
            email,
            displayName: userRecord.displayName?.trim() || null,
            companyName,
          });

          results.push({
            uid: userRecord.uid,
            email,
            type: 'owner',
            result:
              status.welcomeEmailState === 'sent' && status.welcomeEmailSentAt
                ? 'sent'
                : status.welcomeEmailState === 'pending_provider'
                  ? 'already_sent'
                  : 'failed',
            error: status.welcomeEmailError ?? undefined,
          });
        } catch (error) {
          results.push({
            uid: userRecord.uid,
            email,
            type: 'owner',
            result: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      } else {
        // Member welcome email — sync subscription which triggers welcome if needed
        if (dryRun) {
          results.push({
            uid: userRecord.uid,
            email,
            type: 'member',
            result: 'skipped',
            error: 'Dry run — would send member welcome email.',
          });
          continue;
        }

        try {
          const status = await syncMemberEmailSubscription({
            accountId: userRecord.uid,
            email,
            displayName: userRecord.displayName?.trim() || null,
            subscribed: true,
            source: 'member_signup',
          });

          results.push({
            uid: userRecord.uid,
            email,
            type: 'member',
            result:
              status.welcomeEmailState === 'sent' && status.welcomeEmailSentAt
                ? 'sent'
                : status.welcomeEmailState === 'not_requested'
                  ? 'already_sent'
                  : 'failed',
            error: status.welcomeEmailError ?? undefined,
          });
        } catch (error) {
          results.push({
            uid: userRecord.uid,
            email,
            type: 'member',
            result: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }
  }

  const sent = results.filter((r) => r.result === 'sent');
  const alreadySent = results.filter((r) => r.result === 'already_sent');
  const skipped = results.filter((r) => r.result === 'skipped');
  const failed = results.filter((r) => r.result === 'failed');

  response.json({
    ok: true,
    dryRun,
    summary: {
      total: results.length,
      sent: sent.length,
      alreadySent: alreadySent.length,
      skipped: skipped.length,
      failed: failed.length,
    },
    results,
    // null when this was the last page; pass back to resume.
    nextPageToken,
  });
});
