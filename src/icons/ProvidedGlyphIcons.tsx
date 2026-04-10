import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import type { AppIconProps } from './AppIcons';

const DEFAULT_COLOR = '#F3EBDD';
const DEFAULT_STROKE_WIDTH = 1.9;

type GlyphDrawProps = {
  color: string;
  strokeWidth: number;
};

const glyphRenderers = {
  deals: ({ color, strokeWidth }: GlyphDrawProps) => (
    <>
      <Path
        d="M4.75 8.25V5.75A1.25 1.25 0 0 1 6 4.5h2.55l7.2 7.2-5.15 5.15-5.85-5.85Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="7.35" cy="7.1" r="0.9" fill={color} />
    </>
  ),
  favorites: ({ color, strokeWidth }: GlyphDrawProps) => (
    <Path
      d="M12 19.25c-4.35-2.62-6.75-5.1-6.75-7.93A3.82 3.82 0 0 1 9.07 7.5c1.14 0 2.21.51 2.93 1.4.72-.89 1.79-1.4 2.93-1.4a3.82 3.82 0 0 1 3.82 3.82c0 2.83-2.4 5.31-6.75 7.93Z"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  badges: ({ color, strokeWidth }: GlyphDrawProps) => (
    <>
      <Circle cx="12" cy="8.75" r="3.85" stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M9.6 12.1 8.25 18l3.75-2.15L15.75 18l-1.35-5.9"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  browse: ({ color, strokeWidth }: GlyphDrawProps) => (
    <>
      <Rect
        x="4.5"
        y="4.5"
        width="6.25"
        height="6.25"
        rx="1.5"
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <Rect
        x="13.25"
        y="4.5"
        width="6.25"
        height="6.25"
        rx="1.5"
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <Rect
        x="4.5"
        y="13.25"
        width="6.25"
        height="6.25"
        rx="1.5"
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <Rect
        x="13.25"
        y="13.25"
        width="6.25"
        height="6.25"
        rx="1.5"
        stroke={color}
        strokeWidth={strokeWidth}
      />
    </>
  ),
  close: ({ color, strokeWidth }: GlyphDrawProps) => (
    <>
      <Line
        x1="6.5"
        y1="6.5"
        x2="17.5"
        y2="17.5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1="17.5"
        y1="6.5"
        x2="6.5"
        y2="17.5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </>
  ),
  location: ({ color, strokeWidth }: GlyphDrawProps) => (
    <>
      <Path
        d="M12 19.5c3.25-3.6 4.9-6.18 4.9-8.1A4.9 4.9 0 0 0 7.1 11.4c0 1.92 1.65 4.5 4.9 8.1Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="11.2" r="1.8" stroke={color} strokeWidth={strokeWidth} />
    </>
  ),
  map: ({ color, strokeWidth }: GlyphDrawProps) => (
    <>
      <Path
        d="M3.75 6.6 8.55 4.5l6.9 2.1 4.8-2.1v12.9l-4.8 2.1-6.9-2.1-4.8 2.1Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line
        x1="8.55"
        y1="4.5"
        x2="8.55"
        y2="19.5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1="15.45"
        y1="6.6"
        x2="15.45"
        y2="17.4"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </>
  ),
  profile: ({ color, strokeWidth }: GlyphDrawProps) => (
    <>
      <Circle cx="12" cy="8.2" r="3.15" stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M6.2 18.2c1.45-2.72 3.4-4.1 5.8-4.1s4.35 1.38 5.8 4.1"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  storefront: ({ color, strokeWidth }: GlyphDrawProps) => (
    <>
      <Path d="M5.1 8.05h13.8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path
        d="M6.1 8.05 7.1 5.4h9.8l1 2.65"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M6.25 9.15v8.85h11.5V9.15"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M10.05 18V13.5h3.9V18"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M8.15 10.95h1.4M14.45 10.95h1.4"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </>
  ),
  reviews: ({ color, strokeWidth }: GlyphDrawProps) => (
    <>
      <Path
        d="M5.25 6.25h13.5a1.75 1.75 0 0 1 1.75 1.75v7.1a1.75 1.75 0 0 1-1.75 1.75H11.1L7.1 19.5v-2.65H5.25A1.75 1.75 0 0 1 3.5 15.1V8a1.75 1.75 0 0 1 1.75-1.75Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line
        x1="7.35"
        y1="10.1"
        x2="16.65"
        y2="10.1"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1="7.35"
        y1="13.2"
        x2="13.95"
        y2="13.2"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </>
  ),
  saved: ({ color, strokeWidth }: GlyphDrawProps) => (
    <Path
      d="M7.1 4.5h9.8a1.4 1.4 0 0 1 1.4 1.4v13.35L12 15.85l-6.3 3.4V5.9a1.4 1.4 0 0 1 1.4-1.4Z"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  search: ({ color, strokeWidth }: GlyphDrawProps) => (
    <>
      <Circle cx="10.25" cy="10.25" r="4.65" stroke={color} strokeWidth={strokeWidth} />
      <Line
        x1="13.85"
        y1="13.85"
        x2="18.35"
        y2="18.35"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </>
  ),
  stars: ({ color, strokeWidth }: GlyphDrawProps) => (
    <Path
      d="m12 4.65 2.02 4.09 4.52.66-3.27 3.18.78 4.48L12 14.94 7.95 17.06l.78-4.48L5.46 9.4l4.52-.66L12 4.65Z"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  travel: ({ color, strokeWidth }: GlyphDrawProps) => (
    <>
      <Circle cx="6.1" cy="17.2" r="1.55" fill={color} />
      <Circle cx="17.8" cy="6.6" r="1.55" fill={color} />
      <Path
        d="M7.8 16c1.3-.2 2.2-.75 2.9-1.6.72-.9 1.25-2.05 2.2-2.95.88-.82 1.95-1.25 3.4-1.25"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M15.6 4.95 19.5 6.5l-1.55 3.9"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  trophy: ({ color, strokeWidth }: GlyphDrawProps) => (
    <>
      <Path
        d="M8.3 4.75h7.4v3.45a3.7 3.7 0 0 1-3.7 3.7 3.7 3.7 0 0 1-3.7-3.7V4.75Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M8.3 6.3H5.9A2.15 2.15 0 0 0 8.05 8.7h.25M15.7 6.3h2.4A2.15 2.15 0 0 1 15.95 8.7h-.25"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line
        x1="12"
        y1="11.9"
        x2="12"
        y2="15.55"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Path
        d="M9.3 19.25h5.4M10.2 15.55h3.6"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </>
  ),
} as const;

export type ProvidedGlyphName = keyof typeof glyphRenderers;

type ProvidedGlyphIconProps = AppIconProps & {
  name: ProvidedGlyphName;
  opacity?: number;
};

export function ProvidedGlyphIcon({
  name,
  size = 24,
  color = DEFAULT_COLOR,
  strokeWidth = DEFAULT_STROKE_WIDTH,
  opacity = 1,
}: ProvidedGlyphIconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      opacity={opacity}
      style={styles.icon}
    >
      {glyphRenderers[name]({ color, strokeWidth })}
    </Svg>
  );
}

function createGlyphComponent(name: ProvidedGlyphName) {
  return function GlyphComponent({
    size = 24,
    color = DEFAULT_COLOR,
    strokeWidth = DEFAULT_STROKE_WIDTH,
  }: AppIconProps) {
    return <ProvidedGlyphIcon name={name} size={size} color={color} strokeWidth={strokeWidth} />;
  };
}

export const BrowseGlyphIcon = createGlyphComponent('browse');
export const DealsGlyphIcon = createGlyphComponent('deals');
export const FavoritesGlyphIcon = createGlyphComponent('favorites');
export const BadgeGlyphIcon = createGlyphComponent('badges');
export const LocationGlyphIcon = createGlyphComponent('location');
export const MapGlyphIcon = createGlyphComponent('map');
export const ProfileGlyphIcon = createGlyphComponent('profile');
export const ReviewsGlyphIcon = createGlyphComponent('reviews');
export const SavedGlyphIcon = createGlyphComponent('saved');
export const SearchGlyphIcon = createGlyphComponent('search');
export const StarsGlyphIcon = createGlyphComponent('stars');
export const TravelGlyphIcon = createGlyphComponent('travel');
export const TrophyGlyphIcon = createGlyphComponent('trophy');

const styles = StyleSheet.create({
  icon: {
    alignSelf: 'center',
  },
});
