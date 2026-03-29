import { startTransition, useEffect, useState } from 'react';
import { storefrontRepository } from '../repositories/storefrontRepository';
import {
  getCachedBrowseSummarySnapshot,
  loadBrowseSummarySnapshot,
  saveBrowseSummarySnapshot,
} from '../services/storefrontSummarySnapshotService';
import {
  BrowseSortKey,
  BrowseSummaryResult,
  StorefrontListQuery,
} from '../types/storefront';
import { useStorefrontPromotionRevision } from './useStorefrontPromotionRevision';

export function useBrowseSummaries(
  query: StorefrontListQuery,
  sortKey: BrowseSortKey,
  limit: number,
  offset: number
) {
  const promotionRevision = useStorefrontPromotionRevision();
  const cachedPage =
    offset === 0 ? getCachedBrowseSummarySnapshot(query, sortKey, limit) : null;
  const [data, setData] = useState<BrowseSummaryResult>(
    () =>
      cachedPage ?? {
        items: [],
        total: 0,
        limit,
        offset,
        hasMore: false,
      }
  );
  const [isLoading, setIsLoading] = useState(() => !Boolean(cachedPage?.items?.length));

  useEffect(() => {
    let alive = true;
    const cached = offset === 0 ? getCachedBrowseSummarySnapshot(query, sortKey, limit) : null;
    setData((current) =>
      cached ??
      (offset === 0
        ? current
        : {
            items: [],
            total: 0,
            limit,
            offset,
            hasMore: false,
          })
    );
    setIsLoading(!Boolean(cached?.items?.length) && (offset > 0 || data.items.length === 0));

    void (async () => {
      if (offset === 0 && !cached?.items?.length) {
        const snapshot = await loadBrowseSummarySnapshot(query, sortKey, limit);
        if (alive && snapshot?.items?.length) {
          startTransition(() => {
            setData(snapshot);
          });
          setIsLoading(false);
        }
      }

      const liveData = await storefrontRepository.getBrowseSummaries(query, sortKey, limit, offset);
      if (!alive) {
        return;
      }

      startTransition(() => {
        setData(liveData);
      });
      setIsLoading(false);

      if (offset === 0) {
        void saveBrowseSummarySnapshot(query, sortKey, limit, liveData);
      }
    })();

    return () => {
      alive = false;
    };
  }, [
    data.items.length,
    limit,
    offset,
    promotionRevision,
    query.areaId,
    query.searchQuery,
    query.hotDealsOnly,
    query.origin.latitude,
    query.origin.longitude,
    sortKey,
  ]);

  return { data, isLoading };
}
