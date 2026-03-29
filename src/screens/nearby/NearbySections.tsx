import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { CustomerStateCard } from '../../components/CustomerStateCard';
import { MotionInView } from '../../components/MotionInView';
import { SearchField } from '../../components/SearchField';
import { StorefrontRouteCard } from '../../components/StorefrontRouteCard';
import { StorefrontRouteCardSkeleton } from '../../components/StorefrontRouteCardSkeleton';
import { colors } from '../../theme/tokens';
import { StorefrontSummary } from '../../types/storefront';
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
  return (
    <View style={styles.locationPanel}>
      <View style={styles.locationPanelHeader}>
        <View style={styles.locationPanelTitleWrap}>
          <Text style={styles.locationPanelTitle}>Nearby location</Text>
          <Text style={styles.locationPanelSubtitle}>
            {activeLocationMode === 'device'
              ? 'Currently using your device location.'
              : activeLocationMode === 'search'
                ? 'Currently using the address or ZIP code you entered.'
                : 'Choose a location source for Nearby.'}
          </Text>
        </View>
        <Pressable onPress={handleToggleLocationPanel} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>Close</Text>
        </Pressable>
      </View>

      <SearchField
        value={locationQuery}
        onChangeText={setLocationQuery}
        onSubmitEditing={handleApplyLocationQuery}
        placeholder="Enter ZIP code, city, or address"
      />

      {locationError ? <Text style={styles.errorText}>{locationError}</Text> : null}

      <View style={styles.locationActionRow}>
        <Pressable
          onPress={handleApplyLocationQuery}
          style={[styles.secondaryButton, isResolvingLocation && styles.buttonDisabled]}
        >
          {isResolvingLocation ? <ActivityIndicator size="small" color={colors.text} /> : null}
          <Text style={styles.secondaryButtonText}>
            {isResolvingLocation ? 'Applying...' : 'Use This Location'}
          </Text>
        </Pressable>

        <Pressable
          onPress={handleUseDeviceLocation}
          style={[styles.primaryButton, isResolvingLocation && styles.buttonDisabled]}
        >
          <Text style={styles.primaryButtonText}>Use My Location</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function NearbyInfoBanner() {
  return (
    <CustomerStateCard
      tone="info"
      eyebrow="Nearby fallback"
      iconName="refresh-outline"
      title="Keeping your last nearby results on screen."
      body="Canopy Trove is refreshing your location in the background and holding onto the last usable nearby list so the screen stays stable."
      note="This is temporary and will hand back to live nearby results as soon as the refresh completes."
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
  return (
    <View style={styles.list}>
      {storefronts.map((store, index) => (
        <MotionInView key={store.id} delay={delayBase + index * 40}>
          <StorefrontRouteCard
            storefront={store}
            variant="feature"
            primaryActionLabel="Go Now"
            secondaryActionLabel="View Shop"
            isSaved={isSavedStorefront(store.id)}
            isVisited={visitedStorefrontIds.includes(store.id)}
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
      note={errorText ?? 'You can switch to device location or enter a ZIP code, city, or address without leaving the nearby flow.'}
    >
      <View style={styles.actionRow}>
        <Pressable onPress={onPrimary} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>{primaryLabel}</Text>
        </Pressable>
        <Pressable onPress={onSecondary} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>{secondaryLabel}</Text>
        </Pressable>
      </View>
    </CustomerStateCard>
  );
}
