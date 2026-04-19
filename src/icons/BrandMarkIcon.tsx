import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';

type BrandMarkIconProps = {
  size?: number;
  opacity?: number;
};

const pinFill = '#4A6741';
const pinHighlight = '#5E866E';
const compassFill = '#C8A66A';

// The raw pin paths span y=1.5 → y=22.5 inside a 0 0 24 24 viewBox, which
// leaves only ~1.5 units of room on every edge and lets the pin tip look
// cramped — it used to read as "pushed down" in small round containers
// (age gate header logo, ScreenShell brand pill, 404 screen). We wrap the
// geometry in a group and scale it to 0.86 around the viewBox center so the
// whole pin gets visible margin on all four sides, then nudge it up by ~0.6
// units so the compass rose (the perceived focal point of the mark) sits
// closer to optical center of the frame rather than trailing the tip into
// the bottom edge.
const PIN_SCALE = 0.86;
const PIN_TRANSLATE_X = (1 - PIN_SCALE) * 12;
const PIN_TRANSLATE_Y = (1 - PIN_SCALE) * 12 - 0.6;
const PIN_TRANSFORM = `translate(${PIN_TRANSLATE_X} ${PIN_TRANSLATE_Y}) scale(${PIN_SCALE})`;

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
      <G transform={PIN_TRANSFORM}>
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
      </G>
    </Svg>
  );
}

const styles = StyleSheet.create({
  icon: {
    alignSelf: 'center',
  },
});
