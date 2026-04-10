import React from 'react';
import { ProvidedGlyphIcon } from './ProvidedGlyphIcons';

type TabIconProps = {
  size?: number;
  focused?: boolean;
  accentColor?: string;
};

type TabGlyphName = 'nearby' | 'browse' | 'hotDeals' | 'owner' | 'profile';

export function AppTabIcon({
  name,
  size = 24,
  focused = false,
  accentColor,
}: TabIconProps & { name: TabGlyphName }) {
  const opacity = focused ? 1 : 0.72;
  const iconSize = focused ? size : Math.max(20, size - 1);
  const color = focused && accentColor ? accentColor : undefined;

  switch (name) {
    case 'nearby':
      return <ProvidedGlyphIcon name="map" size={iconSize} opacity={opacity} />;
    case 'browse':
      return <ProvidedGlyphIcon name="browse" size={iconSize} opacity={opacity} />;
    case 'hotDeals':
      return <ProvidedGlyphIcon name="deals" size={iconSize} opacity={opacity} color={color} />;
    case 'owner':
      return (
        <ProvidedGlyphIcon name="storefront" size={iconSize} opacity={opacity} color={color} />
      );
    case 'profile':
      return <ProvidedGlyphIcon name="profile" size={iconSize} opacity={opacity} />;
  }
}
