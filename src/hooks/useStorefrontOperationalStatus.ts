import React from 'react';
import type { StorefrontSummary } from '../types/storefront';
import { computeOpenNow } from '../utils/storefrontOpenStatus';

/**
 * Resolve the real-time open/closed status of a storefront.
 *
 * When the detail `hours` array is available, computes the status from
 * the current time. Otherwise falls back to the `openNow` boolean from
 * the API (which now also computes from hours on the backend).
 *
 * Refreshes every 60 seconds so cards stay accurate while browsing.
 */
export function useStorefrontOperationalStatus(
  storefront: StorefrontSummary,
  detailHours?: string[] | null,
) {
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  return React.useMemo(() => {
    const staticValue = typeof storefront.openNow === 'boolean' ? storefront.openNow : null;
    const computed = computeOpenNow(detailHours, staticValue);
    return {
      openNow: computed,
      isLoading: false,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storefront.openNow, detailHours, tick]);
}
