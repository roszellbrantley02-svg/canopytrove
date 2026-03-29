import React from 'react';
import {
  getCachedRecentStorefrontIds,
  subscribeToRecentStorefrontIds,
} from '../services/recentStorefrontService';

export function useStorefrontRouteState(initialSavedStorefrontIds: string[]) {
  const [savedStorefrontIds, setSavedStorefrontIds] = React.useState<string[]>(
    initialSavedStorefrontIds
  );
  const [recentStorefrontIds, setRecentStorefrontIds] = React.useState<string[]>(() =>
    getCachedRecentStorefrontIds()
  );

  const isSavedStorefront = React.useCallback(
    (storefrontId: string) => savedStorefrontIds.includes(storefrontId),
    [savedStorefrontIds]
  );

  const toggleSavedStorefront = React.useCallback((storefrontId: string) => {
    setSavedStorefrontIds((current) =>
      current.includes(storefrontId)
        ? current.filter((id) => id !== storefrontId)
        : [...current, storefrontId]
    );
  }, []);

  React.useEffect(() => {
    const unsubscribe = subscribeToRecentStorefrontIds((nextRecentStorefrontIds) => {
      setRecentStorefrontIds(nextRecentStorefrontIds);
    });

    return unsubscribe;
  }, []);

  return {
    isSavedStorefront,
    recentStorefrontIds,
    savedStorefrontIds,
    setRecentStorefrontIds,
    setSavedStorefrontIds,
    toggleSavedStorefront,
  };
}
