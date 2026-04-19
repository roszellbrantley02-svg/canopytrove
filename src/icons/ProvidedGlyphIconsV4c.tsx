/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { Image, StyleSheet, type ImageSourcePropType } from 'react-native';
import type { AppIconProps } from './AppIcons';

/**
 * v4c icon pack — 66 face-on, color-differentiated 3D-rendered PNGs (512x512, transparent).
 *
 * This is a drop-in parallel to ProvidedGlyphIcons.tsx. The old SVG renderers still
 * exist untouched; swap a consumer's import from './ProvidedGlyphIcons' to
 * './ProvidedGlyphIconsV4c' when ready.
 *
 * The v4c PNGs are already colored per the CTv4 palette (Gold/Silver/Bronze/Ruby/etc).
 * The `color` prop is accepted for API compat but not applied — the image colors win.
 *
 * Full manifest: assets/icons-v4c/asset_manifest.csv (+ .json with hex + render spec).
 */

// Exhaustive map of every v4c asset name -> require() source.
// Keys match the asset_name column in asset_manifest.csv.
const v4cSources: Record<string, ImageSourcePropType> = {
  // Trophies 00-19
  CT_Trophy_Anvil: require('../../assets/icons-v4c/00_CT_Trophy_Anvil.png'),
  CT_Trophy_Compass: require('../../assets/icons-v4c/01_CT_Trophy_Compass.png'),
  CT_Trophy_Crown: require('../../assets/icons-v4c/02_CT_Trophy_Crown.png'),
  CT_Trophy_Cup: require('../../assets/icons-v4c/03_CT_Trophy_Cup.png'),
  CT_Trophy_CupBronze: require('../../assets/icons-v4c/04_CT_Trophy_CupBronze.png'),
  CT_Trophy_CupSilver: require('../../assets/icons-v4c/05_CT_Trophy_CupSilver.png'),
  CT_Trophy_Diamond: require('../../assets/icons-v4c/06_CT_Trophy_Diamond.png'),
  CT_Trophy_Goblet: require('../../assets/icons-v4c/07_CT_Trophy_Goblet.png'),
  CT_Trophy_Hammer: require('../../assets/icons-v4c/08_CT_Trophy_Hammer.png'),
  CT_Trophy_Laurel: require('../../assets/icons-v4c/09_CT_Trophy_Laurel.png'),
  CT_Trophy_Medal: require('../../assets/icons-v4c/10_CT_Trophy_Medal.png'),
  CT_Trophy_Plaque: require('../../assets/icons-v4c/11_CT_Trophy_Plaque.png'),
  CT_Trophy_Ribbon1: require('../../assets/icons-v4c/12_CT_Trophy_Ribbon1.png'),
  CT_Trophy_Ribbon2: require('../../assets/icons-v4c/13_CT_Trophy_Ribbon2.png'),
  CT_Trophy_Ribbon3: require('../../assets/icons-v4c/14_CT_Trophy_Ribbon3.png'),
  CT_Trophy_Shield: require('../../assets/icons-v4c/15_CT_Trophy_Shield.png'),
  CT_Trophy_Star: require('../../assets/icons-v4c/16_CT_Trophy_Star.png'),
  CT_Trophy_StarRuby: require('../../assets/icons-v4c/17_CT_Trophy_StarRuby.png'),
  CT_Trophy_StarSapphire: require('../../assets/icons-v4c/18_CT_Trophy_StarSapphire.png'),
  CT_Trophy_Sword: require('../../assets/icons-v4c/19_CT_Trophy_Sword.png'),

  // Badges 20-39
  CT_Badge_Anchor: require('../../assets/icons-v4c/20_CT_Badge_Anchor.png'),
  CT_Badge_Arrow: require('../../assets/icons-v4c/21_CT_Badge_Arrow.png'),
  CT_Badge_Chest: require('../../assets/icons-v4c/22_CT_Badge_Chest.png'),
  CT_Badge_Crown: require('../../assets/icons-v4c/23_CT_Badge_Crown.png'),
  CT_Badge_Diamond: require('../../assets/icons-v4c/24_CT_Badge_Diamond.png'),
  CT_Badge_Eye: require('../../assets/icons-v4c/25_CT_Badge_Eye.png'),
  CT_Badge_Feather: require('../../assets/icons-v4c/26_CT_Badge_Feather.png'),
  CT_Badge_Fire: require('../../assets/icons-v4c/27_CT_Badge_Fire.png'),
  CT_Badge_Heart: require('../../assets/icons-v4c/28_CT_Badge_Heart.png'),
  CT_Badge_Hourglass: require('../../assets/icons-v4c/29_CT_Badge_Hourglass.png'),
  CT_Badge_Lantern: require('../../assets/icons-v4c/30_CT_Badge_Lantern.png'),
  CT_Badge_Lightning: require('../../assets/icons-v4c/31_CT_Badge_Lightning.png'),
  CT_Badge_Moon: require('../../assets/icons-v4c/32_CT_Badge_Moon.png'),
  CT_Badge_Rose: require('../../assets/icons-v4c/33_CT_Badge_Rose.png'),
  CT_Badge_Shield: require('../../assets/icons-v4c/34_CT_Badge_Shield.png'),
  CT_Badge_Snowflake: require('../../assets/icons-v4c/35_CT_Badge_Snowflake.png'),
  CT_Badge_StarOrange: require('../../assets/icons-v4c/36_CT_Badge_StarOrange.png'),
  CT_Badge_Sun: require('../../assets/icons-v4c/37_CT_Badge_Sun.png'),
  CT_Badge_Target: require('../../assets/icons-v4c/38_CT_Badge_Target.png'),
  CT_Badge_Wings: require('../../assets/icons-v4c/39_CT_Badge_Wings.png'),

  // Flags 40-41
  CT_Flag_Banner: require('../../assets/icons-v4c/40_CT_Flag_Banner.png'),
  CT_Flag_Pennant: require('../../assets/icons-v4c/41_CT_Flag_Pennant.png'),

  // AppNav 42-65
  AppNav_Browse: require('../../assets/icons-v4c/42_AppNav_Browse.png'),
  AppNav_Cart: require('../../assets/icons-v4c/43_AppNav_Cart.png'),
  AppNav_Categories: require('../../assets/icons-v4c/44_AppNav_Categories.png'),
  AppNav_Chat: require('../../assets/icons-v4c/45_AppNav_Chat.png'),
  AppNav_Compass: require('../../assets/icons-v4c/46_AppNav_Compass.png'),
  AppNav_Favorites: require('../../assets/icons-v4c/47_AppNav_Favorites.png'),
  AppNav_Filter: require('../../assets/icons-v4c/48_AppNav_Filter.png'),
  AppNav_Gift: require('../../assets/icons-v4c/49_AppNav_Gift.png'),
  AppNav_Help: require('../../assets/icons-v4c/50_AppNav_Help.png'),
  AppNav_Home: require('../../assets/icons-v4c/51_AppNav_Home.png'),
  AppNav_HotDeals: require('../../assets/icons-v4c/52_AppNav_HotDeals.png'),
  AppNav_MapApp: require('../../assets/icons-v4c/53_AppNav_MapApp.png'),
  AppNav_Nearby: require('../../assets/icons-v4c/54_AppNav_Nearby.png'),
  AppNav_Notifications: require('../../assets/icons-v4c/55_AppNav_Notifications.png'),
  AppNav_Percent: require('../../assets/icons-v4c/56_AppNav_Percent.png'),
  AppNav_Profile: require('../../assets/icons-v4c/57_AppNav_Profile.png'),
  AppNav_Refer: require('../../assets/icons-v4c/58_AppNav_Refer.png'),
  AppNav_Rocket: require('../../assets/icons-v4c/59_AppNav_Rocket.png'),
  AppNav_Search: require('../../assets/icons-v4c/60_AppNav_Search.png'),
  AppNav_Settings: require('../../assets/icons-v4c/61_AppNav_Settings.png'),
  AppNav_Share: require('../../assets/icons-v4c/62_AppNav_Share.png'),
  AppNav_Tag: require('../../assets/icons-v4c/63_AppNav_Tag.png'),
  AppNav_Verify: require('../../assets/icons-v4c/64_AppNav_Verify.png'),
  AppNav_Wallet: require('../../assets/icons-v4c/65_AppNav_Wallet.png'),
};

