import React from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { CustomerStateCard } from '../../components/CustomerStateCard';
import { InlineFeedbackPanel } from '../../components/InlineFeedbackPanel';
import { MotionInView } from '../../components/MotionInView';
import { SearchField } from '../../components/SearchField';
import { StorefrontRouteCard } from '../../components/StorefrontRouteCard';
import { StorefrontRouteCardSkeleton } from '../../components/StorefrontRouteCardSkeleton';
import { colors } from '../../theme/tokens';
import type { StorefrontSummary } from '../../types/storefront';
import { styles } from './nearbyStyles';

export function NearbyLocationPanel({
  activeLocationMode,
  locationQuery,
  setLocationQuery,
  handleApplyLocationQuery,
  handleUseDeviceLocation,
  handleToggleLocationPanel,
  isResolvingLocation,
  locationError,
}: {
  activeLocationMode: 'search' | 'device' | 'fallback';
  locationQuery: string;
  setLocationQuery: (value: string) => void;
  handleApplyLocationQuery: () => void;
  handleUseDeviceLocation: () => void;
  handleToggleLocationPanel: () => void;
  isResolvingLocation: boolean;
  locationError: string | null;
}) {
  const { width } = useWindowDimensions();
  const compactLayout = width < 390;
  const compactHeader = width < 420;

  return (
    <View style={styles.locationPanel}>
      <View
        style={[styles.locationPanelHeader, compactHeader && styles.locationPanelHeaderCompact]}
      >
        <View style={styles.locationPanelTitleWrap}>
          <Text style={styles.locationPanelTitle}>Nearby location</Text>
          <Text style={styles.locationPanelSubtitle}>
            {activeLocationMode === 'device'
              ? 'Currently using your device location for nearby results.'
              : activeLocationMode === 'search'
                ? 'Currently using the address or ZIP code you entered.'
                : 'Choose a location source for the nearby view.'}
          </Text>
        </View>
        <View
          style={[
            styles.locationPanelHeaderActions,
            compactHeader && styles.locationPanelHeaderActionsCompact,
          ]}
        >
          <View style={styles.locationPanelBadge}>
            <Text style={styles.locationPanelBadgeText}>Live radius</Text>
          </View>
          <Pressable
            onPress={handleToggleLocationPanel}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Close location panel"
            accessibilityHint="Closes the location selection panel"
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </Pressable>
        </View>
      </View>

      <SearchField
        value={locationQuery}
        onChangeText={setLocationQuery}
        onSubmitEditing={handleApplyLocationQuery}
        placeholder="Enter ZIP code, city, or address"
        isActive={Boolean(locationQuery.trim())}
      />

      {locationError ? (
        <InlineFeedbackPanel
          tone="danger"
          iconName="location-outline"
          label="Location issue"
          title="Nearby could not apply that search area."
          body={locationError}
        />
      ) : null}

      <View style={[styles.locationActionRow, compactLayout && styles.locationActionRowCompact]}>
        <Pressable
          onPress={() => {
            if (isResolvingLocation || !locationQuery.trim()) return;
            Keyboard.dismiss();
            handleApplyLocationQuery();
          }}
          disabled={isResolvingLocation || !locationQuery.trim()}
          style={[
            styles.secondaryButton,
            compactLayout && styles.fullWidthButton,
            (isResolvingLocation || !locationQuery.trim()) && styles.buttonDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Apply search area"
          accessibilityHint="Applies the entered location to filter nearby results"
        >
          {isResolvingLocation ? <ActivityIndicator size="small" color={colors.text} /> : null}
          <Text style={styles.secondaryButtonText}>
            {isResolvingLocation ? 'Applying...' : 'Apply Search Area'}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            if (isResolvingLocation) return;
            Keyboard.dismiss();
            handleUseDeviceLocation();
          }}
          disabled={isResolvingLocation}
          style={[
            styles.primaryButton,
            compactLayout && styles.fullWidthButton,
            isResolvingLocation && styles.buttonDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Use device location"
          accessibilityHint="Uses your device location to filter nearby results"
        >
          <Text style={styles.primaryButtonText}>Use Device Location</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function NearbyInfoBanner() {
  return (
    <CustomerStateCard
      tone="info"
      eyebrow="Nearby refresh"
      iconName="refresh-outline"
      title="Holding the last nearby view."
      body="Nearby is refreshing in the background while the last usable list stays on screen."
      note="This hands back to live nearby results as soon as the refresh finishes."
    />
  );
}

export function NearbyStoreList({
  storefronts,
  isSavedStorefront,
  visitedStorefrontIds,
  onPrepareStorefront,
  onOpenStorefront,
  onGoNow,
  delayBase,
}: {
  storefronts: StorefrontSummary[];
  isSavedStorefront: (storefrontId: string) => boolean;
  visitedStorefrontIds: string[];
  onPrepareStorefront: (storefrontId: string) => void;
  onOpenStorefront: (storefront: StorefrontSummary) => void;
  onGoNow: (storefront: StorefrontSummary) => void;
  delayBase: number;
}) {
  const visitedSet = React.useMemo(() => new Set(visitedStorefrontIds), [visitedStorefrontIds]);

  return (
    <View style={styles.list}>
      {storefronts.map((store, index) => (
        <MotionInView key={store.id} delay={delayBase + index * 40}>
          <StorefrontRouteCard
            storefront={store}
            variant="feature"
            primaryActionLabel="Directions"
            secondaryActionLabel="Details"
            isSaved={isSavedStorefront(store.id)}
            isVisited={visitedSet.has(store.id)}
            showPromotionText={Boolean(store.promotionText?.trim())}
            onPressIn={() => onPrepareStorefront(store.id)}
            onSecondaryActionPressIn={() => onPrepareStorefront(store.id)}
            onPress={() => onOpenStorefront(store)}
            onPrimaryActionPress={() => onGoNow(store)}
            onSecondaryActionPress={() => onOpenStorefront(store)}
          />
        </MotionInView>
      ))}
    </View>
  );
}

export function NearbySkeletonList({ count, delayBase }: { count: number; delayBase: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, index) => (
        <MotionInView key={`nearby-skeleton-${index}`} delay={delayBase + index * 40}>
          <StorefrontRouteCardSkeleton variant="feature" />
        </MotionInView>
      ))}
    </View>
  );
}

export function NearbyEmptyState({
  title,
  body,
  errorText,
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
}: {
  title: string;
  body: string;
  errorText?: string | null;
  primaryLabel: string;
  secondaryLabel: string;
  onPrimary: () => void;
  onSecondary: () => void;
}) {
  return (
    <CustomerStateCard
      title={title}
      body={body}
      tone={errorText ? 'danger' : 'warm'}
      iconName={errorText ? 'location-outline' : 'map-outline'}
      eyebrow="Nearby state"
      note={
        errorText ??
        'Switch to device location or enter a ZIP, city, or address without leaving this view.'
      }
    >
      <View style={styles.actionRow}>
        <Pressable
          onPress={onPrimary}
          style={styles.primaryButton}
          accessibilityRole="button"
          accessibilityLabel={primaryLabel}
          accessibilityHint="Activates the primary action"
        >
          <Text style={styles.primaryButtonText}>{primaryLabel}</Text>
        </Pressable>
        <Pressable
          onPress={onSecondary}
          style={styles.secondaryButton}
          accessibilityRole="button"
          accessibilityLabel={secondaryLabel}
          accessibilityHint="Activates the secondary action"
        >
          <Text style={styles.secondaryButtonText}>{secondaryLabel}</Text>
        </Pressable>
      </View>
    </CustomerStateCard>
  );
}
