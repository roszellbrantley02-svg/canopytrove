import React from 'react';
import type { StorefrontSummary } from '../types/storefront';

export function useStorefrontOperationalStatus(storefront: StorefrontSummary) {
  return React.useMemo(
    () => ({
      openNow: typeof storefront.openNow === 'boolean' ? storefront.openNow : null,
      isLoading: false,
    }),
    [storefront.openNow],
  );
}