export type V4cAssetName = keyof typeof v4cSources;

/**
 * Maps the existing ProvidedGlyphIcons glyph names to the best-matching v4c asset.
 * Every glyph name in the original SVG component has a v4c counterpart.
 */
const glyphToV4c: Record<string, V4cAssetName> = {
  deals: 'AppNav_HotDeals',
  favorites: 'AppNav_Favorites',
  badges: 'CT_Badge_StarOrange',
  browse: 'AppNav_Browse',
  close: 'AppNav_Filter', // closest visual analog; 'close' has no direct v4c — keep SVG if exact X is needed
  location: 'AppNav_Nearby',
  map: 'AppNav_MapApp',
  profile: 'AppNav_Profile',
  storefront: 'AppNav_Browse',
  reviews: 'CT_Trophy_Star',
  saved: 'AppNav_Favorites',
  search: 'AppNav_Search',
  stars: 'CT_Badge_StarOrange',
  travel: 'AppNav_Compass',
  verify: 'AppNav_Verify',
  trophy: 'CT_Trophy_Compass',
};

export type ProvidedGlyphNameV4c = keyof typeof glyphToV4c;

type ProvidedGlyphIconV4cProps = AppIconProps & {
  name: ProvidedGlyphNameV4c;
  opacity?: number;
};

