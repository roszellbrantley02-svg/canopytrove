import React from 'react';
import { Text, View } from 'react-native';
import { styles } from './mapGridPreview/mapGridPreviewStyles';
import {
  getStatusToneStyles,
  getToneStyles,
  PreviewTone,
  PreviewStatusTone,
} from './mapGridPreview/mapGridPreviewTones';

type MapGridPreviewProps = {
  label?: string;
  statusLabel?: string;
  headline?: string;
  supportingText?: string;
  height?: number;
  tone?: PreviewTone;
  statusTone?: PreviewStatusTone;
};

function MapGridPreviewComponent({
  label,
  statusLabel,
  headline = 'Storefront Preview',
  supportingText = 'Verified New York dispensary',
  height = 160,
  tone = 'default',
  statusTone = 'neverVisited',
}: MapGridPreviewProps) {
  const toneStyles = getToneStyles(tone);
  const statusToneStyles = getStatusToneStyles(statusTone);

  return (
    <View
      pointerEvents="none"
      style={[
        styles.shell,
        {
          height,
          borderColor: toneStyles.borderColor,
          shadowColor: toneStyles.shadowColor,
          backgroundColor: toneStyles.panelBackgroundColor,
        },
      ]}
    >
      <View
        style={[
          styles.glowPrimary,
          { backgroundColor: toneStyles.primaryGlowColor },
        ]}
      />
      <View
        style={[
          styles.glowSecondary,
          { backgroundColor: toneStyles.secondaryGlowColor },
        ]}
      />
      <View
        style={[
          styles.gridBlock,
          {
            borderColor: toneStyles.blockBorderColor,
            backgroundColor: toneStyles.blockBackgroundColor,
          },
        ]}
      />
      <View
        style={[
          styles.gridBlockOffset,
          {
            borderColor: toneStyles.blockBorderColor,
            backgroundColor: toneStyles.blockOffsetBackgroundColor,
          },
        ]}
      />

      {label ? (
        <View
          style={[
            styles.labelPill,
            {
              borderColor: toneStyles.labelBorderColor,
              backgroundColor: toneStyles.labelBackgroundColor,
            },
          ]}
        >
          <Text style={[styles.labelText, { color: toneStyles.labelTextColor }]}>{label}</Text>
        </View>
      ) : null}

      {statusLabel ? (
        <View
          style={[
            styles.statusPill,
            {
              borderColor: statusToneStyles.borderColor,
              backgroundColor: statusToneStyles.backgroundColor,
            },
          ]}
        >
          <Text style={[styles.statusText, { color: statusToneStyles.textColor }]}>
            {statusLabel}
          </Text>
        </View>
      ) : null}

      <View style={styles.content}>
        <View style={styles.copyWrap}>
          <Text numberOfLines={1} style={styles.headline}>
            {headline}
          </Text>
          <Text numberOfLines={2} style={styles.supportingText}>
            {supportingText}
          </Text>
        </View>
      </View>
    </View>
  );
}

export const MapGridPreview = React.memo(MapGridPreviewComponent);
