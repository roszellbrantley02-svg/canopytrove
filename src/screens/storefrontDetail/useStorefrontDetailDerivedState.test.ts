import { describe, expect, it } from 'vitest';
import { getStorefrontDetailPreviewStatus } from './useStorefrontDetailDerivedState';

describe('getStorefrontDetailPreviewStatus', () => {
  it('shows a neutral website badge when hours and resolved open status are missing but a website exists', () => {
    const state = getStorefrontDetailPreviewStatus({
      hasHours: false,
      hasWebsite: true,
      hasMenu: false,
      resolvedOpenNow: null,
      isOperationalDataPending: false,
    });

    expect(state.previewStatusTone).toBe('checking');
    expect(state.previewStatusLabel).toBe('Check Website');
  });

  it('prefers the resolved open or closed badge when published hours exist', () => {
    const state = getStorefrontDetailPreviewStatus({
      hasHours: true,
      hasWebsite: true,
      hasMenu: false,
      resolvedOpenNow: false,
      isOperationalDataPending: false,
    });

    expect(state.previewStatusTone).toBe('closed');
    expect(state.previewStatusLabel).toBe('Closed');
  });

  it('shows open or closed even when hours are missing if the resolved open status is known (Android fallback)', () => {
    const state = getStorefrontDetailPreviewStatus({
      hasHours: false,
      hasWebsite: false,
      hasMenu: false,
      resolvedOpenNow: true,
      isOperationalDataPending: false,
    });

    expect(state.previewStatusTone).toBe('open');
    expect(state.previewStatusLabel).toBe('Open Now');
  });

  it('falls back to See Details when hours, website, menu, and openNow are all absent', () => {
    const state = getStorefrontDetailPreviewStatus({
      hasHours: false,
      hasWebsite: false,
      hasMenu: false,
      resolvedOpenNow: null,
      isOperationalDataPending: false,
    });

    expect(state.previewStatusTone).toBe('checking');
    expect(state.previewStatusLabel).toBe('See Details');
  });
});
