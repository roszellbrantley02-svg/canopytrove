import AsyncStorage from '@react-native-async-storage/async-storage';
import { brand } from '../config/brand';
import { StorefrontSummary } from '../types/storefront';
import {
  getStorefrontPromotionBadges,
  getStorefrontPromotionTextFromBadges,
  normalizeStorefrontPromotionBadges,
} from '../utils/storefrontPromotions';

const STOREFRONT_PROMOTION_OVERRIDES_KEY = `${brand.storageNamespace}:storefront-promotion-overrides:v1`;

export type StorefrontPromotionOverride = {
  storefrontId: string;
  badges: string[];
  expiresAt: string | null;
  updatedAt: string;
};

type StorefrontPromotionOverrideState = Record<string, StorefrontPromotionOverride>;

let memoryState: StorefrontPromotionOverrideState = {};
let initializationPromise: Promise<StorefrontPromotionOverrideState> | null = null;
let revision = 0;
let nextExpiryTimer: ReturnType<typeof setTimeout> | null = null;

const listeners = new Set<(nextRevision: number) => void>();

function isPromotionOverrideActive(override: StorefrontPromotionOverride, now = Date.now()) {
  if (!override.expiresAt) {
    return true;
  }

  const expiresAtMs = Date.parse(override.expiresAt);
  return Number.isFinite(expiresAtMs) && expiresAtMs > now;
}

function emitRevision() {
  revision += 1;
  listeners.forEach((listener) => listener(revision));
}

async function persistState() {
  try {
    await AsyncStorage.setItem(STOREFRONT_PROMOTION_OVERRIDES_KEY, JSON.stringify(memoryState));
  } catch {
    // Promotion overrides are best-effort only.
  }
}

function scheduleNextExpiryCheck() {
  if (nextExpiryTimer) {
    clearTimeout(nextExpiryTimer);
    nextExpiryTimer = null;
  }

  const now = Date.now();
  const nextExpiryAt = Object.values(memoryState).reduce<number | null>((current, override) => {
    if (!override.expiresAt) {
      return current;
    }

    const expiresAtMs = Date.parse(override.expiresAt);
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= now) {
      return current;
    }

    if (current === null || expiresAtMs < current) {
      return expiresAtMs;
    }

    return current;
  }, null);

  if (!nextExpiryAt) {
    return;
  }

  nextExpiryTimer = setTimeout(() => {
    void expireStorefrontPromotionOverrides();
  }, Math.max(1_000, nextExpiryAt - now + 250));
}

async function expireStorefrontPromotionOverrides() {
  await initializeStorefrontPromotionOverrides();

  const now = Date.now();
  const nextState = Object.fromEntries(
    Object.entries(memoryState).filter(([, override]) => isPromotionOverrideActive(override, now))
  );

  if (Object.keys(nextState).length === Object.keys(memoryState).length) {
    scheduleNextExpiryCheck();
    return;
  }

  memoryState = nextState;
  await persistState();
  scheduleNextExpiryCheck();
  emitRevision();
}

function normalizeStoredOverride(value: Partial<StorefrontPromotionOverride>) {
  const storefrontId = typeof value.storefrontId === 'string' ? value.storefrontId.trim() : '';
  if (!storefrontId) {
    return null;
  }

  const badges = normalizeStorefrontPromotionBadges(value.badges ?? []);
  if (!badges.length) {
    return null;
  }

  const expiresAt =
    typeof value.expiresAt === 'string' && value.expiresAt.trim() ? value.expiresAt : null;
  const updatedAt =
    typeof value.updatedAt === 'string' && value.updatedAt.trim()
      ? value.updatedAt
      : new Date().toISOString();

  const normalized: StorefrontPromotionOverride = {
    storefrontId,
    badges,
    expiresAt,
    updatedAt,
  };

  if (!isPromotionOverrideActive(normalized)) {
    return null;
  }

  return normalized;
}

