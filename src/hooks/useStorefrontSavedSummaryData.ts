import { startTransition, useEffect, useMemo, useState } from 'react';
import { useStorefrontProfileController } from '../context/StorefrontController';
import { storefrontRepository } from '../repositories/storefrontRepository';
import {
  getCachedRecentStorefrontIds,
  loadRecentStorefrontIds,
  subscribeToRecentStorefrontIds,
} from '../services/recentStorefrontService';
import { reportRuntimeError } from '../services/runtimeReportingService';
import type { StorefrontSummary } from '../types/storefront';
import { useAsyncResource } from './useAsyncResource';
import { useStorefrontPromotionRevision } from './useStorefrontPromotionRevision';

export function useStorefrontSummariesByIds(storefrontIds: string[]) {
  const { authSession } = useStorefrontProfileController();
  const promotionRevision = useStorefrontPromotionRevision();
  const savedKey = useMemo(() => storefrontIds.join('|'), [storefrontIds]);

  return useAsyncResource<StorefrontSummary[]>(
    () => storefrontRepository.getSavedSummaries(storefrontIds),
    [authSession.status, authSession.uid, savedKey, promotionRevision],
    [],
    {
      resetDataOnChange: true,
    },
  );
}

export const useSavedSummaries = useStorefrontSummariesByIds;

export function useRecentStorefrontIds() {
  const [data, setData] = useState<string[]>(() => getCachedRecentStorefrontIds());
  const [isLoading, setIsLoading] = useState(() => getCachedRecentStorefrontIds().length === 0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const unsubscribe = subscribeToRecentStorefrontIds((nextRecentStorefrontIds) => {
      if (!alive) {
        return;
      }

      startTransition(() => {
        setData(nextRecentStorefrontIds);
      });
      setError(null);
      setIsLoading(false);
    });
    const cached = getCachedRecentStorefrontIds();
    startTransition(() => {
      setData(cached);
    });
    setError(null);
    setIsLoading(cached.length === 0);

    void (async () => {
      try {
        const recentIds = await loadRecentStorefrontIds();
        if (!alive) {
          return;
        }

        startTransition(() => {
          setData(recentIds);
        });
        setError(null);
      } catch (nextError) {
        reportRuntimeError(nextError, {
          source: 'recent-storefront-ids-load',
        });

        if (!alive) {
          return;
        }

        setError(
          nextError instanceof Error
            ? nextError.message
            : 'Unable to load recent storefronts right now.',
        );
      } finally {
        if (alive) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  return { data, error, isLoading };
}
