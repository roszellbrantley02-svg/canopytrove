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
        label="Workspace state"
        title="Loading owner metrics"
        body="Canopy Trove is assembling the storefront analytics and operator signal stack."
      />
    );
  }

  if (errorText) {
    return (
      <InlineFeedbackPanel
        tone="danger"
        iconName="alert-circle-outline"
        label="Workspace issue"
        title="Owner metrics could not load"
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
          <Text style={styles.summaryTileLabel}>Visibility 7D</Text>
          <Text style={styles.summaryTileBody}>
            App impressions generated for this storefront in the last week.
          </Text>
        </View>
        <View style={styles.summaryTile}>
          <Text style={styles.summaryTileValue}>{formatRate(metrics.openRate)}</Text>
          <Text style={styles.summaryTileLabel}>Open Rate</Text>
          <Text style={styles.summaryTileBody}>
            Share of storefront views that turned into listing opens.
          </Text>
        </View>
        <View style={styles.summaryTile}>
          <Text style={styles.summaryTileValue}>{formatCount(metrics.totalActions7d)}</Text>
          <Text style={styles.summaryTileLabel}>Action Intent 7D</Text>
          <Text style={styles.summaryTileBody}>
            Route, website, {Platform.OS === 'android' ? 'website,' : 'menu,'} and phone intent
            combined.
          </Text>
        </View>
        <View style={styles.summaryTile}>
          <Text style={styles.summaryTileValue}>
            {workspace.metrics.averageRating?.toFixed(1) ?? 'New'}
          </Text>
          <Text style={styles.summaryTileLabel}>Trust Signal</Text>
          <Text style={styles.summaryTileBody}>
            Average rating with owner response quality layered in.
          </Text>
        </View>
      </View>

      <View style={styles.analyticsSectionCard}>
        <View style={styles.analyticsSectionHeader}>
          <Text style={styles.analyticsSectionEyebrow}>Visibility and discovery</Text>
          <Text style={styles.analyticsSectionTitle}>
            The premium listing story starts with reach, attention, and retention.
          </Text>
          <Text style={styles.analyticsSectionBody}>
            These KPIs tell you how often the storefront is surfaced and whether customers are
            staying close enough to act later.
          </Text>
        </View>
        <View style={styles.metricGrid}>
          <OwnerPortalAnalyticsCard
            body="How often Canopy Trove surfaced this storefront across customer discovery surfaces."
            eyebrow="Reach"
            icon="sparkles-outline"
            progress={getRelativeProgress(
              workspace.metrics.storefrontImpressions7d,
              metrics.visibilityMax,
            )}
            progressLabel="Relative visibility inside this owner KPI set"
            stats={[
              { label: 'Store opens', value: formatCount(workspace.metrics.storefrontOpenCount7d) },
              { label: 'Open rate', value: formatRate(metrics.openRate) },
            ]}
            title="Impressions 7D"
            tone="warm"
            value={formatCount(workspace.metrics.storefrontImpressions7d)}
          />
          <OwnerPortalAnalyticsCard
            body="Customers who opened the storefront after seeing it in the app."
            eyebrow="Attention"
            icon="open-outline"
            progress={clampProgress(metrics.openRate / 100)}
            progressLabel="View-to-open conversion"
            stats={[
              {
                label: 'From views',
                value: formatCount(workspace.metrics.storefrontImpressions7d),
              },
              { label: 'Followers', value: formatCount(workspace.metrics.followerCount) },
            ]}
            title="Store Opens 7D"
            tone="success"
            value={formatCount(workspace.metrics.storefrontOpenCount7d)}
          />
          <OwnerPortalAnalyticsCard
            body="People ready to hear when a new deal or premium placement goes live."
            eyebrow="Retention"
            icon="bookmark-outline"
            progress={getRelativeProgress(workspace.metrics.followerCount, metrics.visibilityMax)}
            progressLabel="Saved audience depth"
            stats={[
              { label: 'Active offers', value: formatCount(metrics.activePromotionCount) },
              { label: 'Reviews 30D', value: formatCount(workspace.metrics.reviewCount30d) },
            ]}
            title="Saved Followers"
            tone="cyan"
            value={formatCount(workspace.metrics.followerCount)}
          />
          <OwnerPortalAnalyticsCard
            body="Fresh social proof generated from active customer visits in the last month."
            eyebrow="Proof"
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
            title="Reviews 30D"
            tone="rose"
            value={formatCount(workspace.metrics.reviewCount30d)}
          />
        </View>
      </View>

      <View style={styles.analyticsSectionCard}>
        <View style={styles.analyticsSectionHeader}>
          <Text style={styles.analyticsSectionEyebrow}>Action mix</Text>
          <Text style={styles.analyticsSectionTitle}>
            Customer intent is easier to scan when each action has a role.
          </Text>
          <Text style={styles.analyticsSectionBody}>
            Use the mix below to see whether traffic is leaning toward navigation, website
            exploration,{' '}
            {Platform.OS === 'android' ? 'additional website visits,' : 'menu browsing,'} or direct
            phone contact.
          </Text>
        </View>
        <View style={styles.metricGrid}>
          <OwnerPortalAnalyticsCard
            body="Customers starting directions to visit the storefront."
            eyebrow="Visit intent"
            icon="navigate-outline"
            progress={getRelativeProgress(workspace.metrics.routeStarts7d, metrics.actionMixMax)}
            progressLabel="Share of total action mix"
            stats={[
              { label: 'Open to route', value: formatRate(workspace.metrics.openToRouteRate) },
              { label: '7D total', value: formatCount(metrics.totalActions7d) },
            ]}
            title="Route Starts 7D"
            tone="warm"
            value={formatCount(workspace.metrics.routeStarts7d)}
          />
          <OwnerPortalAnalyticsCard
            body="Outbound taps from the storefront into the business website."
            eyebrow="Web intent"
            icon="globe-outline"
            progress={getRelativeProgress(
              workspace.metrics.websiteTapCount7d,
              metrics.actionMixMax,
            )}
            progressLabel="Share of total action mix"
            stats={[
              { label: 'Open to site', value: formatRate(workspace.metrics.openToWebsiteRate) },
              { label: 'Store opens', value: formatCount(workspace.metrics.storefrontOpenCount7d) },
            ]}
            title="Website Taps 7D"
            tone="cyan"
            value={formatCount(workspace.metrics.websiteTapCount7d)}
          />
          <OwnerPortalAnalyticsCard
            body={
              Platform.OS === 'android'
                ? 'Customers choosing to visit the business website from the listing.'
                : 'Shoppers choosing to inspect live menu inventory from the listing.'
            }
            eyebrow={Platform.OS === 'android' ? 'Website intent' : 'Menu intent'}
            icon="restaurant-outline"
            progress={getRelativeProgress(workspace.metrics.menuTapCount7d, metrics.actionMixMax)}
            progressLabel="Share of total action mix"
            stats={[
              {
                label: Platform.OS === 'android' ? 'Open to site' : 'Open to menu',
                value: formatRate(workspace.metrics.openToMenuRate),
              },
              { label: 'Followers', value: formatCount(workspace.metrics.followerCount) },
            ]}
            title={Platform.OS === 'android' ? 'Website Taps 7D' : 'Menu Taps 7D'}
            tone="success"
            value={formatCount(workspace.metrics.menuTapCount7d)}
          />
          <OwnerPortalAnalyticsCard
            body="Customers escalating to direct phone contact from the storefront."
            eyebrow="Direct contact"
            icon="call-outline"
            progress={getRelativeProgress(workspace.metrics.phoneTapCount7d, metrics.actionMixMax)}
            progressLabel="Share of total action mix"
            stats={[
              { label: 'Open to phone', value: formatRate(workspace.metrics.openToPhoneRate) },
              { label: 'Active offers', value: formatCount(metrics.activePromotionCount) },
            ]}
            title="Phone Taps 7D"
            tone="rose"
            value={formatCount(workspace.metrics.phoneTapCount7d)}
          />
        </View>
      </View>

      <View style={styles.analyticsSectionCard}>
        <View style={styles.analyticsSectionHeader}>
          <Text style={styles.analyticsSectionEyebrow}>Operator signals</Text>
          <Text style={styles.analyticsSectionTitle}>
            The paid side feels strongest when trust, responsiveness, and campaign energy stay
            readable at a glance.
          </Text>
          <Text style={styles.analyticsSectionBody}>
            These signals balance reputation quality, moderation load, and live offer momentum
            without changing any underlying owner logic.
          </Text>
        </View>
        <View style={styles.metricGrid}>
          <OwnerPortalAnalyticsCard
            body="Average customer sentiment across recent Canopy Trove reviews."
            eyebrow="Reputation"
            icon="star-outline"
            progress={clampProgress((workspace.metrics.averageRating ?? 0) / 5)}
            progressLabel="Five-star scale"
            stats={[
              { label: 'Reply rate', value: formatRate(workspace.metrics.replyRate * 100) },
              { label: 'Reviews 30D', value: formatCount(workspace.metrics.reviewCount30d) },
            ]}
            title="Average Rating"
            tone="warm"
            value={workspace.metrics.averageRating?.toFixed(1) ?? 'New'}
          />
          <OwnerPortalAnalyticsCard
            body="Recent reviews that already received an owner response."
            eyebrow="Response quality"
            icon="send-outline"
            progress={clampProgress(workspace.metrics.replyRate)}
            progressLabel="Replied share of recent reviews"
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
            body="Moderation issues still waiting on owner follow-up."
            eyebrow="Risk load"
            icon="warning-outline"
            progress={getRelativeProgress(
              workspace.metrics.openReportCount,
              metrics.responseMixMax,
            )}
            progressLabel="Relative moderation pressure"
            stats={[
              { label: 'Recent reports', value: formatCount(workspace.recentReports.length) },
              { label: 'Recent reviews', value: formatCount(workspace.recentReviews.length) },
            ]}
            title="Open Reports"
            tone="rose"
            value={formatCount(workspace.metrics.openReportCount)}
          />
          <OwnerPortalAnalyticsCard
            body="Promotions currently carrying live paid visibility or action opportunity."
            eyebrow="Campaign pace"
            icon="pricetags-outline"
            progress={getRelativeProgress(metrics.activePromotionCount, metrics.responseMixMax)}
            progressLabel="Live promotion presence"
            stats={[
              {
                label: 'Tracked offers',
                value: formatCount(workspace.promotionPerformance.length),
              },
              {
                label: 'Top action',
                value: metrics.topPromotion
                  ? formatRate(metrics.topPromotion.metrics.actionRate)
                  : '0%',
              },
            ]}
            title="Active Offers"
            tone="cyan"
            value={formatCount(metrics.activePromotionCount)}
          />
        </View>
      </View>

      {metrics.topPromotion ? (
        <View style={styles.analyticsSpotlightCard}>
          <View style={styles.analyticsSpotlightHeader}>
            <View style={styles.splitHeaderCopy}>
              <Text style={styles.sectionEyebrow}>Top offer right now</Text>
              <Text style={styles.splitHeaderTitle}>{metrics.topPromotion.title}</Text>
              <Text style={styles.analyticsSpotlightBody}>
                The current leader combines the strongest action rate with the best mix of
                visibility and downstream storefront intent.
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
            Action rate across the current promotion set
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
          <Text style={styles.emptyStateTitle}>No promotion leader yet</Text>
          <Text style={styles.emptyStateBody}>
            Once owner offers start receiving meaningful activity, the best-performing promotion
            will be highlighted here for faster scanning.
          </Text>
        </View>
      )}

      {workspace.patternFlags.length ? (
        <View style={styles.analyticsSectionCard}>
          <View style={styles.analyticsSectionHeader}>
            <Text style={styles.analyticsSectionEyebrow}>Signals to act on</Text>
            <Text style={styles.analyticsSectionTitle}>
              The next owner tasks worth attention surface here first.
            </Text>
            <Text style={styles.analyticsSectionBody}>
              These alerts keep moderation, promotion, and review priorities readable without
              changing any existing decision logic.
            </Text>
          </View>
          <View style={styles.list}>
            <Text style={styles.resultTitle}>Signals to act on</Text>
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
          <Text style={styles.emptyStateTitle}>No urgent owner signals</Text>
          <Text style={styles.emptyStateBody}>
            Review, moderation, and promotion signals are currently calm. This section will surface
            the next issues worth acting on first.
          </Text>
        </View>
      )}
    </View>
  );
}