export async function initializeStorefrontPromotionOverrides() {
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      const rawValue = await AsyncStorage.getItem(STOREFRONT_PROMOTION_OVERRIDES_KEY);
      if (!rawValue) {
        memoryState = {};
        scheduleNextExpiryCheck();
        return memoryState;
      }

      const parsed = JSON.parse(rawValue) as StorefrontPromotionOverrideState;
      memoryState = Object.fromEntries(
        Object.values(parsed)
          .map((override) => normalizeStoredOverride(override))
          .filter((override): override is StorefrontPromotionOverride => Boolean(override))
          .map((override) => [override.storefrontId, override])
      );
      scheduleNextExpiryCheck();
      return memoryState;
    } catch {
      memoryState = {};
      scheduleNextExpiryCheck();
      return memoryState;
    }
  })();

  return initializationPromise;
}

export function getStorefrontPromotionOverrideRevision() {
  return revision;
}

export function subscribeToStorefrontPromotionOverrideRevision(
  listener: (nextRevision: number) => void
) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function getStorefrontPromotionOverride(storefrontId: string) {
  await initializeStorefrontPromotionOverrides();
  return memoryState[storefrontId] ?? null;
}

export async function saveStorefrontPromotionOverride(options: {
  storefrontId: string;
  badges: string[];
  durationHours: number;
}) {
  const [override] = await saveStorefrontPromotionOverrides([options]);
  return override ?? null;
}

export async function saveStorefrontPromotionOverrides(
  optionsList: Array<{
    storefrontId: string;
    badges: string[];
    durationHours: number;
  }>
) {
  await initializeStorefrontPromotionOverrides();

  if (!optionsList.length) {
    return [];
  }

  const nextState = { ...memoryState };
  const savedOverrides: StorefrontPromotionOverride[] = [];

  optionsList.forEach((options) => {
    const badges = normalizeStorefrontPromotionBadges(options.badges);
    if (!badges.length) {
      delete nextState[options.storefrontId];
      return;
    }

    const durationHours = Math.max(1, Math.min(720, Math.round(options.durationHours)));
    const override: StorefrontPromotionOverride = {
      storefrontId: options.storefrontId,
      badges,
      expiresAt: new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    };

    nextState[options.storefrontId] = override;
    savedOverrides.push(override);
  });

  memoryState = nextState;
  await persistState();
  scheduleNextExpiryCheck();
  emitRevision();
  return savedOverrides;
}

export async function clearStorefrontPromotionOverride(storefrontId: string) {
  await clearStorefrontPromotionOverrides([storefrontId]);
}

export async function clearStorefrontPromotionOverrides(storefrontIds: string[]) {
  await initializeStorefrontPromotionOverrides();
  if (!storefrontIds.some((storefrontId) => Boolean(memoryState[storefrontId]))) {
    return;
  }

  const nextState = { ...memoryState };
  storefrontIds.forEach((storefrontId) => {
    delete nextState[storefrontId];
  });
  memoryState = nextState;
  await persistState();
  scheduleNextExpiryCheck();
  emitRevision();
}

export async function clearAllStorefrontPromotionOverrides() {
  await initializeStorefrontPromotionOverrides();
  if (!Object.keys(memoryState).length) {
    return;
  }

  memoryState = {};
  await persistState();
  scheduleNextExpiryCheck();
  emitRevision();
}

function applyPromotionOverride(
  summary: StorefrontSummary,
  override: StorefrontPromotionOverride | null
): StorefrontSummary {
  const badges = override
    ? normalizeStorefrontPromotionBadges(override.badges)
    : getStorefrontPromotionBadges(summary);
  const promotionText = getStorefrontPromotionTextFromBadges(badges);

  return {
    ...summary,
    promotionBadges: badges,
    promotionText,
    promotionExpiresAt: override?.expiresAt ?? summary.promotionExpiresAt ?? null,
  };
}

export async function applyStorefrontPromotionOverrides(summaries: StorefrontSummary[]) {
  await initializeStorefrontPromotionOverrides();

  return summaries.map((summary) => {
    const override = memoryState[summary.id];
    return applyPromotionOverride(summary, override ?? null);
  });
}
