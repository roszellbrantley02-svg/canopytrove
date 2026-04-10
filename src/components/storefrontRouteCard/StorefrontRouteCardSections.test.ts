import { describe, expect, it } from 'vitest';
import { getStorefrontRouteCardState } from './storefrontRouteCardState';

describe('getStorefrontRouteCardState', () => {
  it('shows a neutral details badge when hours are not published yet', () => {
    const state = getStorefrontRouteCardState({
      isSaved: false,
      isVisited: false,
      hasPromotion: false,
      premiumCardVariant: undefined,
      openNow: false,
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
