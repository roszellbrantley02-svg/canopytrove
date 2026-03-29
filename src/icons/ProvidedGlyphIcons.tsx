import React from 'react';
import { Image, StyleSheet } from 'react-native';
import type { AppIconProps } from './AppIcons';

const glyphSources = {
  badges: require('../../assets/map-icon-cutouts-v3/glyphs/badges.png'),
  browse: require('../../assets/map-icon-cutouts-v3/glyphs/browse.png'),
  close: require('../../assets/map-icon-cutouts-v3/glyphs/close.png'),
  location: require('../../assets/map-icon-cutouts-v3/glyphs/location.png'),
  profile: require('../../assets/map-icon-cutouts-v3/glyphs/profile.png'),
  reviews: require('../../assets/map-icon-cutouts-v3/glyphs/reviews.png'),
  search: require('../../assets/map-icon-cutouts-v3/glyphs/search.png'),
  stars: require('../../assets/map-icon-cutouts-v3/glyphs/stars.png'),
  trophy: require('../../assets/map-icon-cutouts-v3/glyphs/trophy.png'),
} as const;

export type ProvidedGlyphName = keyof typeof glyphSources;

type ProvidedGlyphIconProps = AppIconProps & {
  name: ProvidedGlyphName;
  opacity?: number;
};

export function ProvidedGlyphIcon({
  name,
  size = 24,
  opacity = 1,
}: ProvidedGlyphIconProps) {
  return (
    <Image
      source={glyphSources[name]}
      fadeDuration={0}
      resizeMode="contain"
      style={[styles.icon, { width: size, height: size, opacity }]}
    />
  );
}

function createGlyphComponent(name: ProvidedGlyphName) {
  return function GlyphComponent({ size = 24 }: AppIconProps) {
    return <ProvidedGlyphIcon name={name} size={size} />;
  };
}

export const BrowseGlyphIcon = createGlyphComponent('browse');
export const BadgeGlyphIcon = createGlyphComponent('badges');
export const LocationGlyphIcon = createGlyphComponent('location');
export const ProfileGlyphIcon = createGlyphComponent('profile');
export const ReviewsGlyphIcon = createGlyphComponent('reviews');
export const SearchGlyphIcon = createGlyphComponent('search');
export const StarsGlyphIcon = createGlyphComponent('stars');
export const TrophyGlyphIcon = createGlyphComponent('trophy');

const styles = StyleSheet.create({
  icon: {
    alignSelf: 'center',
  },
});
