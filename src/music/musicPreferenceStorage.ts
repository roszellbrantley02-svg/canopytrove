import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Where the on/off preference is persisted. The key is namespaced so it won't
 * collide with anything else in AsyncStorage and so we can bulk-purge music
 * prefs later if we ever need to reset the feature.
 */
const MUSIC_ENABLED_STORAGE_KEY = '@canopytrove/music/enabled-v1';

/** Background music defaults ON for guests/members — feature is explicitly requested by product. */
export const MUSIC_ENABLED_DEFAULT = true;

export async function readMusicEnabledPreference(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(MUSIC_ENABLED_STORAGE_KEY);
    if (raw === null || raw === undefined) {
      return MUSIC_ENABLED_DEFAULT;
    }
    return raw === 'true';
  } catch {
    return MUSIC_ENABLED_DEFAULT;
  }
}

export async function writeMusicEnabledPreference(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(MUSIC_ENABLED_STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    // AsyncStorage failures here are non-fatal — the preference just won't
    // survive an app restart. No toast/log needed; user can re-toggle.
  }
}
