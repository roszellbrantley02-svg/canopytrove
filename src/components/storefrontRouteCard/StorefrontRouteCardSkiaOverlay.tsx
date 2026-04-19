/**
 * Holographic shine overlay painted on top of every StorefrontRouteCard.
 *
 * Temporarily stubbed to a no-op render until `react-native-reanimated`
 * (required by `@shopify/react-native-skia`'s animation hooks such as
 * `useClock` / `useDerivedValue`) is added back to the dependency tree.
 * Once reanimated is installed, restore the Canvas + Shader implementation
 * (kept below in a comment block for reference) and the feature flag
 * `EXPO_PUBLIC_DISABLE_CARD_SKIA` can once again toggle it live.
 *
 * The shader source lives in `storefrontRouteCardShine.sksl` in git
 * history — grep for SHINE_SRC in prior commits if needed.
 */

import React from 'react';

type Props = {
  /** Disable the shine for cards where it would compete visually. */
  enabled?: boolean;
};

function StorefrontRouteCardSkiaOverlayComponent(_props: Props) {
  return null;
}

export const StorefrontRouteCardSkiaOverlay = React.memo(
  StorefrontRouteCardSkiaOverlayComponent,
);
