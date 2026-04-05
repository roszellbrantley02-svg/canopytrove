import React from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';
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
        <Text style={styles.headerBadgeText}>Storefront record</Text>
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
      body: ratingDisplay.helperLabel ?? 'Customer score shown in Canopy Trove.',
    },
    {
      id: 'reviews',
      label: 'Reviews',
      value: ratingDisplay.countLabel,
      body: 'Visible customer review volume in Canopy Trove.',
    },
    {
      id: 'distance',
      label: 'Distance',
      value: `${storefront.distanceMiles.toFixed(1)} mi`,
      body: 'Approximate distance from your current browse context.',
    },
    ...(typeof storefront.favoriteFollowerCount === 'number'
      ? [
          {
            id: 'saved',
            label: 'Following',
            value: `${storefront.favoriteFollowerCount}`,
            body: 'Customers following this storefront for future visits.',
          },
        ]
      : []),
  ];

  return (
    <View style={styles.hero}>
      <View pointerEvents="none" style={styles.heroTone} />
      <Text style={styles.heroKicker}>Storefront record</Text>
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
    <SectionCard title="Operational details" body={body}>
      <View style={styles.operationalList}>
        {rows.map((row) => (
          <View key={row.id} style={styles.operationalRow}>
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
                {row.status === 'available'
                  ? 'Available'
                  : row.status === 'checking'
                    ? 'Checking'
                    : 'Not Published'}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </SectionCard>
  );
}

export function DetailPrimaryActions({
  onGoNow,
  hasWebsite,
  hasMenu,
  hasPhone,
  onOpenWebsite,
  onOpenMenu,
  onCall,
}: {
  onGoNow: () => void;
  hasWebsite: boolean;
  hasMenu: boolean;
  hasPhone: boolean;
  onOpenWebsite: () => void;
  onOpenMenu: () => void;
  onCall: () => void;
}) {
  if (!hasWebsite && !hasPhone && !hasMenu) {
    return null;
  }

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
      {hasMenu ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            Platform.OS === 'android' ? 'Open storefront website' : 'Open storefront menu'
          }
          accessibilityHint={
            Platform.OS === 'android'
              ? 'Opens the website link for this storefront.'
              : 'Opens the menu link for this storefront.'
          }
          onPress={onOpenMenu}
          style={styles.primaryButton}
        >
          <AppUiIcon name="restaurant-outline" size={16} color={colors.backgroundDeep} />
          <Text style={styles.primaryButtonText}>
            {Platform.OS === 'android' ? 'Website' : 'Menu'}
          </Text>
        </Pressable>
      ) : null}
      {hasWebsite ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open storefront website"
          accessibilityHint="Opens the website link for this storefront."
          onPress={onOpenWebsite}
          style={styles.primaryButton}
        >
          <AppUiIcon name="globe-outline" size={16} color={colors.backgroundDeep} />
          <Text style={styles.primaryButtonText}>Website</Text>
        </Pressable>
      ) : null}
      {hasPhone ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Call storefront"
          accessibilityHint="Starts a phone call to this storefront."
          onPress={onCall}
          style={styles.secondaryButton}
        >
          <AppUiIcon name="call-outline" size={16} color={colors.text} />
          <Text style={styles.secondaryButtonText}>Call</Text>
        </Pressable>
      ) : null}
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
      title="Loading storefront information"
      body="Fetching current hours, contact details, and Canopy Trove customer reviews for this shop."
    >
      <CustomerStateCard
        title="Updating live storefront details"
        body="Canopy Trove is pulling the best available operational and community detail state for this shop."
        tone="info"
        iconName="sync-outline"
        eyebrow="Loading"
        note="You can stay on this screen while the storefront detail payload finishes refreshing."
      >
        <View style={styles.loadingInline}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>Refreshing hours, contact, and review signals...</Text>
        </View>
      </CustomerStateCard>
    </SectionCard>
  );
}
