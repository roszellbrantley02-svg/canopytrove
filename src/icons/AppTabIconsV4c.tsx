import React from 'react';
import { V4cIcon } from './ProvidedGlyphIconsV4c';

/**
 * Bottom-nav tab icons rendered from the v4c PNG pack.
 *
 * Parallel to AppTabIcons.tsx — swap the import in your tab bar from
 * './AppTabIcons' to './AppTabIconsV4c' when ready. Same API, same tab names.
 *
 * The v4c PNGs are color-baked so the `accentColor` prop is accepted for API
 * compat but not applied. Focus is communicated via opacity + size.
 */

type TabIconProps = {
  size?: number;
  focused?: boolean;
  accentColor?: string;
};

type TabGlyphName = 'nearby' | 'browse' | 'hotDeals' | 'verify' | 'owner' | 'profile';

export function AppTabIconV4c({
  name,
  size = 24,
  focused = false,
}: TabIconProps & { name: TabGlyphName }) {
  const opacity = focused ? 1 : 0.72;
  const iconSize = focused ? size : Math.max(20, size - 1);

  switch (name) {
    case 'nearby':
      return <V4cIcon asset="AppNav_Nearby" size={iconSize} opacity={opacity} />;
    case 'browse':
      return <V4cIcon asset="AppNav_Browse" size={iconSize} opacity={opacity} />;
    case 'hotDeals':
      return <V4cIcon asset="AppNav_HotDeals" size={iconSize} opacity={opacity} />;
    case 'verify':
      return <V4cIcon asset="AppNav_Verify" size={iconSize} opacity={opacity} />;
    case 'owner':
      return <V4cIcon asset="AppNav_Home" size={iconSize} opacity={opacity} />;
    case 'profile':
      return <V4cIcon asset="AppNav_Profile" size={iconSize} opacity={opacity} />;
  }
}
