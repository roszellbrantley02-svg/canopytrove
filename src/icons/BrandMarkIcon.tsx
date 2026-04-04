import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

type BrandMarkIconProps = {
  size?: number;
  opacity?: number;
};

const pinFill = '#4A6741';
const pinHighlight = '#5E866E';
const compassFill = '#C8A66A';

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
      {/* Location pin body */}
      <Path
        d="M12 1.5C7.86 1.5 4.5 4.86 4.5 9c0 5.25 7.5 13.5 7.5 13.5s7.5-8.25 7.5-13.5c0-4.14-3.36-7.5-7.5-7.5Z"
        fill={pinFill}
      />
      {/* Subtle highlight on the pin */}
      <Path
        d="M12 1.5C7.86 1.5 4.5 4.86 4.5 9c0 5.25 7.5 13.5 7.5 13.5V1.5Z"
        fill={pinHighlight}
        opacity={0.3}
      />
      {/* White inner circle */}
      <Circle cx={12} cy={9} r={4.8} fill="#FFFFFF" />
      {/* Gold compass rose — 4 main points */}
      <Path
        d="M12 4.8l.55 3.1h.01L15.6 9l-3.04.55v.01L12 13.2l-.56-3.64L8.4 9l3.04-.55L12 4.8Z"
        fill={compassFill}
      />
      {/* Compass rose — 4 diagonal points */}
      <Path
        d="M14.2 6.3l-.7 2.05 2.05-.7-2.05.7.7 2.05-.7-2.05-2.05.7 2.05-.7ZM9.8 6.3l.7 2.05-2.05-.7 2.05.7-.7 2.05.7-2.05 2.05.7-2.05-.7Z"
        fill={compassFill}
        opacity={0.7}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  icon: {
    alignSelf: 'center',
  },
});
