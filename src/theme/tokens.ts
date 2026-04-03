import type { TextStyle } from 'react-native';

export const colors = {
  backgroundDeep: '#060B10',
  background: '#0A1117',
  backgroundAlt: '#0D151C',
  surface: '#101820',
  surfaceElevated: '#12202A',
  surfaceGlass: 'rgba(15, 24, 31, 0.76)',
  surfaceGlassStrong: 'rgba(18, 32, 42, 0.94)',
  card: '#0B1016',
  cardMuted: '#111A22',
  surfaceHighlight: 'rgba(255, 255, 255, 0.04)',
  borderSoft: 'rgba(143, 255, 209, 0.10)',
  border: 'rgba(0, 245, 140, 0.14)',
  borderStrong: 'rgba(0, 245, 140, 0.28)',
  text: '#F2F8F6',
  textMuted: '#A9B9B4',
  textSoft: '#738680',
  primary: '#00F58C',
  primaryDeep: '#00B86B',
  accent: '#8FFFD1',
  cyan: '#00D7FF',
  blue: '#4D9CFF',
  gold: '#F5C86A',
  goldSoft: '#FFE0A6',
  purple: '#8C3BFF',
  warning: '#F7C765',
  danger: '#FF7A7A',
  rose: '#FF9A86',
  shadow: '#02060A',
  overlay: 'rgba(5, 10, 14, 0.74)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radii = {
  sm: 12,
  md: 18,
  lg: 24,
  xl: 30,
  pill: 999,
};

export const typography = {
  display: 32,
  title: 24,
  section: 18,
  body: 15,
  caption: 12,
};

export const fontFamilies = {
  display: 'SpaceGrotesk_700Bold',
  displayMedium: 'SpaceGrotesk_500Medium',
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodyBold: 'DMSans_700Bold',
} as const;

export const textStyles = {
  display: {
    fontFamily: fontFamilies.display,
    fontSize: typography.display,
    lineHeight: 40,
    letterSpacing: -0.55,
  } satisfies TextStyle,
  title: {
    fontFamily: fontFamilies.display,
    fontSize: typography.title,
    lineHeight: 32,
    letterSpacing: -0.35,
  } satisfies TextStyle,
  section: {
    fontFamily: fontFamilies.displayMedium,
    fontSize: typography.section,
    lineHeight: 26,
    letterSpacing: -0.18,
  } satisfies TextStyle,
  body: {
    fontFamily: fontFamilies.body,
    fontSize: typography.body,
    lineHeight: 24,
  } satisfies TextStyle,
  bodyStrong: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: typography.body,
    lineHeight: 24,
  } satisfies TextStyle,
  caption: {
    fontFamily: fontFamilies.bodyMedium,
    fontSize: typography.caption,
    lineHeight: 18,
  } satisfies TextStyle,
  labelCaps: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: typography.caption,
    lineHeight: 18,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  } satisfies TextStyle,
  button: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: typography.body,
    lineHeight: 22,
    letterSpacing: 0.3,
  } satisfies TextStyle,
} as const;

export const motion = {
  quick: 180,
  dense: 210,
  standard: 260,
  ambient: 420,
  page: 220,
  denseRevealDistance: 9,
  revealDistance: 14,
  revealScale: 0.988,
  denseSectionStagger: 20,
  sectionStagger: 70,
  tabLift: 3,
  tabSceneShift: 10,
};
