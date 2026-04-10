import { beforeEach, describe, expect, it, vi } from 'vitest';

const asyncStorageMocks = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: asyncStorageMocks.getItem,
    setItem: asyncStorageMocks.setItem,
  },
}));

vi.mock('../config/brand', () => ({
  brand: {
    storageNamespace: 'test-app',
  },
}));

async function loadService() {
  vi.resetModules();
  return import('./communitySafetyService');
}

describe('communitySafetyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('drops legacy global blockedAuthorProfileIds during initialization', async () => {
    asyncStorageMocks.getItem.mockResolvedValue(
      JSON.stringify({
        acceptedGuidelinesVersion: '2026-03-28',
        blockedAuthorProfileIds: ['author_global_1'],
      }),
    );

    const service = await loadService();
    const state = await service.initializeCommunitySafetyState();

    expect(state.acceptedGuidelinesVersion).toBe('2026-03-28');
    expect(state.blockedReviewAuthors).toEqual([]);
    expect(asyncStorageMocks.setItem).toHaveBeenCalledWith(
      'test-app:community-safety',
      JSON.stringify({
        acceptedGuidelinesVersion: '2026-03-28',
        blockedReviewAuthors: [],
      }),
    );
  });

  it('blocks and unblocks authors per storefront instead of globally', async () => {
    asyncStorageMocks.getItem.mockResolvedValue(null);
    asyncStorageMocks.setItem.mockResolvedValue(undefined);

    const service = await loadService();
    await service.initializeCommunitySafetyState();
    await service.blockCommunityAuthor({
      storefrontId: 'storefront-1',
      storefrontName: 'Storefront One',
      authorId: 'author_1',
    });

    expect(
      service.isCommunityAuthorBlocked(
        'storefront-1',
        'author_1',
        service.getCommunitySafetyState(),
      ),
    ).toBe(true);
    expect(
      service.isCommunityAuthorBlocked(
        'storefront-2',
        'author_1',
        service.getCommunitySafetyState(),
      ),
    ).toBe(false);

    await service.unblockCommunityAuthor({
      storefrontId: 'storefront-1',
      authorId: 'author_1',
    });

    expect(
      service.isCommunityAuthorBlocked(
        'storefront-1',
        'author_1',
        service.getCommunitySafetyState(),
      ),
    ).toBe(false);
  });

  it('clears blocked authors for only the requested storefront', async () => {
    asyncStorageMocks.getItem.mockResolvedValue(null);
    asyncStorageMocks.setItem.mockResolvedValue(undefined);

    const service = await loadService();
    await service.initializeCommunitySafetyState();
    await service.blockCommunityAuthor({
      storefrontId: 'storefront-1',
      storefrontName: 'Storefront One',
      authorId: 'author_1',
    });
    await service.blockCommunityAuthor({
      storefrontId: 'storefront-2',
      storefrontName: 'Storefront Two',
      authorId: 'author_2',
    });

    await service.clearBlockedCommunityAuthorsForStorefront('storefront-1');

    expect(
      service.isCommunityAuthorBlocked(
        'storefront-1',
        'author_1',
        service.getCommunitySafetyState(),
      ),
    ).toBe(false);
    expect(
      service.isCommunityAuthorBlocked(
        'storefront-2',
        'author_2',
        service.getCommunitySafetyState(),
      ),
    ).toBe(true);
  });
});
