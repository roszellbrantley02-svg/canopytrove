import React from 'react';
import { useRoute, type RouteProp } from '@react-navigation/native';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import { ScreenShell } from '../components/ScreenShell';
import { MotionInView } from '../components/MotionInView';
import { AppUiIcon } from '../icons/AppUiIcon';
import { useCanopyEventDetail } from '../hooks/useCanopyEvents';
import { buildEventDirectionsUrl, openEventDirections } from '../services/eventsService';
import { colors, fontFamilies, radii, spacing, typography } from '../theme/tokens';
import {
  formatEventCategoryLabel,
  formatEventFullWhen,
  formatEventRelativeLabel,
} from '../utils/eventDateFormat';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Route = RouteProp<RootStackParamList, 'EventDetail'>;

function EventDetailScreenInner() {
  const route = useRoute<Route>();
  const { eventId } = route.params ?? { eventId: '' };
  const { status, event, errorText } = useCanopyEventDetail(eventId);

  return (
    <ScreenShell
      eyebrow="Event"
      title={event?.title ?? 'Event details'}
      subtitle={event?.summary ?? 'Loading the full event details…'}
      showHero={false}
    >
      <ScrollView contentContainerStyle={styles.scrollBody}>
        {status === 'loading' ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null}

        {(status === 'not_found' || status === 'error') && !event ? (
          <View style={styles.errorPanel}>
            <Text style={styles.errorTitle}>
              {status === 'not_found' ? 'Event not found.' : 'Could not load event.'}
            </Text>
            <Text style={styles.errorBody}>
              {errorText ?? 'It may have been removed. Try again from the Travel & Events list.'}
            </Text>
          </View>
        ) : null}

        {event ? <EventBody event={event} /> : null}
      </ScrollView>
    </ScreenShell>
  );
}

