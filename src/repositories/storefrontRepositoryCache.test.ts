import { describe, expect, it, vi } from 'vitest';

vi.mock('../services/storefrontMemberDealAccessService', () => ({
  getStorefrontMemberAccessCacheKey: vi.fn(() => 'signed-out'),
}));

import { createSavedKey } from './storefrontRepositoryCache';

describe('createSavedKey', () => {
  it('avoids delimiter collisions between different saved storefront id sets', () => {
    const firstKey = createSavedKey(['a|b', 'c']);
    const secondKey = createSavedKey(['a', 'b|c']);

    expect(firstKey).not.toBe(secondKey);
  });
});
