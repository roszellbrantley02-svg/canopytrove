import { beforeEach, describe, expect, it, vi } from 'vitest';

const asyncStorageMocks = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: asyncStorageMocks.getItem,
    setItem: asyncStorageMocks.setItem,
    removeItem: asyncStorageMocks.removeItem,
  },
}));

vi.mock('../config/brand', () => ({
  brand: {
    storageNamespace: 'test-app',
  },
}));

import {
  clearRecentStorefrontState,
  getCachedRecentStorefrontIds,
  getLastRecentStorefrontMutationAt,
  subscribeToRecentStorefrontIds,
  loadRecentStorefrontIds,
  saveRecentStorefrontIds,
  markStorefrontAsRecent,
} from './recentStorefrontService';

// Helper to reset module state between tests
async function resetService() {
  // Clear all mocks
  vi.clearAllMocks();
  // Re-import the module to reset internal state
  const module = await import('./recentStorefrontService');
  return module;
}

describe('recentStorefrontService', () => {
  beforeEach(async () => {
    await resetService();
    clearRecentStorefrontState();
  });

  describe('getCachedRecentStorefrontIds', () => {
    it('returns empty array initially', () => {
      const result = getCachedRecentStorefrontIds();
      expect(result).toEqual([]);
    });

    it('returns cached IDs after loading', async () => {
      asyncStorageMocks.getItem.mockResolvedValue(JSON.stringify(['storefront-1', 'storefront-2']));

      await loadRecentStorefrontIds();
      const result = getCachedRecentStorefrontIds();

      expect(result).toEqual(['storefront-1', 'storefront-2']);
    });
  });

  describe('getLastRecentStorefrontMutationAt', () => {
    it('returns 0 initially', () => {
      const result = getLastRecentStorefrontMutationAt();
      expect(result).toBe(0);
    });

    it('returns timestamp after mutation', async () => {
      asyncStorageMocks.setItem.mockResolvedValue(undefined);
      const beforeTime = Date.now();

      await saveRecentStorefrontIds(['storefront-1']);

      const afterTime = Date.now();
      const mutationTime = getLastRecentStorefrontMutationAt();

      expect(mutationTime).toBeGreaterThanOrEqual(beforeTime);
      expect(mutationTime).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('subscribeToRecentStorefrontIds', () => {
    it('returns an unsubscribe function', () => {
      const listener = vi.fn();
      const unsubscribe = subscribeToRecentStorefrontIds(listener);

      expect(typeof unsubscribe).toBe('function');
    });

    it('calls listener when IDs are loaded', async () => {
      const listener = vi.fn();
      subscribeToRecentStorefrontIds(listener);

      asyncStorageMocks.getItem.mockResolvedValue(JSON.stringify(['storefront-1', 'storefront-2']));

      await loadRecentStorefrontIds();

      expect(listener).toHaveBeenCalledWith(['storefront-1', 'storefront-2']);
    });

    it('calls listener when IDs are saved', async () => {
      const listener = vi.fn();
      subscribeToRecentStorefrontIds(listener);

      asyncStorageMocks.setItem.mockResolvedValue(undefined);

      await saveRecentStorefrontIds(['new-storefront']);

      expect(listener).toHaveBeenCalledWith(['new-storefront']);
    });

    it('supports multiple listeners', async () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      subscribeToRecentStorefrontIds(listener1);
      subscribeToRecentStorefrontIds(listener2);

      asyncStorageMocks.setItem.mockResolvedValue(undefined);

      await saveRecentStorefrontIds(['storefront-1']);

      expect(listener1).toHaveBeenCalledWith(['storefront-1']);
      expect(listener2).toHaveBeenCalledWith(['storefront-1']);
    });

    it('unsubscribe removes listener', async () => {
      const listener = vi.fn();
      const unsubscribe = subscribeToRecentStorefrontIds(listener);

      asyncStorageMocks.setItem.mockResolvedValue(undefined);

      await saveRecentStorefrontIds(['storefront-1']);
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      await saveRecentStorefrontIds(['storefront-2']);
      expect(listener).toHaveBeenCalledTimes(1); // Still called only once
    });
  });

  describe('loadRecentStorefrontIds', () => {
    it('returns empty array when no data is stored', async () => {
      asyncStorageMocks.getItem.mockResolvedValue(null);

      const result = await loadRecentStorefrontIds();

      expect(result).toEqual([]);
    });

    it('parses JSON and returns IDs', async () => {
      asyncStorageMocks.getItem.mockResolvedValue(JSON.stringify(['id-1', 'id-2', 'id-3']));

      const result = await loadRecentStorefrontIds();

      expect(result).toEqual(['id-1', 'id-2', 'id-3']);
    });

    it('returns empty array on parse error', async () => {
      asyncStorageMocks.getItem.mockResolvedValue('invalid json');

      const result = await loadRecentStorefrontIds();

      expect(result).toEqual([]);
    });

    it('returns empty array on storage error', async () => {
      asyncStorageMocks.getItem.mockRejectedValue(new Error('Storage error'));

      const result = await loadRecentStorefrontIds();

      expect(result).toEqual([]);
    });

    it('updates cache after loading', async () => {
      asyncStorageMocks.getItem.mockResolvedValue(JSON.stringify(['storefront-1', 'storefront-2']));

      await loadRecentStorefrontIds();
      const cached = getCachedRecentStorefrontIds();

      expect(cached).toEqual(['storefront-1', 'storefront-2']);
    });
  });

  describe('saveRecentStorefrontIds', () => {
    it('persists IDs to AsyncStorage', async () => {
      asyncStorageMocks.setItem.mockResolvedValue(undefined);

      await saveRecentStorefrontIds(['id-1', 'id-2']);

      expect(asyncStorageMocks.setItem).toHaveBeenCalledWith(
        'test-app:recent-storefronts',
        JSON.stringify(['id-1', 'id-2']),
      );
    });

    it('limits to 8 storefronts', async () => {
      asyncStorageMocks.setItem.mockResolvedValue(undefined);

      const ids = Array.from({ length: 15 }, (_, i) => `storefront-${i}`);
      await saveRecentStorefrontIds(ids);

      const call = asyncStorageMocks.setItem.mock.calls[0];
      const savedIds = JSON.parse(call[1] as string);

      expect(savedIds).toHaveLength(8);
    });

    it('updates cache after saving', async () => {
      asyncStorageMocks.setItem.mockResolvedValue(undefined);

      await saveRecentStorefrontIds(['id-1', 'id-2']);
      const cached = getCachedRecentStorefrontIds();

      expect(cached).toEqual(['id-1', 'id-2']);
    });

    it('handles storage errors gracefully', async () => {
      asyncStorageMocks.setItem.mockRejectedValue(new Error('Write failed'));

      expect(async () => {
        await saveRecentStorefrontIds(['id-1']);
      }).not.toThrow();
    });

    it('tracks mutation time by default', async () => {
      asyncStorageMocks.setItem.mockResolvedValue(undefined);

      await saveRecentStorefrontIds(['id-1']);
      const mutationTime = getLastRecentStorefrontMutationAt();

      expect(mutationTime).toBeGreaterThan(0);
    });

    it('skips tracking mutation when trackMutation is false', async () => {
      asyncStorageMocks.setItem.mockResolvedValue(undefined);

      const beforeTime = getLastRecentStorefrontMutationAt();
      await saveRecentStorefrontIds(['id-1'], { trackMutation: false });
      const afterTime = getLastRecentStorefrontMutationAt();

      expect(beforeTime).toBe(afterTime);
    });
  });

  describe('markStorefrontAsRecent', () => {
    it('moves storefront to front of list', async () => {
      asyncStorageMocks.getItem.mockResolvedValue(null);
      asyncStorageMocks.setItem.mockResolvedValue(undefined);

      await markStorefrontAsRecent('storefront-1');
      await markStorefrontAsRecent('storefront-2');
      await markStorefrontAsRecent('storefront-1');

      const call = asyncStorageMocks.setItem.mock.calls.at(-1);
      expect(call).toBeDefined();
      if (!call) {
        throw new Error('Expected AsyncStorage write for recent storefront update.');
      }
      const savedIds = JSON.parse(call[1] as string);

      expect(savedIds[0]).toBe('storefront-1');
    });

    it('adds new storefront to front', async () => {
      asyncStorageMocks.getItem.mockResolvedValue(JSON.stringify(['storefront-2', 'storefront-3']));
      asyncStorageMocks.setItem.mockResolvedValue(undefined);

      await markStorefrontAsRecent('storefront-1');

      const call = asyncStorageMocks.setItem.mock.calls[0];
      const savedIds = JSON.parse(call[1] as string);

      expect(savedIds[0]).toBe('storefront-1');
      expect(savedIds).toContain('storefront-2');
      expect(savedIds).toContain('storefront-3');
    });

    it('respects 8 storefront limit', async () => {
      asyncStorageMocks.getItem.mockResolvedValue(null);
      asyncStorageMocks.setItem.mockResolvedValue(undefined);

      for (let i = 1; i <= 10; i++) {
        await markStorefrontAsRecent(`storefront-${i}`);
      }

      const call = asyncStorageMocks.setItem.mock.calls.at(-1);
      expect(call).toBeDefined();
      if (!call) {
        throw new Error('Expected AsyncStorage write for recent storefront limit check.');
      }
      const savedIds = JSON.parse(call[1] as string);

      expect(savedIds).toHaveLength(8);
    });

    it('does not duplicate storefronts', async () => {
      asyncStorageMocks.getItem.mockResolvedValue(
        JSON.stringify(['storefront-1', 'storefront-2', 'storefront-3']),
      );
      asyncStorageMocks.setItem.mockResolvedValue(undefined);

      await markStorefrontAsRecent('storefront-2');

      const call = asyncStorageMocks.setItem.mock.calls[0];
      const savedIds = JSON.parse(call[1] as string);

      expect(savedIds.filter((id: string) => id === 'storefront-2')).toHaveLength(1);
    });

    it('preserves order of other storefronts', async () => {
      asyncStorageMocks.getItem.mockResolvedValue(
        JSON.stringify(['storefront-1', 'storefront-2', 'storefront-3']),
      );
      asyncStorageMocks.setItem.mockResolvedValue(undefined);

      await markStorefrontAsRecent('storefront-2');

      const call = asyncStorageMocks.setItem.mock.calls[0];
      const savedIds = JSON.parse(call[1] as string);

      expect(savedIds).toEqual(['storefront-2', 'storefront-1', 'storefront-3']);
    });
  });
});
