import type {
  AnalyticsEventInput,
  AnalyticsEventType,
  AnalyticsMetadata,
} from '../types/analytics';
import type { AnalyticsIdentity } from './analyticsConfig';
import { createAnalyticsId } from './analyticsConfig';

export function buildAnalyticsEvent(
  eventType: AnalyticsEventType,
  installId: string,
  currentSessionId: string | null,
  currentIdentity: AnalyticsIdentity,
  currentScreen: string | null,
  metadata?: AnalyticsMetadata,
  options?: {
    screen?: string;
    storefrontId?: string;
    dealId?: string;
  },
) {
  if (!installId || !currentSessionId) {
    return null;
  }

  return {
    eventId: createAnalyticsId('event'),
    eventType,
    installId,
    sessionId: currentSessionId,
    occurredAt: new Date().toISOString(),
    profileId: currentIdentity.profileId,
    accountId: currentIdentity.accountId,
    profileKind: currentIdentity.profileKind,
    screen: options?.screen ?? currentScreen ?? undefined,
    storefrontId: options?.storefrontId,
    dealId: options?.dealId,
    metadata,
  } satisfies AnalyticsEventInput;
}

export function classifyLocationInput(query: string) {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return 'unknown';
  }

  if (/^\d{5}$/.test(trimmedQuery)) {
    return 'zip';
  }

  if (/\d/.test(trimmedQuery)) {
    return 'address';
  }

  return 'city';
}
