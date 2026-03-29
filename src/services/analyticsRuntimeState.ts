import { AppState, AppStateStatus } from 'react-native';
import { AnalyticsEventInput } from '../types/analytics';
import { AnalyticsIdentity } from './analyticsConfig';

export type AnalyticsRuntimeState = {
  analyticsInitialized: boolean;
  analyticsInitPromise: Promise<void> | null;
  installId: string;
  pendingEvents: AnalyticsEventInput[];
  currentScreen: string | null;
  currentSessionId: string | null;
  currentSessionStartedAt: number;
  currentIdentity: AnalyticsIdentity;
  flushTimeout: ReturnType<typeof setTimeout> | null;
  flushBackoffUntil: number;
  isFlushing: boolean;
  appStateSubscription: { remove: () => void } | null;
  lastAppState: AppStateStatus;
  coldOpenTracked: boolean;
  storefrontImpressionKeys: Set<string>;
  dealImpressionKeys: Set<string>;
};

export const analyticsRuntimeState: AnalyticsRuntimeState = {
  analyticsInitialized: false,
  analyticsInitPromise: null,
  installId: '',
  pendingEvents: [],
  currentScreen: null,
  currentSessionId: null,
  currentSessionStartedAt: 0,
  currentIdentity: {
    profileId: null,
    accountId: null,
    profileKind: null,
  },
  flushTimeout: null,
  flushBackoffUntil: 0,
  isFlushing: false,
  appStateSubscription: null,
  lastAppState: AppState.currentState,
  coldOpenTracked: false,
  storefrontImpressionKeys: new Set<string>(),
  dealImpressionKeys: new Set<string>(),
};
