import React from 'react';
import { StorefrontSummary } from '../types/storefront';
import {
  getStorefrontOperationalEnrichment,
  hasStorefrontOperationalConfig,
} from '../services/storefrontOperationalDataService';

function getInitialOpenNow(storefront: StorefrontSummary) {
  return storefront.placeId?.trim() ? storefront.openNow : null;
}

export function useStorefrontOperationalStatus(storefront: StorefrontSummary) {
  const [openNow, setOpenNow] = React.useState<boolean | null>(() => getInitialOpenNow(storefront));
  const [isLoading, setIsLoading] = React.useState(() =>
    hasStorefrontOperationalConfig() && !storefront.placeId?.trim()
  );

  React.useEffect(() => {
    let alive = true;
    const hasConfig = hasStorefrontOperationalConfig();
    const initialOpenNow = getInitialOpenNow(storefront);

    setOpenNow(initialOpenNow);
    setIsLoading(hasConfig && initialOpenNow === null);

    if (!hasConfig) {
      return () => {
        alive = false;
      };
    }

    void (async () => {
      try {
        const enrichment = await getStorefrontOperationalEnrichment(storefront);
        if (!alive) {
          return;
        }

        if (typeof enrichment?.openNow === 'boolean') {
          setOpenNow(enrichment.openNow);
        }
      } finally {
        if (alive) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [
    storefront.id,
    storefront.placeId,
    storefront.openNow,
    storefront.displayName,
    storefront.addressLine1,
    storefront.city,
    storefront.zip,
    storefront.coordinates.latitude,
    storefront.coordinates.longitude,
  ]);

  return {
    openNow,
    isLoading,
  };
}
