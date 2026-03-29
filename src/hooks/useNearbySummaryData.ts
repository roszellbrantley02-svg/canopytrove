import { startTransition, useEffect, useState } from 'react';
import { storefrontRepository } from '../repositories/storefrontRepository';
import {
  getCachedLatestNearbySummarySnapshot,
  getCachedNearbySummarySnapshot,
  loadLatestNearbySummarySnapshot,
  loadNearbySummarySnapshot,
  saveNearbySummarySnapshot,
} from '../services/storefrontSummarySnapshotService';
import { StorefrontListQuery, StorefrontSummary } from '../types/storefront';
import { useStorefrontPromotionRevision } from './useStorefrontPromotionRevision';

export function useNearbySummaries(query: StorefrontListQuery | null) {
  const promotionRevision = useStorefrontPromotionRevision();
  const [data, setData] = useState<StorefrontSummary[]>(() =>
    query
      ? getCachedNearbySummarySnapshot(query) ?? getCachedLatestNearbySummarySnapshot() ?? []
      : []
  );
  const [isLoading, setIsLoading] = useState(() =>
    query
      ? !Boolean(
          getCachedNearbySummarySnapshot(query)?.length ||
            getCachedLatestNearbySummarySnapshot()?.length
        )
      : false
  );

  useEffect(() => {
    if (!query) {
      startTransition(() => {
        setData([]);
      });
      setIsLoading(false);
      return;
    }

    let alive = true;
    const cached = getCachedNearbySummarySnapshot(query);
    const fallback = getCachedLatestNearbySummarySnapshot();
    const hasCachedData = Boolean(cached?.length || fallback?.length);
    setData((current) => cached ?? fallback ?? current);
    setIsLoading(!hasCachedData);

    void (async () => {
      if (!cached?.length) {
        if (!fallback?.length) {
          const latestSnapshot = await loadLatestNearbySummarySnapshot();
          if (alive && latestSnapshot?.length) {
            startTransition(() => {
              setData((current) => (current.length ? current : latestSnapshot));
            });
            setIsLoading(false);
          }
        }

        const snapshot = await loadNearbySummarySnapshot(query);
        if (alive && snapshot?.length) {
          startTransition(() => {
            setData(snapshot);
          });
          setIsLoading(false);
        }
      }

      const liveData = await storefrontRepository.getNearbySummaries(query);
      if (!alive) {
        return;
      }

      startTransition(() => {
        setData(liveData);
      });
      setIsLoading(false);
      void saveNearbySummarySnapshot(query, liveData);
    })();

    return () => {
      alive = false;
    };
  }, [promotionRevision, query?.areaId, query?.searchQuery, query?.origin.latitude, query?.origin.longitude]);

  return { data, isLoading };
}

export function useNearbyWarmSnapshot() {
  useStorefrontPromotionRevision();
  const [data, setData] = useState<StorefrontSummary[]>(() => getCachedLatestNearbySummarySnapshot() ?? []);

  useEffect(() => {
    let alive = true;
    if (data.length) {
      return () => {
        alive = false;
      };
    }

    void (async () => {
      const snapshot = await loadLatestNearbySummarySnapshot();
      if (!alive || !snapshot?.length) {
        return;
      }

      startTransition(() => {
        setData(snapshot);
      });
    })();

    return () => {
      alive = false;
    };
  }, [data.length]);

  return data;
}
