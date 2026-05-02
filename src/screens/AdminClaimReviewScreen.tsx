/**
 * Admin Claim Review Screen — manual queue overflow.
 *
 * The bulk of legitimate claims auto-approve via the backend's
 * claimAutoApprovalService when shop-phone OTP succeeds + OCM cross-
 * reference matches. This screen handles the rest: the manual-review
 * path, non-OCM-listed shops, and any auto-approval failures.
 *
 * Auth: Firebase ID token + admin claim (same as AdminRuntimePanelScreen).
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import { AppUiIcon } from '../icons/AppUiIcon';
import { colors } from '../theme/tokens';
import {
  fetchAdminClaimQueue,
  submitAdminBatchClaimReview,
  submitAdminClaimReview,
  type AdminPendingClaim,
} from '../services/adminClaimReviewService';
import { ownerPortalStyles as sharedStyles } from './ownerPortal/ownerPortalStyles';

type PendingActionState = {
  claimId: string;
  action: 'approve' | 'reject';
};

type PendingBatchActionState = {
  batchId: string;
  action: 'approve';
};

/**
 * Partition claims into batch groups + ungrouped singletons, preserving the
 * server-returned ordering inside each group. Phase 2 multi-location feature
 * stamps `bulkClaimBatchId` on every claim that came in as a cluster — we
 * use that to surface a single "Approve all in batch" action per group.
 */
