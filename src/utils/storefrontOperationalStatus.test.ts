import { describe, expect, it } from 'vitest';
import { resolveStorefrontOpenNow } from './storefrontOperationalStatus';

describe('resolveStorefrontOpenNow', () => {
  it('prefers live status over summary and detail status', () => {
    expect(
      resolveStorefrontOpenNow({
        liveOpenNow: false,
        summaryOpenNow: true,
        detailOpenNow: true,
      }),
    ).toBe(false);
  });

  it('falls back to summary status when live status is unavailable', () => {
    expect(
      resolveStorefrontOpenNow({
        liveOpenNow: null,
        summaryOpenNow: true,
        detailOpenNow: false,
      }),
    ).toBe(true);
  });

  it('falls back to detail status when summary status is unavailable', () => {
    expect(
      resolveStorefrontOpenNow({
        summaryOpenNow: null,
        detailOpenNow: false,
      }),
    ).toBe(false);
  });

  it('returns null when no status source is available', () => {
    expect(
      resolveStorefrontOpenNow({
        liveOpenNow: null,
        summaryOpenNow: null,
        detailOpenNow: null,
      }),
    ).toBeNull();
  });
});
