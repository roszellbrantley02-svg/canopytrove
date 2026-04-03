import { useEffect, useState } from 'react';
import { storefrontApiBaseUrl, storefrontSourceMode } from '../config/storefrontSourceConfig';
import type { StorefrontBackendHealth } from '../services/storefrontBackendService';
import { getStorefrontBackendHealth } from '../services/storefrontBackendService';

type BackendHealthState = {
  status: 'idle' | 'checking' | 'healthy' | 'unreachable';
  activeMode: string | null;
  fallbackReason: string | null;
  profileStorage: 'memory' | 'firestore' | null;
  routeStateStorage: 'memory' | 'firestore' | null;
  gamificationStorage: 'memory' | 'firestore' | null;
  allowDevSeed: boolean;
};

const initialState: BackendHealthState = {
  status: storefrontSourceMode === 'api' ? 'checking' : 'idle',
  activeMode: null,
  fallbackReason: null,
  profileStorage: null,
  routeStateStorage: null,
  gamificationStorage: null,
  allowDevSeed: false,
};

export function useStorefrontBackendHealth() {
  const [state, setState] = useState<BackendHealthState>(initialState);

  useEffect(() => {
    if (storefrontSourceMode !== 'api' || !storefrontApiBaseUrl) {
      setState({
        status: 'idle',
        activeMode: null,
        fallbackReason: null,
        profileStorage: null,
        routeStateStorage: null,
        gamificationStorage: null,
        allowDevSeed: false,
      });
      return;
    }

    const controller = new AbortController();
    setState({
      status: 'checking',
      activeMode: null,
      fallbackReason: null,
      profileStorage: null,
      routeStateStorage: null,
      gamificationStorage: null,
      allowDevSeed: false,
    });

    void (async () => {
      try {
        const payload = (await getStorefrontBackendHealth()) as StorefrontBackendHealth;

        if (controller.signal.aborted) {
          return;
        }

        setState({
          status: payload.ok ? 'healthy' : 'unreachable',
          activeMode: payload.source?.activeMode ?? null,
          fallbackReason: payload.source?.fallbackReason ?? null,
          profileStorage: payload.profileStorage ?? null,
          routeStateStorage: payload.routeStateStorage ?? null,
          gamificationStorage: payload.gamificationStorage ?? null,
          allowDevSeed: Boolean(payload.allowDevSeed),
        });
      } catch {
        if (controller.signal.aborted) {
          return;
        }

        setState({
          status: 'unreachable',
          activeMode: null,
          fallbackReason: null,
          profileStorage: null,
          routeStateStorage: null,
          gamificationStorage: null,
          allowDevSeed: false,
        });
      }
    })();

    return () => {
      controller.abort();
    };
  }, []);

  return state;
}
