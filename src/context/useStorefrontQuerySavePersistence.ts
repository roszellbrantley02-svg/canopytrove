import { useEffect } from 'react';
import type { StorefrontQueryPersistencePayload } from './storefrontQueryPersistenceShared';
import {
  createStorefrontQueryPreferencesPayload,
  persistStorefrontQueryPreferences,
} from './storefrontQueryPersistenceShared';

type UseStorefrontQuerySavePersistenceArgs = StorefrontQueryPersistencePayload & {
  hasHydratedPreferences: boolean;
  lastSavedPreferencesPayloadRef: React.MutableRefObject<string | null>;
};

export function useStorefrontQuerySavePersistence({
  hasHydratedPreferences,
  lastSavedPreferencesPayloadRef,
  ...payload
}: UseStorefrontQuerySavePersistenceArgs) {
  useEffect(() => {
    if (!hasHydratedPreferences) {
      return;
    }

    const serializedPreferences = createStorefrontQueryPreferencesPayload(payload);
    if (serializedPreferences === lastSavedPreferencesPayloadRef.current) {
      return;
    }

    const timeoutId = setTimeout(() => {
      lastSavedPreferencesPayloadRef.current = serializedPreferences;
      void persistStorefrontQueryPreferences(payload);
    }, 300);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [hasHydratedPreferences, lastSavedPreferencesPayloadRef, payload]);
}
