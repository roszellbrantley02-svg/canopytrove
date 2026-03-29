import AsyncStorage from '@react-native-async-storage/async-storage';
import { brand } from '../config/brand';

const STORAGE_MIGRATION_KEY = `${brand.storageNamespace}:storage-migration:v1`;
const LEGACY_STORAGE_NAMESPACES = [String.fromCharCode(99, 97, 110, 110, 97, 118, 97)];

let storageMigrationPromise: Promise<void> | null = null;

function createLegacyPrefix(namespace: string) {
  return `${namespace}:`;
}

function getNextStorageKey(legacyKey: string, legacyPrefix: string) {
  return `${brand.storageNamespace}:${legacyKey.slice(legacyPrefix.length)}`;
}

async function migrateLegacyStorageNamespaceOnce() {
  try {
    const migrationStatus = await AsyncStorage.getItem(STORAGE_MIGRATION_KEY);
    if (migrationStatus === 'done') {
      return;
    }

    const allKeys = await AsyncStorage.getAllKeys();
    const currentKeys = new Set(allKeys);
    const copyTargets: Array<{ legacyKey: string; nextKey: string }> = [];

    for (const namespace of LEGACY_STORAGE_NAMESPACES) {
      const legacyPrefix = createLegacyPrefix(namespace);
      for (const key of allKeys) {
        if (!key.startsWith(legacyPrefix)) {
          continue;
        }

        const nextKey = getNextStorageKey(key, legacyPrefix);
        if (currentKeys.has(nextKey)) {
          continue;
        }

        copyTargets.push({
          legacyKey: key,
          nextKey,
        });
      }
    }

    if (copyTargets.length > 0) {
      const legacyEntries = await AsyncStorage.multiGet(copyTargets.map((entry) => entry.legacyKey));
      const nextEntries: Array<[string, string]> = [];

      for (const [legacyKey, value] of legacyEntries) {
        if (typeof value !== 'string') {
          continue;
        }

        const target = copyTargets.find((entry) => entry.legacyKey === legacyKey);
        if (!target) {
          continue;
        }

        nextEntries.push([target.nextKey, value]);
      }

      if (nextEntries.length > 0) {
        await AsyncStorage.multiSet(nextEntries);
      }
    }

    await AsyncStorage.setItem(STORAGE_MIGRATION_KEY, 'done');
  } catch {
    // Storage migration is best-effort and should never block app startup.
  }
}

export function migrateLegacyStorageNamespace() {
  if (!storageMigrationPromise) {
    storageMigrationPromise = migrateLegacyStorageNamespaceOnce();
  }

  return storageMigrationPromise;
}
