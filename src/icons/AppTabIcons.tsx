import React from 'react';
import { BrowseIcon, LocationPinIcon, ProfileIcon } from './AppIcons';
import { LayeredAppIcon } from './LayeredAppIcon';
import { colors } from '../theme/tokens';

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
  const outlineColor = focused ? colors.primary : 'rgba(143, 255, 209, 0.48)';
  const fillColor = focused ? '#FCFFFE' : 'rgba(242, 248, 246, 0.82)';
  const outlineStroke = focused ? 3.8 : 3.2;
  const fillStroke = focused ? 1.95 : 1.7;

  switch (name) {
    case 'nearby':
      return (
        <LayeredAppIcon
          icon={LocationPinIcon}
          size={size}
          outlineColor={outlineColor}
          fillColor={fillColor}
          outlineStroke={outlineStroke}
          fillStroke={fillStroke}
        />
      );
    case 'browse':
      return (
        <LayeredAppIcon
          icon={BrowseIcon}
          size={size}
          outlineColor={outlineColor}
          fillColor={fillColor}
          outlineStroke={outlineStroke}
          fillStroke={fillStroke}
        />
      );
    case 'profile':
      return (
        <LayeredAppIcon
          icon={ProfileIcon}
          size={size}
          outlineColor={outlineColor}
          fillColor={fillColor}
          outlineStroke={outlineStroke}
          fillStroke={fillStroke}
        />
      );
  }
}
