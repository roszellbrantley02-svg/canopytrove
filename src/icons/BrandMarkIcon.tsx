import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

type BrandMarkIconProps = {
  size?: number;
  opacity?: number;
};

const canopyStroke = '#5E866E';
const accentFill = '#C8A66A';

export function BrandMarkIcon({ size = 24, opacity = 1 }: BrandMarkIconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      opacity={opacity}
      style={styles.icon}
    >
      <Path
        d="M4.3 11.05C5.18 7.48 8.18 5.05 12 5.05s6.82 2.43 7.7 6"
        stroke={canopyStroke}
        strokeWidth={2.15}
        strokeLinecap="round"
      />
      <Path
        d="m12 10.05.93 1.88 2.07.3-1.5 1.47.35 2.05L12 14.79l-1.85.96.35-2.05-1.5-1.47 2.07-.3L12 10.05Z"
        fill={accentFill}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  icon: {
    alignSelf: 'center',
  },
});
