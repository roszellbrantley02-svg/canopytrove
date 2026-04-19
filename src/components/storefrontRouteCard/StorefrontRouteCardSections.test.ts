import { describe, expect, it } from 'vitest';
import { getStorefrontRouteCardState } from './storefrontRouteCardState';

describe('getStorefrontRouteCardState', () => {
  it('trusts a resolved closed status even without published hours (Android fallback)', () => {
    // Android frequently lands here: Google Places backfill hasn't run so the
    // normalized hours array is empty, but the summary-level openNow boolean
    // is already resolved. The card should reflect that boolean rather than
    // falling back to "See Details" (which was the pre-fix behavior that made
    // listing cards feel broken on Android).
    const state = getStorefrontRouteCardState({
      isSaved: false,
      isVisited: false,
      hasPromotion: false,
      premiumCardVariant: undefined,
      openNow: false,
      isOperationalStatusPending: false,
      hasPublishedHours: false,
    });

    expect(state.previewStatusTone).toBe('closed');
    expect(state.previewStatusLabel.startsWith('Closed')).toBe(true);
  });

  it('falls back to See Details when openNow is unresolved', () => {
    // True missing-data case: the backend couldn't compute openNow and no
    // operational check is in flight. Cards should render the neutral label.
    const state = getStorefrontRouteCardState({
      isSaved: false,
      isVisited: false,
      hasPromotion: false,
      premiumCardVariant: undefined,
      openNow: null,
      isOperationalStatusPending: false,
      hasPublishedHours: false,
    });

    expect(state.previewStatusTone).toBe('checking');
    expect(state.previewStatusLabel.startsWith('See Details')).toBe(true);
  });

  it('keeps the closed badge when published hours support a resolved status', () => {
    const state = getStorefrontRouteCardState({
      isSaved: false,
      isVisited: false,
      hasPromotion: false,
      premiumCardVariant: undefined,
      openNow: false,
      isOperationalStatusPending: false,
      hasPublishedHours: true,
    });

    expect(state.previewStatusTone).toBe('closed');
    expect(state.previewStatusLabel.startsWith('Closed')).toBe(true);
  });
});
