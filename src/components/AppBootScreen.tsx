import React from 'react';
import { LoadingScreen } from '../screens/LoadingScreen';

/**
 * The app's initial loading screen (shown while fonts, last location, saved
 * places, and profile details are being hydrated).
 *
 * Replaced the previous "Getting your app ready." shimmer/skeleton composition
 * with the Canopy Trove pin + compass animation: green map pin rotating one
 * direction, gold compass rose rotating the other.
 *
 * The old composition lives in ./appBoot/AppBootSections.tsx if it's ever
 * needed again (for storybook / a detailed startup screen variant).
 */
export function AppBootScreen() {
  return <LoadingScreen />;
}
