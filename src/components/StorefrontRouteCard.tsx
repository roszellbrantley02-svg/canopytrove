import React from 'react';
import { Pressable } from 'react-native';
import { StorefrontSummary } from '../types/storefront';
import { useStorefrontOperationalStatus } from '../hooks/useStorefrontOperationalStatus';
import {
  getStorefrontRouteCardState,
  StorefrontRouteCardBody,
} from './storefrontRouteCard/StorefrontRouteCardSections';
import { styles } from './storefrontRouteCard/storefrontRouteCardStyles';
import { hasStorefrontPromotion } from '../utils/storefrontPromotions';

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
  const { openNow, isLoading: isOperationalStatusPending } = useStorefrontOperationalStatus(storefront);
  const { previewTone, previewStatusLabel, previewStatusTone } = getStorefrontRouteCardState({
    isSaved,
    isVisited,
    hasPromotion,
    openNow,
    isOperationalStatusPending,
  });

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      style={({ pressed }) => [
        styles.card,
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
        previewTone={previewTone}
        previewStatusLabel={previewStatusLabel}
        previewStatusTone={previewStatusTone}
      />
    </Pressable>
  );
}

function areStorefrontCardsEqual(
  previous: Readonly<StorefrontRouteCardProps>,
  next: Readonly<StorefrontRouteCardProps>
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
    previous.storefront.rating === next.storefront.rating &&
    previous.storefront.distanceMiles === next.storefront.distanceMiles &&
    previous.storefront.openNow === next.storefront.openNow &&
    previous.storefront.isVerified === next.storefront.isVerified &&
    previous.storefront.promotionText === next.storefront.promotionText &&
    previous.onPress === next.onPress &&
    previous.onPressIn === next.onPressIn &&
    previous.onPrimaryActionPress === next.onPrimaryActionPress &&
    previous.onPrimaryActionPressIn === next.onPrimaryActionPressIn &&
    previous.onSecondaryActionPress === next.onSecondaryActionPress &&
    previous.onSecondaryActionPressIn === next.onSecondaryActionPressIn
  );
}

export const StorefrontRouteCard = React.memo(StorefrontRouteCardComponent, areStorefrontCardsEqual);
