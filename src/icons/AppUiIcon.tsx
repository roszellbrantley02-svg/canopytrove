import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

type IconDrawProps = {
  color: string;
  strokeWidth: number;
};

const DEFAULT_STROKE_WIDTH = 1.9;

const iconRenderers = {
  close: ({ color, strokeWidth }) => (
    <>
      <Line
        x1="6.5"
        y1="6.5"
        x2="17.5"
        y2="17.5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1="17.5"
        y1="6.5"
        x2="6.5"
        y2="17.5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </>
  ),
  'arrow-back': ({ color, strokeWidth }) => (
    <>
      <Line
        x1="18.25"
        y1="12"
        x2="5.75"
        y2="12"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1="10.2"
        y1="7.45"
        x2="5.75"
        y2="12"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1="10.2"
        y1="16.55"
        x2="5.75"
        y2="12"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </>
  ),
  'arrow-forward': ({ color, strokeWidth }) => (
    <>
      <Line
        x1="5.75"
        y1="12"
        x2="18.25"
        y2="12"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1="13.8"
        y1="7.45"
        x2="18.25"
        y2="12"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1="13.8"
        y1="16.55"
        x2="18.25"
        y2="12"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </>
  ),
  'chevron-down': ({ color, strokeWidth }) => (
    <>
      <Line
        x1="7.2"
        y1="9.6"
        x2="12"
        y2="14.4"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1="16.8"
        y1="9.6"
        x2="12"
        y2="14.4"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </>
  ),
  'chevron-forward': ({ color, strokeWidth }) => (
    <>
      <Line
        x1="9.4"
        y1="7.2"
        x2="14.2"
        y2="12"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1="9.4"
        y1="16.8"
        x2="14.2"
        y2="12"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </>
  ),
  star: ({ color, strokeWidth }) => (
    <Path
      d="m12 4.65 2.02 4.09 4.52.66-3.27 3.18.78 4.48L12 14.94 7.95 17.06l.78-4.48L5.46 9.4l4.52-.66L12 4.65Z"
      fill={color}
      stroke={color}
      strokeWidth={Math.max(1, strokeWidth - 0.55)}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  'star-outline': ({ color, strokeWidth }) => (
    <Path
      d="m12 4.65 2.02 4.09 4.52.66-3.27 3.18.78 4.48L12 14.94 7.95 17.06l.78-4.48L5.46 9.4l4.52-.66L12 4.65Z"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  'location-outline': ({ color, strokeWidth }) => (
    <>
      <Path
        d="M12 19.5c3.25-3.6 4.9-6.18 4.9-8.1A4.9 4.9 0 0 0 7.1 11.4c0 1.92 1.65 4.5 4.9 8.1Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="11.2" r="1.8" stroke={color} strokeWidth={strokeWidth} />
    </>
  ),
  'navigate-outline': ({ color, strokeWidth }) => (
    <>
      <Path
        d="M5.25 18.75 9 6.15a1 1 0 0 1 1.82-.19l4.28 7.25 3.65 1.64a1 1 0 0 1-.16 1.88L5.25 18.75Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line
        x1="10.05"
        y1="7.55"
        x2="13.9"
        y2="14.2"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </>
  ),
  navigate: ({ color, strokeWidth }) => (
    <Path
      d="M5.25 18.75 9 6.15a1 1 0 0 1 1.82-.19l4.28 7.25 3.65 1.64a1 1 0 0 1-.16 1.88L5.25 18.75Z"
      fill={color}
      stroke={color}
      strokeWidth={Math.max(1, strokeWidth - 0.55)}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  'navigate-circle': ({ color, strokeWidth }) => (
    <>
      <Circle cx="12" cy="12" r="8.15" fill={color} opacity={0.14} />
      <Circle cx="12" cy="12" r="8.15" stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M8.25 16.25 10.7 7.95a.72.72 0 0 1 1.32-.14l2.82 4.8 2.41 1.09a.72.72 0 0 1-.11 1.35l-8.89 1.2Z"
        fill={color}
        stroke={color}
        strokeWidth={Math.max(1, strokeWidth - 0.55)}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  'compass-outline': ({ color, strokeWidth }) => (
    <>
      <Circle cx="12" cy="12" r="7.25" stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="m9.35 14.65 1.9-5.05 5.05-1.9-1.9 5.05-5.05 1.9Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  compass: ({ color, strokeWidth }) => (
    <>
      <Circle cx="12" cy="12" r="7.25" fill={color} opacity={0.14} />
      <Circle cx="12" cy="12" r="7.25" stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="m9.35 14.65 1.9-5.05 5.05-1.9-1.9 5.05-5.05 1.9Z"
        fill={color}
        stroke={color}
        strokeWidth={Math.max(1, strokeWidth - 0.55)}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  map: ({ color, strokeWidth }) => (
    <>
      <Path
        d="M5.6 6.9 10 5.1l4 1.95 4.4-1.8v11.85L14 18.9l-4-1.95-4.4 1.8V6.9Z"
        fill={color}
        opacity={0.12}
      />
      <Path
        d="M5.6 6.9 10 5.1l4 1.95 4.4-1.8v11.85L14 18.9l-4-1.95-4.4 1.8V6.9Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line
        x1="10"
        y1="5.1"
        x2="10"
        y2="16.95"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1="14"
        y1="7.05"
        x2="14"
        y2="18.9"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </>
  ),
  'map-outline': ({ color, strokeWidth }) => (
    <>
      <Path
        d="M5.6 6.9 10 5.1l4 1.95 4.4-1.8v11.85L14 18.9l-4-1.95-4.4 1.8V6.9Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line
        x1="10"
        y1="5.1"
        x2="10"
        y2="16.95"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1="14"
        y1="7.05"
        x2="14"
        y2="18.9"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </>
  ),
  'time-outline': ({ color, strokeWidth }) => (
    <>
      <Circle cx="12" cy="12" r="7.25" stroke={color} strokeWidth={strokeWidth} />
      <Line
        x1="12"
        y1="12"
        x2="12"
        y2="8.2"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1="12"
        y1="12"
        x2="14.85"
        y2="13.85"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </>
  ),
  'calendar-outline': ({ color, strokeWidth }) => (
    <>
      {/* Calendar body */}
      <Path
        d="M5 6.5h14a1.5 1.5 0 0 1 1.5 1.5v11a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V8A1.5 1.5 0 0 1 5 6.5z"
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
      />
      {/* Top divider line */}
      <Line x1="3.5" y1="10.5" x2="20.5" y2="10.5" stroke={color} strokeWidth={strokeWidth} />
      {/* Two binder rings */}
      <Line
        x1="8"
        y1="4"
        x2="8"
        y2="8"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1="16"
        y1="4"
        x2="16"
        y2="8"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </>
  ),
  'sparkles-outline': ({ color, strokeWidth }) => (
    <>
      <Path
        d="M12 4.6 13.4 8.6 17.4 10 13.4 11.4 12 15.4 10.6 11.4 6.6 10 10.6 8.6 12 4.6Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M18.2 5.8 18.8 7.4 20.4 8 18.8 8.6 18.2 10.2 17.6 8.6 16 8 17.6 7.4 18.2 5.8Z"
        fill={color}
      />
      <Path
        d="M6.2 14.9 6.8 16.5 8.4 17.1 6.8 17.7 6.2 19.3 5.6 17.7 4 17.1 5.6 16.5 6.2 14.9Z"
        fill={color}
      />
    </>
  ),
  sparkles: ({ color, strokeWidth }) => (
    <>
      <Path
        d="M12 4.6 13.4 8.6 17.4 10 13.4 11.4 12 15.4 10.6 11.4 6.6 10 10.6 8.6 12 4.6Z"
        fill={color}
        stroke={color}
        strokeWidth={Math.max(1, strokeWidth - 0.55)}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M18.2 5.8 18.8 7.4 20.4 8 18.8 8.6 18.2 10.2 17.6 8.6 16 8 17.6 7.4 18.2 5.8Z"
        fill={color}
      />
      <Path
        d="M6.2 14.9 6.8 16.5 8.4 17.1 6.8 17.7 6.2 19.3 5.6 17.7 4 17.1 5.6 16.5 6.2 14.9Z"
        fill={color}
      />
    </>
  ),
  'people-outline': ({ color, strokeWidth }) => (
    <>
      <Circle cx="9.15" cy="9.35" r="2.15" stroke={color} strokeWidth={strokeWidth} />
      <Circle cx="15.25" cy="10.1" r="1.7" stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M5.95 17.35c.8-1.8 2.12-2.8 3.95-2.8 1.83 0 3.15 1 3.95 2.8"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M13.8 16.95c.48-1.08 1.35-1.7 2.65-1.7 1.02 0 1.88.4 2.55 1.2"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  people: ({ color, strokeWidth }) => (
    <>
      <Circle cx="9.15" cy="9.35" r="2.15" fill={color} opacity={0.2} />
      <Circle cx="15.25" cy="10.1" r="1.7" fill={color} opacity={0.16} />
      <Circle cx="9.15" cy="9.35" r="2.15" stroke={color} strokeWidth={strokeWidth} />
      <Circle cx="15.25" cy="10.1" r="1.7" stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M5.95 17.35c.8-1.8 2.12-2.8 3.95-2.8 1.83 0 3.15 1 3.95 2.8"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M13.8 16.95c.48-1.08 1.35-1.7 2.65-1.7 1.02 0 1.88.4 2.55 1.2"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  'diamond-outline': ({ color, strokeWidth }) => (
    <Path
      d="M12 4.9 18.15 12 12 19.1 5.85 12 12 4.9Z"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  'brush-outline': ({ color, strokeWidth }) => (
    <>
      <Path
        d="m14.45 6.15 3.4 3.4-6.9 6.9a2.3 2.3 0 0 1-1.63.68H7.4v-1.92c0-.61.24-1.2.68-1.63l6.37-6.42Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M6.55 17.55c-.48.3-.85.78-.95 1.55"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </>
  ),
  'chatbubbles-outline': ({ color, strokeWidth }) => (
    <>
      <Path
        d="M6.85 7.15h7.45a2.7 2.7 0 0 1 2.7 2.7v2.65a2.7 2.7 0 0 1-2.7 2.7H10.3l-2.35 2.05v-2.05H6.85a2.7 2.7 0 0 1-2.7-2.7V9.85a2.7 2.7 0 0 1 2.7-2.7Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M11.7 5.35h4.05a2.1 2.1 0 0 1 2.1 2.1v2.1"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  'shield-checkmark-outline': ({ color, strokeWidth }) => (
    <>
      <Path
        d="M12 4.8 17.7 6.85v4.72c0 3.17-2.18 5.97-5.7 7.58-3.52-1.61-5.7-4.41-5.7-7.58V6.85L12 4.8Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="m9.55 12.15 1.6 1.7 3.4-3.8"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  'shield-checkmark': ({ color, strokeWidth }) => (
    <>
      <Path
        d="M12 4.8 17.7 6.85v4.72c0 3.17-2.18 5.97-5.7 7.58-3.52-1.61-5.7-4.41-5.7-7.58V6.85L12 4.8Z"
        fill={color}
        opacity={0.18}
      />
      <Path
        d="M12 4.8 17.7 6.85v4.72c0 3.17-2.18 5.97-5.7 7.58-3.52-1.61-5.7-4.41-5.7-7.58V6.85L12 4.8Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="m9.55 12.15 1.6 1.7 3.4-3.8"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  'chatbubble-ellipses-outline': ({ color, strokeWidth }) => (
    <>
      <Path
        d="M5.25 6.25h13.5A1.75 1.75 0 0 1 20.5 8v7.1a1.75 1.75 0 0 1-1.75 1.75H11.1L7.1 19.5v-2.65H5.25A1.75 1.75 0 0 1 3.5 15.1V8a1.75 1.75 0 0 1 1.75-1.75Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="8.55" cy="11.55" r="0.9" fill={color} />
      <Circle cx="12" cy="11.55" r="0.9" fill={color} />
      <Circle cx="15.45" cy="11.55" r="0.9" fill={color} />
    </>
  ),
  'information-circle-outline': ({ color, strokeWidth }) => (
    <>
      <Circle cx="12" cy="12" r="7.35" stroke={color} strokeWidth={strokeWidth} />
      <Circle cx="12" cy="8.25" r="0.85" fill={color} />
      <Line
        x1="12"
        y1="10.9"
        x2="12"
        y2="15.75"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </>
  ),
  'eye-outline': ({ color, strokeWidth }) => (
    <>
      <Path
        d="M3.95 12c2.05-3.15 4.72-4.75 8.05-4.75S18 8.85 20.05 12c-2.05 3.15-4.72 4.75-8.05 4.75S6 15.15 3.95 12Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="12" r="2.15" stroke={color} strokeWidth={strokeWidth} />
    </>
  ),
  'eye-off-outline': ({ color, strokeWidth }) => (
    <>
      <Path
        d="M5.2 6.8c1.86-1.4 4.04-2.1 6.8-2.1 3.33 0 6 1.6 8.05 4.75-.86 1.32-1.84 2.37-2.96 3.14"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M18.15 17.2c-1.73 1.02-3.75 1.53-6.15 1.53-3.33 0-6-1.6-8.05-4.75.82-1.27 1.75-2.29 2.8-3.06"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line
        x1="5.4"
        y1="5.4"
        x2="18.6"
        y2="18.6"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </>
  ),
  'thumbs-up-outline': ({ color, strokeWidth }) => (
    <>
      <Path
        d="M10.2 10.45 11.9 6.7a1.55 1.55 0 0 1 2.9.65v2.95h2.38c1 0 1.72.96 1.45 1.93l-1.02 3.66a1.8 1.8 0 0 1-1.74 1.31H9.3a1.8 1.8 0 0 1-1.8-1.8v-4a1.8 1.8 0 0 1 1.8-1.8h.9Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Rect
        x="4.4"
        y="10.35"
        width="2.4"
        height="6.85"
        rx="1.2"
        stroke={color}
        strokeWidth={strokeWidth}
      />
    </>
  ),
  'create-outline': ({ color, strokeWidth }) => (
    <>
      <Path
        d="m6.2 17.8 2.95-.48L17 9.47l-2.47-2.47-7.85 7.85-.48 2.95Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="m12.9 8.62 2.47 2.47"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </>
  ),
  'call-outline': ({ color, strokeWidth }) => (
    <Path
      d="M7.85 5.5h2.9l1.1 2.95-1.75 1.5c.68 1.3 1.65 2.4 2.9 3.3l1.88-1.05 2.52 1.55v2.75c0 .7-.57 1.25-1.27 1.2-5.58-.4-10.03-4.86-10.43-10.43-.05-.7.5-1.27 1.2-1.27Z"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  'globe-outline': ({ color, strokeWidth }) => (
    <>
      <Circle cx="12" cy="12" r="7.3" stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M4.95 9.35h14.1M4.95 14.65h14.1"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Path
        d="M12 4.7c1.95 1.82 3.05 4.2 3.05 7.3S13.95 17.48 12 19.3c-1.95-1.82-3.05-4.2-3.05-7.3S10.05 6.52 12 4.7Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  'restaurant-outline': ({ color, strokeWidth }) => (
    <>
      <Line
        x1="8.2"
        y1="5.55"
        x2="8.2"
        y2="18.45"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1="6.5"
        y1="5.55"
        x2="6.5"
        y2="10.4"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1="9.9"
        y1="5.55"
        x2="9.9"
        y2="10.4"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Path
        d="M14.75 5.55c1.45 0 2.6 1.15 2.6 2.6v10.3"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line
        x1="14.75"
        y1="11"
        x2="17.35"
        y2="11"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </>
  ),
  'bookmark-outline': ({ color, strokeWidth }) => (
    <Path
      d="M7.1 4.5h9.8a1.4 1.4 0 0 1 1.4 1.4v13.35L12 15.85l-6.3 3.4V5.9a1.4 1.4 0 0 1 1.4-1.4Z"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  bookmark: ({ color, strokeWidth }) => (
    <Path
      d="M7.1 4.5h9.8a1.4 1.4 0 0 1 1.4 1.4v13.35L12 15.85l-6.3 3.4V5.9a1.4 1.4 0 0 1 1.4-1.4Z"
      fill={color}
      stroke={color}
      strokeWidth={Math.max(1, strokeWidth - 0.55)}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  'server-outline': ({ color, strokeWidth }) => (
    <>
      <Rect
        x="5.35"
        y="5.2"
        width="13.3"
        height="5.2"
        rx="1.4"
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <Rect
        x="5.35"
        y="13.6"
        width="13.3"
        height="5.2"
        rx="1.4"
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <Circle cx="8.15" cy="7.8" r="0.9" fill={color} />
      <Circle cx="8.15" cy="16.2" r="0.9" fill={color} />
      <Line
        x1="11.1"
        y1="7.8"
        x2="15.8"
        y2="7.8"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1="11.1"
        y1="16.2"
        x2="15.8"
        y2="16.2"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </>
  ),
  'phone-portrait-outline': ({ color, strokeWidth }) => (
    <>
      <Rect
        x="7.7"
        y="4.35"
        width="8.6"
        height="15.3"
        rx="1.9"
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <Line
        x1="10.35"
        y1="6.75"
        x2="13.65"
        y2="6.75"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Circle cx="12" cy="17.15" r="0.78" fill={color} />
    </>
  ),
  'flag-outline': ({ color, strokeWidth }) => (
    <>
      <Line
        x1="7"
        y1="5"
        x2="7"
        y2="19"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Path
        d="M8.35 6.25h7.65l-1.6 2.95 1.6 2.95H8.35"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  'megaphone-outline': ({ color, strokeWidth }) => (
    <>
      <Path
        d="M6.55 12.2 15.8 8.2v7.6l-9.25-4v-3.6Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M6.55 11.35H4.8v1.7h1.75M9.05 14.65l1.1 2.35"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  'options-outline': ({ color, strokeWidth }) => (
    <>
      <Line
        x1="5"
        y1="8"
        x2="19"
        y2="8"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Circle cx="9" cy="8" r="1.6" fill={color} />
      <Line
        x1="5"
        y1="12"
        x2="19"
        y2="12"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Circle cx="15" cy="12" r="1.6" fill={color} />
      <Line
        x1="5"
        y1="16"
        x2="19"
        y2="16"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Circle cx="11.5" cy="16" r="1.6" fill={color} />
    </>
  ),
  notifications: ({ color, strokeWidth }) => (
    <>
      <Path
        d="M12 5.3a3.8 3.8 0 0 1 3.8 3.8v2.1c0 1.05.35 2.08 1 2.9l.6.78H6.6l.6-.78c.65-.82 1-1.85 1-2.9V9.1A3.8 3.8 0 0 1 12 5.3Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M10.05 18.2a2.1 2.1 0 0 0 3.9 0"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Circle cx="16.95" cy="7.25" r="1.55" fill={color} />
    </>
  ),
  'notifications-off-outline': ({ color, strokeWidth }) => (
    <>
      <Path
        d="M12 5.3a3.8 3.8 0 0 1 3.8 3.8v2.1c0 1.05.35 2.08 1 2.9l.6.78H6.6l.6-.78c.65-.82 1-1.85 1-2.9V9.1A3.8 3.8 0 0 1 12 5.3Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M10.05 18.2a2.1 2.1 0 0 0 3.9 0"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1="6.2"
        y1="5.8"
        x2="17.8"
        y2="17.4"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </>
  ),
  'radio-button-on': ({ color, strokeWidth }) => (
    <>
      <Circle cx="12" cy="12" r="6.15" stroke={color} strokeWidth={strokeWidth} />
      <Circle cx="12" cy="12" r="2.5" fill={color} />
    </>
  ),
  'radio-button-off-outline': ({ color, strokeWidth }) => (
    <Circle cx="12" cy="12" r="6.15" stroke={color} strokeWidth={strokeWidth} />
  ),
  'pricetag-outline': ({ color, strokeWidth }) => (
    <>
      <Path
        d="M5 9V6.35A1.35 1.35 0 0 1 6.35 5h2.95L18.55 14.25 14.25 18.55 5 9Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="8.35" cy="8.35" r="0.95" fill={color} />
    </>
  ),
  'ribbon-outline': ({ color, strokeWidth }) => (
    <>
      <Circle cx="12" cy="8.35" r="3.15" stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M9.8 11.2 8.55 18l3.45-2.1L15.45 18l-1.25-6.8"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  ribbon: ({ color, strokeWidth }) => (
    <>
      <Circle cx="12" cy="8.35" r="3.15" fill={color} opacity={0.14} />
      <Circle cx="12" cy="8.35" r="3.15" stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M9.8 11.2 8.55 18l3.45-2.1L15.45 18l-1.25-6.8"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  'trophy-outline': ({ color, strokeWidth }) => (
    <>
      <Path
        d="M8.3 4.75h7.4v3.45a3.7 3.7 0 0 1-3.7 3.7 3.7 3.7 0 0 1-3.7-3.7V4.75Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M8.3 6.3H5.9A2.15 2.15 0 0 0 8.05 8.7h.25M15.7 6.3h2.4A2.15 2.15 0 0 1 15.95 8.7h-.25"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line
        x1="12"
        y1="11.9"
        x2="12"
        y2="15.55"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Path
        d="M9.3 19.25h5.4M10.2 15.55h3.6"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </>
  ),
  trophy: ({ color, strokeWidth }) => (
    <>
      <Path
        d="M8.3 4.75h7.4v3.45a3.7 3.7 0 0 1-3.7 3.7 3.7 3.7 0 0 1-3.7-3.7V4.75Z"
        fill={color}
        opacity={0.16}
      />
      <Path
        d="M8.3 4.75h7.4v3.45a3.7 3.7 0 0 1-3.7 3.7 3.7 3.7 0 0 1-3.7-3.7V4.75Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M8.3 6.3H5.9A2.15 2.15 0 0 0 8.05 8.7h.25M15.7 6.3h2.4A2.15 2.15 0 0 1 15.95 8.7h-.25"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line
        x1="12"
        y1="11.9"
        x2="12"
        y2="15.55"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Path
        d="M9.3 19.25h5.4M10.2 15.55h3.6"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </>
  ),
  'image-outline': ({ color, strokeWidth }) => (
    <>
      <Rect
        x="5.1"
        y="6"
        width="13.8"
        height="12"
        rx="2"
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <Circle cx="9.3" cy="10.1" r="1.25" fill={color} />
      <Path
        d="m7.1 16 3.05-3.1 2.25 2.3 2.2-1.85L16.9 16"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  'images-outline': ({ color, strokeWidth }) => (
    <>
      <Rect
        x="6.3"
        y="5.4"
        width="11.8"
        height="10.8"
        rx="1.8"
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <Rect
        x="4.6"
        y="7.8"
        width="11.8"
        height="10.8"
        rx="1.8"
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <Circle cx="10.1" cy="11.75" r="1.05" fill={color} />
      <Path
        d="m8.15 16 2.7-2.55 1.8 1.75 1.95-1.75 1.8 2.55"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  flame: ({ color, strokeWidth }) => (
    <Path
      d="M12.7 4.8c.9 2.05-.45 3.45-.45 4.95 0 1.3 1 1.9 2 2.85.95.9 1.55 1.92 1.55 3.28A4.35 4.35 0 0 1 11.45 20c-2.35 0-4.25-1.86-4.25-4.15 0-2.9 2.1-4.2 3.15-6.2.55-1.05.8-2.15.7-4 .55.32 1.17.82 1.65 1.45Z"
      fill={color}
      stroke={color}
      strokeWidth={Math.max(1, strokeWidth - 0.55)}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  'flame-outline': ({ color, strokeWidth }) => (
    <Path
      d="M12.7 4.8c.9 2.05-.45 3.45-.45 4.95 0 1.3 1 1.9 2 2.85.95.9 1.55 1.92 1.55 3.28A4.35 4.35 0 0 1 11.45 20c-2.35 0-4.25-1.86-4.25-4.15 0-2.9 2.1-4.2 3.15-6.2.55-1.05.8-2.15.7-4 .55.32 1.17.82 1.65 1.45Z"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  'earth-outline': ({ color, strokeWidth }) => (
    <>
      <Circle cx="12" cy="12" r="7.3" stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M4.95 9.35h14.1M4.95 14.65h14.1"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Path
        d="M12 4.7c1.95 1.82 3.05 4.2 3.05 7.3S13.95 17.48 12 19.3c-1.95-1.82-3.05-4.2-3.05-7.3S10.05 6.52 12 4.7Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  'storefront-outline': ({ color, strokeWidth }) => (
    <>
      <Path
        d="M5.2 9.2h13.6l-1.2-3.9H6.4L5.2 9.2ZM6.2 9.2v8.85h11.6V9.2"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9.35 18.05v-4.25h5.3v4.25"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  'warning-outline': ({ color, strokeWidth }) => (
    <>
      <Path
        d="M12 5.25 19.15 18H4.85L12 5.25Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line
        x1="12"
        y1="9.3"
        x2="12"
        y2="13.25"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Circle cx="12" cy="15.95" r="0.85" fill={color} />
    </>
  ),
  'send-outline': ({ color, strokeWidth }) => (
    <>
      <Path
        d="M4.85 11.95 19.1 5.8l-4.45 12.4-4-4-5.8-2.25Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line
        x1="10.65"
        y1="14.2"
        x2="19.1"
        y2="5.8"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </>
  ),
  'albums-outline': ({ color, strokeWidth }) => (
    <>
      <Rect
        x="6.15"
        y="5.4"
        width="11.25"
        height="10.85"
        rx="1.6"
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <Rect
        x="4.6"
        y="7.75"
        width="11.25"
        height="10.85"
        rx="1.6"
        stroke={color}
        strokeWidth={strokeWidth}
      />
    </>
  ),
  'sync-outline': ({ color, strokeWidth }) => (
    <>
      <Path
        d="M6.9 9.2A5.4 5.4 0 0 1 16.35 7.3"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M17 5.45v2.8h-2.8"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M17.1 14.8A5.4 5.4 0 0 1 7.65 16.7"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M7 18.55v-2.8h2.8"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  'search-outline': ({ color, strokeWidth }) => (
    <>
      <Circle cx="10.35" cy="10.35" r="4.7" stroke={color} strokeWidth={strokeWidth} />
      <Line
        x1="13.95"
        y1="13.95"
        x2="18.35"
        y2="18.35"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </>
  ),
  'open-outline': ({ color, strokeWidth }) => (
    <>
      <Rect
        x="5.2"
        y="4.9"
        width="9.9"
        height="14.2"
        rx="1.5"
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <Path
        d="M18.8 8.45v7.1M15.1 8.45l3.7 3.55-3.7 3.55"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="11.7" cy="12" r="0.85" fill={color} />
    </>
  ),
  'notifications-outline': ({ color, strokeWidth }) => (
    <>
      <Path
        d="M12 5.3a3.8 3.8 0 0 1 3.8 3.8v2.1c0 1.05.35 2.08 1 2.9l.6.78H6.6l.6-.78c.65-.82 1-1.85 1-2.9V9.1A3.8 3.8 0 0 1 12 5.3Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M10.05 18.2a2.1 2.1 0 0 0 3.9 0"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </>
  ),
  'shield-outline': ({ color, strokeWidth }) => (
    <Path
      d="M12 4.8 17.7 6.85v4.72c0 3.17-2.18 5.97-5.7 7.58-3.52-1.61-5.7-4.41-5.7-7.58V6.85L12 4.8Z"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  'pricetags-outline': ({ color, strokeWidth }) => (
    <>
      <Path
        d="M4.6 9.2V6.7A1.2 1.2 0 0 1 5.8 5.5h2.35l5.95 5.95-4.45 4.45L4.6 10.8Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.74}
      />
      <Path
        d="M8.4 8.2V5.75A1.25 1.25 0 0 1 9.65 4.5h2.55l7.2 7.2-5.15 5.15L8.4 11Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="10.95" cy="7.1" r="0.85" fill={color} />
    </>
  ),
  'flash-outline': ({ color, strokeWidth }) => (
    <Path
      d="m13.35 4.9-5.8 7h3.1l-1.05 7.2 5.9-7.2h-3.15l1-7Z"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  'layers-outline': ({ color, strokeWidth }) => (
    <>
      <Path
        d="m12 4.95 7.2 3.85L12 12.65 4.8 8.8 12 4.95Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="m5.95 11.6 6.05 3.2 6.05-3.2"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="m7.15 14.95 4.85 2.6 4.85-2.6"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  'stats-chart-outline': ({ color, strokeWidth }) => (
    <>
      <Line
        x1="5.2"
        y1="18.2"
        x2="18.8"
        y2="18.2"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Path
        d="m6.3 15.45 3.25-3.4 2.75 2.15 5.4-5.65"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="m15.4 8.55 2.35.05-.1 2.35"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  'document-text-outline': ({ color, strokeWidth }) => (
    <>
      <Path
        d="M7 4.75h7.2l3.8 3.8v10a1.45 1.45 0 0 1-1.45 1.45H7a1.45 1.45 0 0 1-1.45-1.45V6.2A1.45 1.45 0 0 1 7 4.75Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Path
        d="M14.2 4.75v3.8H18"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line
        x1="8.9"
        y1="11.25"
        x2="15.2"
        y2="11.25"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1="8.9"
        y1="14.2"
        x2="15.2"
        y2="14.2"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1="8.9"
        y1="17.15"
        x2="13.1"
        y2="17.15"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </>
  ),
  'document-attach-outline': ({ color, strokeWidth }) => (
    <>
      <Path
        d="M7 4.75h7.2l3.8 3.8v10a1.45 1.45 0 0 1-1.45 1.45H7a1.45 1.45 0 0 1-1.45-1.45V6.2A1.45 1.45 0 0 1 7 4.75Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Path
        d="M14.2 4.75v3.8H18"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9.1 14.1v2.1a1.55 1.55 0 0 0 3.1 0v-4.05a1.2 1.2 0 0 1 2.4 0v3.1a2.6 2.6 0 1 1-5.2 0v-1.9"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  'link-outline': ({ color, strokeWidth }) => (
    <>
      <Path
        d="M9.55 14.45 8.1 15.9a3 3 0 0 1-4.25-4.25l2.9-2.9a3 3 0 0 1 4.25 0"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M14.45 9.55 15.9 8.1a3 3 0 0 1 4.25 4.25l-2.9 2.9a3 3 0 0 1-4.25 0"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line
        x1="9.3"
        y1="14.7"
        x2="14.7"
        y2="9.3"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </>
  ),
  'help-buoy-outline': ({ color, strokeWidth }) => (
    <>
      <Circle cx="12" cy="12" r="7.8" stroke={color} strokeWidth={strokeWidth} />
      <Circle cx="12" cy="12" r="3.1" stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M12 4.2v3.1M12 16.7v3.1M4.2 12h3.1M16.7 12h3.1"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </>
  ),
  'cloud-offline-outline': ({ color, strokeWidth }) => (
    <>
      <Path
        d="M8.2 17.25h8.25a3.35 3.35 0 0 0 .75-6.61 4.9 4.9 0 0 0-9.46-1.26 3.32 3.32 0 0 0 .44 6.62Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line
        x1="5.4"
        y1="5.4"
        x2="18.6"
        y2="18.6"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </>
  ),
  'refresh-outline': ({ color, strokeWidth }) => (
    <>
      <Path
        d="M7.1 8.5A6.2 6.2 0 0 1 18 10.3"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Path
        d="m16.5 6.95 1.95 3.45-3.95.3"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M16.9 15.5A6.2 6.2 0 0 1 6 13.7"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Path
        d="m7.5 17.05-1.95-3.45 3.95-.3"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  'lock-closed-outline': ({ color, strokeWidth }) => (
    <>
      <Rect
        x="6.25"
        y="10.5"
        width="11.5"
        height="8.35"
        rx="1.7"
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <Path
        d="M8.8 10.5V8.8a3.2 3.2 0 0 1 6.4 0v1.7"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Circle cx="12" cy="14.45" r="0.95" fill={color} />
    </>
  ),
  'briefcase-outline': ({ color, strokeWidth }) => (
    <>
      <Rect
        x="4.9"
        y="7.55"
        width="14.2"
        height="10.2"
        rx="1.8"
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <Path
        d="M9.25 7.55V6.7a1.55 1.55 0 0 1 1.55-1.55h2.4a1.55 1.55 0 0 1 1.55 1.55v.85"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1="4.9"
        y1="11.55"
        x2="19.1"
        y2="11.55"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </>
  ),
  'camera-outline': ({ color, strokeWidth }) => (
    <>
      <Path
        d="M7.2 7.25h2.2l1.05-1.55h2.9l1.05 1.55h2.38A1.8 1.8 0 0 1 18.6 9.05v7.05a1.8 1.8 0 0 1-1.8 1.8H7.2a1.8 1.8 0 0 1-1.8-1.8V9.05a1.8 1.8 0 0 1 1.8-1.8Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="12.6" r="3.15" stroke={color} strokeWidth={strokeWidth} />
    </>
  ),
  camera: ({ color, strokeWidth }) => (
    <>
      <Path
        d="M7.2 7.25h2.2l1.05-1.55h2.9l1.05 1.55h2.38A1.8 1.8 0 0 1 18.6 9.05v7.05a1.8 1.8 0 0 1-1.8 1.8H7.2a1.8 1.8 0 0 1-1.8-1.8V9.05a1.8 1.8 0 0 1 1.8-1.8Z"
        fill={color}
        opacity={0.14}
      />
      <Path
        d="M7.2 7.25h2.2l1.05-1.55h2.9l1.05 1.55h2.38A1.8 1.8 0 0 1 18.6 9.05v7.05a1.8 1.8 0 0 1-1.8 1.8H7.2a1.8 1.8 0 0 1-1.8-1.8V9.05a1.8 1.8 0 0 1 1.8-1.8Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="12.6" r="3.15" stroke={color} strokeWidth={strokeWidth} />
    </>
  ),
  'mail-open-outline': ({ color, strokeWidth }) => (
    <>
      <Path
        d="m5 9 7-4.35L19 9v8.25A1.25 1.25 0 0 1 17.75 18.5H6.25A1.25 1.25 0 0 1 5 17.25V9Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Path
        d="m5.7 9.4 6.3 4.1 6.3-4.1"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  'person-circle-outline': ({ color, strokeWidth }) => (
    <>
      <Circle cx="12" cy="12" r="8.2" stroke={color} strokeWidth={strokeWidth} />
      <Circle cx="12" cy="10.1" r="2.2" stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M8.2 16.45c.95-1.55 2.2-2.35 3.8-2.35 1.6 0 2.85.8 3.8 2.35"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  'person-circle': ({ color, strokeWidth }) => (
    <>
      <Circle cx="12" cy="12" r="8.2" fill={color} opacity={0.14} />
      <Circle cx="12" cy="12" r="8.2" stroke={color} strokeWidth={strokeWidth} />
      <Circle cx="12" cy="10.1" r="2.2" stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M8.2 16.45c.95-1.55 2.2-2.35 3.8-2.35 1.6 0 2.85.8 3.8 2.35"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  'share-social-outline': ({ color, strokeWidth }) => (
    <>
      <Circle cx="7" cy="12.15" r="1.7" stroke={color} strokeWidth={strokeWidth} />
      <Circle cx="16.95" cy="7.2" r="1.7" stroke={color} strokeWidth={strokeWidth} />
      <Circle cx="16.95" cy="17.1" r="1.7" stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M8.5 11.35 15.25 8M8.5 12.95l6.75 3.35"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </>
  ),
  'rocket-outline': ({ color, strokeWidth }) => (
    <>
      <Path
        d="M11.05 6.1c2.28-.98 4.72-.92 6.85-.6.32 2.13.38 4.57-.6 6.85l-3.15 3.15-3.1-.65-.65-3.1 3.15-3.15Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="14.45" cy="9.65" r="1.05" stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M9.9 13.75 6.6 17.05M10.3 17.4l-1.8 1.2.6-2.45M6.25 13.35l-1.2 1.8 2.45-.6"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  'star-half-outline': ({ color, strokeWidth }) => (
    <>
      <Path
        d="m12 4.65 2.02 4.09 4.52.66-3.27 3.18.78 4.48L12 14.94 7.95 17.06l.78-4.48L5.46 9.4l4.52-.66L12 4.65Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 4.65v10.29l4.05 2.12-.78-4.48 3.27-3.18-4.52-.66L12 4.65Z"
        fill={color}
        opacity={0.2}
      />
    </>
  ),
  'person-add-outline': ({ color, strokeWidth }) => (
    <>
      <Circle cx="10.1" cy="9.1" r="2.6" stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M5.95 17.45c.85-2.18 2.45-3.3 4.8-3.3 1.12 0 2.08.25 2.9.72"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line
        x1="17.4"
        y1="10.2"
        x2="17.4"
        y2="16.1"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1="14.45"
        y1="13.15"
        x2="20.35"
        y2="13.15"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </>
  ),
  'log-in-outline': ({ color, strokeWidth }) => (
    <>
      <Path
        d="M10.1 5.35H6.75A1.55 1.55 0 0 0 5.2 6.9v10.2a1.55 1.55 0 0 0 1.55 1.55h3.35"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1="10.2"
        y1="12"
        x2="18.8"
        y2="12"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Path
        d="M15.25 8.35 18.9 12l-3.65 3.65"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  'log-out-outline': ({ color, strokeWidth }) => (
    <>
      <Path
        d="M13.9 5.35h3.35A1.55 1.55 0 0 1 18.8 6.9v10.2a1.55 1.55 0 0 1-1.55 1.55H13.9"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1="13.8"
        y1="12"
        x2="5.2"
        y2="12"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Path
        d="M8.75 8.35 5.1 12l3.65 3.65"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  'checkmark-circle-outline': ({ color, strokeWidth }) => (
    <>
      <Circle cx="12" cy="12" r="8.2" stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="m8.6 12.35 2.2 2.25 4.75-4.95"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  'checkmark-done-circle-outline': ({ color, strokeWidth }) => (
    <>
      <Circle cx="12" cy="12" r="8.2" stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="m7.5 12.45 1.7 1.9 3.3-3.55"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="m11.25 12.45 1.7 1.9 3.3-3.55"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  'checkmark-circle': ({ color, strokeWidth }) => (
    <>
      <Circle cx="12" cy="12" r="8.2" fill={color} opacity={0.14} />
      <Circle cx="12" cy="12" r="8.2" stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="m8.6 12.35 2.2 2.25 4.75-4.95"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  'archive-outline': ({ color, strokeWidth }) => (
    <>
      <Rect
        x="5.1"
        y="7.7"
        width="13.8"
        height="10.8"
        rx="1.8"
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <Rect
        x="4.35"
        y="5.2"
        width="15.3"
        height="3.3"
        rx="1.2"
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <Line
        x1="9.2"
        y1="12.45"
        x2="14.8"
        y2="12.45"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </>
  ),
  'close-circle-outline': ({ color, strokeWidth }) => (
    <>
      <Circle cx="12" cy="12" r="8.2" stroke={color} strokeWidth={strokeWidth} />
      <Line
        x1="8.7"
        y1="8.7"
        x2="15.3"
        y2="15.3"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1="15.3"
        y1="8.7"
        x2="8.7"
        y2="15.3"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </>
  ),
  'alert-circle-outline': ({ color, strokeWidth }) => (
    <>
      <Circle cx="12" cy="12" r="8.2" stroke={color} strokeWidth={strokeWidth} />
      <Line
        x1="12"
        y1="8.05"
        x2="12"
        y2="12.6"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Circle cx="12" cy="16.25" r="1" fill={color} />
    </>
  ),
  'chatbubble-outline': ({ color, strokeWidth }) => (
    <Path
      d="M5.2 6.3h13.6A1.7 1.7 0 0 1 20.5 8v7.05a1.7 1.7 0 0 1-1.7 1.7H11.2L7.2 19.4v-2.65h-2A1.7 1.7 0 0 1 3.5 15.05V8a1.7 1.7 0 0 1 1.7-1.7Z"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  'arrow-forward-circle-outline': ({ color, strokeWidth }) => (
    <>
      <Circle cx="12" cy="12" r="8.2" stroke={color} strokeWidth={strokeWidth} />
      <Line
        x1="8"
        y1="12"
        x2="15.5"
        y2="12"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Path
        d="M12.2 8.7 15.5 12l-3.3 3.3"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  'save-outline': ({ color, strokeWidth }) => (
    <>
      <Path
        d="M6.2 4.9h10.15l1.45 1.45v11.45A1.3 1.3 0 0 1 16.5 19.1h-9A1.3 1.3 0 0 1 6.2 17.8V4.9Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Rect
        x="8.4"
        y="5.8"
        width="5.9"
        height="3.2"
        rx="0.8"
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <Rect
        x="8.2"
        y="12.8"
        width="7.6"
        height="4.1"
        rx="1"
        stroke={color}
        strokeWidth={strokeWidth}
      />
    </>
  ),
  'beaker-outline': ({ color, strokeWidth }) => (
    <>
      <Path d="M9 3.5h6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path
        d="M9.5 3.5v5.9l-4 9.1a1.5 1.5 0 0 0 1.35 2.1h10.3a1.5 1.5 0 0 0 1.35-2.1L14.5 9.4V3.5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M7.5 15h9" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </>
  ),
  'leaf-outline': ({ color, strokeWidth }) => (
    <>
      <Path
        d="M4.8 19.2C4.8 11.5 10.8 5 19.5 4.5c-.5 8.7-7 14.7-14.7 14.7Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M4.8 19.2 11.5 12.5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </>
  ),
} satisfies Record<string, (props: IconDrawProps) => React.ReactNode>;

export type AppUiIconName = keyof typeof iconRenderers;

const missingIconWarnings = new Set<string>();

type AppUiIconProps = {
  name: AppUiIconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  opacity?: number;
};

export function AppUiIcon({
  name,
  size = 24,
  color = '#F3EBDD',
  strokeWidth = DEFAULT_STROKE_WIDTH,
  opacity = 1,
}: AppUiIconProps) {
  const unsafeName = name as string;
  const renderer =
    (iconRenderers as Record<string, (props: IconDrawProps) => React.ReactNode>)[unsafeName] ??
    iconRenderers['sparkles-outline'];
  const isDevRuntime = typeof __DEV__ !== 'undefined' && __DEV__;

  if (isDevRuntime && !(unsafeName in iconRenderers) && !missingIconWarnings.has(unsafeName)) {
    missingIconWarnings.add(unsafeName);
    console.warn(`[AppUiIcon] Missing icon renderer for "${unsafeName}", using fallback.`);
  }

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      opacity={opacity}
      style={styles.icon}
    >
      {renderer({ color, strokeWidth })}
    </Svg>
  );
}

const styles = StyleSheet.create({
  icon: {
    alignSelf: 'center',
  },
});
