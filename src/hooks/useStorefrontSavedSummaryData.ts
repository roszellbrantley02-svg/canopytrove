import { startTransition, useEffect, useMemo, useState } from 'react';
import { storefrontRepository } from '../repositories/storefrontRepository';
import {
  getCachedRecentStorefrontIds,
  loadRecentStorefrontIds,
  subscribeToRecentStorefrontIds,
} from '../services/recentStorefrontService';
import { StorefrontSummary } from '../types/storefront';
import { useAsyncResource } from './useAsyncResource';
import { useStorefrontPromotionRevision } from './useStorefrontPromotionRevision';

export function useStorefrontSummariesByIds(storefrontIds: string[]) {
  const promotionRevision = useStorefrontPromotionRevision();
  const savedKey = useMemo(() => storefrontIds.join('|'), [storefrontIds]);

  return useAsyncResource<StorefrontSummary[]>(
    () => storefrontRepository.getSavedSummaries(storefrontIds),
    [savedKey, promotionRevision],
    []
  );
}

export const useSavedSummaries = useStorefrontSummariesByIds;

export function useRecentStorefrontIds() {
  const [data, setData] = useState<string[]>(() => getCachedRecentStorefrontIds());
  const [isLoading, setIsLoading] = useState(() => getCachedRecentStorefrontIds().length === 0);

  useEffect(() => {
    let alive = true;
    const unsubscribe = subscribeToRecentStorefrontIds((nextRecentStorefrontIds) => {
      if (!alive) {
        return;
      }

      startTransition(() => {
        setData(nextRecentStorefrontIds);
      });
      setIsLoading(false);
    });
    const cached = getCachedRecentStorefrontIds();
    startTransition(() => {
      setData(cached);
    });
    setIsLoading(cached.length === 0);

    void (async () => {
      const recentIds = await loadRecentStorefrontIds();
      if (!alive) {
        return;
      }

      startTransition(() => {
        setData(recentIds);
      });
      setIsLoading(false);
    })();

    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  return { data, isLoading };
}
