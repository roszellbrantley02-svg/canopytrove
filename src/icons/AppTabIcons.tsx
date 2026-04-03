import React from 'react';
import { ProvidedGlyphIcon } from './ProvidedGlyphIcons';

type TabIconProps = {
  size?: number;
  focused?: boolean;
};

type TabGlyphName = 'nearby' | 'browse' | 'profile';

export function AppTabIcon({
  name,
  size = 24,
  focused = false,
}: TabIconProps & { name: TabGlyphName }) {
  const opacity = focused ? 1 : 0.72;
  const iconSize = focused ? size : Math.max(20, size - 1);

  switch (name) {
    case 'nearby':
      return <ProvidedGlyphIcon name="map" size={iconSize} opacity={opacity} />;
    case 'browse':
      return <ProvidedGlyphIcon name="browse" size={iconSize} opacity={opacity} />;
    case 'profile':
      return <ProvidedGlyphIcon name="profile" size={iconSize} opacity={opacity} />;
  }
}
