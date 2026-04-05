import { startTransition, useEffect, useMemo, useState } from 'react';
import { useStorefrontProfileController } from '../context/StorefrontController';
import { storefrontRepository } from '../repositories/storefrontRepository';
import { reportRuntimeError } from '../services/runtimeReportingService';
import {
  getCachedLatestNearbySummarySnapshot,
  getCachedNearbySummarySnapshot,
  loadLatestNearbySummarySnapshot,
  loadNearbySummarySnapshot,
  saveNearbySummarySnapshot,
} from '../services/storefrontSummarySnapshotService';
import type { StorefrontListQuery, StorefrontSummary } from '../types/storefront';
import { useStorefrontPromotionRevision } from './useStorefrontPromotionRevision';
import {
  shouldKeepWarmNearbyResults,
  shouldPersistNearbySnapshot,
} from './storefrontSummarySnapshotGuards';

export function useNearbySummaries(query: StorefrontListQuery | null) {
  const { authSession } = useStorefrontProfileController();
  const promotionRevision = useStorefrontPromotionRevision();
  const hasQuery = Boolean(query);
  const areaId = query?.areaId;
  const searchQuery = query?.searchQuery ?? '';
  const locationLabel = query?.locationLabel ?? '';
  const originLatitude = query?.origin.latitude ?? 0;
  const originLongitude = query?.origin.longitude ?? 0;
  const hotDealsOnly = query?.hotDealsOnly;
  const stableQuery = useMemo<StorefrontListQuery | null>(
    () =>
      hasQuery
        ? {
            areaId,
            searchQuery,
            origin: {
              latitude: originLatitude,
              longitude: originLongitude,
            },
            locationLabel,
            hotDealsOnly,
          }
        : null,
    [areaId, hasQuery, hotDealsOnly, locationLabel, originLatitude, originLongitude, searchQuery],
  );
  const [data, setData] = useState<StorefrontSummary[]>(() =>
    stableQuery
      ? (getCachedNearbySummarySnapshot(stableQuery) ??
        getCachedLatestNearbySummarySnapshot() ??
        [])
      : [],
  );
  const [isLoading, setIsLoading] = useState(() =>
    stableQuery
      ? !Boolean(
          getCachedNearbySummarySnapshot(stableQuery)?.length ||
          getCachedLatestNearbySummarySnapshot()?.length,
        )
      : false,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!stableQuery) {
      startTransition(() => {
        setData([]);
      });
      setError(null);
      setIsLoading(false);
      return;
    }

    let alive = true;
    const cached = getCachedNearbySummarySnapshot(stableQuery);
    const fallback = getCachedLatestNearbySummarySnapshot();
    startTransition(() => {
      setData(cached ?? fallback ?? []);
    });
    setError(null);
    setIsLoading(true);

    void (async () => {
      try {
        if (!cached?.length) {
          if (!fallback?.length) {
            try {
              const latestSnapshot = await loadLatestNearbySummarySnapshot();
              if (alive && latestSnapshot?.length) {
                startTransition(() => {
                  setData((current) => (current.length ? current : latestSnapshot));
                });
              }
            } catch (latestSnapshotError) {
              reportRuntimeError(latestSnapshotError, {
                source: 'nearby-latest-snapshot-load',
              });
            }
          }

          try {
            const snapshot = await loadNearbySummarySnapshot(stableQuery);
            if (alive && snapshot?.length) {
              startTransition(() => {
                setData(snapshot);
              });
            }
          } catch (snapshotError) {
            reportRuntimeError(snapshotError, {
              source: 'nearby-summary-snapshot-load',
            });
          }
        }

        const liveData = await storefrontRepository.getNearbySummaries(stableQuery);
        if (!alive) {
          return;
        }

        if (!shouldKeepWarmNearbyResults(cached, fallback, liveData)) {
          startTransition(() => {
            setData(liveData);
          });
        }
        setError(null);
        if (shouldPersistNearbySnapshot(liveData)) {
          void saveNearbySummarySnapshot(stableQuery, liveData);
        }
      } catch (nextError) {
        reportRuntimeError(nextError, {
          source: 'nearby-summary-fetch',
        });

        if (!alive) {
          return;
        }

        setError(
          nextError instanceof Error
            ? nextError.message
            : 'Unable to load nearby storefronts right now.',
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
  }, [authSession.status, authSession.uid, promotionRevision, stableQuery]);

  return { data, error, isLoading };
}

export function useNearbyWarmSnapshot() {
  const { authSession } = useStorefrontProfileController();
  const promotionRevision = useStorefrontPromotionRevision();
  const [data, setData] = useState<StorefrontSummary[]>(
    () => getCachedLatestNearbySummarySnapshot() ?? [],
  );

  useEffect(() => {
    let alive = true;
    const cached = getCachedLatestNearbySummarySnapshot() ?? [];
    startTransition(() => {
      setData(cached);
    });

    void (async () => {
      try {
        const snapshot = await loadLatestNearbySummarySnapshot();
        if (!alive || !snapshot?.length) {
          return;
        }

        startTransition(() => {
          setData(snapshot);
        });
      } catch (error) {
        if (__DEV__) {
          console.warn('[useNearbyWarmSnapshot] failed to load nearby summary snapshot:', error);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [authSession.status, authSession.uid, promotionRevision]);

  return data;
}
