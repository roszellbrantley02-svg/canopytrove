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

import { hasAcceptedAgeGate, acceptAgeGate } from './ageGateService';

describe('ageGateService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('hasAcceptedAgeGate', () => {
    it('returns false when no value is stored', async () => {
      asyncStorageMocks.getItem.mockResolvedValue(null);

      const result = await hasAcceptedAgeGate();

      expect(result).toBe(false);
    });

    it('returns true when stored value is "true"', async () => {
      asyncStorageMocks.getItem.mockResolvedValue('true');

      const result = await hasAcceptedAgeGate();

      expect(result).toBe(true);
    });

    it('returns false when stored value is "false"', async () => {
      asyncStorageMocks.getItem.mockResolvedValue('false');

      const result = await hasAcceptedAgeGate();

      expect(result).toBe(false);
    });

    it('returns false when stored value is any other string', async () => {
      asyncStorageMocks.getItem.mockResolvedValue('invalid');

      const result = await hasAcceptedAgeGate();

      expect(result).toBe(false);
    });

    it('returns false when AsyncStorage throws an error', async () => {
      asyncStorageMocks.getItem.mockRejectedValue(new Error('Storage error'));

      const result = await hasAcceptedAgeGate();

      expect(result).toBe(false);
    });

    it('queries AsyncStorage with the correct key', async () => {
      asyncStorageMocks.getItem.mockResolvedValue(null);

      await hasAcceptedAgeGate();

      expect(asyncStorageMocks.getItem).toHaveBeenCalledWith('test-app:age-gate:accepted');
    });

    it('returns false when stored value is empty string', async () => {
      asyncStorageMocks.getItem.mockResolvedValue('');

      const result = await hasAcceptedAgeGate();

      expect(result).toBe(false);
    });

    it('is case-sensitive for "true" check', async () => {
      asyncStorageMocks.getItem.mockResolvedValue('True');

      const result = await hasAcceptedAgeGate();

      expect(result).toBe(false);
    });
  });

  describe('acceptAgeGate', () => {
    it('persists acceptance to AsyncStorage', async () => {
      asyncStorageMocks.setItem.mockResolvedValue(undefined);

      await acceptAgeGate();

      expect(asyncStorageMocks.setItem).toHaveBeenCalledWith('test-app:age-gate:accepted', 'true');
    });

    it('stores "true" string value', async () => {
      asyncStorageMocks.setItem.mockResolvedValue(undefined);

      await acceptAgeGate();

      const call = asyncStorageMocks.setItem.mock.calls[0];
      expect(call[1]).toBe('true');
    });

    it('uses correct storage key', async () => {
      asyncStorageMocks.setItem.mockResolvedValue(undefined);

      await acceptAgeGate();

      const call = asyncStorageMocks.setItem.mock.calls[0];
      expect(call[0]).toBe('test-app:age-gate:accepted');
    });

    it('does not throw when AsyncStorage fails', async () => {
      asyncStorageMocks.setItem.mockRejectedValue(new Error('Storage error'));

      expect(async () => {
        await acceptAgeGate();
      }).not.toThrow();
    });

    it('silently handles storage errors', async () => {
      const error = new Error('Write failed');
      asyncStorageMocks.setItem.mockRejectedValue(error);

      const result = acceptAgeGate();
      await expect(result).resolves.toBeUndefined();
    });
  });

  describe('integration', () => {
    it('hasAcceptedAgeGate returns false initially', async () => {
      asyncStorageMocks.getItem.mockResolvedValue(null);

      const result = await hasAcceptedAgeGate();

      expect(result).toBe(false);
    });

    it('hasAcceptedAgeGate returns true after acceptAgeGate is called', async () => {
      asyncStorageMocks.setItem.mockResolvedValue(undefined);
      asyncStorageMocks.getItem.mockResolvedValue('true');

      await acceptAgeGate();
      const result = await hasAcceptedAgeGate();

      expect(result).toBe(true);
    });

    it('acceptAgeGate makes subsequent hasAcceptedAgeGate checks return true', async () => {
      asyncStorageMocks.getItem.mockResolvedValue(null);
      let accepted = false;

      asyncStorageMocks.setItem.mockImplementation(async (_key, value) => {
        if (value === 'true') {
          accepted = true;
        }
      });

      asyncStorageMocks.getItem.mockImplementation(async (_key) => {
        return accepted ? 'true' : null;
      });

      let result = await hasAcceptedAgeGate();
      expect(result).toBe(false);

      await acceptAgeGate();

      result = await hasAcceptedAgeGate();
      expect(result).toBe(true);
    });
  });
});
