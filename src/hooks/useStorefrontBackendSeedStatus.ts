import { useEffect, useState } from 'react';
import { storefrontApiBaseUrl, storefrontSourceMode } from '../config/storefrontSourceConfig';
import {
  StorefrontBackendSeedStatus,
  getStorefrontBackendSeedStatus,
} from '../services/storefrontBackendService';

const initialState: StorefrontBackendSeedStatus | null = null;

export function useStorefrontBackendSeedStatus() {
  const [data, setData] = useState<StorefrontBackendSeedStatus | null>(initialState);
  const [isLoading, setIsLoading] = useState(storefrontSourceMode === 'api');

  useEffect(() => {
    if (storefrontSourceMode !== 'api' || !storefrontApiBaseUrl) {
      setData(null);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);

    void (async () => {
      try {
        const payload = await getStorefrontBackendSeedStatus();
        if (controller.signal.aborted) {
          return;
        }

        setData(payload);
      } catch {
        if (controller.signal.aborted) {
          return;
        }

        setData(null);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, []);

  return { data, isLoading };
}
