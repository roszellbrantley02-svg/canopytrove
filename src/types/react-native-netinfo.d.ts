/**
 * Minimal type declarations for @react-native-community/netinfo.
 * Remove this file once `npm install` resolves the real package types.
 */
declare module '@react-native-community/netinfo' {
  export interface NetInfoState {
    type: string;
    isConnected: boolean | null;
    isInternetReachable: boolean | null;
    details: unknown;
  }

  export type NetInfoChangeHandler = (state: NetInfoState) => void;

  export interface NetInfoConfiguration {
    reachabilityUrl?: string;
    reachabilityTest?: (response: Response) => Promise<boolean>;
    reachabilityLongTimeout?: number;
    reachabilityShortTimeout?: number;
    reachabilityRequestTimeout?: number;
    reachabilityShouldRun?: () => boolean;
    shouldFetchWiFiSSID?: boolean;
    useNativeReachability?: boolean;
  }

  const NetInfo: {
    addEventListener(listener: NetInfoChangeHandler): () => void;
    fetch(requestedInterface?: string): Promise<NetInfoState>;
    refresh(): Promise<NetInfoState>;
    configure(configuration: Partial<NetInfoConfiguration>): void;
  };

  export default NetInfo;
}
