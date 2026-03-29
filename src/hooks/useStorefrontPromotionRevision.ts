import { useEffect, useState } from 'react';
import {
  getStorefrontPromotionOverrideRevision,
  initializeStorefrontPromotionOverrides,
  subscribeToStorefrontPromotionOverrideRevision,
} from '../services/storefrontPromotionOverrideService';

export function useStorefrontPromotionRevision() {
  const [revision, setRevision] = useState(() => getStorefrontPromotionOverrideRevision());

  useEffect(() => {
    let alive = true;
    const unsubscribe = subscribeToStorefrontPromotionOverrideRevision((nextRevision) => {
      if (!alive) {
        return;
      }

      setRevision(nextRevision);
    });

    void initializeStorefrontPromotionOverrides();

    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  return revision;
}
