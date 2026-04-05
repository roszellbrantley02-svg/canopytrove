import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { MapGridPreview } from '../MapGridPreview';
import type { PreviewStatusTone } from '../mapGridPreview/mapGridPreviewTones';
import { LocationPinIcon } from '../../icons/AppIcons';
import { AppUiIcon } from '../../icons/AppUiIcon';
import { colors } from '../../theme/tokens';
import type { StorefrontSummary } from '../../types/storefront';
import { getUSHolidayInfo } from '../../utils/holidayUtils';
import { getStorefrontRatingDisplay } from '../../utils/storefrontRatings';
import {
  formatStorefrontPromotionExpiry,
  getStorefrontPromotionBadges,
} from '../../utils/storefrontPromotions';
import {
  getHeatColor,
  getHeatLabel,
  routeStartsToHeatLevel,
  type HeatLevel,
} from './StorefrontHeatGlow';
import { styles } from './storefrontRouteCardStyles';
import type { StorefrontCardVisualLane } from './storefrontRouteCardVisualState';
import {
  getStorefrontCardHeroLabel,
  getStorefrontCardPreviewTone,
  getStorefrontCardVisualLane,
} from './storefrontRouteCardVisualState';

const heatChipTextStyleMap: Record<HeatLevel, typeof styles.heatChipText1 | null> = {
  0: null,
  1: styles.heatChipText1,
  2: styles.heatChipText2,
  3: styles.heatChipText3,
  4: styles.heatChipText4,
  5: styles.heatChipText5,
};

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
  cardVisualLane: StorefrontCardVisualLane;
  previewStatusLabel: string;
  previewStatusTone: PreviewStatusTone;
};

