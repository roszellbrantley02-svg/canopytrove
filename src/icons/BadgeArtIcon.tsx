import React from 'react';
import { AppUiIcon, type AppUiIconName } from './AppUiIcon';
import { V4cIcon, type V4cAssetName } from './ProvidedGlyphIconsV4c';

const BADGE_ICON_TO_V4C: Partial<Record<string, V4cAssetName>> = {
  'beaker-outline': 'CT_Badge_Lantern',
  'brush-outline': 'CT_Trophy_Hammer',
  camera: 'CT_Badge_Eye',
  'camera-outline': 'CT_Badge_Eye',
  'chatbubble-ellipses-outline': 'AppNav_Chat',
  'chatbubbles-outline': 'AppNav_Chat',
  'checkmark-circle-outline': 'AppNav_Verify',
  'compass-outline': 'AppNav_Compass',
  'diamond-outline': 'CT_Trophy_Diamond',
  'document-text-outline': 'CT_Trophy_Plaque',
  'earth-outline': 'CT_Trophy_Compass',
  flame: 'CT_Badge_Fire',
  'flame-outline': 'CT_Badge_Fire',
  'images-outline': 'CT_Badge_Chest',
  'leaf-outline': 'CT_Badge_Feather',
  'location-outline': 'AppNav_Nearby',
  'map-outline': 'AppNav_MapApp',
  people: 'CT_Badge_Anchor',
  'people-outline': 'CT_Badge_Wings',
  'person-add-outline': 'AppNav_Refer',
  'pricetag-outline': 'AppNav_Tag',
  'pricetags-outline': 'AppNav_Percent',
  ribbon: 'CT_Trophy_Ribbon3',
  'ribbon-outline': 'CT_Trophy_Ribbon1',
  'rocket-outline': 'AppNav_Rocket',
  'share-social-outline': 'AppNav_Share',
  'shield-checkmark-outline': 'CT_Badge_Shield',
  star: 'CT_Trophy_StarRuby',
  'star-half-outline': 'CT_Trophy_StarSapphire',
  'star-outline': 'CT_Trophy_Star',
  'thumbs-up-outline': 'CT_Badge_Heart',
  trophy: 'CT_Trophy_Cup',
  'trophy-outline': 'CT_Trophy_Cup',
};

const TIER_TO_V4C: Partial<Record<string, V4cAssetName>> = {
  bronze: 'CT_Trophy_CupBronze',
  diamond: 'CT_Trophy_Diamond',
  gold: 'CT_Trophy_Cup',
  platinum: 'CT_Trophy_Crown',
  silver: 'CT_Trophy_CupSilver',
};

export function resolveBadgeArtAsset({
  icon,
  tier,
}: {
  icon?: string | null;
  tier?: string | null;
}): V4cAssetName | null {
  if (icon) {
    const iconAsset = BADGE_ICON_TO_V4C[icon];
    if (iconAsset) {
      return iconAsset;
    }
  }

  if (tier) {
    return TIER_TO_V4C[tier] ?? null;
  }

  return null;
}

export function BadgeArtIcon({
  icon,
  tier,
  size = 28,
  color = '#FFFFFF',
  muted = false,
  fallbackName = 'star-outline',
}: {
  icon?: string | null;
  tier?: string | null;
  size?: number;
  color?: string;
  muted?: boolean;
  fallbackName?: AppUiIconName;
}) {
  const asset = resolveBadgeArtAsset({ icon, tier });

  if (asset) {
    return <V4cIcon asset={asset} size={size} opacity={muted ? 0.48 : 1} />;
  }

  return (
    <AppUiIcon
      name={(icon as AppUiIconName | undefined) ?? fallbackName}
      size={size}
      color={color}
    />
  );
}
