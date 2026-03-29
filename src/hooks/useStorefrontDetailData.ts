import { startTransition, useEffect, useRef, useState } from 'react';
import { storefrontRepository } from '../repositories/storefrontRepository';
import { storefrontSourceMode } from '../config/storefrontSourceConfig';
import {
  getCachedStorefrontDetailSnapshot,
  loadStorefrontDetailSnapshot,
  saveStorefrontDetailSnapshot,
  subscribeToStorefrontDetailSnapshot,
} from '../services/storefrontSummarySnapshotService';
import { StorefrontDetails, StorefrontSummary } from '../types/storefront';
import { reportRuntimeError } from '../services/runtimeReportingService';
import {
  applyStorefrontOperationalEnrichment,
  needsStorefrontOperationalEnrichment,
} from '../services/storefrontOperationalDataService';
import { createFallbackDetails } from '../screens/storefrontDetail/storefrontDetailHelpers';

export function useStorefrontDetails(storefrontId: string | null, storefront?: StorefrontSummary | null) {
  const [data, setData] = useState<StorefrontDetails | null>(() => {
    if (!storefrontId) {
      return null;
    }

    return (
      storefrontRepository.getCachedStorefrontDetails(storefrontId) ??
      (storefrontSourceMode !== 'api' ? getCachedStorefrontDetailSnapshot(storefrontId) : null)
    );
  });
  const [isLoading, setIsLoading] = useState(() =>
    storefrontId
      ? !Boolean(
          storefrontRepository.getCachedStorefrontDetails(storefrontId) ??
            (storefrontSourceMode !== 'api' ? getCachedStorefrontDetailSnapshot(storefrontId) : null)
        )
      : false
  );
  const [isOperationalDataPending, setIsOperationalDataPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const followUpRefreshKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!storefrontId || storefrontSourceMode === 'api') {
      return;
    }

    const unsubscribe = subscribeToStorefrontDetailSnapshot(storefrontId, (nextDetail) => {
      startTransition(() => {
        setData(nextDetail);
      });
      setIsLoading(false);
    });

    return unsubscribe;
  }, [storefrontId]);

  useEffect(() => {
    let alive = true;
    const cached =
      (storefrontId ? storefrontRepository.getCachedStorefrontDetails(storefrontId) : null) ??
      (storefrontId && storefrontSourceMode !== 'api'
        ? getCachedStorefrontDetailSnapshot(storefrontId)
        : null);
    setData(cached);
    setError(null);
    setIsOperationalDataPending(false);
    setIsLoading(storefrontId ? !Boolean(cached) : false);

    void (async () => {
      if (!storefrontId) {
        if (alive) {
          setIsLoading(false);
          setError(null);
          setIsOperationalDataPending(false);
        }
        return;
      }

      try {
        followUpRefreshKeyRef.current = null;

        if (!cached && storefrontSourceMode !== 'api') {
          const snapshot = await loadStorefrontDetailSnapshot(storefrontId);
          if (alive && snapshot) {
            startTransition(() => {
              setData(snapshot);
            });
            setIsLoading(false);
          }
        }

        const liveData = await storefrontRepository.getStorefrontDetails(storefrontId);
        if (!alive) {
          return;
        }

        startTransition(() => {
          setData(liveData);
        });
        setError(null);
        setIsLoading(false);
        setIsOperationalDataPending(false);

        if (storefrontSourceMode !== 'api') {
          void saveStorefrontDetailSnapshot(storefrontId, liveData);
        }

        if (
          storefront &&
          needsStorefrontOperationalEnrichment(liveData) &&
          followUpRefreshKeyRef.current !== storefrontId
        ) {
          const nextStorefrontId = storefrontId;
          followUpRefreshKeyRef.current = nextStorefrontId;
          setIsOperationalDataPending(true);

          void (async () => {
            let latestDetail = liveData ?? createFallbackDetails(nextStorefrontId);

            try {
              const enrichedDetail = await applyStorefrontOperationalEnrichment(
                liveData ?? createFallbackDetails(nextStorefrontId),
                storefront
              );
              if (!alive || nextStorefrontId !== storefrontId) {
                return;
              }

              latestDetail = enrichedDetail;
              storefrontRepository.primeStorefrontDetails(nextStorefrontId, enrichedDetail);
              if (storefrontSourceMode !== 'api') {
                void saveStorefrontDetailSnapshot(nextStorefrontId, enrichedDetail);
              }

              startTransition(() => {
                setData(enrichedDetail);
              });
            } catch {
              // Operational enrichment failures should not replace the main detail payload.
            } finally {
              if (!alive || nextStorefrontId !== storefrontId) {
                return;
              }

              followUpRefreshKeyRef.current = null;
              startTransition(() => {
                setData(latestDetail);
              });
              setIsOperationalDataPending(false);
            }
          })();
        }
      } catch (nextError) {
        reportRuntimeError(nextError, {
          source: 'storefront-detail-fetch',
          screen: 'StorefrontDetail',
        });
        if (!alive) {
          return;
        }

        setError('Unable to load the latest storefront details right now.');
        setIsLoading(false);
        setIsOperationalDataPending(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [storefrontId, storefront]);

  return { data, isLoading, isOperationalDataPending, error };
}
