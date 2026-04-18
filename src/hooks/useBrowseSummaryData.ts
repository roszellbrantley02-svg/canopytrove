import { startTransition, useEffect, useMemo, useState } from 'react';
import { useStorefrontProfileController } from '../context/StorefrontController';
import { storefrontRepository } from '../repositories/storefrontRepository';
import { getWarmSharedSummaries } from '../repositories/storefrontRepositoryCache';
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
import { deriveAuthFetchKey } from './authFetchKey';

export function useBrowseSummaries(
  query: StorefrontListQuery,
  sortKey: BrowseSortKey,
  limit: number,
  offset: number,
  options?: { enabled?: boolean; refetchKey?: number },
) {
  const enabled = options?.enabled ?? true;
  const refetchKey = options?.refetchKey ?? 0;
  const { authSession } = useStorefrontProfileController();
  const authFetchKey = deriveAuthFetchKey(authSession);
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
  // If no cached page, try the cross-tab shared pool for instant UI
  const warmPage = useMemo<BrowseSummaryResult | null>(() => {
    if (cachedPage || offset !== 0) {
      return null;
    }
    const warmItems = getWarmSharedSummaries(limit);
    if (!warmItems.length) {
      return null;
    }
    return { items: warmItems, total: warmItems.length, limit, offset: 0, hasMore: true };
  }, [cachedPage, limit, offset]);
  const initialPage = cachedPage ?? warmPage;
  const [data, setData] = useState<BrowseSummaryResult>(() =>
    enabled
      ? (initialPage ?? {
          items: [],
          total: 0,
          limit,
          offset,
          hasMore: false,
        })
      : {
          items: [],
          total: 0,
          limit,
          offset,
          hasMore: false,
        },
  );
  const [isLoading, setIsLoading] = useState(() => enabled && !Boolean(initialPage?.items?.length));
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
    if (!enabled) {
      startTransition(() => {
        setData(emptyPage);
      });
      setError(null);
      setIsLoading(false);
      return;
    }

    let alive = true;
    const cached =
      offset === 0 ? getCachedBrowseSummarySnapshot(resolvedQuery, sortKey, limit) : null;
    // Use warm shared pool as fallback before going to AsyncStorage / API
    const warmFallback = !cached && offset === 0 ? getWarmSharedSummaries(limit) : [];
    const initialData: BrowseSummaryResult | null = cached
      ? cached
      : warmFallback.length
        ? { items: warmFallback, total: warmFallback.length, limit, offset: 0, hasMore: true }
        : null;
    startTransition(() => {
      setData(initialData ?? emptyPage);
    });
    setError(null);
    setIsLoading(true);

    void (async () => {
      try {
        if (offset === 0 && !cached?.items?.length && !warmFallback.length) {
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
    authFetchKey,
    emptyPage,
    enabled,
    limit,
    offset,
    promotionRevision,
    refetchKey,
    resolvedQuery,
    sortKey,
  ]);

  return { data, error, isLoading };
}
