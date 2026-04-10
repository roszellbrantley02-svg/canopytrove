import React from 'react';
import type { StorefrontSummary } from '../types/storefront';
import { storefrontRepository } from '../repositories/storefrontRepository';
import { computeOpenNow } from '../utils/storefrontOpenStatus';

/**
 * Resolve the real-time open/closed status of a storefront.
 *
 * Priority for hours source (highest to lowest):
 *   1. detailHours — passed in from the detail screen when available
 *   2. storefront.hours — included in the summary API response so list cards
 *      can also compute accurately without a separate detail fetch
 *   3. storefront.openNow — static fallback for storefronts with no hours data
 *
 * Recomputes every 60 seconds so badges stay accurate while the user browses.
 */
export function useStorefrontOperationalStatus(
  storefront: StorefrontSummary,
  detailHours?: string[] | null,
) {
  const [tick, setTick] = React.useState(0);
  const [cachedDetail, setCachedDetail] = React.useState(() =>
    storefrontRepository.getCachedStorefrontDetails(storefront.id),
  );

  React.useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  React.useEffect(() => {
    setCachedDetail(storefrontRepository.getCachedStorefrontDetails(storefront.id));

    return storefrontRepository.subscribeToCachedStorefrontDetails(storefront.id, () => {
      setCachedDetail(storefrontRepository.getCachedStorefrontDetails(storefront.id));
    });
  }, [storefront.id]);

  return React.useMemo(() => {
    // Prefer explicit detail hours > cached detail hours > summary hours > static boolean
    const hoursToUse = detailHours?.length
      ? detailHours
      : cachedDetail?.hours?.length
        ? cachedDetail.hours
        : storefront.hours?.length
          ? storefront.hours
          : null;
    const staticValue =
      typeof cachedDetail?.openNow === 'boolean'
        ? cachedDetail.openNow
        : typeof storefront.openNow === 'boolean'
          ? storefront.openNow
          : null;
    const computed = computeOpenNow(hoursToUse, staticValue);
    return {
      openNow: computed,
      isLoading: false,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cachedDetail, storefront.openNow, storefront.hours, detailHours, tick]);
}
