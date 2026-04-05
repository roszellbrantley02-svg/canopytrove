import { OwnerStorefrontPromotionDocument } from '../../../src/types/ownerPortal';
import { serverConfig } from '../config';
import { dispatchFavoriteDealAlertsForStorefront } from './favoriteDealAlertService';
import { getOwnerStorefrontPromotionsCollection } from './ownerPortalWorkspaceCollections';
import {
  ownerStorefrontPromotionStore,
  saveOwnerStorefrontPromotionDocument,
} from './ownerPortalWorkspaceData';
import {
  derivePromotionStatus,
  normalizePromotion,
  parseIsoDate,
} from './ownerPortalWorkspaceHelpers';

export const MAX_OWNER_PROMOTIONS_PER_STOREFRONT = 5;

let promotionSchedulerHandle: ReturnType<typeof setInterval> | null = null;
let promotionSchedulerStarted = false;
let promotionSweepInFlight: Promise<OwnerPromotionSweepResult> | null = null;
let promotionAlertDispatcher: typeof dispatchFavoriteDealAlertsForStorefront =
  dispatchFavoriteDealAlertsForStorefront;

type PromotionAlertDispatchResult = Awaited<
  ReturnType<typeof dispatchFavoriteDealAlertsForStorefront>
>;

export type OwnerPromotionSweepResult = {
  ok: true;
  processedCount: number;
  alertedCount: number;
  skippedCount: number;
  failedPromotionIds: string[];
};

export class OwnerPromotionValidationError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

function getNowIso() {
  return new Date().toISOString();
}

function shouldCountAgainstPromotionLimit(
  promotion: OwnerStorefrontPromotionDocument,
  nowIso = getNowIso(),
) {
  return derivePromotionStatus(promotion, nowIso) !== 'expired';
}

async function listAllOwnerPromotions() {
  const collectionRef = getOwnerStorefrontPromotionsCollection();
  if (collectionRef) {
    const snapshot = await collectionRef.get();
    return snapshot.docs.map((documentSnapshot) => {
      const data = documentSnapshot.data() as OwnerStorefrontPromotionDocument;
      return normalizePromotion(data.ownerUid, data.storefrontId, data);
    });
  }

  return Array.from(ownerStorefrontPromotionStore.values())
    .flat()
    .map((promotion) => normalizePromotion(promotion.ownerUid, promotion.storefrontId, promotion));
}

function getPromotionDurationMs(
  promotion: Pick<OwnerStorefrontPromotionDocument, 'startsAt' | 'endsAt'>,
) {
  return parseIsoDate(promotion.endsAt) - parseIsoDate(promotion.startsAt);
}

export function assertOwnerPromotionConstraints(options: {
  nextPromotion: OwnerStorefrontPromotionDocument;
  existingPromotions: OwnerStorefrontPromotionDocument[];
  currentPromotionId?: string | null;
  nowIso?: string;
  /** Override the max promotion limit (for tier-based gating). Defaults to MAX_OWNER_PROMOTIONS_PER_STOREFRONT. */
  maxPromotions?: number;
}) {
  const nowIso = options.nowIso ?? getNowIso();
  const durationMs = getPromotionDurationMs(options.nextPromotion);
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new OwnerPromotionValidationError('Promotion end time must be after the start time.');
  }

  const nextStatus = derivePromotionStatus(options.nextPromotion, nowIso);
  if (nextStatus === 'expired') {
    return;
  }

  const maxAllowed = options.maxPromotions ?? MAX_OWNER_PROMOTIONS_PER_STOREFRONT;
  const livePromotionCount = options.existingPromotions.filter((promotion) => {
    if (promotion.id === options.currentPromotionId) {
      return false;
    }

    return shouldCountAgainstPromotionLimit(promotion, nowIso);
  }).length;

  if (livePromotionCount >= maxAllowed) {
    throw new OwnerPromotionValidationError(
      `You can keep at most ${maxAllowed} scheduled or active promotions at once.${maxAllowed < MAX_OWNER_PROMOTIONS_PER_STOREFRONT ? ' Upgrade your plan for more.' : ''}`,
    );
  }
}

