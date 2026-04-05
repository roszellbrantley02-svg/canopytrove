import React from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  useStorefrontProfileController,
  useStorefrontQueryController,
  useStorefrontRewardsController,
  useStorefrontRouteController,
} from '../context/StorefrontController';
import { ErrorRecoveryCard } from '../components/ErrorRecoveryCard';
import { ScreenShell } from '../components/ScreenShell';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useBrowseSummaries } from '../hooks/useStorefrontSummaryData';
import { spacing } from '../theme/tokens';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { openStorefrontRoute } from '../services/navigationService';
import type { BrowseSortKey, StorefrontSummary } from '../types/storefront';
import {
  HotDealsEmptyState,
  HotDealsFilters,
  HotDealsList,
  HotDealsMemberGate,
  HotDealsSkeletonList,
} from './hotDeals/HotDealsSections';

const PAGE_SIZE = 6;

export function HotDealsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [offset, setOffset] = React.useState(0);
  const [items, setItems] = React.useState<StorefrontSummary[]>([]);
  const [dealSearchQuery, setDealSearchQuery] = React.useState('');
  const [sortKey, setSortKey] = React.useState<BrowseSortKey>('distance');
  const {
    activeLocationLabel,
    activeLocationMode,
    locationError,
    locationQuery,
    isResolvingLocation,
    storefrontQuery,
    setLocationQuery,
    applyLocationQuery,
    useDeviceLocation: requestDeviceLocation,
  } = useStorefrontQueryController();
  const { authSession, profileId } = useStorefrontProfileController();
  const { isSavedStorefront } = useStorefrontRouteController();
  const {
    gamificationState: { visitedStorefrontIds },
  } = useStorefrontRewardsController();
  const isMemberAuthenticated = authSession.status === 'authenticated';
  const debouncedDealSearchQuery = useDebouncedValue(dealSearchQuery, 250);
  const query = React.useMemo(
    () => ({
      ...storefrontQuery,
      searchQuery: debouncedDealSearchQuery,
      hotDealsOnly: true,
    }),
    [debouncedDealSearchQuery, storefrontQuery],
  );
  const { data, error, isLoading } = useBrowseSummaries(query, sortKey, PAGE_SIZE, offset);

  const handleApplyLocationQuery = React.useCallback(() => {
    void applyLocationQuery();
  }, [applyLocationQuery]);

  const handleRefreshDeviceLocation = React.useCallback(() => {
    void requestDeviceLocation();
  }, [requestDeviceLocation]);

  const handleRetryError = React.useCallback(() => {
    // Trigger a fresh data fetch by resetting offset
    setOffset(0);
  }, []);

  React.useEffect(() => {
    setOffset(0);
  }, [activeLocationLabel, debouncedDealSearchQuery, isMemberAuthenticated, sortKey]);

  React.useEffect(() => {
    if (isLoading) {
      return;
    }

    React.startTransition(() => {
      setItems((current) => {
        if (data.offset === 0) {
          return data.items;
        }

        const seen = new Set(current.map((item) => item.id));
        const nextItems = data.items.filter((item) => !seen.has(item.id));
        return current.concat(nextItems);
      });
    });
  }, [data.items, data.offset, isLoading]);

  return (
    <ScreenShell
      eyebrow="Hot Deals"
      title="Live deals near you."
      subtitle="Filter by location, storefront, or offer details to browse active promotions."
      headerPill={activeLocationLabel}
      onBrandIconPress={handleRefreshDeviceLocation}
    >
      <HotDealsFilters
        locationQuery={locationQuery}
        setLocationQuery={setLocationQuery}
        handleApplyLocationQuery={handleApplyLocationQuery}
        isResolvingLocation={isResolvingLocation}
        locationError={locationError}
        dealSearchQuery={dealSearchQuery}
        setDealSearchQuery={setDealSearchQuery}
        activeLocationMode={activeLocationMode}
        activeLocationLabel={activeLocationLabel}
        sortKey={sortKey}
        setSortKey={setSortKey}
      />

      {!isMemberAuthenticated ? (
        <HotDealsMemberGate
          onOpenMemberSignIn={() => navigation.navigate('CanopyTroveSignIn')}
          onOpenMemberSignUp={() => navigation.navigate('CanopyTroveSignUp')}
        />
      ) : error && items.length === 0 ? (
        <View style={{ padding: spacing.xl, paddingTop: spacing.xxl }}>
          <ErrorRecoveryCard
            title="Unable to load deals"
            message={error}
            onRetry={handleRetryError}
            retryLabel="Refresh"
          />
        </View>
      ) : isLoading && items.length === 0 ? (
        <HotDealsSkeletonList />
      ) : items.length === 0 ? (
        <HotDealsEmptyState errorText={error} />
      ) : (
        <HotDealsList
          items={items}
          isSavedStorefront={isSavedStorefront}
          visitedStorefrontIds={visitedStorefrontIds}
          onOpenDetail={(item) => navigation.navigate('StorefrontDetail', { storefront: item })}
          onGoNow={(item) => {
            void openStorefrontRoute(item, 'verified', {
              profileId,
              accountId: authSession.status === 'authenticated' ? authSession.uid : null,
              isAuthenticated: authSession.status === 'authenticated',
              sourceScreen: 'HotDeals',
              storefront: item,
            });
          }}
          dataHasMore={data.hasMore}
          dataTotal={data.total}
          isLoading={isLoading}
          onLoadMore={() => setOffset((current) => current + PAGE_SIZE)}
        />
      )}
    </ScreenShell>
  );
}