function groupClaimsByBatch(claims: AdminPendingClaim[]): {
  batches: Array<{ batchId: string; claims: AdminPendingClaim[] }>;
  singletons: AdminPendingClaim[];
} {
  const batchMap = new Map<string, AdminPendingClaim[]>();
  const singletons: AdminPendingClaim[] = [];
  for (const claim of claims) {
    const batchId = claim.bulkClaimBatchId;
    if (typeof batchId === 'string' && batchId.length > 0) {
      const list = batchMap.get(batchId) ?? [];
      list.push(claim);
      batchMap.set(batchId, list);
    } else {
      singletons.push(claim);
    }
  }
  // Drop any "batch" with only one claim back to singletons — no point
  // showing a one-click action for a batch of one.
  const batches: Array<{ batchId: string; claims: AdminPendingClaim[] }> = [];
  batchMap.forEach((batchClaims, batchId) => {
    if (batchClaims.length <= 1) {
      singletons.push(...batchClaims);
    } else {
      batches.push({ batchId, claims: batchClaims });
    }
  });
  return { batches, singletons };
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function describeShopVerification(claim: AdminPendingClaim): {
  label: string;
  tone: 'success' | 'warning' | 'danger';
} {
  if (claim.shopOwnershipVerified === true) {
    const suffix = claim.shopOwnershipVerifiedPhoneSuffix
      ? ` (***-${claim.shopOwnershipVerifiedPhoneSuffix})`
      : '';
    return { label: `Shop phone verified${suffix}`, tone: 'success' };
  }
  if (claim.shopClaimNotificationSentAt) {
    return {
      label: `Notification call fired (status: ${claim.shopClaimNotificationStatus ?? 'unknown'})`,
      tone: 'warning',
    };
  }
  return { label: 'No shop-phone signal — manual review', tone: 'danger' };
}

type RenderClaimCardCtx = {
  reviewNotesByClaim: Record<string, string>;
  setReviewNotesByClaim: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  pendingAction: PendingActionState | null;
  pendingBatchAction: PendingBatchActionState | null;
  handleReview: (claim: AdminPendingClaim, action: 'approve' | 'reject') => void | Promise<void>;
  isApproving: (claimId: string) => boolean;
  isRejecting: (claimId: string) => boolean;
};

function renderClaimCard(claim: AdminPendingClaim, ctx: RenderClaimCardCtx): React.ReactNode {
  const verification = describeShopVerification(claim);
  const verificationToneStyle =
    verification.tone === 'success'
      ? sharedStyles.statusPanelSuccess
      : verification.tone === 'warning'
        ? sharedStyles.statusPanelWarm
        : sharedStyles.statusPanelDanger;
  const notes = ctx.reviewNotesByClaim[claim.id] ?? '';
  const isAnyActionPending = Boolean(ctx.pendingAction || ctx.pendingBatchAction);
  return (
    <View style={localStyles.claimStack} key={claim.id}>
      <View style={[sharedStyles.statusPanel, verificationToneStyle]}>
        <View style={sharedStyles.statusRow}>
          <Text style={sharedStyles.statusLabel}>Claim</Text>
          <Text style={sharedStyles.statusValue}>{claim.id}</Text>
        </View>
        <View style={sharedStyles.statusRow}>
          <Text style={sharedStyles.statusLabel}>Verification</Text>
          <Text style={sharedStyles.statusValue}>{verification.label}</Text>
        </View>
        <View style={sharedStyles.statusRow}>
          <Text style={sharedStyles.statusLabel}>Owner UID</Text>
          <Text style={sharedStyles.statusValue}>{claim.ownerUid ?? '—'}</Text>
        </View>
        <View style={sharedStyles.statusRow}>
          <Text style={sharedStyles.statusLabel}>Storefront</Text>
          <Text style={sharedStyles.statusValue}>{claim.dispensaryId ?? '—'}</Text>
        </View>
        <View style={sharedStyles.statusRow}>
          <Text style={sharedStyles.statusLabel}>Notification call</Text>
          <Text style={sharedStyles.statusValue}>
            {formatTimestamp(claim.shopClaimNotificationSentAt)}
          </Text>
        </View>
        {claim.bulkClaimRole ? (
          <View style={sharedStyles.statusRow}>
            <Text style={sharedStyles.statusLabel}>Cluster role</Text>
            <Text style={sharedStyles.statusValue}>{claim.bulkClaimRole}</Text>
          </View>
        ) : null}
        {claim.reviewNotes ? (
          <Text style={sharedStyles.helperText}>Existing notes: {claim.reviewNotes}</Text>
        ) : null}
      </View>

      <View style={sharedStyles.fieldGroup}>
        <Text style={sharedStyles.fieldLabel}>Per-claim notes (optional)</Text>
        <TextInput
          value={notes}
          onChangeText={(value) =>
            ctx.setReviewNotesByClaim((current) => ({ ...current, [claim.id]: value }))
          }
          placeholder="Why approving / rejecting this specific claim"
          placeholderTextColor={colors.textSoft}
          style={[sharedStyles.inputPremium, sharedStyles.textAreaPremium]}
          multiline={true}
          numberOfLines={3}
        />
      </View>

      <View style={localStyles.actionRow}>
        <Pressable
          disabled={isAnyActionPending}
          onPress={() => void ctx.handleReview(claim, 'approve')}
          style={[localStyles.approveButton, isAnyActionPending && sharedStyles.buttonDisabled]}
        >
          <AppUiIcon name="checkmark-circle-outline" size={18} color="#08110D" />
          <Text style={localStyles.approveButtonText}>
            {ctx.isApproving(claim.id) ? 'Approving…' : 'Approve'}
          </Text>
        </Pressable>
        <Pressable
          disabled={isAnyActionPending}
          onPress={() => void ctx.handleReview(claim, 'reject')}
          style={[localStyles.rejectButton, isAnyActionPending && sharedStyles.buttonDisabled]}
        >
          <AppUiIcon name="close-circle-outline" size={18} color="#FFC0C0" />
          <Text style={localStyles.rejectButtonText}>
            {ctx.isRejecting(claim.id) ? 'Rejecting…' : 'Reject'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function AdminClaimReviewScreenInner() {
  const [claims, setClaims] = React.useState<AdminPendingClaim[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [statusText, setStatusText] = React.useState<string | null>(null);
  const [pendingAction, setPendingAction] = React.useState<PendingActionState | null>(null);
  const [pendingBatchAction, setPendingBatchAction] =
    React.useState<PendingBatchActionState | null>(null);
  const [reviewNotesByClaim, setReviewNotesByClaim] = React.useState<Record<string, string>>({});
  const [reviewNotesByBatch, setReviewNotesByBatch] = React.useState<Record<string, string>>({});

  const { batches, singletons } = React.useMemo(() => groupClaimsByBatch(claims), [claims]);

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    setStatusText(null);
    try {
      const result = await fetchAdminClaimQueue(50);
      setClaims(result.claims ?? []);
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : 'Unable to load claim queue.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleReview = async (claim: AdminPendingClaim, action: 'approve' | 'reject') => {
    if (pendingAction) return;
    setPendingAction({ claimId: claim.id, action });
    setStatusText(null);
    try {
      const trimmedNotes = (reviewNotesByClaim[claim.id] ?? '').trim();
      await submitAdminClaimReview(claim.id, {
        status: action === 'approve' ? 'approved' : 'rejected',
        reviewNotes: trimmedNotes ? trimmedNotes : null,
        // When approving without shop-phone signal, explicitly override
        // so the backend records the audit-trail bypass.
        overrideShopOwnership:
          action === 'approve' && claim.shopOwnershipVerified !== true ? true : undefined,
      });
      setStatusText(
        action === 'approve' ? `Approved claim ${claim.id}.` : `Rejected claim ${claim.id}.`,
      );
      // Optimistically drop it from the list — refresh on next tick
      // pulls authoritative state.
      setClaims((current) => current.filter((c) => c.id !== claim.id));
      void refresh();
    } catch (error) {
      setStatusText(
        error instanceof Error ? error.message : `Could not ${action} claim ${claim.id}.`,
      );
    } finally {
      setPendingAction(null);
    }
  };

  const isApproving = (claimId: string) =>
    pendingAction?.claimId === claimId && pendingAction.action === 'approve';
  const isRejecting = (claimId: string) =>
    pendingAction?.claimId === claimId && pendingAction.action === 'reject';
  const isBatchApproving = (batchId: string) =>
    pendingBatchAction?.batchId === batchId && pendingBatchAction.action === 'approve';

  const handleBatchApprove = async (batchId: string, batchClaims: AdminPendingClaim[]) => {
    if (pendingBatchAction || pendingAction) return;
    setPendingBatchAction({ batchId, action: 'approve' });
    setStatusText(null);
    try {
      const trimmedNotes = (reviewNotesByBatch[batchId] ?? '').trim();
      // Override shop-ownership when ANY sibling lacks the OTP signal —
      // the admin is taking responsibility for the whole cluster decision.
      const needsOverride = batchClaims.some((c) => c.shopOwnershipVerified !== true);
      const result = await submitAdminBatchClaimReview({
        claimIds: batchClaims.map((c) => c.id),
        status: 'approved',
        reviewNotes: trimmedNotes ? trimmedNotes : null,
        overrideShopOwnership: needsOverride ? true : undefined,
      });
      const succeededIds = Object.entries(result.results)
        .filter(([, outcome]) => outcome.ok)
        .map(([id]) => id);
      setStatusText(
        result.failedCount > 0
          ? `Approved ${result.approvedCount} of ${batchClaims.length} in batch ${batchId}. ${result.failedCount} failed — refresh and retry.`
          : `Approved all ${result.approvedCount} claims in batch ${batchId}.`,
      );
      setClaims((current) => current.filter((c) => !succeededIds.includes(c.id)));
      void refresh();
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : `Could not approve batch ${batchId}.`);
    } finally {
      setPendingBatchAction(null);
    }
  };

  return (
    <ScreenShell
      eyebrow="Admin"
      title="Claim review"
      subtitle="Manual-queue overflow. Auto-approval handles the rest in the background."
      headerPill="Internal"
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={localStyles.scrollContent}
      >
        <MotionInView delay={70}>
          <SectionCard
            title="Pending claims"
            body={
              isLoading
                ? 'Loading…'
                : claims.length === 0
                  ? 'No claims awaiting manual review. Auto-approval is keeping up.'
                  : `${claims.length} claim${claims.length === 1 ? '' : 's'} need a decision.`
            }
          >
            <View style={localStyles.headerActions}>
              <Pressable onPress={() => void refresh()} style={sharedStyles.secondaryButton}>
                <Text style={sharedStyles.secondaryButtonText}>
                  {isLoading ? 'Refreshing…' : 'Refresh'}
                </Text>
              </Pressable>
            </View>
            {statusText ? (
              <Text
                style={sharedStyles.helperText}
                accessibilityLiveRegion="polite"
                accessibilityRole="alert"
              >
                {statusText}
              </Text>
            ) : null}
          </SectionCard>
        </MotionInView>

        {batches.map((batch, batchIndex) => {
          const batchNotes = reviewNotesByBatch[batch.batchId] ?? '';
          const batchOwnerUid = batch.claims[0]?.ownerUid ?? '—';
          const verifiedCount = batch.claims.filter((c) => c.shopOwnershipVerified === true).length;
          return (
            <MotionInView delay={120 + batchIndex * 40} key={`batch-${batch.batchId}`}>
              <SectionCard
                title={`Cluster claim — ${batch.claims.length} sibling locations`}
                body={`Batch ${batch.batchId} · Owner ${batchOwnerUid} · ${verifiedCount} of ${batch.claims.length} have shop-OTP signal.`}
              >
                <View style={localStyles.claimStack}>
                  <View style={sharedStyles.fieldGroup}>
                    <Text style={sharedStyles.fieldLabel}>
                      Batch review notes (applied to every claim in cluster)
                    </Text>
                    <TextInput
                      value={batchNotes}
                      onChangeText={(value) =>
                        setReviewNotesByBatch((current) => ({
                          ...current,
                          [batch.batchId]: value,
                        }))
                      }
                      placeholder="Why approving the whole cluster (audit trail)"
                      placeholderTextColor={colors.textSoft}
                      style={[sharedStyles.inputPremium, sharedStyles.textAreaPremium]}
                      multiline={true}
                      numberOfLines={3}
                    />
                  </View>

                  <Pressable
                    disabled={Boolean(pendingAction || pendingBatchAction)}
                    onPress={() => void handleBatchApprove(batch.batchId, batch.claims)}
                    style={[
                      localStyles.approveButton,
                      Boolean(pendingAction || pendingBatchAction) && sharedStyles.buttonDisabled,
                    ]}
                  >
                    <AppUiIcon name="checkmark-circle-outline" size={18} color="#08110D" />
                    <Text style={localStyles.approveButtonText}>
                      {isBatchApproving(batch.batchId)
                        ? 'Approving cluster…'
                        : `Approve all ${batch.claims.length} in batch`}
                    </Text>
                  </Pressable>
                  <Text style={sharedStyles.helperText}>
                    Or review each sibling individually below.
                  </Text>
                  {batch.claims.map((claim) =>
                    renderClaimCard(claim, {
                      reviewNotesByClaim,
                      setReviewNotesByClaim,
                      pendingAction,
                      pendingBatchAction,
                      handleReview,
                      isApproving,
                      isRejecting,
                    }),
                  )}
                </View>
              </SectionCard>
            </MotionInView>
          );
        })}

        {singletons.map((claim, index) => (
          <MotionInView delay={120 + (batches.length + index) * 40} key={claim.id}>
            <SectionCard title={claim.id} body={`Submitted ${formatTimestamp(claim.submittedAt)}`}>
              {renderClaimCard(claim, {
                reviewNotesByClaim,
                setReviewNotesByClaim,
                pendingAction,
                pendingBatchAction,
                handleReview,
                isApproving,
                isRejecting,
              })}
            </SectionCard>
          </MotionInView>
        ))}

        {!isLoading && claims.length === 0 ? (
          <MotionInView delay={120}>
            <View style={[sharedStyles.emptyStateCard, sharedStyles.statusPanelSuccess]}>
              <Text style={sharedStyles.emptyStateTitle}>Inbox zero</Text>
              <Text style={sharedStyles.emptyStateBody}>
                Auto-approval handled everything in the queue. Pull to refresh anytime.
              </Text>
            </View>
          </MotionInView>
        ) : null}
      </ScrollView>
    </ScreenShell>
  );
}

const localStyles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  claimStack: {
    gap: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: '#2ECC71',
    paddingHorizontal: 16,
  },
  approveButtonText: {
    color: '#08110D',
    fontSize: 14,
    fontWeight: '800',
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 122, 122, 0.4)',
    backgroundColor: 'rgba(255, 122, 122, 0.12)',
    paddingHorizontal: 16,
  },
  rejectButtonText: {
    color: '#FFC0C0',
    fontSize: 14,
    fontWeight: '800',
  },
});

export const AdminClaimReviewScreen = withScreenErrorBoundary(
  AdminClaimReviewScreenInner,
  'admin-claim-review',
);
