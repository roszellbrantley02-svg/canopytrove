import { describe, expect, it } from 'vitest';
import { getStorefrontDetailPreviewStatus } from './useStorefrontDetailDerivedState';

describe('getStorefrontDetailPreviewStatus', () => {
  it('shows a neutral website badge when hours are missing but a website exists', () => {
    const state = getStorefrontDetailPreviewStatus({
      hasHours: false,
      hasWebsite: true,
      hasMenu: false,
      resolvedOpenNow: false,
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
});
