import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MapGridPreview } from '../MapGridPreview';
import { PreviewStatusTone } from '../mapGridPreview/mapGridPreviewTones';
import { BrandMarkIcon } from '../../icons/BrandMarkIcon';
import { colors } from '../../theme/tokens';
import { StorefrontSummary } from '../../types/storefront';
import { getStorefrontRatingDisplay } from '../../utils/storefrontRatings';
import {
  formatStorefrontPromotionExpiry,
  getStorefrontPromotionBadges,
} from '../../utils/storefrontPromotions';
import { styles } from './storefrontRouteCardStyles';

type PreviewTone = 'promotion' | 'saved' | 'visited' | 'neverVisited';

type StorefrontRouteCardBodyProps = {
  storefront: StorefrontSummary;
  compact: boolean;
  primaryActionLabel: string;
  secondaryActionLabel?: string;
  onPress?: () => void;
  onPressIn?: () => void;
  onPrimaryActionPress?: () => void;
  onPrimaryActionPressIn?: () => void;
  onSecondaryActionPress?: () => void;
  onSecondaryActionPressIn?: () => void;
  showPromotionText: boolean;
  previewTone: PreviewTone;
  previewStatusLabel: string;
  previewStatusTone: PreviewStatusTone;
};

export function getStorefrontRouteCardState({
  isSaved,
  isVisited,
  hasPromotion,
  openNow,
  isOperationalStatusPending,
}: {
  isSaved: boolean;
  isVisited: boolean;
  hasPromotion: boolean;
  openNow: boolean | null;
  isOperationalStatusPending: boolean;
}) {
  const previewTone: PreviewTone = hasPromotion
    ? 'promotion'
    : isSaved
      ? 'saved'
      : isVisited
        ? 'visited'
        : 'neverVisited';
  const previewStatusTone: PreviewStatusTone =
    typeof openNow === 'boolean'
      ? openNow
        ? 'open'
        : 'closed'
      : isOperationalStatusPending
        ? 'checking'
        : 'default';
  const previewStatusLabel =
    typeof openNow === 'boolean'
      ? openNow
        ? 'Open Now'
        : 'Closed'
      : isOperationalStatusPending
        ? 'Checking'
        : 'Check Hours';

  return {
    previewTone,
    previewStatusTone,
    previewStatusLabel,
  };
}

