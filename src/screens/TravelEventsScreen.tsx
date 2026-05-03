import React from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import { ScreenShell } from '../components/ScreenShell';
import { MotionInView } from '../components/MotionInView';
import { EventSummaryCard } from '../components/events/EventSummaryCard';
import { useCanopyEvents } from '../hooks/useCanopyEvents';
import { colors, fontFamilies, radii, spacing, typography } from '../theme/tokens';
import type { CanopyEvent } from '../types/events';
import type { RootStackParamList } from '../navigation/RootNavigator';

// Travel & Events tab — list view. Pulls upcoming events from /events,
// renders a stack of EventSummaryCards. Tap a card → EventDetailScreen.

type Nav = NativeStackNavigationProp<RootStackParamList>;

function TravelEventsScreenInner() {
  const navigation = useNavigation<Nav>();
  const { status, items, errorText, isRefreshing, reload } = useCanopyEvents('upcoming');

  const handleEventPress = React.useCallback(
    (event: CanopyEvent) => {
      navigation.navigate('EventDetail', { eventId: event.id });
    },
    [navigation],
  );

  return (
    <ScreenShell
      eyebrow="Travel & Events"
      title="What's happening this month"
      subtitle="NY cannabis festivals, conventions, advocacy meetings, and dispensary nights — all in one place."
    >
      <ScrollView
        contentContainerStyle={styles.scrollBody}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void reload()}
            tintColor={colors.primary}
          />
        }
      >
        {status === 'loading' && items.length === 0 ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.helperText}>Loading events…</Text>
          </View>
        ) : null}

        {status === 'error' && items.length === 0 ? (
          <View style={styles.errorPanel}>
            <Text style={styles.errorTitle}>Couldn't load events.</Text>
            <Text style={styles.errorBody}>
              {errorText ?? 'Pull to refresh, or check your connection.'}
            </Text>
          </View>
        ) : null}

        {status !== 'loading' && items.length === 0 && !errorText ? (
          <View style={styles.emptyPanel}>
            <Text style={styles.emptyTitle}>No upcoming events yet.</Text>
            <Text style={styles.emptyBody}>
              We're curating the list this month — check back soon.
            </Text>
          </View>
        ) : null}

        {items.map((event, index) => (
          <MotionInView key={event.id} delay={Math.min(index * 40, 240)}>
            <EventSummaryCard
              event={event}
              variant={index === 0 ? 'feature' : 'list'}
              onPress={handleEventPress}
            />
          </MotionInView>
        ))}

        {items.length > 0 ? (
          <Text style={styles.footerHint}>
            Want your event listed? Email us at askmehere@canopytrove.com.
          </Text>
        ) : null}
      </ScrollView>
    </ScreenShell>
  );
}

export const TravelEventsScreen = withScreenErrorBoundary(TravelEventsScreenInner, 'travel-events');
export default TravelEventsScreen;

const styles = StyleSheet.create({
  scrollBody: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: 0,
  },
  centered: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  helperText: {
    fontFamily: fontFamilies.body,
    fontSize: typography.body,
    color: colors.textMuted,
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
  emptyPanel: {
    padding: spacing.xl,
    borderRadius: radii.md,
    borderColor: colors.borderSoft,
    borderWidth: 1,
    backgroundColor: colors.surface,
    gap: spacing.xs,
    alignItems: 'center',
  },
  emptyTitle: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: typography.body,
    color: colors.text,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: fontFamilies.body,
    fontSize: typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  footerHint: {
    marginTop: spacing.lg,
    fontFamily: fontFamilies.body,
    fontSize: typography.caption,
    color: colors.textSoft,
    textAlign: 'center',
  },
});
