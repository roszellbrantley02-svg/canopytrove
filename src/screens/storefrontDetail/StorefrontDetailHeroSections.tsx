import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BrandMarkIcon } from '../../icons/BrandMarkIcon';
import { CustomerStateCard } from '../../components/CustomerStateCard';
import { SectionCard } from '../../components/SectionCard';
import { colors } from '../../theme/tokens';
import { StorefrontSummary } from '../../types/storefront';
import { StorefrontRatingDisplay } from '../../utils/storefrontRatings';
import { styles } from './storefrontDetailStyles';

type OperationalRow = {
  id: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
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
      <Pressable onPress={onBack} style={styles.headerBadge}>
        <Ionicons name="arrow-back" size={16} color={colors.text} />
        <Text style={styles.headerBadgeText}>Detail</Text>
      </Pressable>
      {verifiedOwnerBadgeLabel ? (
        <View style={styles.headerBadge}>
          <Ionicons name="shield-checkmark" size={14} color={colors.primary} />
          <Text style={styles.headerBadgeText}>{verifiedOwnerBadgeLabel}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function DetailHero({ storefront, ratingDisplay }: DetailHeroProps) {
  const summaryItems = [
    {
      id: 'rating',
      label: 'Rating',
      value: ratingDisplay.badgeLabel,
      body: ratingDisplay.helperLabel ?? 'Canopy Trove community score for this storefront.',
    },
    {
      id: 'reviews',
      label: 'Reviews',
      value: ratingDisplay.countLabel,
      body: 'Customer review volume currently visible in the app.',
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
            label: 'Saved',
            value: `${storefront.favoriteFollowerCount}`,
            body: 'Canopy Trove members following this storefront for future visits.',
          },
        ]
      : []),
  ];

  return (
    <View style={styles.hero}>
      <Text style={styles.heroKicker}>Storefront detail</Text>
      <Text style={styles.title}>{storefront.displayName}</Text>
      <Text style={styles.address}>
        {storefront.addressLine1}, {storefront.city}, {storefront.state} {storefront.zip}
      </Text>

      <View style={styles.heroSummaryStrip}>
        {summaryItems.map((item) => (
          <View key={item.id} style={styles.heroSummaryTile}>
            <Text style={styles.heroSummaryValue}>{item.value}</Text>
            <Text style={styles.heroSummaryLabel}>{item.label}</Text>
            <Text style={styles.heroSummaryBody}>{item.body}</Text>
          </View>
        ))}
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaChip}>
          <Ionicons
            name={ratingDisplay.isReady ? 'star' : 'star-outline'}
            size={12}
            color={ratingDisplay.isReady ? colors.gold : colors.textSoft}
          />
          <Text style={styles.metaText}>{ratingDisplay.badgeLabel}</Text>
        </View>
        <View style={styles.metaChip}>
          <Ionicons name="people-outline" size={12} color={colors.cyan} />
          <Text style={styles.metaText}>{ratingDisplay.countLabel}</Text>
        </View>
        <View style={styles.metaChip}>
          <BrandMarkIcon size={14} />
          <Text style={styles.metaText}>{storefront.distanceMiles.toFixed(1)} mi away</Text>
        </View>
      </View>

      {ratingDisplay.helperLabel ? (
        <Text style={styles.ratingHelperText}>{ratingDisplay.helperLabel}</Text>
      ) : null}

      {storefront.ownerFeaturedBadges?.length ? (
        <View style={styles.ownerBadgeRow}>
          {storefront.ownerFeaturedBadges.slice(0, 4).map((badge) => (
            <View key={badge} style={styles.ownerBadge}>
              <Text style={styles.ownerBadgeText}>{badge}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {storefront.ownerCardSummary ? (
        <Text style={styles.ownerSummaryText}>{storefront.ownerCardSummary}</Text>
      ) : null}
    </View>
  );
}

export function DetailOperationalSection({
  body,
  rows,
}: {
  body: string;
  rows: OperationalRow[];
}) {
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
                <Ionicons
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
                <Text style={styles.operationalLabel}>{row.label}</Text>
                <Text
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
      <Pressable onPress={onGoNow} style={styles.primaryButton}>
        <Ionicons name="navigate" size={16} color={colors.background} />
        <Text style={styles.primaryButtonText}>Go Now</Text>
      </Pressable>
      {hasMenu ? (
        <Pressable onPress={onOpenMenu} style={styles.primaryButton}>
          <Ionicons name="restaurant-outline" size={16} color={colors.background} />
          <Text style={styles.primaryButtonText}>Menu</Text>
        </Pressable>
      ) : null}
      {hasWebsite ? (
        <Pressable onPress={onOpenWebsite} style={styles.primaryButton}>
          <Ionicons name="globe-outline" size={16} color={colors.background} />
          <Text style={styles.primaryButtonText}>Website</Text>
        </Pressable>
      ) : null}
      {hasPhone ? (
        <Pressable onPress={onCall} style={styles.secondaryButton}>
          <Ionicons name="call-outline" size={16} color={colors.text} />
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
  onReport,
}: {
  storefront: StorefrontSummary;
  isSaved: boolean;
  onToggleSaved: (storefrontId: string) => void;
  onWriteReview: () => void;
  onReport: () => void;
}) {
  return (
    <>
      <View style={styles.secondaryCtaRow}>
        <Pressable onPress={() => onToggleSaved(storefront.id)} style={styles.tertiaryButton}>
          <Ionicons
            name={isSaved ? 'bookmark' : 'bookmark-outline'}
            size={16}
            color={isSaved ? colors.primary : colors.text}
          />
          <Text style={styles.tertiaryButtonText}>{isSaved ? 'Saved' : 'Save'}</Text>
        </Pressable>
      </View>

      <View style={styles.secondaryCtaRow}>
        <Pressable onPress={onWriteReview} style={styles.tertiaryButton}>
          <Ionicons name="create-outline" size={16} color={colors.text} />
          <Text style={styles.tertiaryButtonText}>Write Review</Text>
        </Pressable>

        <Pressable onPress={onReport} style={styles.tertiaryButton}>
          <Ionicons name="flag-outline" size={16} color={colors.text} />
          <Text style={styles.tertiaryButtonText}>Report</Text>
        </Pressable>
      </View>
    </>
  );
}

export function DetailLoadingCard() {
  return (
    <SectionCard
      title="Loading storefront information"
      body="Fetching current hours, contact details, and Canopy Trove reviews for this shop."
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
