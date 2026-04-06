import { startTransition, useEffect, useRef, useState } from 'react';
import { useStorefrontProfileController } from '../context/StorefrontController';
import { storefrontRepository } from '../repositories/storefrontRepository';
import { storefrontSourceMode } from '../config/storefrontSourceConfig';
import {
  getCachedStorefrontDetailSnapshot,
  loadStorefrontDetailSnapshot,
  saveStorefrontDetailSnapshot,
  subscribeToStorefrontDetailSnapshot,
} from '../services/storefrontSummarySnapshotService';
import type { StorefrontDetails, StorefrontSummary } from '../types/storefront';
import { reportRuntimeError } from '../services/runtimeReportingService';
import { createFallbackDetails } from '../screens/storefrontDetail/storefrontDetailHelpers';
import { hasPublishedStorefrontHours } from '../utils/storefrontHours';
import { deriveAuthFetchKey } from './authFetchKey';

const FOLLOW_UP_REFRESH_DELAYS_MS = [1_250, 2_500];

function createStorefrontOperationalDependencyKey(storefront?: StorefrontSummary | null) {
  if (!storefront) {
    return null;
  }

  return [
    storefront.id,
    storefront.placeId ?? '',
    storefront.displayName,
    storefront.addressLine1,
    storefront.city,
    storefront.state,
    storefront.zip,
    storefront.coordinates.latitude,
    storefront.coordinates.longitude,
  ].join('|');
}

function normalizeDetailString(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function needsStorefrontOperationalFollowUp(detail: StorefrontDetails | null) {
  if (!detail) {
    return true;
  }

  return (
    !normalizeDetailString(detail.website) ||
    !normalizeDetailString(detail.phone) ||
    !hasPublishedStorefrontHours(detail.hours) ||
    typeof detail.openNow !== 'boolean'
  );
}

export function useStorefrontDetails(
  storefrontId: string | null,
  storefront?: StorefrontSummary | null,
) {
  const { authSession } = useStorefrontProfileController();
  const authFetchKey = deriveAuthFetchKey(authSession);
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
          (storefrontSourceMode !== 'api' ? getCachedStorefrontDetailSnapshot(storefrontId) : null),
        )
      : false,
  );
  const [isOperationalDataPending, setIsOperationalDataPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const followUpRefreshKeyRef = useRef<string | null>(null);
  const followUpTimeoutHandlesRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const storefrontOperationalDependencyKey = createStorefrontOperationalDependencyKey(storefront);
  const shouldRunOperationalFollowUp =
    storefrontSourceMode === 'api' && Boolean(storefrontOperationalDependencyKey);

  const clearFollowUpTimeoutHandles = () => {
    followUpTimeoutHandlesRef.current.forEach((handle) => {
      clearTimeout(handle);
    });
    followUpTimeoutHandlesRef.current = [];
  };

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
        clearFollowUpTimeoutHandles();

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
          shouldRunOperationalFollowUp &&
          needsStorefrontOperationalFollowUp(liveData) &&
          followUpRefreshKeyRef.current !== storefrontId
        ) {
          const nextStorefrontId = storefrontId;
          followUpRefreshKeyRef.current = nextStorefrontId;
          setIsOperationalDataPending(true);

          void (async () => {
            let latestDetail = liveData ?? createFallbackDetails(nextStorefrontId);

            try {
              for (const delayMs of FOLLOW_UP_REFRESH_DELAYS_MS) {
                await new Promise<void>((resolve) => {
                  const timeoutHandle = setTimeout(() => {
                    followUpTimeoutHandlesRef.current = followUpTimeoutHandlesRef.current.filter(
                      (candidate) => candidate !== timeoutHandle,
                    );
                    resolve();
                  }, delayMs);
                  followUpTimeoutHandlesRef.current.push(timeoutHandle);
                });
                if (!alive || nextStorefrontId !== storefrontId) {
                  return;
                }

                const refreshedDetail =
                  await storefrontRepository.getStorefrontDetails(nextStorefrontId);
                if (!alive || nextStorefrontId !== storefrontId) {
                  return;
                }

                latestDetail = refreshedDetail ?? latestDetail;
                storefrontRepository.primeStorefrontDetails(nextStorefrontId, latestDetail);
                if (storefrontSourceMode !== 'api') {
                  void saveStorefrontDetailSnapshot(nextStorefrontId, latestDetail);
                }

                startTransition(() => {
                  setData(latestDetail);
                });

                if (!needsStorefrontOperationalFollowUp(latestDetail)) {
                  break;
                }
              }
            } catch {
              // Follow-up refresh failures should not replace the main detail payload.
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
      clearFollowUpTimeoutHandles();
    };
  }, [
    authFetchKey,
    shouldRunOperationalFollowUp,
    storefrontId,
    storefrontOperationalDependencyKey,
  ]);

  return { data, isLoading, isOperationalDataPending, error };
}