export function ProvidedGlyphIconV4c({ name, size = 24, opacity = 1 }: ProvidedGlyphIconV4cProps) {
  const assetName = glyphToV4c[name];
  const source = v4cSources[assetName];
  return (
    <Image
      source={source}
      style={[styles.icon, { width: size, height: size, opacity }]}
      resizeMode="contain"
    />
  );
}

/**
 * Render any v4c asset directly by its canonical name (bypass the glyph alias map).
 * Useful for new UI surfaces that want a specific trophy/badge/flag.
 */
type V4cIconProps = {
  asset: V4cAssetName;
  size?: number;
  opacity?: number;
};

export function V4cIcon({ asset, size = 24, opacity = 1 }: V4cIconProps) {
  return (
    <Image
      source={v4cSources[asset]}
      style={[styles.icon, { width: size, height: size, opacity }]}
      resizeMode="contain"
    />
  );
}

// Convenience components mirroring the SVG file's exports.
function createGlyphComponent(name: ProvidedGlyphNameV4c) {
  return function GlyphComponentV4c({ size = 24 }: AppIconProps) {
    return <ProvidedGlyphIconV4c name={name} size={size} />;
  };
}

export const BrowseGlyphIconV4c = createGlyphComponent('browse');
export const DealsGlyphIconV4c = createGlyphComponent('deals');
export const FavoritesGlyphIconV4c = createGlyphComponent('favorites');
export const BadgeGlyphIconV4c = createGlyphComponent('badges');
export const LocationGlyphIconV4c = createGlyphComponent('location');
export const MapGlyphIconV4c = createGlyphComponent('map');
export const ProfileGlyphIconV4c = createGlyphComponent('profile');
export const ReviewsGlyphIconV4c = createGlyphComponent('reviews');
export const SavedGlyphIconV4c = createGlyphComponent('saved');
export const SearchGlyphIconV4c = createGlyphComponent('search');
export const StarsGlyphIconV4c = createGlyphComponent('stars');
export const TravelGlyphIconV4c = createGlyphComponent('travel');
export const TrophyGlyphIconV4c = createGlyphComponent('trophy');
export const VerifyGlyphIconV4c = createGlyphComponent('verify');

const styles = StyleSheet.create({
  icon: {
    resizeMode: 'contain',
  },
});
