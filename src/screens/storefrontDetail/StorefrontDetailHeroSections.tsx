import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { LocationPinIcon } from '../../icons/AppIcons';
import type { AppUiIconName } from '../../icons/AppUiIcon';
import { AppUiIcon } from '../../icons/AppUiIcon';
import { CustomerStateCard } from '../../components/CustomerStateCard';
import { SectionCard } from '../../components/SectionCard';
import { colors } from '../../theme/tokens';
import type { StorefrontSummary } from '../../types/storefront';
import type { StorefrontRatingDisplay } from '../../utils/storefrontRatings';
import {
  getHeatColor,
  getHeatLabel,
  routeStartsToHeatLevel,
} from '../../components/storefrontRouteCard/StorefrontHeatGlow';
import { styles } from './storefrontDetailStyles';

type OperationalRow = {
  id: string;
  icon: AppUiIconName;
  label: string;
  value: string;
  status: 'available' | 'checking' | 'unavailable';
  /**
   * When set, the entire row becomes tappable. Used to make Phone /
   * Website / Menu rows perform their action directly (call, open URL,
   * open menu) so the redundant button row below is no longer needed.
   * For Hours, used to toggle expanded state.
   */
  onPress?: () => void;
  /**
   * When true, the row renders a chevron and (when `expanded` is true)
   * unfolds `expandedLines` directly below the row. Used by the Hours
   * row so the full week is reachable from a single tap.
   */
  expandable?: boolean;
  expanded?: boolean;
  expandedLines?: string[];
  /**
   * Accessibility label override — when the row's `value` is a phone
   * number or URL, screen readers benefit from something more
   * descriptive than the value alone.
   */
  accessibilityHint?: string;
};

type DetailHeroProps = {
  storefront: StorefrontSummary;
  ratingDisplay: StorefrontRatingDisplay;
};

