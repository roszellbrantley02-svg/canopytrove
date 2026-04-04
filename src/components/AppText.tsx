import React from 'react';
import { Text, type TextProps } from 'react-native';

/**
 * App-wide Text component that enforces accessibility defaults.
 *
 * - Caps Dynamic Type scaling at 1.3x to prevent layout breakage
 * - Allows override via maxFontSizeMultiplier prop
 * - Drop-in replacement for React Native's Text
 */
export function AppText({ maxFontSizeMultiplier = 1.3, ...props }: TextProps) {
  return <Text maxFontSizeMultiplier={maxFontSizeMultiplier} {...props} />;
}

/**
 * Heading variant with slightly tighter scaling cap (1.2x).
 * Use for titles and section headings where space is constrained.
 */
export function AppHeading({ maxFontSizeMultiplier = 1.2, ...props }: TextProps) {
  return <Text maxFontSizeMultiplier={maxFontSizeMultiplier} {...props} />;
}
