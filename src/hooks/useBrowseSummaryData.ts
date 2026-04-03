import { startTransition, useEffect, useMemo, useState } from 'react';
import { useStorefrontProfileController } from '../context/StorefrontController';
import { storefrontRepository } from '../repositories/storefrontRepository';
import { reportRuntimeError } from '../services/runtimeReportingService';
import {
  getCachedBrowseSummarySnapshot,
  loadBrowseSummarySnapshot,
  saveBrowseSummarySnapshot,
} from '../services/storefrontSummarySnapshotService';
import type { BrowseSortKey, BrowseSummaryResult, StorefrontListQuery } from '../types/storefront';
import { useStorefrontPromotionRevision } from './useStorefrontPromotionRevision';
import {
  shouldKeepCachedBrowseResults,
  shouldPersistBrowseSnapshot,
} from './storefrontSummarySnapshotGuards';

export function useBrowseSummaries(
  query: StorefrontListQuery,
  sortKey: BrowseSortKey,
  limit: number,
  offset: number,
) {
  const { authSession } = useStorefrontProfileController();
  const promotionRevision = useStorefrontPromotionRevision();
  const resolvedQuery = useMemo<StorefrontListQuery>(
    () => ({
      areaId: query.areaId,
      searchQuery: query.searchQuery,
      origin: {
        latitude: query.origin.latitude,
        longitude: query.origin.longitude,
      },
      locationLabel: query.locationLabel,
      hotDealsOnly: query.hotDealsOnly,
    }),
    [
      query.areaId,
      query.hotDealsOnly,
      query.locationLabel,
      query.origin.latitude,
      query.origin.longitude,
      query.searchQuery,
    ],
  );
  const cachedPage =
    offset === 0 ? getCachedBrowseSummarySnapshot(resolvedQuery, sortKey, limit) : null;
  const [data, setData] = useState<BrowseSummaryResult>(
    () =>
      cachedPage ?? {
        items: [],
        total: 0,
        limit,
        offset,
        hasMore: false,
      },
  );
  const [isLoading, setIsLoading] = useState(() => !Boolean(cachedPage?.items?.length));
  const [error, setError] = useState<string | null>(null);
  const emptyPage = useMemo(
    () =>
      ({
        items: [],
        total: 0,
        limit,
        offset,
        hasMore: false,
      }) satisfies BrowseSummaryResult,
    [limit, offset],
  );

  useEffect(() => {
    let alive = true;
    const cached =
      offset === 0 ? getCachedBrowseSummarySnapshot(resolvedQuery, sortKey, limit) : null;
    startTransition(() => {
      setData(cached ?? emptyPage);
    });
    setError(null);
    setIsLoading(true);

    void (async () => {
      try {
        if (offset === 0 && !cached?.items?.length) {
          try {
            const snapshot = await loadBrowseSummarySnapshot(resolvedQuery, sortKey, limit);
            if (alive && snapshot?.items?.length) {
              startTransition(() => {
                setData(snapshot);
              });
            }
          } catch (snapshotError) {
            reportRuntimeError(snapshotError, {
              source: 'browse-summary-snapshot-load',
            });
          }
        }

        const liveData = await storefrontRepository.getBrowseSummaries(
          resolvedQuery,
          sortKey,
          limit,
          offset,
        );
        if (!alive) {
          return;
        }

        const keepCachedResults =
          offset === 0 && shouldKeepCachedBrowseResults(resolvedQuery, cached, liveData);
        if (!keepCachedResults) {
          startTransition(() => {
            setData(liveData);
          });
        }
        setError(null);

        if (offset === 0 && shouldPersistBrowseSnapshot(resolvedQuery, liveData)) {
          void saveBrowseSummarySnapshot(resolvedQuery, sortKey, limit, liveData);
        }
      } catch (nextError) {
        reportRuntimeError(nextError, {
          source: 'browse-summary-fetch',
        });

        if (!alive) {
          return;
        }

        setError(
          nextError instanceof Error ? nextError.message : 'Unable to load storefronts right now.',
        );
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
    authSession.status,
    authSession.uid,
    emptyPage,
    limit,
    offset,
    promotionRevision,
    resolvedQuery,
    sortKey,
  ]);

  return { data, error, isLoading };
}
