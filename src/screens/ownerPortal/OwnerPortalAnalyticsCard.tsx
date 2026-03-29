import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { ownerPortalStyles as styles } from './ownerPortalStyles';

type OwnerAnalyticsTone = 'warm' | 'success' | 'cyan' | 'rose';

type OwnerAnalyticsStat = {
  label: string;
  value: string;
};

type OwnerPortalAnalyticsCardProps = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  eyebrow: string;
  title: string;
  value: string;
  body: string;
  tone?: OwnerAnalyticsTone;
  progress?: number;
  progressLabel?: string;
  stats?: OwnerAnalyticsStat[];
  footer?: string;
};

function getToneContainerStyle(tone: OwnerAnalyticsTone) {
  switch (tone) {
    case 'success':
      return styles.metricCardSuccess;
    case 'cyan':
      return styles.metricCardCyan;
    case 'rose':
      return styles.metricCardRose;
    case 'warm':
    default:
      return styles.metricCardWarm;
  }
}

function getToneIconStyle(tone: OwnerAnalyticsTone) {
  switch (tone) {
    case 'success':
      return styles.metricIconBadgeSuccess;
    case 'cyan':
      return styles.metricIconBadgeCyan;
    case 'rose':
      return styles.metricIconBadgeRose;
    case 'warm':
    default:
      return styles.metricIconBadgeWarm;
  }
}

function getToneProgressStyle(tone: OwnerAnalyticsTone) {
  switch (tone) {
    case 'success':
      return styles.metricProgressFillSuccess;
    case 'cyan':
      return styles.metricProgressFillCyan;
    case 'rose':
      return styles.metricProgressFillRose;
    case 'warm':
    default:
      return styles.metricProgressFillWarm;
  }
}

function clampProgress(value: number | undefined) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value ?? 0));
}

export function OwnerPortalAnalyticsCard({
  icon,
  eyebrow,
  title,
  value,
  body,
  tone = 'warm',
  progress,
  progressLabel,
  stats,
  footer,
}: OwnerPortalAnalyticsCardProps) {
  const normalizedProgress = clampProgress(progress);

  return (
    <View style={[styles.metricCard, styles.analyticsMetricCard, getToneContainerStyle(tone)]}>
      <View style={styles.metricCardHeader}>
        <Text style={styles.metricEyebrow}>{eyebrow}</Text>
        <View style={[styles.metricIconBadge, getToneIconStyle(tone)]}>
          <Ionicons
            color={
              tone === 'rose'
                ? '#FFD7D1'
                : tone === 'cyan'
                  ? '#CBEFFF'
                  : tone === 'success'
                    ? '#B8FFD5'
                    : '#F8E0A2'
            }
            name={icon}
            size={16}
          />
        </View>
      </View>

      <View style={styles.metricValueColumn}>
        <Text style={styles.metricValue}>{value}</Text>
        <Text style={styles.analyticsMetricTitle}>{title}</Text>
      </View>

      <Text style={styles.metricHelper}>{body}</Text>

      {progress !== undefined ? (
        <View style={styles.metricProgressBlock}>
          <View style={styles.metricProgressTrack}>
            <View
              style={[
                styles.metricProgressFill,
                getToneProgressStyle(tone),
                { width: `${Math.max(normalizedProgress * 100, normalizedProgress > 0 ? 12 : 0)}%` },
              ]}
            />
          </View>
          {progressLabel ? <Text style={styles.metricProgressLabel}>{progressLabel}</Text> : null}
        </View>
      ) : null}

      {stats?.length ? (
        <View style={styles.metricChipRow}>
          {stats.map((stat) => (
            <View key={`${stat.label}-${stat.value}`} style={styles.metricChip}>
              <Text style={styles.metricChipValue}>{stat.value}</Text>
              <Text style={styles.metricChipLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {footer ? <Text style={styles.metricFooter}>{footer}</Text> : null}
    </View>
  );
}