export function DetailTopBar({
  onBack,
  verifiedOwnerBadgeLabel,
}: {
  onBack: () => void;
  verifiedOwnerBadgeLabel: string | null;
}) {
  return (
    <View style={styles.topBar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back to storefront results"
        accessibilityHint="Returns to the previous screen."
        onPress={onBack}
        style={styles.headerBadge}
      >
        <AppUiIcon name="arrow-back" size={16} color={colors.text} />
        <Text style={styles.headerBadgeText}>Back to results</Text>
      </Pressable>
      {verifiedOwnerBadgeLabel ? (
        <View style={styles.headerBadge}>
          <AppUiIcon name="shield-checkmark" size={14} color={colors.primary} />
          <Text numberOfLines={1} style={styles.headerBadgeText}>
            {verifiedOwnerBadgeLabel}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export function DetailHero({ storefront, ratingDisplay }: DetailHeroProps) {
  const heatLevel = routeStartsToHeatLevel(storefront.routeStartsPerHour ?? 0);
  const heatLabel = getHeatLabel(heatLevel);
  const heatColor = getHeatColor(heatLevel);
  const heatChipBorderStyle = heatLabel ? { borderColor: `${heatColor}33` } : undefined;
  const heatTextColorStyle = heatLabel ? { color: heatColor } : undefined;
  const summaryItems = [
    {
      id: 'rating',
      label: 'Rating',
      value: ratingDisplay.badgeLabel,
      body: ratingDisplay.helperLabel ?? 'Average rating from customer reviews.',
    },
    {
      id: 'reviews',
      label: 'Reviews',
      value: ratingDisplay.countLabel,
      body: 'How many customer reviews this storefront has so far.',
    },
    {
      id: 'distance',
      label: 'Distance',
      value: `${storefront.distanceMiles.toFixed(1)} mi`,
      body: 'About how far this storefront is from the location you are using.',
    },
    ...(typeof storefront.favoriteFollowerCount === 'number'
      ? [
          {
            id: 'saved',
            label: 'Following',
            value: `${storefront.favoriteFollowerCount}`,
            body: 'People following this storefront for updates.',
          },
        ]
      : []),
  ];

  return (
    <View style={styles.hero}>
      <View pointerEvents="none" style={styles.heroTone} />
      <Text style={styles.heroKicker}>Storefront details</Text>
      <Text numberOfLines={2} style={styles.title}>
        {storefront.displayName}
      </Text>
      <Text numberOfLines={1} style={styles.address}>
        {storefront.addressLine1}, {storefront.city}, {storefront.state} {storefront.zip}
      </Text>

      <View style={styles.heroSummaryStrip}>
        {summaryItems.map((item) => (
          <View key={item.id} style={styles.heroSummaryTile}>
            <Text numberOfLines={1} style={styles.heroSummaryValue}>
              {item.value}
            </Text>
            <Text numberOfLines={1} style={styles.heroSummaryLabel}>
              {item.label}
            </Text>
            <Text numberOfLines={2} style={styles.heroSummaryBody}>
              {item.body}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaChip}>
          <AppUiIcon
            name={ratingDisplay.isReady ? 'star' : 'star-outline'}
            size={12}
            color={ratingDisplay.isReady ? colors.gold : colors.textSoft}
          />
          <Text numberOfLines={1} style={styles.metaText}>
            {ratingDisplay.badgeLabel}
          </Text>
        </View>
        <View style={styles.metaChip}>
          <AppUiIcon name="people-outline" size={12} color={colors.cyan} />
          <Text numberOfLines={1} style={styles.metaText}>
            {ratingDisplay.countLabel}
          </Text>
        </View>
        <View style={styles.metaChip}>
          <LocationPinIcon size={14} color={colors.goldSoft} />
          <Text numberOfLines={1} style={styles.metaText}>
            {storefront.distanceMiles.toFixed(1)} mi away
          </Text>
        </View>
        {heatLabel ? (
          <View style={[styles.metaChip, heatChipBorderStyle]}>
            <AppUiIcon name="flame" size={12} color={heatColor} />
            <Text numberOfLines={1} style={[styles.metaText, heatTextColorStyle]}>
              {heatLabel}
            </Text>
          </View>
        ) : null}
      </View>

      {ratingDisplay.helperLabel ? (
        <Text numberOfLines={1} style={styles.ratingHelperText}>
          {ratingDisplay.helperLabel}
        </Text>
      ) : null}

      {storefront.ownerFeaturedBadges?.length ? (
        <View style={styles.ownerBadgeRow}>
          {storefront.ownerFeaturedBadges.slice(0, 4).map((badge) => (
            <View key={badge} style={styles.ownerBadge}>
              <AppUiIcon name="ribbon-outline" size={11} color={colors.primary} />
              <Text numberOfLines={1} style={styles.ownerBadgeText}>
                {badge}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {storefront.ownerCardSummary ? (
        <Text numberOfLines={3} style={styles.ownerSummaryText}>
          {storefront.ownerCardSummary}
        </Text>
      ) : null}
    </View>
  );
}

export function DetailOperationalSection({ body, rows }: { body: string; rows: OperationalRow[] }) {
  return (
    <SectionCard title="Before you go" body={body}>
      <View style={styles.operationalList}>
        {rows.map((row) => (
          <OperationalRowItem key={row.id} row={row} />
        ))}
      </View>
    </SectionCard>
  );
}

/**
 * Single row in the "Before you go" section. When `row.onPress` is set the
 * whole row becomes a Pressable target; when `row.expandable` is set a
 * chevron is rendered and the expanded lines unfold below the row.
 *
 * Three visual states for the leading status pill:
 *   - available  (green)  — has data + actionable
 *   - checking   (warm)   — data still loading
 *   - unavailable (gray)  — data confirmed missing
 *
 * For tappable rows, the pill text changes to a verb ("Tap to call",
 * "Tap to open", "Show hours") so the user understands the row is
 * interactive even before reading the value.
 */
function OperationalRowItem({ row }: { row: OperationalRow }) {
  const isPressable = Boolean(row.onPress);
  const showExpanded = Boolean(row.expandable && row.expanded);
  const pillLabel = getOperationalPillLabel(row);

  const inner = (
    <View style={styles.operationalRow}>
      <View style={styles.operationalRowMain}>
        <View
          style={[
            styles.operationalIconWrap,
            row.status === 'available' && styles.operationalIconWrapActive,
            row.status === 'checking' && styles.operationalIconWrapChecking,
          ]}
        >
          <AppUiIcon
            name={row.icon}
            size={15}
            color={
              row.status === 'available'
                ? colors.primary
                : row.status === 'checking'
                  ? colors.warning
                  : colors.textSoft
            }
          />
        </View>
        <View style={styles.operationalCopy}>
          <Text numberOfLines={1} style={styles.operationalLabel}>
            {row.label}
          </Text>
          <Text
            numberOfLines={1}
            style={[
              styles.operationalValue,
              row.status !== 'available' && styles.operationalValueMuted,
            ]}
          >
            {row.value}
          </Text>
        </View>
      </View>
      <View style={styles.operationalRowTrailing}>
        <View
          style={[
            styles.operationalStatusPill,
            row.status === 'available'
              ? styles.operationalStatusAvailable
              : row.status === 'checking'
                ? styles.operationalStatusChecking
                : styles.operationalStatusUnavailable,
          ]}
        >
          <Text
            style={[
              styles.operationalStatusText,
              row.status === 'available'
                ? styles.operationalStatusTextAvailable
                : row.status === 'checking'
                  ? styles.operationalStatusTextChecking
                  : styles.operationalStatusTextUnavailable,
            ]}
          >
            {pillLabel}
          </Text>
        </View>
        {row.expandable ? (
          <AppUiIcon
            name={showExpanded ? 'chevron-down' : 'chevron-forward'}
            size={14}
            color={colors.textSoft}
          />
        ) : null}
      </View>
    </View>
  );

  return (
    <View>
      {isPressable ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${row.label}: ${row.value}`}
          accessibilityHint={row.accessibilityHint}
          accessibilityState={row.expandable ? { expanded: showExpanded } : undefined}
          onPress={row.onPress}
          android_ripple={{ color: 'rgba(0, 245, 140, 0.10)' }}
          style={({ pressed }) => [pressed && styles.operationalRowPressed]}
        >
          {inner}
        </Pressable>
      ) : (
        inner
      )}
      {showExpanded && row.expandedLines && row.expandedLines.length > 0 ? (
        <View style={styles.operationalExpandedBlock}>
          {row.expandedLines.map((line, index) => {
            const [day, ...rest] = line.split(': ');
            const value = rest.join(': ');
            return (
              <View key={`${row.id}-line-${index}`} style={styles.operationalExpandedRow}>
                <Text style={styles.operationalExpandedDay}>{day}</Text>
                <Text style={styles.operationalExpandedValue}>{value || '—'}</Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function getOperationalPillLabel(row: OperationalRow): string {
  if (row.status === 'checking') return 'Checking';
  if (row.status === 'unavailable') return 'Not listed';
  // status === 'available'
  if (row.expandable) {
    return row.expanded ? 'Hide' : 'Show';
  }
  if (!row.onPress) return 'Available';
  switch (row.id) {
    case 'phone':
      return 'Tap to call';
    case 'website':
      return 'Tap to open';
    case 'menu':
      return 'Tap to open';
    default:
      return 'Tap to open';
  }
}

export function DetailPrimaryActions({ onGoNow }: { onGoNow: () => void }) {
  // Simplified to Directions only. Phone, Website, and Menu used to live
  // here as separate buttons but are now reachable directly by tapping
  // the corresponding row in DetailOperationalSection above. Directions
  // stays here because it has no equivalent display row — there is no
  // "Address" row on this section, and the Get Directions affordance is
  // the highest-intent action on the page.
  return (
    <View style={styles.ctaRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open directions"
        accessibilityHint="Starts navigation to this storefront."
        onPress={onGoNow}
        style={styles.primaryButton}
      >
        <AppUiIcon name="navigate" size={16} color={colors.backgroundDeep} />
        <Text style={styles.primaryButtonText}>Directions</Text>
      </Pressable>
    </View>
  );
}

export function DetailSecondaryActions({
  storefront,
  isSaved,
  onToggleSaved,
  onWriteReview,
  writeReviewLabel,
  onSuggestEdit,
  onReportClosed,
}: {
  storefront: StorefrontSummary;
  isSaved: boolean;
  onToggleSaved: (storefrontId: string) => void;
  onWriteReview: () => void;
  writeReviewLabel: string;
  onSuggestEdit: () => void;
  onReportClosed: () => void;
}) {
  return (
    <>
      <View style={styles.secondaryCtaRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            isSaved
              ? `Remove ${storefront.displayName} from saved storefronts`
              : `Save ${storefront.displayName}`
          }
          accessibilityHint="Toggles this storefront in your saved list."
          onPress={() => onToggleSaved(storefront.id)}
          style={styles.tertiaryButton}
        >
          <AppUiIcon
            name={isSaved ? 'bookmark' : 'bookmark-outline'}
            size={16}
            color={isSaved ? colors.primary : colors.text}
          />
          <Text style={styles.tertiaryButtonText}>{isSaved ? 'Saved' : 'Save'}</Text>
        </Pressable>
      </View>

      <View style={styles.secondaryCtaRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${writeReviewLabel} for ${storefront.displayName}`}
          accessibilityHint="Opens the review composer for this storefront."
          onPress={onWriteReview}
          style={styles.tertiaryButton}
        >
          <AppUiIcon name="create-outline" size={16} color={colors.text} />
          <Text style={styles.tertiaryButtonText}>{writeReviewLabel}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Suggest an edit for ${storefront.displayName}`}
          accessibilityHint="Opens the storefront correction flow."
          onPress={onSuggestEdit}
          style={styles.tertiaryButton}
        >
          <AppUiIcon name="create-outline" size={16} color={colors.text} />
          <Text style={styles.tertiaryButtonText}>Suggest Edit</Text>
        </Pressable>
      </View>

      <View style={styles.secondaryCtaRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Report ${storefront.displayName} as closed`}
          accessibilityHint="Opens the storefront closure report flow."
          onPress={onReportClosed}
          style={styles.tertiaryButton}
        >
          <AppUiIcon name="flag-outline" size={16} color={colors.text} />
          <Text style={styles.tertiaryButtonText}>Report Closed</Text>
        </Pressable>
      </View>
    </>
  );
}

export function DetailLoadingCard() {
  return (
    <SectionCard
      title="Loading storefront details"
      body="Fetching the latest hours, contact details, and customer reviews for this storefront."
    >
      <CustomerStateCard
        title="Updating storefront details"
        body="We are pulling the latest hours, links, and review details for this storefront."
        tone="info"
        iconName="sync-outline"
        eyebrow="Loading"
        note="You can stay on this screen while the latest storefront details finish loading."
      >
        <View style={styles.loadingInline}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>Refreshing hours, contact details, and reviews...</Text>
        </View>
      </CustomerStateCard>
    </SectionCard>
  );
}
