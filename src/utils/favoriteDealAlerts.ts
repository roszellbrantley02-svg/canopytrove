import type { StorefrontSummary } from '../types/storefront';

export const FAVORITE_DEAL_ALERT_POLL_INTERVAL_MS = 15 * 60 * 1000;

export type FavoriteDealAlertState = {
  hasHydrated: boolean;
  activeDealFingerprintsByStorefrontId: Record<string, string>;
};

export const EMPTY_FAVORITE_DEAL_ALERT_STATE: FavoriteDealAlertState = {
  hasHydrated: false,
  activeDealFingerprintsByStorefrontId: {},
};

export function createFavoriteDealFingerprint(promotionText?: string | null) {
  const normalized = promotionText?.trim().replace(/\s+/g, ' ').toLowerCase() ?? '';
  return normalized || null;
}

export function getFavoriteDealAlertChanges({
  previousState,
  savedSummaries,
  allowNotifications,
}: {
  previousState: FavoriteDealAlertState;
  savedSummaries: StorefrontSummary[];
  allowNotifications: boolean;
}) {
  const nextFingerprints: Record<string, string> = {};
  const nextNotifications: StorefrontSummary[] = [];

  savedSummaries.forEach((summary) => {
    const fingerprint = createFavoriteDealFingerprint(summary.promotionText);
    if (!fingerprint) {
      return;
    }

    nextFingerprints[summary.id] = fingerprint;

    const previousFingerprint = previousState.activeDealFingerprintsByStorefrontId[summary.id] ?? null;
    if (allowNotifications && previousState.hasHydrated && previousFingerprint !== fingerprint) {
      nextNotifications.push(summary);
    }
  });

  return {
    nextState: {
      hasHydrated: true,
      activeDealFingerprintsByStorefrontId: nextFingerprints,
    } satisfies FavoriteDealAlertState,
    notifications: nextNotifications,
  };
}
