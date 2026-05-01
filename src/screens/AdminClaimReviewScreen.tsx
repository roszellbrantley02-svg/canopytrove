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
  submitAdminClaimReview,
  type AdminPendingClaim,
} from '../services/adminClaimReviewService';
import { ownerPortalStyles as sharedStyles } from './ownerPortal/ownerPortalStyles';

type PendingActionState = {
  claimId: string;
  action: 'approve' | 'reject';
};

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

function AdminClaimReviewScreenInner() {
  const [claims, setClaims] = React.useState<AdminPendingClaim[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [statusText, setStatusText] = React.useState<string | null>(null);
  const [pendingAction, setPendingAction] = React.useState<PendingActionState | null>(null);
  const [reviewNotesByClaim, setReviewNotesByClaim] = React.useState<Record<string, string>>({});

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

        {claims.map((claim, index) => {
          const verification = describeShopVerification(claim);
          const verificationToneStyle =
            verification.tone === 'success'
              ? sharedStyles.statusPanelSuccess
              : verification.tone === 'warning'
                ? sharedStyles.statusPanelWarm
                : sharedStyles.statusPanelDanger;
          const notes = reviewNotesByClaim[claim.id] ?? '';
          return (
            <MotionInView delay={120 + index * 40} key={claim.id}>
              <SectionCard
                title={claim.id}
                body={`Submitted ${formatTimestamp(claim.submittedAt)}`}
              >
                <View style={localStyles.claimStack}>
                  <View style={[sharedStyles.statusPanel, verificationToneStyle]}>
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
                    {claim.reviewNotes ? (
                      <Text style={sharedStyles.helperText}>
                        Existing notes: {claim.reviewNotes}
                      </Text>
                    ) : null}
                  </View>

                  <View style={sharedStyles.fieldGroup}>
                    <Text style={sharedStyles.fieldLabel}>Review notes (optional)</Text>
                    <TextInput
                      value={notes}
                      onChangeText={(value) =>
                        setReviewNotesByClaim((current) => ({ ...current, [claim.id]: value }))
                      }
                      placeholder="Why approving / rejecting (visible in audit trail)"
                      placeholderTextColor={colors.textSoft}
                      style={[sharedStyles.inputPremium, sharedStyles.textAreaPremium]}
                      multiline={true}
                      numberOfLines={3}
                    />
                  </View>

                  <View style={localStyles.actionRow}>
                    <Pressable
                      disabled={Boolean(pendingAction)}
                      onPress={() => void handleReview(claim, 'approve')}
                      style={[
                        localStyles.approveButton,
                        Boolean(pendingAction) && sharedStyles.buttonDisabled,
                      ]}
                    >
                      <AppUiIcon name="checkmark-circle-outline" size={18} color="#08110D" />
                      <Text style={localStyles.approveButtonText}>
                        {isApproving(claim.id) ? 'Approving…' : 'Approve'}
                      </Text>
                    </Pressable>
                    <Pressable
                      disabled={Boolean(pendingAction)}
                      onPress={() => void handleReview(claim, 'reject')}
                      style={[
                        localStyles.rejectButton,
                        Boolean(pendingAction) && sharedStyles.buttonDisabled,
                      ]}
                    >
                      <AppUiIcon name="close-circle-outline" size={18} color="#FFC0C0" />
                      <Text style={localStyles.rejectButtonText}>
                        {isRejecting(claim.id) ? 'Rejecting…' : 'Reject'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </SectionCard>
            </MotionInView>
          );
        })}

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