function EventBody({
  event,
}: {
  event: NonNullable<ReturnType<typeof useCanopyEventDetail>['event']>;
}) {
  const directionsUrl = buildEventDirectionsUrl(event);
  const fullWhen = formatEventFullWhen(event);
  const relative = formatEventRelativeLabel(event);
  const categoryLabel = formatEventCategoryLabel(event);
  const locationLine = [event.venueName, event.addressLine1, event.city, event.state, event.zip]
    .filter((s): s is string => Boolean(s && s.trim()))
    .join(', ');

  const onDriveThere = async () => {
    if (!directionsUrl) return;
    const opened = await openEventDirections(event);
    if (!opened && Platform.OS === 'web' && typeof window !== 'undefined') {
      // Fallback for web — open in a new tab
      window.open(directionsUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const onOpenWebsite = () => {
    if (!event.websiteUrl) return;
    void Linking.openURL(event.websiteUrl);
  };

  const onOpenTickets = () => {
    if (!event.ticketUrl) return;
    void Linking.openURL(event.ticketUrl);
  };

  return (
    <View style={styles.body}>
      {event.photoUrl ? (
        <MotionInView delay={40}>
          <Image
            source={{ uri: event.photoUrl }}
            style={styles.heroImage}
            contentFit="cover"
            transition={150}
          />
        </MotionInView>
      ) : null}

      <MotionInView delay={80}>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>When</Text>
          <View style={styles.row}>
            <AppUiIcon name="calendar-outline" size={18} color={colors.primary} />
            <Text style={styles.sectionPrimary}>{fullWhen}</Text>
          </View>
          {relative ? <Text style={styles.helperText}>{relative}</Text> : null}
        </View>
      </MotionInView>

      <MotionInView delay={120}>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Where</Text>
          <View style={styles.row}>
            <AppUiIcon name="location-outline" size={18} color={colors.primary} />
            <View style={styles.flex1}>
              <Text style={styles.sectionPrimary}>{event.venueName}</Text>
              {locationLine ? <Text style={styles.helperText}>{locationLine}</Text> : null}
            </View>
          </View>

          {directionsUrl ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Drive to ${event.venueName}`}
              onPress={() => void onDriveThere()}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.primaryButtonPressed,
              ]}
            >
              <AppUiIcon name="navigate-outline" size={16} color={colors.background ?? '#0E1410'} />
              <Text style={styles.primaryButtonText}>Drive there</Text>
            </Pressable>
          ) : (
            <View style={styles.helperPanel}>
              <Text style={styles.helperText}>
                Venue / exact address not yet announced. Check the organizer link below.
              </Text>
            </View>
          )}
        </View>
      </MotionInView>

      <MotionInView delay={160}>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>About this event</Text>
          {event.description.split('\n\n').map((paragraph, i) => (
            <Text key={i} style={styles.bodyText}>
              {paragraph.trim()}
            </Text>
          ))}
        </View>
      </MotionInView>

      <MotionInView delay={200}>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Details</Text>
          <DetailRow label="Category" value={categoryLabel} />
          {event.organizerName ? <DetailRow label="Organizer" value={event.organizerName} /> : null}
          {event.priceLabel ? <DetailRow label="Price" value={event.priceLabel} /> : null}
          {event.ageRestriction ? <DetailRow label="Age" value={event.ageRestriction} /> : null}
          {event.tags.length > 0 ? (
            <View style={styles.chipRow}>
              {event.tags.map((tag) => (
                <View key={tag} style={styles.chip}>
                  <Text style={styles.chipText}>{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </MotionInView>

      {event.websiteUrl || event.ticketUrl ? (
        <MotionInView delay={240}>
          <View style={styles.linkRow}>
            {event.ticketUrl ? (
              <Pressable
                accessibilityRole="link"
                onPress={onOpenTickets}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.secondaryButtonPressed,
                ]}
              >
                <Text style={styles.secondaryButtonText}>Get tickets</Text>
              </Pressable>
            ) : null}
            {event.websiteUrl ? (
              <Pressable
                accessibilityRole="link"
                onPress={onOpenWebsite}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.secondaryButtonPressed,
                ]}
              >
                <Text style={styles.secondaryButtonText}>
                  {event.ticketUrl ? 'Organizer site' : 'More info'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </MotionInView>
      ) : null}

      <MotionInView delay={280}>
        <View style={styles.disclaimerPanel}>
          <Text style={styles.disclaimerText}>
            Canopy Trove curates this list from public sources. Times, prices, and venues can change
            — confirm with the organizer before traveling. Cannabis activity at events is subject to
            NY state law and venue policy.
          </Text>
        </View>
      </MotionInView>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

export const EventDetailScreen = withScreenErrorBoundary(EventDetailScreenInner, 'event-detail');
export default EventDetailScreen;

const styles = StyleSheet.create({
  scrollBody: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  centered: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  body: {
    gap: spacing.lg,
  },
  heroImage: {
    width: '100%',
    height: 200,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceElevated,
  },
  section: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sectionLabel: {
    fontFamily: fontFamilies.bodyMedium,
    fontSize: typography.caption,
    color: colors.textSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionPrimary: {
    fontFamily: fontFamilies.bodyMedium,
    fontSize: typography.body,
    color: colors.text,
    flexShrink: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  flex1: {
    flex: 1,
    gap: 2,
  },
  helperText: {
    fontFamily: fontFamilies.body,
    fontSize: typography.caption,
    color: colors.textMuted,
  },
  helperPanel: {
    padding: spacing.md,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.borderSoft,
    borderWidth: StyleSheet.hairlineWidth,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radii.sm,
    marginTop: spacing.xs,
  },
  primaryButtonPressed: {
    opacity: 0.85,
  },
  primaryButtonText: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: typography.body,
    color: '#0E1410',
  },
  bodyText: {
    fontFamily: fontFamilies.body,
    fontSize: typography.body,
    color: colors.text,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  detailLabel: {
    fontFamily: fontFamilies.bodyMedium,
    fontSize: typography.caption,
    color: colors.textSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  detailValue: {
    fontFamily: fontFamilies.bodyMedium,
    fontSize: typography.body,
    color: colors.text,
    textAlign: 'right',
    flexShrink: 1,
    marginLeft: spacing.md,
    maxWidth: '70%',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill ?? 999,
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.borderSoft,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: {
    fontFamily: fontFamilies.bodyMedium,
    fontSize: typography.caption,
    color: colors.textSoft,
  },
  linkRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  secondaryButton: {
    flex: 1,
    minWidth: 130,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.sm,
    borderColor: colors.borderStrong,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonPressed: {
    opacity: 0.85,
  },
  secondaryButtonText: {
    fontFamily: fontFamilies.bodyMedium,
    fontSize: typography.body,
    color: colors.text,
  },
  errorPanel: {
    padding: spacing.lg,
    borderRadius: radii.md,
    borderColor: colors.borderSoft,
    borderWidth: 1,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  errorTitle: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: typography.body,
    color: colors.text,
  },
  errorBody: {
    fontFamily: fontFamilies.body,
    fontSize: typography.body,
    color: colors.textMuted,
  },
  disclaimerPanel: {
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.borderSoft,
    borderWidth: StyleSheet.hairlineWidth,
  },
  disclaimerText: {
    fontFamily: fontFamilies.body,
    fontSize: typography.caption,
    color: colors.textMuted,
    lineHeight: 18,
  },
});