export function StorefrontRouteCardBody({
  storefront,
  compact,
  primaryActionLabel,
  secondaryActionLabel,
  onPress,
  onPressIn,
  onPrimaryActionPress,
  onPrimaryActionPressIn,
  onSecondaryActionPress,
  onSecondaryActionPressIn,
  showPromotionText,
  previewTone,
  previewStatusLabel,
  previewStatusTone,
}: StorefrontRouteCardBodyProps) {
  const promotionText = storefront.promotionText?.trim() || null;
  const promotionBadges = getStorefrontPromotionBadges(storefront).slice(0, 5);
  const promotionExpiryLabel = formatStorefrontPromotionExpiry(storefront.promotionExpiresAt);
  const ownerFeaturedBadges = (storefront.ownerFeaturedBadges ?? []).slice(0, 4);
  const ratingDisplay = getStorefrontRatingDisplay({
    publishedRating: storefront.rating,
    publishedReviewCount: storefront.reviewCount,
  });
  const isOwnerFeatured = storefront.premiumCardVariant === 'owner_featured';
  const heroLabel = isOwnerFeatured
    ? 'Owner featured'
    : promotionBadges.length
      ? 'Live deal'
      : storefront.isVerified
        ? 'Verified storefront'
        : 'Local storefront';

  return (
    <>
      <View style={styles.previewWrap}>
        <MapGridPreview
          statusLabel={previewStatusLabel}
          statusTone={previewStatusTone}
          tone={previewTone}
          headline={storefront.addressLine1}
          supportingText={`${storefront.city}, ${storefront.state} ${storefront.zip}`}
          height={compact ? 146 : 182}
        />
      </View>

      <View
        style={[
          styles.body,
          promotionBadges.length ? styles.bodyPromotion : null,
          isOwnerFeatured ? styles.bodyOwnerFeatured : null,
        ]}
      >
        <View style={styles.kickerRow}>
          <View
            style={[
              styles.kickerChip,
              isOwnerFeatured
                ? styles.kickerChipOwnerFeatured
                : promotionBadges.length
                  ? styles.kickerChipPromotion
                  : styles.kickerChipDefault,
            ]}
          >
            <Text
              style={[
                styles.kickerChipText,
                isOwnerFeatured
                  ? styles.kickerChipTextOwnerFeatured
                  : promotionBadges.length
                    ? styles.kickerChipTextPromotion
                    : null,
              ]}
            >
              {heroLabel}
            </Text>
          </View>
          <View style={styles.kickerMetric}>
            <Ionicons name="location-outline" size={13} color={colors.textSoft} />
            <Text style={styles.kickerMetricText}>{`${storefront.city}, ${storefront.state}`}</Text>
          </View>
        </View>

        <View style={styles.titleRow}>
          <Text style={styles.title}>{storefront.displayName}</Text>
          {storefront.verifiedOwnerBadgeLabel ? (
            <View style={styles.ownerHeadlineChip}>
              <Ionicons name="shield-checkmark" size={12} color={colors.primary} />
              <Text style={styles.ownerHeadlineText}>{storefront.verifiedOwnerBadgeLabel}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaChip}>
            <Ionicons
              name={ratingDisplay.isReady ? 'star' : 'star-outline'}
              size={12}
              color={ratingDisplay.isReady ? colors.primary : colors.textSoft}
            />
            <Text style={styles.metaChipText}>{ratingDisplay.badgeLabel}</Text>
          </View>
          <View style={styles.metaChip}>
            <Ionicons name="people-outline" size={12} color={colors.cyan} />
            <Text style={styles.metaChipText}>{ratingDisplay.countLabel}</Text>
          </View>
          <View style={styles.metaChip}>
            <BrandMarkIcon size={14} />
            <Text style={styles.metaChipText}>{storefront.distanceMiles.toFixed(1)} mi</Text>
          </View>
        </View>

        {ratingDisplay.helperLabel ? (
          <Text style={styles.ratingHelperText}>{ratingDisplay.helperLabel}</Text>
        ) : null}

        {storefront.ownerCardSummary ? (
          <Text style={styles.ownerSummaryText}>{storefront.ownerCardSummary}</Text>
        ) : null}

        {ownerFeaturedBadges.length ? (
          <View style={styles.ownerBadgeWrap}>
            {ownerFeaturedBadges.map((badge) => (
              <View key={badge} style={styles.ownerBadge}>
                <Text numberOfLines={1} style={styles.ownerBadgeText}>
                  {badge}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {promotionBadges.length ? (
          <View style={styles.promotionBadgeWrap}>
            {promotionBadges.map((badge) => (
              <View key={badge} style={styles.promotionBadge}>
                <Text numberOfLines={1} style={styles.promotionBadgeText}>
                  {badge}
                </Text>
              </View>
            ))}
            {promotionExpiryLabel ? (
              <View style={styles.promotionBadgeExpiry}>
                <Text style={styles.promotionBadgeExpiryText}>{promotionExpiryLabel}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {showPromotionText && promotionText ? (
          <View style={styles.promotionBanner}>
            <Ionicons name="flame" size={14} color={colors.background} />
            <Text style={styles.promotionText}>{promotionText}</Text>
          </View>
        ) : null}

        <View style={styles.actionRow}>
          {secondaryActionLabel && onSecondaryActionPress ? (
            <Pressable
              onPressIn={(event) => {
                event.stopPropagation();
                (onSecondaryActionPressIn ?? onPressIn)?.();
              }}
              onPress={(event) => {
                event.stopPropagation();
                onSecondaryActionPress();
              }}
              style={styles.secondaryCta}
            >
              <Ionicons name="storefront-outline" size={14} color={colors.text} />
              <Text style={styles.secondaryCtaText}>{secondaryActionLabel}</Text>
            </Pressable>
          ) : null}

          <Pressable
            onPressIn={(event) => {
              event.stopPropagation();
              (onPrimaryActionPressIn ?? onPressIn)?.();
            }}
            onPress={(event) => {
              event.stopPropagation();
              (onPrimaryActionPress ?? onPress)?.();
            }}
            style={[
              styles.primaryCta,
              secondaryActionLabel && onSecondaryActionPress && styles.primaryCtaSplit,
            ]}
          >
            <Ionicons name="arrow-forward" size={14} color={colors.backgroundDeep} />
            <Text style={styles.primaryCtaText}>{primaryActionLabel}</Text>
          </Pressable>
        </View>
      </View>
    </>
  );
}
