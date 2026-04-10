import { describe, expect, it } from 'vitest';
import { resolveStorefrontOpenNow } from './storefrontOperationalStatus';

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

describe('resolveStorefrontOpenNow', () => {
  it('computes from published hours before using stored booleans', () => {
    const today = DAY_NAMES[new Date().getDay()];

    expect(
      resolveStorefrontOpenNow({
        hours: [`${today}: Closed`],
        summaryOpenNow: true,
        detailOpenNow: true,
      }),
    ).toBe(false);
  });

  it('prefers live status over summary and detail status', () => {
    expect(
      resolveStorefrontOpenNow({
        liveOpenNow: false,
        summaryOpenNow: true,
        detailOpenNow: true,
      }),
    ).toBe(false);
  });

  it('falls back to detail status before summary when live status is unavailable', () => {
    expect(
      resolveStorefrontOpenNow({
        liveOpenNow: null,
        summaryOpenNow: true,
        detailOpenNow: false,
      }),
    ).toBe(false);
  });

  it('falls back to summary status when detail status is unavailable', () => {
    expect(
      resolveStorefrontOpenNow({
        summaryOpenNow: false,
        detailOpenNow: null,
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
