import React from 'react';
import { Pressable } from 'react-native';
import type { StorefrontSummary } from '../types/storefront';
import { useStorefrontOperationalStatus } from '../hooks/useStorefrontOperationalStatus';
import {
  getStorefrontRouteCardState,
  StorefrontRouteCardBody,
} from './storefrontRouteCard/StorefrontRouteCardSections';
import { styles } from './storefrontRouteCard/storefrontRouteCardStyles';
import type { StorefrontCardVisualLane } from './storefrontRouteCard/storefrontRouteCardVisualState';
import { hasStorefrontPromotion } from '../utils/storefrontPromotions';

const cardToneStyleMap: Record<StorefrontCardVisualLane, typeof styles.cardHotDeal | null> = {
  hotDeal: styles.cardHotDeal,
  ownerFeatured: styles.cardOwnerFeatured,
  saved: styles.cardSaved,
  visited: styles.cardVisited,
  newToYou: styles.cardNewToYou,
  default: null,
};

type StorefrontRouteCardProps = {
  storefront: StorefrontSummary;
  variant?: 'feature' | 'list';
  onPress?: () => void;
  onPressIn?: () => void;
  onPrimaryActionPress?: () => void;
  onPrimaryActionPressIn?: () => void;
  onSecondaryActionPress?: () => void;
  onSecondaryActionPressIn?: () => void;
  primaryActionLabel?: string;
  secondaryActionLabel?: string;
  isSaved?: boolean;
  isVisited?: boolean;
  showPromotionText?: boolean;
};

function areStringArraysEqual(previous: string[] | undefined, next: string[] | undefined) {
  if (previous === next) {
    return true;
  }

  if (!previous || !next || previous.length !== next.length) {
    return false;
  }

  return previous.every((value, index) => value === next[index]);
}

function StorefrontRouteCardComponent({
  storefront,
  variant = 'feature',
  onPress,
  onPressIn,
  onPrimaryActionPress,
  onPrimaryActionPressIn,
  onSecondaryActionPress,
  onSecondaryActionPressIn,
  primaryActionLabel = 'View Shop',
  secondaryActionLabel,
  isSaved = false,
  isVisited = false,
  showPromotionText = false,
}: StorefrontRouteCardProps) {
  const compact = variant === 'list';
  const hasPromotion = hasStorefrontPromotion(storefront);
  const { openNow, isLoading: isOperationalStatusPending } =
    useStorefrontOperationalStatus(storefront);
  const { cardVisualLane, previewStatusLabel, previewStatusTone } = getStorefrontRouteCardState({
    isSaved,
    isVisited,
    hasPromotion,
    premiumCardVariant: storefront.premiumCardVariant,
    openNow,
    isOperationalStatusPending,
  });
  const accessibilityLabel = `${storefront.displayName}, ${storefront.city}, ${storefront.state}. ${previewStatusLabel}. ${hasPromotion ? 'Live deal available.' : 'No live deal highlighted.'}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Opens the storefront detail screen."
      onPress={onPress}
      onPressIn={onPressIn}
      style={({ pressed }) => [
        styles.card,
        cardToneStyleMap[cardVisualLane],
        compact && styles.cardCompact,
        pressed && styles.cardPressed,
      ]}
    >
      <StorefrontRouteCardBody
        storefront={storefront}
        compact={compact}
        primaryActionLabel={primaryActionLabel}
        secondaryActionLabel={secondaryActionLabel}
        onPress={onPress}
        onPressIn={onPressIn}
        onPrimaryActionPress={onPrimaryActionPress}
        onPrimaryActionPressIn={onPrimaryActionPressIn}
        onSecondaryActionPress={onSecondaryActionPress}
        onSecondaryActionPressIn={onSecondaryActionPressIn}
        showPromotionText={showPromotionText}
        cardVisualLane={cardVisualLane}
        previewStatusLabel={previewStatusLabel}
        previewStatusTone={previewStatusTone}
      />
    </Pressable>
  );
}

function areStorefrontCardsEqual(
  previous: Readonly<StorefrontRouteCardProps>,
  next: Readonly<StorefrontRouteCardProps>,
) {
  return (
    previous.variant === next.variant &&
    previous.primaryActionLabel === next.primaryActionLabel &&
    previous.secondaryActionLabel === next.secondaryActionLabel &&
    previous.isSaved === next.isSaved &&
    previous.isVisited === next.isVisited &&
    previous.showPromotionText === next.showPromotionText &&
    previous.storefront.id === next.storefront.id &&
    previous.storefront.displayName === next.storefront.displayName &&
    previous.storefront.addressLine1 === next.storefront.addressLine1 &&
    previous.storefront.city === next.storefront.city &&
    previous.storefront.state === next.storefront.state &&
    previous.storefront.zip === next.storefront.zip &&
    previous.storefront.rating === next.storefront.rating &&
    previous.storefront.reviewCount === next.storefront.reviewCount &&
    previous.storefront.distanceMiles === next.storefront.distanceMiles &&
    previous.storefront.openNow === next.storefront.openNow &&
    previous.storefront.isVerified === next.storefront.isVerified &&
    previous.storefront.promotionText === next.storefront.promotionText &&
    areStringArraysEqual(previous.storefront.promotionBadges, next.storefront.promotionBadges) &&
    previous.storefront.promotionExpiresAt === next.storefront.promotionExpiresAt &&
    previous.storefront.activePromotionId === next.storefront.activePromotionId &&
    previous.storefront.activePromotionCount === next.storefront.activePromotionCount &&
    previous.storefront.verifiedOwnerBadgeLabel === next.storefront.verifiedOwnerBadgeLabel &&
    areStringArraysEqual(
      previous.storefront.ownerFeaturedBadges,
      next.storefront.ownerFeaturedBadges,
    ) &&
    previous.storefront.ownerCardSummary === next.storefront.ownerCardSummary &&
    previous.storefront.premiumCardVariant === next.storefront.premiumCardVariant &&
    previous.storefront.thumbnailUrl === next.storefront.thumbnailUrl &&
    previous.onPress === next.onPress &&
    previous.onPressIn === next.onPressIn &&
    previous.onPrimaryActionPress === next.onPrimaryActionPress &&
    previous.onPrimaryActionPressIn === next.onPrimaryActionPressIn &&
    previous.onSecondaryActionPress === next.onSecondaryActionPress &&
    previous.onSecondaryActionPressIn === next.onSecondaryActionPressIn
  );
}

export const StorefrontRouteCard = React.memo(
  StorefrontRouteCardComponent,
  areStorefrontCardsEqual,
);
