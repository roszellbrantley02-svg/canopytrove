import React from 'react';
import { Image, Text, View } from 'react-native';
import { styles } from './mapGridPreview/mapGridPreviewStyles';
import type { PreviewTone, PreviewStatusTone } from './mapGridPreview/mapGridPreviewTones';
import { getStatusToneStyles, getToneStyles } from './mapGridPreview/mapGridPreviewTones';

type MapGridPreviewProps = {
  label?: string;
  statusLabel?: string;
  headline?: string;
  supportingText?: string;
  height?: number;
  imageUrl?: string | null;
  tone?: PreviewTone;
  statusTone?: PreviewStatusTone;
};

function MapGridPreviewComponent({
  label,
  statusLabel,
  headline = 'Storefront Preview',
  supportingText = 'Verified New York dispensary',
  height = 160,
  imageUrl,
  tone = 'default',
  statusTone = 'neverVisited',
}: MapGridPreviewProps) {
  const toneStyles = getToneStyles(tone);
  const statusToneStyles = getStatusToneStyles(statusTone);
  const hasImage = typeof imageUrl === 'string' && imageUrl.trim().length > 0;
  const shellStyle = {
    height,
    borderColor: toneStyles.borderColor,
    shadowColor: toneStyles.shadowColor,
    backgroundColor: toneStyles.panelBackgroundColor,
  };
  const glowPrimaryStyle = {
    backgroundColor: toneStyles.primaryGlowColor,
    opacity: hasImage ? 0.5 : 1,
  };
  const glowSecondaryStyle = {
    backgroundColor: toneStyles.secondaryGlowColor,
    opacity: hasImage ? 0.45 : 1,
  };
  const gridBlockStyle = {
    borderColor: toneStyles.blockBorderColor,
    backgroundColor: hasImage ? 'rgba(9, 14, 16, 0.22)' : toneStyles.blockBackgroundColor,
  };
  const gridBlockOffsetStyle = {
    borderColor: toneStyles.blockBorderColor,
    backgroundColor: hasImage ? 'rgba(9, 14, 16, 0.18)' : toneStyles.blockOffsetBackgroundColor,
  };
  const labelPillStyle = {
    borderColor: toneStyles.labelBorderColor,
    backgroundColor: toneStyles.labelBackgroundColor,
  };
  const labelTextStyle = {
    color: toneStyles.labelTextColor,
  };
  const statusPillStyle = {
    borderColor: statusToneStyles.borderColor,
    backgroundColor: statusToneStyles.backgroundColor,
  };
  const statusTextStyle = {
    color: statusToneStyles.textColor,
  };

  return (
    <View pointerEvents="none" style={[styles.shell, shellStyle]}>
      {hasImage ? (
        <>
          <Image source={{ uri: imageUrl }} style={styles.imageBackground} />
          <View style={styles.imageOverlay} />
        </>
      ) : null}
      <View style={[styles.glowPrimary, glowPrimaryStyle]} />
      <View style={[styles.glowSecondary, glowSecondaryStyle]} />
      <View style={[styles.gridBlock, gridBlockStyle]} />
      <View style={[styles.gridBlockOffset, gridBlockOffsetStyle]} />

      {label || statusLabel ? (
        <View style={styles.topRail}>
          <View style={styles.topRailStart}>
            {label ? (
              <View style={[styles.labelPill, labelPillStyle]}>
                <Text style={[styles.labelText, labelTextStyle]}>{label}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.topRailEnd}>
            {statusLabel ? (
              <View style={[styles.statusPill, statusPillStyle]}>
                <Text style={[styles.statusText, statusTextStyle]}>{statusLabel}</Text>
              </View>
            ) : null}
          </View>
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
