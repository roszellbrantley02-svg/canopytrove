import React from 'react';
import {
  getCachedRecentStorefrontIds,
  subscribeToRecentStorefrontIds,
} from '../services/recentStorefrontService';
import { areStringArraysEqual } from './storefrontControllerShared';

export function useStorefrontRouteState(initialSavedStorefrontIds: string[]) {
  const [savedStorefrontIds, setSavedStorefrontIds] =
    React.useState<string[]>(initialSavedStorefrontIds);
  const [recentStorefrontIds, setRecentStorefrontIds] = React.useState<string[]>(() =>
    getCachedRecentStorefrontIds(),
  );
  const lastLocalSavedStorefrontMutationAtRef = React.useRef(0);
  const markLocalSavedStorefrontMutation = React.useCallback(() => {
    lastLocalSavedStorefrontMutationAtRef.current = Date.now();
  }, []);

  const isSavedStorefront = React.useCallback(
    (storefrontId: string) => savedStorefrontIds.includes(storefrontId),
    [savedStorefrontIds],
  );

  const toggleSavedStorefront = React.useCallback(
    (storefrontId: string) => {
      markLocalSavedStorefrontMutation();
      setSavedStorefrontIds((current) =>
        current.includes(storefrontId)
          ? current.filter((id) => id !== storefrontId)
          : [...current, storefrontId],
      );
    },
    [markLocalSavedStorefrontMutation],
  );

  React.useEffect(() => {
    const unsubscribe = subscribeToRecentStorefrontIds((nextRecentStorefrontIds) => {
      setRecentStorefrontIds((current) =>
        areStringArraysEqual(current, nextRecentStorefrontIds) ? current : nextRecentStorefrontIds,
      );
    });

    return unsubscribe;
  }, []);

  return {
    isSavedStorefront,
    recentStorefrontIds,
    savedStorefrontIds,
    setRecentStorefrontIds,
    setSavedStorefrontIds,
    lastLocalSavedStorefrontMutationAtRef,
    markLocalSavedStorefrontMutation,
    toggleSavedStorefront,
  };
}
