import { colors } from '../theme/tokens';
import React from 'react';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { AppUiIcon } from '../icons/AppUiIcon';

import type { RootStackParamList } from '../navigation/RootNavigator';
import { OwnerPortalAnalyticsCard } from './ownerPortal/OwnerPortalAnalyticsCard';
import {
  clampProgress,
  formatCount,
  formatPercent,
  getRelativeProgress,
} from './ownerPortal/ownerPortalMetricUtils';
import { ownerPortalStyles as styles } from './ownerPortal/ownerPortalStyles';
import { useOwnerPortalWorkspace } from './ownerPortal/useOwnerPortalWorkspace';

type OwnerPortalReviewInboxRoute = RouteProp<RootStackParamList, 'OwnerPortalReviewInbox'>;

function getReviewRuntimeMessage(reviewRepliesEnabled: boolean, safeModeEnabled: boolean) {
  if (!reviewRepliesEnabled) {
    return 'Review replies are temporarily paused while the system stabilizes.';
  }

  if (safeModeEnabled) {
    return 'Protected mode is active. Monitoring is elevated, but the inbox is still visible.';
  }

  return null;
}

function OwnerPortalReviewInboxScreenInner() {
  const _route = useRoute<OwnerPortalReviewInboxRoute>();
  const preview = false;
  const {
    workspace,
    runtimeStatus,
    isLoading,
    isSaving,
    isAiLoading,
    errorText,
    aiErrorText,
    enableAlerts,
    replyToReview,
    draftReviewReplyWithAi,
  } = useOwnerPortalWorkspace(preview);
  const [replyDrafts, setReplyDrafts] = React.useState<Record<string, string>>({});

  const reviews = workspace?.recentReviews ?? [];
  const reports = workspace?.recentReports ?? [];
  const metrics = workspace?.metrics;
  const lowRatingCount = reviews.filter((review) => review.isLowRating).length;
  const pendingReplyCount = reviews.filter((review) => !review.ownerReply?.text).length;
  const reportPressureMax = Math.max(reports.length, 1);
  const reviewRepliesEnabled = runtimeStatus?.policy.reviewRepliesEnabled !== false;
  const runtimeMessage = getReviewRuntimeMessage(
    reviewRepliesEnabled,
    runtimeStatus?.policy.safeModeEnabled === true,
  );

  return (
    <ScreenShell
      eyebrow="Owner Portal"
      title="Review management."
      subtitle="Reply fast, watch low-rating patterns, and keep reports from going stale."
      headerPill={'Reviews'}
    >
      <MotionInView delay={70}>
        <View style={styles.portalHeroCard}>
          <View style={styles.portalHeroGlow} />
          <Text style={styles.portalHeroKicker}>Review inbox</Text>
          <Text style={styles.portalHeroTitle}>
            Keep reputation management fast, calm, and clearly prioritized.
          </Text>
          <Text style={styles.portalHeroBody}>
            The inbox now reads like a premium operator console while keeping review, report, and
            runtime incident alerts attached to the same owner device.
          </Text>
          <View style={styles.portalHeroMetricRow}>
            <View style={styles.portalHeroMetricCard}>
              <Text style={styles.portalHeroMetricValue}>{reviews.length}</Text>
              <Text style={styles.portalHeroMetricLabel}>Recent Reviews</Text>
            </View>
            <View style={styles.portalHeroMetricCard}>
              <Text style={styles.portalHeroMetricValue}>{reports.length}</Text>
              <Text style={styles.portalHeroMetricLabel}>Recent Reports</Text>
            </View>
            <View style={styles.portalHeroMetricCard}>
              <Text style={styles.portalHeroMetricValue}>
                {workspace?.ownerAlertStatus.pushEnabled ? 'On' : 'Off'}
              </Text>
              <Text style={styles.portalHeroMetricLabel}>Fast Alerts</Text>
            </View>
          </View>
        </View>
      </MotionInView>

      <MotionInView delay={120}>
        <SectionCard
          title="Inbox health"
          body="This is the live owner signal board for reviews, reports, and fast-notification status."
        >
          {runtimeMessage ? (
            <View
              style={[
                styles.statusPanel,
                runtimeStatus?.policy.safeModeEnabled
                  ? styles.statusPanelWarm
                  : styles.statusPanelSuccess,
              ]}
            >
              <Text style={styles.helperText}>{runtimeMessage}</Text>
            </View>
          ) : null}
          {isLoading ? <Text style={styles.helperText}>Loading inbox...</Text> : null}
          {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
          {aiErrorText ? <Text style={styles.errorText}>{aiErrorText}</Text> : null}
          {metrics ? (
            <View style={styles.sectionStack}>
              <View style={styles.summaryStrip}>
                <View style={styles.summaryTile}>
                  <Text style={styles.summaryTileValue}>{formatCount(pendingReplyCount)}</Text>
                  <Text style={styles.summaryTileLabel}>Needs Reply</Text>
                  <Text style={styles.summaryTileBody}>
                    Reviews still waiting on an owner response.
                  </Text>
                </View>
                <View style={styles.summaryTile}>
                  <Text style={styles.summaryTileValue}>{formatCount(lowRatingCount)}</Text>
                  <Text style={styles.summaryTileLabel}>Low Rating Queue</Text>
                  <Text style={styles.summaryTileBody}>
                    Priority reviews that deserve the fastest follow-up.
                  </Text>
                </View>
                <View style={styles.summaryTile}>
                  <Text style={styles.summaryTileValue}>
                    {formatCount(metrics.openReportCount)}
                  </Text>
                  <Text style={styles.summaryTileLabel}>Open Reports</Text>
                  <Text style={styles.summaryTileBody}>
                    Moderation items that still need owner attention.
                  </Text>
                </View>
                <View style={styles.summaryTile}>
                  <Text style={styles.summaryTileValue}>
                    {workspace?.ownerAlertStatus.pushEnabled ? 'On' : 'Off'}
                  </Text>
                  <Text style={styles.summaryTileLabel}>Fast Alerts</Text>
                  <Text style={styles.summaryTileBody}>
                    Notification readiness for reviews, reports, and runtime incidents.
                  </Text>
                </View>
              </View>

              <View style={styles.analyticsSectionCard}>
                <View style={styles.analyticsSectionHeader}>
                  <Text style={styles.analyticsSectionEyebrow}>Inbox analytics</Text>
                  <Text style={styles.analyticsSectionTitle}>
                    Reputation health reads faster when response quality and moderation pressure are
                    separated clearly.
                  </Text>
                  <Text style={styles.analyticsSectionBody}>
                    This view keeps the same owner inbox logic, but makes scan paths calmer and more
                    premium for paid workspace usage.
                  </Text>
                </View>
                <View style={styles.metricGrid}>
                  <OwnerPortalAnalyticsCard
                    body="Average customer sentiment across recent Canopy Trove reviews."
                    eyebrow="Reputation"
                    icon="star-outline"
                    progress={clampProgress((metrics.averageRating ?? 0) / 5)}
                    progressLabel="Five-star scale"
                    stats={[
                      { label: 'Recent reviews', value: formatCount(reviews.length) },
                      { label: 'Low rating', value: formatCount(lowRatingCount) },
                    ]}
                    title="Average Rating"
                    tone="warm"
                    value={metrics.averageRating?.toFixed(1) ?? 'N/A'}
                  />
                  <OwnerPortalAnalyticsCard
                    body="Recent reviews that already received an owner response."
                    eyebrow="Response quality"
                    icon="chatbubble-ellipses-outline"
                    progress={clampProgress(metrics.replyRate)}
                    progressLabel="Replied share of recent reviews"
                    stats={[
                      { label: 'Needs reply', value: formatCount(pendingReplyCount) },
                      { label: 'Low rating', value: formatCount(lowRatingCount) },
                    ]}
                    title="Reply Rate"
                    tone="success"
                    value={formatPercent(metrics.replyRate * 100)}
                  />
                  <OwnerPortalAnalyticsCard
                    body="Reports still open for moderation or owner follow-up."
                    eyebrow="Moderation"
                    icon="shield-outline"
                    progress={getRelativeProgress(metrics.openReportCount, reportPressureMax)}
                    progressLabel="Share of recent report queue"
                    stats={[
                      { label: 'Recent reports', value: formatCount(reports.length) },
                      { label: 'Pending reviews', value: formatCount(pendingReplyCount) },
                    ]}
                    title="Open Reports"
                    tone="rose"
                    value={formatCount(metrics.openReportCount)}
                  />
                  <OwnerPortalAnalyticsCard
                    body="Push notifications that keep the owner aware of new reputation issues and runtime incidents quickly."
                    eyebrow="Notification readiness"
                    icon="notifications-outline"
                    progress={workspace?.ownerAlertStatus.pushEnabled ? 1 : 0.18}
                    progressLabel={
                      workspace?.ownerAlertStatus.pushEnabled
                        ? 'Fast alerts are enabled'
                        : 'Alerts are currently disabled'
                    }
                    stats={[
                      {
                        label: 'Updated',
                        value: workspace?.ownerAlertStatus.updatedAt
                          ? new Date(workspace.ownerAlertStatus.updatedAt).toLocaleDateString()
                          : 'Never',
                      },
                      { label: 'Queue items', value: formatCount(reviews.length + reports.length) },
                    ]}
                    title="Fast Alerts"
                    tone="cyan"
                    value={workspace?.ownerAlertStatus.pushEnabled ? 'On' : 'Off'}
                  />
                </View>
              </View>
            </View>
          ) : null}
        </SectionCard>
      </MotionInView>

      <MotionInView delay={180}>
        <SectionCard
          title="Inbox alerts"
          body="Turn on owner push alerts so reviews, reports, and runtime incidents reach the phone quickly."
        >
          <View
            style={[
              styles.ctaPanel,
              workspace?.ownerAlertStatus.pushEnabled
                ? styles.statusPanelSuccess
                : styles.statusPanelWarm,
            ]}
          >
            <Text style={styles.helperText}>
              {workspace?.ownerAlertStatus.pushEnabled
                ? `Owner and incident alerts are live${workspace.ownerAlertStatus.updatedAt ? ` as of ${new Date(workspace.ownerAlertStatus.updatedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}.` : '.'}`
                : 'Owner alerts are currently off for this device.'}
            </Text>
            {Platform.OS === 'web' ? (
              <Text style={styles.helperText}>
                Push alerts require the native iOS or Android app. Download the app to receive
                instant review, report, and incident alerts on your device.
              </Text>
            ) : (
              <Pressable
                disabled={preview || isSaving}
                onPress={() => {
                  void enableAlerts().catch((err: unknown) => {
                    const message = err instanceof Error ? err.message : 'Failed to enable alerts.';
                    if (typeof alert === 'function') {
                      alert(message);
                    }
                  });
                }}
                style={[styles.primaryButton, (preview || isSaving) && styles.buttonDisabled]}
              >
                <Text style={styles.primaryButtonText}>
                  {preview ? 'Preview Only' : isSaving ? 'Enabling...' : 'Enable Fast Alerts'}
                </Text>
              </Pressable>
            )}
          </View>
        </SectionCard>
      </MotionInView>

      {workspace?.patternFlags?.length ? (
        <MotionInView delay={240}>
          <SectionCard
            title="Flag patterns"
            body="These signals call out review or moderation patterns worth acting on first."
          >
            <View style={styles.cardStack}>
              {workspace.patternFlags.map((flag) => (
                <View
                  key={flag.id}
                  style={[
                    styles.actionTile,
                    flag.tone === 'warning'
                      ? styles.resultWarning
                      : flag.tone === 'success'
                        ? styles.resultSuccess
                        : null,
                  ]}
                >
                  <View style={styles.splitHeaderRow}>
                    <View style={styles.splitHeaderCopy}>
                      <Text style={styles.actionTileMeta}>Priority signal</Text>
                      <Text style={styles.actionTileTitle}>{flag.title}</Text>
                      <Text style={styles.actionTileBody}>{flag.body}</Text>
                    </View>
                    <AppUiIcon
                      name={
                        flag.tone === 'warning' ? 'warning-outline' : 'checkmark-circle-outline'
                      }
                      size={20}
                      color={flag.tone === 'warning' ? '#FFB4A8' : '#00F58C'}
                    />
                  </View>
                </View>
              ))}
            </View>
          </SectionCard>
        </MotionInView>
      ) : null}

      <MotionInView delay={300}>
        <SectionCard
          title="Recent reviews"
          body="Responding fast helps the listing look active and trustworthy."
        >
          <View style={styles.cardStack}>
            {reviews.length ? (
              reviews.map((review) => (
                <View
                  key={review.id}
                  style={[styles.actionTile, review.isLowRating ? styles.resultWarning : null]}
                >
                  <View style={styles.splitHeaderRow}>
                    <View style={styles.splitHeaderCopy}>
                      <Text style={styles.actionTileMeta}>
                        {review.isLowRating ? 'Low-rating review' : 'Recent review'}
                      </Text>
                      <Text style={styles.actionTileTitle}>
                        {review.authorName} | {review.rating.toFixed(1)} stars
                      </Text>
                      <Text style={styles.actionTileBody}>{review.relativeTime}</Text>
                    </View>
                    <AppUiIcon
                      name={review.isLowRating ? 'alert-circle-outline' : 'chatbubble-outline'}
                      size={20}
                      color={review.isLowRating ? '#FFB4A8' : '#9CC5B4'}
                    />
                  </View>
                  <Text style={styles.helperText}>{review.text}</Text>
                  {review.tags.length ? (
                    <View style={styles.tagRow}>
                      {review.tags.map((tag) => (
                        <View key={`${review.id}-${tag}`} style={styles.tag}>
                          <Text style={styles.tagText}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  {review.ownerReply?.text ? (
                    <View style={styles.fileCard}>
                      <Text style={styles.resultTitle}>
                        Reply sent by {review.ownerReply.ownerDisplayName ?? 'Owner'}
                      </Text>
                      <Text style={styles.helperText}>{review.ownerReply.text}</Text>
                    </View>
                  ) : (
                    <View style={styles.reviewComposerCard}>
                      <Text style={styles.fieldLabel}>Reply draft</Text>
                      <TextInput
                        value={replyDrafts[review.id] ?? ''}
                        onChangeText={(value) =>
                          setReplyDrafts((current) => ({
                            ...current,
                            [review.id]: value,
                          }))
                        }
                        placeholder="Write a thoughtful owner reply"
                        placeholderTextColor={colors.textSoft}
                        multiline={true}
                        style={[styles.inputPremium, styles.textAreaPremium]}
                      />
                      <View style={styles.inlineActionRow}>
                        <Pressable
                          disabled={preview || isAiLoading}
                          onPress={() => {
                            void draftReviewReplyWithAi(review.id, {
                              tone: review.isLowRating ? 'make-it-right' : 'warm',
                            })
                              .then((draft) => {
                                setReplyDrafts((current) => ({
                                  ...current,
                                  [review.id]: draft.text,
                                }));
                              })
                              .catch((err: unknown) => {
                                const message =
                                  err instanceof Error ? err.message : 'Failed to draft reply.';
                                if (typeof alert === 'function') {
                                  alert(message);
                                }
                              });
                          }}
                          style={[
                            styles.secondaryButton,
                            styles.inlineButton,
                            (preview || isAiLoading) && styles.buttonDisabled,
                          ]}
                        >
                          <Text style={styles.secondaryButtonText}>
                            {preview
                              ? 'Preview Only'
                              : isAiLoading
                                ? 'Drafting...'
                                : 'Draft With AI'}
                          </Text>
                        </Pressable>
                      </View>
                      <Pressable
                        disabled={
                          preview ||
                          isSaving ||
                          !reviewRepliesEnabled ||
                          !(replyDrafts[review.id] ?? '').trim()
                        }
                        onPress={() => {
                          void replyToReview(review.id, (replyDrafts[review.id] ?? '').trim())
                            .then(() => {
                              setReplyDrafts((current) => ({
                                ...current,
                                [review.id]: '',
                              }));
                            })
                            .catch((err: unknown) => {
                              const message =
                                err instanceof Error ? err.message : 'Failed to send reply.';
                              if (typeof alert === 'function') {
                                alert(message);
                              }
                            });
                        }}
                        style={[
                          styles.primaryButton,
                          (preview ||
                            isSaving ||
                            !reviewRepliesEnabled ||
                            !(replyDrafts[review.id] ?? '').trim()) &&
                            styles.buttonDisabled,
                        ]}
                      >
                        <Text style={styles.primaryButtonText}>
                          {preview
                            ? 'Preview Only'
                            : !reviewRepliesEnabled
                              ? 'Replies Paused'
                              : isSaving
                                ? 'Saving...'
                                : 'Send Reply'}
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              ))
            ) : (
              <View style={styles.emptyStateCard}>
                <Text style={styles.emptyStateTitle}>No owner-facing reviews yet</Text>
                <Text style={styles.emptyStateBody}>
                  The inbox is calm right now. New customer reviews will appear here with reply
                  space directly beneath each card.
                </Text>
              </View>
            )}
          </View>
        </SectionCard>
      </MotionInView>

      <MotionInView delay={360}>
        <SectionCard
          title="Recent reports"
          body="Reports do not earn customer points, but they do affect trust and should be checked quickly."
        >
          <View style={styles.cardStack}>
            {reports.length ? (
              reports.map((report) => (
                <View
                  key={report.id}
                  style={[
                    styles.actionTile,
                    report.moderationStatus === 'open' ? styles.resultWarning : null,
                  ]}
                >
                  <View style={styles.splitHeaderRow}>
                    <View style={styles.splitHeaderCopy}>
                      <Text style={styles.actionTileMeta}>Moderation report</Text>
                      <Text style={styles.actionTileTitle}>{report.reason}</Text>
                      <Text style={styles.actionTileBody}>
                        {report.authorName} |{' '}
                        {new Date(report.createdAt).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true,
                        })}
                      </Text>
                    </View>
                    <AppUiIcon
                      name={
                        report.moderationStatus === 'open'
                          ? 'shield-outline'
                          : 'checkmark-done-circle-outline'
                      }
                      size={20}
                      color={report.moderationStatus === 'open' ? '#FFB4A8' : '#00F58C'}
                    />
                  </View>
                  <Text style={styles.helperText}>{report.description}</Text>
                  <Text style={styles.resultMeta}>
                    Status: {report.moderationStatus.replace(/_/g, ' ')}
                  </Text>
                </View>
              ))
            ) : (
              <View style={styles.emptyStateCard}>
                <Text style={styles.emptyStateTitle}>No storefront reports waiting</Text>
                <Text style={styles.emptyStateBody}>
                  Moderation is currently quiet. When new reports come in, they will land here with
                  the most urgent items reading visually louder first.
                </Text>
              </View>
            )}
          </View>
        </SectionCard>
      </MotionInView>
    </ScreenShell>
  );
}

export const OwnerPortalReviewInboxScreen = withScreenErrorBoundary(
  OwnerPortalReviewInboxScreenInner,
  'owner-portal-reviews',
);
