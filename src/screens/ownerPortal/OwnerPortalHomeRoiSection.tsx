import React from 'react';
import { Platform, Text, View } from 'react-native';
import { InlineFeedbackPanel } from '../../components/InlineFeedbackPanel';
import { AppUiIcon } from '../../icons/AppUiIcon';
import type { OwnerPortalWorkspaceDocument } from '../../types/ownerPortal';
import { OwnerPortalAnalyticsCard } from './OwnerPortalAnalyticsCard';
import type { OwnerPortalHomeDerivedMetrics } from './ownerPortalHomeData';
import {
  clampProgress,
  formatCount,
  formatRate,
  getRelativeProgress,
} from './ownerPortalMetricUtils';
import { ownerPortalStyles as styles } from './ownerPortalStyles';

export function OwnerPortalHomeRoiSection({
  isLoading,
  errorText,
  workspace,
  metrics,
}: {
  isLoading: boolean;
  errorText: string | null;
  workspace: OwnerPortalWorkspaceDocument | null;
  metrics: OwnerPortalHomeDerivedMetrics;
}) {
  if (isLoading) {
    return (
      <InlineFeedbackPanel
        tone="info"
        iconName="stats-chart-outline"
        label="Storefront activity"
        title="Loading your storefront activity"
        body="Pulling together recent views, taps, and review activity."
      />
    );
  }

  if (errorText) {
    return (
      <InlineFeedbackPanel
        tone="danger"
        iconName="alert-circle-outline"
        label="Storefront activity"
        title="Could not load storefront activity"
        body={errorText}
      />
    );
  }

  if (!workspace) {
    return null;
  }

  return (
    <View style={styles.list}>
      <View style={styles.summaryStrip}>
        <View style={styles.summaryTile}>
          <Text style={styles.summaryTileValue}>
            {formatCount(workspace.metrics.storefrontImpressions7d)}
          </Text>
          <Text style={styles.summaryTileLabel}>Views This Week</Text>
          <Text style={styles.summaryTileBody}>
            How often people saw this storefront in the app this week.
          </Text>
        </View>
        <View style={styles.summaryTile}>
          <Text style={styles.summaryTileValue}>{formatRate(metrics.openRate)}</Text>
          <Text style={styles.summaryTileLabel}>Open Rate</Text>
          <Text style={styles.summaryTileBody}>
            How often a storefront view turned into a full open.
          </Text>
        </View>
        <View style={styles.summaryTile}>
          <Text style={styles.summaryTileValue}>{formatCount(metrics.totalActions7d)}</Text>
          <Text style={styles.summaryTileLabel}>Customer Actions</Text>
          <Text style={styles.summaryTileBody}>
            Directions, website, {Platform.OS === 'android' ? 'website,' : 'menu,'} and phone taps
            combined.
          </Text>
        </View>
        <View style={styles.summaryTile}>
          <Text style={styles.summaryTileValue}>
            {workspace.metrics.averageRating?.toFixed(1) ?? 'New'}
          </Text>
          <Text style={styles.summaryTileLabel}>Average Rating</Text>
          <Text style={styles.summaryTileBody}>The rating customers currently see.</Text>
        </View>
      </View>

      <View style={styles.analyticsSectionCard}>
        <View style={styles.analyticsSectionHeader}>
          <Text style={styles.analyticsSectionEyebrow}>Reach</Text>
          <Text style={styles.analyticsSectionTitle}>
            Start with how many people are seeing and opening your storefront.
          </Text>
          <Text style={styles.analyticsSectionBody}>
            These numbers show how often people discover your storefront and how often they tap in.
          </Text>
        </View>
        <View style={styles.metricGrid}>
          <OwnerPortalAnalyticsCard
            body="How often your storefront appeared across the app."
            eyebrow="Reach"
            icon="sparkles-outline"
            progress={getRelativeProgress(
              workspace.metrics.storefrontImpressions7d,
              metrics.visibilityMax,
            )}
            progressLabel="Compared with your other storefront numbers"
            stats={[
              { label: 'Store opens', value: formatCount(workspace.metrics.storefrontOpenCount7d) },
              { label: 'Open rate', value: formatRate(metrics.openRate) },
            ]}
            title="Views This Week"
            tone="warm"
            value={formatCount(workspace.metrics.storefrontImpressions7d)}
          />
          <OwnerPortalAnalyticsCard
            body="How many people opened the storefront after seeing it in the app."
            eyebrow="Attention"
            icon="open-outline"
            progress={clampProgress(metrics.openRate / 100)}
            progressLabel="Share of views that become storefront opens"
            stats={[
              {
                label: 'From views',
                value: formatCount(workspace.metrics.storefrontImpressions7d),
              },
              { label: 'Followers', value: formatCount(workspace.metrics.followerCount) },
            ]}
            title="Opens This Week"
            tone="success"
            value={formatCount(workspace.metrics.storefrontOpenCount7d)}
          />
          <OwnerPortalAnalyticsCard
            body={
              Platform.OS === 'android'
                ? 'People who saved the storefront and may come back for future updates.'
                : 'People who saved the storefront and may come back for future offers.'
            }
            eyebrow="Saved"
            icon="bookmark-outline"
            progress={getRelativeProgress(workspace.metrics.followerCount, metrics.visibilityMax)}
            progressLabel="Size of your saved audience"
            stats={[
              {
                label: Platform.OS === 'android' ? 'Active updates' : 'Active offers',
                value: formatCount(metrics.activePromotionCount),
              },
              {
                label: 'Reviews this month',
                value: formatCount(workspace.metrics.reviewCount30d),
              },
            ]}
            title="Saved Followers"
            tone="cyan"
            value={formatCount(workspace.metrics.followerCount)}
          />
          <OwnerPortalAnalyticsCard
            body="Recent customer reviews that help build trust."
            eyebrow="Reviews"
            icon="chatbubble-ellipses-outline"
            progress={getRelativeProgress(workspace.metrics.reviewCount30d, metrics.visibilityMax)}
            progressLabel="Recent review activity"
            stats={[
              {
                label: 'Average rating',
                value: workspace.metrics.averageRating?.toFixed(1) ?? 'New',
              },
              { label: 'Reply rate', value: formatRate(workspace.metrics.replyRate * 100) },
            ]}
            title="Reviews This Month"
            tone="rose"
            value={formatCount(workspace.metrics.reviewCount30d)}
          />
        </View>
      </View>

      <View style={styles.analyticsSectionCard}>
        <View style={styles.analyticsSectionHeader}>
          <Text style={styles.analyticsSectionEyebrow}>What customers do next</Text>
          <Text style={styles.analyticsSectionTitle}>
            See which actions people take after opening your storefront.
          </Text>
          <Text style={styles.analyticsSectionBody}>
            This makes it easier to tell whether people want directions, want to browse more, or
            want to contact you directly.
          </Text>
        </View>
        <View style={styles.metricGrid}>
          <OwnerPortalAnalyticsCard
            body="People starting directions to visit the storefront."
            eyebrow="Directions"
            icon="navigate-outline"
            progress={getRelativeProgress(workspace.metrics.routeStarts7d, metrics.actionMixMax)}
            progressLabel="Share of total customer actions"
            stats={[
              { label: 'Of opens', value: formatRate(workspace.metrics.openToRouteRate) },
              { label: 'Total this week', value: formatCount(metrics.totalActions7d) },
            ]}
            title="Directions This Week"
            tone="warm"
            value={formatCount(workspace.metrics.routeStarts7d)}
          />
          <OwnerPortalAnalyticsCard
            body="People leaving the storefront to visit your website."
            eyebrow="Website"
            icon="globe-outline"
            progress={getRelativeProgress(
              workspace.metrics.websiteTapCount7d,
              metrics.actionMixMax,
            )}
            progressLabel="Share of total customer actions"
            stats={[
              { label: 'Of opens', value: formatRate(workspace.metrics.openToWebsiteRate) },
              { label: 'Store opens', value: formatCount(workspace.metrics.storefrontOpenCount7d) },
            ]}
            title="Website Taps This Week"
            tone="cyan"
            value={formatCount(workspace.metrics.websiteTapCount7d)}
          />
          <OwnerPortalAnalyticsCard
            body={
              Platform.OS === 'android'
                ? 'People opening the business website from the storefront.'
                : 'People checking the live menu from the storefront.'
            }
            eyebrow={Platform.OS === 'android' ? 'Website' : 'Menu'}
            icon="restaurant-outline"
            progress={getRelativeProgress(workspace.metrics.menuTapCount7d, metrics.actionMixMax)}
            progressLabel="Share of total customer actions"
            stats={[
              {
                label: 'Of opens',
                value: formatRate(workspace.metrics.openToMenuRate),
              },
              { label: 'Followers', value: formatCount(workspace.metrics.followerCount) },
            ]}
            title={Platform.OS === 'android' ? 'Website Taps This Week' : 'Menu Taps This Week'}
            tone="success"
            value={formatCount(workspace.metrics.menuTapCount7d)}
          />
          <OwnerPortalAnalyticsCard
            body="People calling the business from the storefront."
            eyebrow="Calls"
            icon="call-outline"
            progress={getRelativeProgress(workspace.metrics.phoneTapCount7d, metrics.actionMixMax)}
            progressLabel="Share of total customer actions"
            stats={[
              { label: 'Of opens', value: formatRate(workspace.metrics.openToPhoneRate) },
              {
                label: Platform.OS === 'android' ? 'Active updates' : 'Active offers',
                value: formatCount(metrics.activePromotionCount),
              },
            ]}
            title="Phone Calls This Week"
            tone="rose"
            value={formatCount(workspace.metrics.phoneTapCount7d)}
          />
        </View>
      </View>

      <View style={styles.analyticsSectionCard}>
        <View style={styles.analyticsSectionHeader}>
          <Text style={styles.analyticsSectionEyebrow}>Store health</Text>
          <Text style={styles.analyticsSectionTitle}>
            {Platform.OS === 'android'
              ? 'Keep an eye on reputation, replies, reports, and live updates.'
              : 'Keep an eye on reputation, replies, reports, and live offers.'}
          </Text>
          <Text style={styles.analyticsSectionBody}>
            These signals help you spot what needs attention without digging through every section.
          </Text>
        </View>
        <View style={styles.metricGrid}>
          <OwnerPortalAnalyticsCard
            body="Your average customer rating from recent reviews."
            eyebrow="Rating"
            icon="star-outline"
            progress={clampProgress((workspace.metrics.averageRating ?? 0) / 5)}
            progressLabel="Based on a five-star scale"
            stats={[
              { label: 'Reply rate', value: formatRate(workspace.metrics.replyRate * 100) },
              {
                label: 'Reviews this month',
                value: formatCount(workspace.metrics.reviewCount30d),
              },
            ]}
            title="Average Rating"
            tone="warm"
            value={workspace.metrics.averageRating?.toFixed(1) ?? 'New'}
          />
          <OwnerPortalAnalyticsCard
            body="How often recent reviews already have a reply."
            eyebrow="Replies"
            icon="send-outline"
            progress={clampProgress(workspace.metrics.replyRate)}
            progressLabel="Share of recent reviews with replies"
            stats={[
              {
                label: 'Low-rating focus',
                value: formatCount(
                  workspace.recentReviews.filter((review) => review.isLowRating).length,
                ),
              },
              { label: 'Open reports', value: formatCount(workspace.metrics.openReportCount) },
            ]}
            title="Reply Rate"
            tone="success"
            value={formatRate(workspace.metrics.replyRate * 100)}
          />
          <OwnerPortalAnalyticsCard
            body="Reports that still need attention."
            eyebrow="Reports"
            icon="warning-outline"
            progress={getRelativeProgress(
              workspace.metrics.openReportCount,
              metrics.responseMixMax,
            )}
            progressLabel="How many reports still need attention"
            stats={[
              { label: 'Recent reports', value: formatCount(workspace.recentReports.length) },
              { label: 'Recent reviews', value: formatCount(workspace.recentReviews.length) },
            ]}
            title="Open Reports"
            tone="rose"
            value={formatCount(workspace.metrics.openReportCount)}
          />
          <OwnerPortalAnalyticsCard
            body={
              Platform.OS === 'android'
                ? 'Updates that are currently live for customers.'
                : 'Offers that are currently live for customers.'
            }
            eyebrow={Platform.OS === 'android' ? 'Updates' : 'Offers'}
            icon="pricetags-outline"
            progress={getRelativeProgress(metrics.activePromotionCount, metrics.responseMixMax)}
            progressLabel={
              Platform.OS === 'android'
                ? 'How many updates are live right now'
                : 'How many offers are live right now'
            }
            stats={[
              {
                label: Platform.OS === 'android' ? 'Tracked updates' : 'Tracked offers',
                value: formatCount(workspace.promotionPerformance.length),
              },
              {
                label: 'Top action',
                value: metrics.topPromotion
                  ? formatRate(metrics.topPromotion.metrics.actionRate)
                  : '0%',
              },
            ]}
            title={Platform.OS === 'android' ? 'Active Updates' : 'Active Offers'}
            tone="cyan"
            value={formatCount(metrics.activePromotionCount)}
          />
        </View>
      </View>

      {metrics.topPromotion ? (
        <View style={styles.analyticsSpotlightCard}>
          <View style={styles.analyticsSpotlightHeader}>
            <View style={styles.splitHeaderCopy}>
              <Text style={styles.sectionEyebrow}>
                {Platform.OS === 'android' ? 'Top update right now' : 'Top offer right now'}
              </Text>
              <Text style={styles.splitHeaderTitle}>{metrics.topPromotion.title}</Text>
              <Text style={styles.analyticsSpotlightBody}>
                {Platform.OS === 'android'
                  ? 'This is the update getting the strongest response right now.'
                  : 'This is the offer getting the strongest response right now.'}
              </Text>
            </View>
            <AppUiIcon name="trophy-outline" size={22} color="#F5C86A" />
          </View>
          <Text style={styles.analyticsSpotlightValue}>
            {formatRate(metrics.topPromotion.metrics.actionRate)}
          </Text>
          <View style={styles.metricProgressTrack}>
            <View
              style={[
                styles.metricProgressFill,
                styles.metricProgressFillWarm,
                {
                  width: `${Math.max(
                    clampProgress(metrics.topPromotion.metrics.actionRate / 100) * 100,
                    metrics.topPromotion.metrics.actionRate > 0 ? 12 : 0,
                  )}%`,
                },
              ]}
            />
          </View>
          <Text style={styles.metricProgressLabel}>
            {Platform.OS === 'android'
              ? 'Action rate across the current update set'
              : 'Action rate across the current promotion set'}
          </Text>
          <View style={styles.analyticsInlineStats}>
            <View style={styles.analyticsInlineStat}>
              <Text style={styles.analyticsInlineStatValue}>
                {formatCount(metrics.topPromotion.metrics.impressions)}
              </Text>
              <Text style={styles.analyticsInlineStatLabel}>Impressions</Text>
            </View>
            <View style={styles.analyticsInlineStat}>
              <Text style={styles.analyticsInlineStatValue}>
                {formatCount(metrics.topPromotion.metrics.opens)}
              </Text>
              <Text style={styles.analyticsInlineStatLabel}>Opens</Text>
            </View>
            <View style={styles.analyticsInlineStat}>
              <Text style={styles.analyticsInlineStatValue}>
                {formatCount(metrics.topPromotionTrackedActions)}
              </Text>
              <Text style={styles.analyticsInlineStatLabel}>Tracked Actions</Text>
            </View>
            <View style={styles.analyticsInlineStat}>
              <Text style={styles.analyticsInlineStatValue}>
                {metrics.topPromotion.status.toUpperCase()}
              </Text>
              <Text style={styles.analyticsInlineStatLabel}>Status</Text>
            </View>
          </View>
          <Text style={styles.resultMeta}>
            Route starts {metrics.topPromotion.metrics.redeemStarts} | Website taps{' '}
            {metrics.topPromotion.metrics.websiteTaps} |{' '}
            {Platform.OS === 'android' ? 'Website' : 'Menu'} taps{' '}
            {metrics.topPromotion.metrics.menuTaps} | Phone taps{' '}
            {metrics.topPromotion.metrics.phoneTaps}
          </Text>
        </View>
      ) : (
        <View style={styles.emptyStateCard}>
          <Text style={styles.emptyStateTitle}>
            {Platform.OS === 'android' ? 'No standout update yet' : 'No standout offer yet'}
          </Text>
          <Text style={styles.emptyStateBody}>
            {Platform.OS === 'android'
              ? 'Once your updates start getting activity, the best-performing one will show up here.'
              : 'Once your offers start getting activity, the best-performing one will show up here.'}
          </Text>
        </View>
      )}

      {workspace.patternFlags.length ? (
        <View style={styles.analyticsSectionCard}>
          <View style={styles.analyticsSectionHeader}>
            <Text style={styles.analyticsSectionEyebrow}>Worth your attention</Text>
            <Text style={styles.analyticsSectionTitle}>
              The next things worth checking show up here first.
            </Text>
            <Text style={styles.analyticsSectionBody}>
              Use these notes to decide what to fix or follow up on next.
            </Text>
          </View>
          <View style={styles.list}>
            <Text style={styles.resultTitle}>What to look at next</Text>
            {workspace.patternFlags.map((flag) => (
              <View
                key={flag.id}
                style={[
                  styles.resultCard,
                  flag.tone === 'warning'
                    ? styles.resultWarning
                    : flag.tone === 'success'
                      ? styles.resultSuccess
                      : null,
                ]}
              >
                <Text style={styles.resultTitle}>{flag.title}</Text>
                <Text style={styles.helperText}>{flag.body}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <View style={styles.emptyStateCard}>
          <Text style={styles.emptyStateTitle}>Nothing urgent right now</Text>
          <Text style={styles.emptyStateBody}>
            {Platform.OS === 'android'
              ? 'Reviews, reports, and updates all look calm right now. If something needs attention, it will show up here first.'
              : 'Reviews, reports, and offers all look calm right now. If something needs attention, it will show up here first.'}
          </Text>
        </View>
      )}
    </View>
  );
}
