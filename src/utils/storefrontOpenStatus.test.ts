import { describe, expect, it } from 'vitest';
import { computeOpenNow } from './storefrontOpenStatus';

describe('computeOpenNow', () => {
  it('uses the storefront timezone instead of the runtime timezone', () => {
    expect(
      computeOpenNow(
        ['Friday: 10:00 AM - 8:00 PM'],
        null,
        new Date('2026-04-10T16:30:00.000Z'),
        'America/Los_Angeles',
      ),
    ).toBe(false);
  });

  it('keeps a storefront open during overnight spillover even when today is marked closed', () => {
    expect(
      computeOpenNow(
        ['Thursday: 4:00 PM - 2:00 AM', 'Friday: Closed'],
        false,
        new Date('2026-04-10T05:30:00.000Z'),
        'America/New_York',
      ),
    ).toBe(true);
  });
});
