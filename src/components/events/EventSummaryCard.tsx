import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { HapticPressable } from '../HapticPressable';
import { AppUiIcon } from '../../icons/AppUiIcon';
import { colors, fontFamilies, radii, spacing, typography } from '../../theme/tokens';
import type { CanopyEvent } from '../../types/events';
import {
  formatEventCategoryLabel,
  formatEventDateLabel,
  formatEventRelativeLabel,
  formatEventTimeLabel,
} from '../../utils/eventDateFormat';

// Card-shape used in the Travel & Events list. Tap → opens EventDetailScreen.
// Layout:
//   [date pill] [relative-time pill]
//   Title (2 lines max)
//   Summary (2 lines max)
//   [pin] City, Region   [calendar] Time   [tag] Category
//   [free / 21+ chips]
//
// Two visual variants:
//   - 'feature' — used for the first item; slightly larger title + image hero
//   - 'list'    — denser, compact card (default for everything else)

type Props = {
  event: CanopyEvent;
  variant?: 'feature' | 'list';
  onPress: (event: CanopyEvent) => void;
};

export function EventSummaryCard({ event, variant = 'list', onPress }: Props) {
  const dateLabel = formatEventDateLabel(event);
  const relative = formatEventRelativeLabel(event);
  const timeLabel = formatEventTimeLabel(event);
  const categoryLabel = formatEventCategoryLabel(event);
  const locationLabel = [event.city, event.region]
    .filter((s): s is string => Boolean(s && s.trim()))
    .join(', ');
  const isFeature = variant === 'feature';

  return (
    <HapticPressable
      accessibilityRole="button"
      accessibilityLabel={`${event.title}. ${dateLabel}. ${locationLabel || event.venueName}.`}
      onPress={() => onPress(event)}
      style={[styles.card, isFeature && styles.cardFeature]}
    >
      {isFeature && event.photoUrl ? (
        <Image
          source={{ uri: event.photoUrl }}
          style={styles.heroImage}
          contentFit="cover"
          transition={150}
        />
      ) : null}

      <View style={styles.body}>
        <View style={styles.pillRow}>
          <View style={[styles.pill, styles.datePill]}>
            <AppUiIcon name="calendar-outline" size={11} color={colors.primary} />
            <Text style={styles.datePillText}>{dateLabel}</Text>
          </View>
          {relative ? (
            <View style={[styles.pill, styles.relativePill]}>
              <Text style={styles.relativePillText}>{relative}</Text>
            </View>
          ) : null}
        </View>

        <Text style={[styles.title, isFeature && styles.titleFeature]} numberOfLines={2}>
          {event.title}
        </Text>

        {event.summary ? (
          <Text style={styles.summary} numberOfLines={2}>
            {event.summary}
          </Text>
        ) : null}

        <View style={styles.metaRow}>
          {locationLabel ? (
            <View style={styles.metaItem}>
              <AppUiIcon name="location-outline" size={12} color={colors.textMuted} />
              <Text style={styles.metaText} numberOfLines={1}>
                {locationLabel}
              </Text>
            </View>
          ) : null}
          {timeLabel ? (
            <View style={styles.metaItem}>
              <AppUiIcon name="time-outline" size={12} color={colors.textMuted} />
              <Text style={styles.metaText} numberOfLines={1}>
                {timeLabel}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.chipRow}>
          <View style={styles.chip}>
            <Text style={styles.chipText}>{categoryLabel}</Text>
          </View>
          {event.isFree ? (
            <View style={[styles.chip, styles.chipAccent]}>
              <Text style={[styles.chipText, styles.chipAccentText]}>Free</Text>
            </View>
          ) : null}
          {event.ageRestriction ? (
            <View style={styles.chip}>
              <Text style={styles.chipText}>{event.ageRestriction}</Text>
            </View>
          ) : null}
          {event.isMultiDay ? (
            <View style={styles.chip}>
              <Text style={styles.chipText}>Multi-day</Text>
            </View>
          ) : null}
        </View>
      </View>
    </HapticPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
    borderWidth: 1,
    borderRadius: radii.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  cardFeature: {
    borderColor: colors.borderStrong,
  },
  heroImage: {
    width: '100%',
    height: 160,
    backgroundColor: colors.surfaceElevated,
  },
  body: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  datePill: {
    backgroundColor: 'rgba(0, 245, 140, 0.10)',
    borderColor: 'rgba(0, 245, 140, 0.24)',
  },
  datePillText: {
    fontFamily: fontFamilies.bodyMedium,
    fontSize: typography.caption,
    color: colors.primary,
  },
  relativePill: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.borderSoft,
  },
  relativePillText: {
    fontFamily: fontFamilies.bodyMedium,
    fontSize: typography.caption,
    color: colors.textMuted,
  },
  title: {
    fontFamily: fontFamilies.display,
    fontSize: typography.title - 4,
    color: colors.text,
    marginTop: 2,
  },
  titleFeature: {
    fontSize: typography.title,
  },
  summary: {
    fontFamily: fontFamilies.body,
    fontSize: typography.body,
    color: colors.textMuted,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: 2,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontFamily: fontFamilies.body,
    fontSize: typography.caption,
    color: colors.textMuted,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: 4,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.borderSoft,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipAccent: {
    backgroundColor: 'rgba(0, 245, 140, 0.12)',
    borderColor: 'rgba(0, 245, 140, 0.30)',
  },
  chipText: {
    fontFamily: fontFamilies.bodyMedium,
    fontSize: typography.caption,
    color: colors.textSoft,
  },
  chipAccentText: {
    color: colors.primary,
  },
});
