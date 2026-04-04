import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

type OfflineAwareState = {
  isOnline: boolean;
  connectionType: string | null;
};

/**
 * Monitors network connectivity status via @react-native-community/netinfo.
 * Returns { isOnline, connectionType }.
 */
export function useOfflineAware(): OfflineAwareState {
  const [state, setState] = useState<OfflineAwareState>({
    isOnline: true,
    connectionType: null,
  });

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((netState) => {
      setState({
        isOnline: netState.isConnected ?? true,
        connectionType: netState.type ?? null,
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return state;
}
