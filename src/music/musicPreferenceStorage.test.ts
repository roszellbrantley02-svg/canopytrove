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

import {
  MUSIC_ENABLED_DEFAULT,
  readMusicEnabledPreference,
  writeMusicEnabledPreference,
} from './musicPreferenceStorage';

describe('musicPreferenceStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps background music off by default for fresh installs', async () => {
    asyncStorageMocks.getItem.mockResolvedValue(null);

    await expect(readMusicEnabledPreference()).resolves.toBe(false);
    expect(MUSIC_ENABLED_DEFAULT).toBe(false);
  });

  it('defaults to off when the stored preference cannot be read', async () => {
    asyncStorageMocks.getItem.mockRejectedValue(new Error('storage unavailable'));

    await expect(readMusicEnabledPreference()).resolves.toBe(false);
  });

  it('only turns music on after an explicit persisted opt-in', async () => {
    asyncStorageMocks.getItem.mockResolvedValue('true');

    await expect(readMusicEnabledPreference()).resolves.toBe(true);
  });

  it('persists explicit opt-in and opt-out values', async () => {
    asyncStorageMocks.setItem.mockResolvedValue(undefined);

    await writeMusicEnabledPreference(true);
    await writeMusicEnabledPreference(false);

    expect(asyncStorageMocks.setItem).toHaveBeenNthCalledWith(
      1,
      '@canopytrove/music/enabled-v1',
      'true',
    );
    expect(asyncStorageMocks.setItem).toHaveBeenNthCalledWith(
      2,
      '@canopytrove/music/enabled-v1',
      'false',
    );
  });
});