export function getStorefrontRouteCardState({
  isSaved,
  isVisited,
  hasPromotion,
  premiumCardVariant,
  openNow,
  isOperationalStatusPending,
}: {
  isSaved: boolean;
  isVisited: boolean;
  hasPromotion: boolean;
  premiumCardVariant?: StorefrontSummary['premiumCardVariant'];
  openNow: boolean | null;
  isOperationalStatusPending: boolean;
}) {
  const cardVisualLane = getStorefrontCardVisualLane({
    isSaved,
    isVisited,
    hasPromotion,
    premiumCardVariant,
  });
  const previewStatusTone: PreviewStatusTone =
    typeof openNow === 'boolean'
      ? openNow
        ? 'open'
        : 'closed'
      : isOperationalStatusPending
        ? 'checking'
        : 'default';
  const baseStatusLabel =
    typeof openNow === 'boolean'
      ? openNow
        ? 'Open Now'
        : 'Closed'
      : isOperationalStatusPending
        ? 'Checking'
        : 'Check Hours';

  const holiday = getUSHolidayInfo();
  const previewStatusLabel = holiday
    ? `${baseStatusLabel} \u00B7 ${holiday.notice}`
    : baseStatusLabel;

  return {
    cardVisualLane,
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
  cardVisualLane,
  previewStatusLabel,
  previewStatusTone,
}: StorefrontRouteCardBodyProps) {
  const promotionText = storefront.promotionText?.trim() || null;
  const promotionBadges = getStorefrontPromotionBadges(storefront).slice(0, 5);
  const promotionExpiryLabel = formatStorefrontPromotionExpiry(storefront.promotionExpiresAt);
  const activePromotionCount =
    storefront.activePromotionCount ?? (promotionBadges.length || promotionText ? 1 : 0);
  const hasLiveDeals = activePromotionCount > 0;
  const isAndroid = Platform.OS === 'android';
  const ownerFeaturedBadges = (storefront.ownerFeaturedBadges ?? []).slice(0, 4);
  const heatLevel = routeStartsToHeatLevel(storefront.routeStartsPerHour ?? 0);
  const heatLabel = getHeatLabel(heatLevel);
  const heatColor = getHeatColor(heatLevel);
  const ratingDisplay = getStorefrontRatingDisplay({
    publishedRating: storefront.rating,
    publishedReviewCount: storefront.reviewCount,
  });
  const previewTone = getStorefrontCardPreviewTone(cardVisualLane);
  const heroLabel = getStorefrontCardHeroLabel({
    lane: cardVisualLane,
    activePromotionCount,
    isVerified: storefront.isVerified,
  });
  const bodyToneStyle =
    cardVisualLane === 'hotDeal'
      ? styles.bodyHotDeal
      : cardVisualLane === 'ownerFeatured'
        ? styles.bodyOwnerFeatured
        : cardVisualLane === 'saved'
          ? styles.bodySaved
          : cardVisualLane === 'visited'
            ? styles.bodyVisited
            : cardVisualLane === 'newToYou'
              ? styles.bodyNewToYou
              : null;
  const kickerChipStyle =
    cardVisualLane === 'hotDeal'
      ? styles.kickerChipHotDeal
      : cardVisualLane === 'ownerFeatured'
        ? styles.kickerChipOwnerFeatured
        : cardVisualLane === 'saved'
          ? styles.kickerChipSaved
          : cardVisualLane === 'visited'
            ? styles.kickerChipVisited
            : cardVisualLane === 'newToYou'
              ? styles.kickerChipNewToYou
              : styles.kickerChipDefault;
  const kickerChipTextStyle =
    cardVisualLane === 'hotDeal'
      ? styles.kickerChipTextHotDeal
      : cardVisualLane === 'ownerFeatured'
        ? styles.kickerChipTextOwnerFeatured
        : cardVisualLane === 'saved'
          ? styles.kickerChipTextSaved
          : cardVisualLane === 'visited'
            ? styles.kickerChipTextVisited
            : cardVisualLane === 'newToYou'
              ? styles.kickerChipTextNewToYou
              : null;

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
          imageUrl={storefront.thumbnailUrl}
        />
      </View>

      <View style={[styles.body, bodyToneStyle]}>
        <View style={styles.kickerRow}>
          <View style={[styles.kickerChip, kickerChipStyle]}>
            <Text numberOfLines={1} style={[styles.kickerChipText, kickerChipTextStyle]}>
              {heroLabel}
            </Text>
          </View>
          <View style={styles.kickerMetric}>
            <AppUiIcon name="location-outline" size={13} color={colors.textSoft} />
            <Text
              numberOfLines={1}
              style={styles.kickerMetricText}
            >{`${storefront.city}, ${storefront.state}`}</Text>
          </View>
          {heatLabel ? (
            <View style={styles.heatChip}>
              <AppUiIcon name="flame" size={13} color={heatColor} />
              <Text
                numberOfLines={1}
                style={[styles.kickerMetricText, heatChipTextStyleMap[heatLevel]]}
              >
                {heatLabel}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.titleRow}>
          <Text numberOfLines={2} style={styles.title}>
            {storefront.displayName}
          </Text>
          {storefront.verifiedOwnerBadgeLabel ? (
            <View style={styles.ownerHeadlineChip}>
              <AppUiIcon name="shield-checkmark" size={12} color={colors.primary} />
              <Text numberOfLines={1} style={styles.ownerHeadlineText}>
                {storefront.verifiedOwnerBadgeLabel}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaChip}>
            <AppUiIcon
              name={ratingDisplay.isReady ? 'star' : 'star-outline'}
              size={12}
              color={ratingDisplay.isReady ? colors.primary : colors.textSoft}
            />
            <Text style={styles.metaChipText}>{ratingDisplay.badgeLabel}</Text>
          </View>
          <View style={styles.metaChip}>
            <AppUiIcon name="people-outline" size={12} color={colors.cyan} />
            <Text style={styles.metaChipText}>{ratingDisplay.countLabel}</Text>
          </View>
          <View style={styles.metaChip}>
            <LocationPinIcon size={14} color={colors.goldSoft} />
            <Text style={styles.metaChipText}>{storefront.distanceMiles.toFixed(1)} mi</Text>
          </View>
        </View>

        {ratingDisplay.helperLabel ? (
          <Text numberOfLines={1} style={styles.ratingHelperText}>
            {ratingDisplay.helperLabel}
          </Text>
        ) : null}

        {storefront.ownerCardSummary ? (
          <Text numberOfLines={3} style={styles.ownerSummaryText}>
            {storefront.ownerCardSummary}
          </Text>
        ) : null}

        {ownerFeaturedBadges.length ? (
          <View style={styles.ownerBadgeWrap}>
            {ownerFeaturedBadges.map((badge) => (
              <View key={badge} style={styles.ownerBadge}>
                <AppUiIcon name="ribbon-outline" size={11} color={colors.primary} />
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
                <Text numberOfLines={1} style={styles.promotionBadgeExpiryText}>
                  {promotionExpiryLabel}
                </Text>
              </View>
            ) : null}
            {activePromotionCount > 1 ? (
              <View style={styles.promotionBadgeExpiry}>
                <Text
                  style={styles.promotionBadgeExpiryText}
                >{`${activePromotionCount} live now`}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {showPromotionText && promotionText ? (
          <View style={styles.promotionBanner}>
            <AppUiIcon name="flame" size={14} color={colors.background} />
            <Text numberOfLines={2} style={styles.promotionText}>
              {promotionText}
            </Text>
          </View>
        ) : !showPromotionText && hasLiveDeals ? (
          <View style={styles.promotionTeaserBanner}>
            <AppUiIcon name="lock-closed-outline" size={14} color={colors.text} />
            <Text numberOfLines={2} style={styles.promotionTeaserText}>
              {activePromotionCount > 1
                ? isAndroid
                  ? `Members unlock ${activePromotionCount} recent updates`
                  : `Members unlock ${activePromotionCount} live deals`
                : isAndroid
                  ? 'Members unlock this recent update'
                  : 'Members unlock this live deal'}
            </Text>
          </View>
        ) : null}

        <View style={styles.actionRow}>
          {secondaryActionLabel && onSecondaryActionPress ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${secondaryActionLabel} for ${storefront.displayName}`}
              accessibilityHint="Runs the secondary storefront card action."
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
              <AppUiIcon name="eye-outline" size={14} color={colors.text} />
              <Text style={styles.secondaryCtaText}>{secondaryActionLabel}</Text>
            </Pressable>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${primaryActionLabel} for ${storefront.displayName}`}
            accessibilityHint="Runs the primary storefront card action."
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
            <AppUiIcon name="arrow-forward" size={14} color={colors.backgroundDeep} />
            <Text style={styles.primaryCtaText}>{primaryActionLabel}</Text>
          </Pressable>
        </View>
      </View>
    </>
  );
}