export function preparePromotionForSave(options: {
  existingPromotion: OwnerStorefrontPromotionDocument | null;
  nextPromotion: OwnerStorefrontPromotionDocument;
}) {
  const { existingPromotion, nextPromotion } = options;

  if (!nextPromotion.alertFollowersOnStart) {
    return {
      ...nextPromotion,
      followersAlertedAt: null,
    };
  }

  if (!existingPromotion) {
    return {
      ...nextPromotion,
      followersAlertedAt: nextPromotion.followersAlertedAt ?? null,
    };
  }

  const schedulingChanged =
    existingPromotion.startsAt !== nextPromotion.startsAt ||
    existingPromotion.endsAt !== nextPromotion.endsAt;
  const shouldResetAlert = schedulingChanged || !existingPromotion.alertFollowersOnStart;

  return {
    ...nextPromotion,
    followersAlertedAt: shouldResetAlert ? null : (existingPromotion.followersAlertedAt ?? null),
  };
}

async function markPromotionAlerted(
  promotion: OwnerStorefrontPromotionDocument,
  alertedAt: string,
) {
  return saveOwnerStorefrontPromotionDocument({
    ...promotion,
    followersAlertedAt: alertedAt,
    updatedAt: alertedAt,
  });
}

export async function maybeDispatchPromotionStartAlert(
  promotion: OwnerStorefrontPromotionDocument,
  nowIso = getNowIso(),
) {
  if (!promotion.alertFollowersOnStart) {
    return {
      promotion,
      didAlert: false,
      result: null as PromotionAlertDispatchResult | null,
    };
  }

  if (promotion.followersAlertedAt) {
    return {
      promotion,
      didAlert: false,
      result: null as PromotionAlertDispatchResult | null,
    };
  }

  if (derivePromotionStatus(promotion, nowIso) !== 'active') {
    return {
      promotion,
      didAlert: false,
      result: null as PromotionAlertDispatchResult | null,
    };
  }

  const result = await promotionAlertDispatcher(promotion.storefrontId);
  const nextPromotion = await markPromotionAlerted(promotion, nowIso);
  return {
    promotion: nextPromotion,
    didAlert: true,
    result,
  };
}

export async function runOwnerPromotionStartSweep(
  nowIso = getNowIso(),
): Promise<OwnerPromotionSweepResult> {
  if (promotionSweepInFlight) {
    return promotionSweepInFlight;
  }

  const task = (async () => {
    const promotions = await listAllOwnerPromotions();
    const eligiblePromotions = promotions.filter(
      (promotion) =>
        promotion.alertFollowersOnStart &&
        !promotion.followersAlertedAt &&
        derivePromotionStatus(promotion, nowIso) === 'active',
    );

    let alertedCount = 0;
    const failedPromotionIds: string[] = [];

    for (const promotion of eligiblePromotions) {
      try {
        const result = await maybeDispatchPromotionStartAlert(promotion, nowIso);
        if (result.didAlert) {
          alertedCount += 1;
        }
      } catch {
        failedPromotionIds.push(promotion.id);
      }
    }

    return {
      ok: true,
      processedCount: promotions.length,
      alertedCount,
      skippedCount: promotions.length - eligiblePromotions.length,
      failedPromotionIds,
    } satisfies OwnerPromotionSweepResult;
  })();

  promotionSweepInFlight = task;
  try {
    return await task;
  } finally {
    promotionSweepInFlight = null;
  }
}

export function startOwnerPromotionScheduler(
  intervalMinutes = serverConfig.ownerPromotionSweepIntervalMinutes,
) {
  if (!serverConfig.ownerPromotionSchedulerEnabled || promotionSchedulerStarted) {
    return false;
  }

  promotionSchedulerStarted = true;
  const intervalMs = Math.max(60_000, intervalMinutes * 60 * 1000);
  void runOwnerPromotionStartSweep().catch(() => undefined);
  promotionSchedulerHandle = setInterval(() => {
    void runOwnerPromotionStartSweep().catch(() => undefined);
  }, intervalMs);
  return true;
}

export function stopOwnerPromotionScheduler() {
  if (promotionSchedulerHandle) {
    clearInterval(promotionSchedulerHandle);
    promotionSchedulerHandle = null;
  }
  promotionSchedulerStarted = false;
}

export function setOwnerPromotionAlertDispatcherForTests(
  dispatcher: typeof dispatchFavoriteDealAlertsForStorefront | null,
) {
  promotionAlertDispatcher = dispatcher ?? dispatchFavoriteDealAlertsForStorefront;
}

export function clearOwnerPromotionSchedulerStateForTests() {
  stopOwnerPromotionScheduler();
  promotionSweepInFlight = null;
  promotionAlertDispatcher = dispatchFavoriteDealAlertsForStorefront;
}
