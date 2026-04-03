import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { OwnerStorefrontPromotionDocument } from '../../../src/types/ownerPortal';
import {
  assertOwnerPromotionConstraints,
  clearOwnerPromotionSchedulerStateForTests,
  runOwnerPromotionStartSweep,
  setOwnerPromotionAlertDispatcherForTests,
} from './ownerPortalPromotionSchedulerService';
import {
  ownerStorefrontPromotionStore,
  saveOwnerStorefrontPromotionDocument,
} from './ownerPortalWorkspaceData';

function createPromotion(overrides?: Partial<OwnerStorefrontPromotionDocument>): OwnerStorefrontPromotionDocument {
  const now = Date.now();
  const startsAt = new Date(now - 30 * 60 * 1000).toISOString();
  const endsAt = new Date(now + 30 * 60 * 1000).toISOString();

  return {
    id: overrides?.id ?? `promotion-${Math.random().toString(36).slice(2, 10)}`,
    storefrontId: overrides?.storefrontId ?? 'storefront-1',
    ownerUid: overrides?.ownerUid ?? 'owner-1',
    title: overrides?.title ?? 'Daily deal',
    description: overrides?.description ?? 'One-day storefront promotion',
    badges: overrides?.badges ?? ['Daily deal'],
    startsAt: overrides?.startsAt ?? startsAt,
    endsAt: overrides?.endsAt ?? endsAt,
    status: overrides?.status ?? 'active',
    audience: overrides?.audience ?? 'all_followers',
    alertFollowersOnStart: overrides?.alertFollowersOnStart ?? true,
    cardTone: overrides?.cardTone ?? 'owner_featured',
    placementSurfaces: overrides?.placementSurfaces ?? ['browse'],
    placementScope: overrides?.placementScope ?? 'storefront_area',
    followersAlertedAt:
      Object.prototype.hasOwnProperty.call(overrides ?? {}, 'followersAlertedAt')
        ? overrides?.followersAlertedAt ?? null
        : null,
    createdAt: overrides?.createdAt ?? new Date(now - 60 * 60 * 1000).toISOString(),
    updatedAt: overrides?.updatedAt ?? new Date(now - 60 * 60 * 1000).toISOString(),
  };
}

afterEach(() => {
  ownerStorefrontPromotionStore.clear();
  clearOwnerPromotionSchedulerStateForTests();
});

test('allows multi-day promotions when the time window is valid', () => {
  const now = Date.now();
  const nextPromotion = createPromotion({
    startsAt: new Date(now + 60 * 60 * 1000).toISOString(),
    endsAt: new Date(now + 26 * 60 * 60 * 1000).toISOString(),
  });

  assert.doesNotThrow(() =>
    assertOwnerPromotionConstraints({
      nextPromotion,
      existingPromotions: [],
    })
  );
});

test('rejects a sixth scheduled or active promotion for one storefront', () => {
  const now = Date.now();
  const existingPromotions = Array.from({ length: 5 }, (_, index) =>
    createPromotion({
      id: `promotion-${index + 1}`,
      startsAt: new Date(now + index * 60 * 60 * 1000).toISOString(),
      endsAt: new Date(now + (index + 1) * 60 * 60 * 1000).toISOString(),
      status: 'scheduled',
    })
  );

  assert.throws(
    () =>
      assertOwnerPromotionConstraints({
        nextPromotion: createPromotion({
          id: 'promotion-6',
          startsAt: new Date(now + 6 * 60 * 60 * 1000).toISOString(),
          endsAt: new Date(now + 7 * 60 * 60 * 1000).toISOString(),
          status: 'scheduled',
        }),
        existingPromotions,
      }),
    /at most 5 scheduled or active promotions/
  );
});

test('promotion sweep alerts active promotions only once', async () => {
  const promotion = createPromotion({
    id: 'promotion-active',
    storefrontId: 'storefront-1',
    followersAlertedAt: null,
  });
  await saveOwnerStorefrontPromotionDocument(promotion);

  const dispatchCalls: string[] = [];
  setOwnerPromotionAlertDispatcherForTests(async (storefrontId) => {
    dispatchCalls.push(storefrontId);
    return {
      storefrontId,
      processedProfiles: 0,
      notifiedProfiles: 0,
      totalNotifications: 0,
      results: [],
    };
  });

  const firstSweep = await runOwnerPromotionStartSweep();
  assert.equal(firstSweep.alertedCount, 1);
  assert.deepEqual(dispatchCalls, ['storefront-1']);

  const storedPromotion = ownerStorefrontPromotionStore.get('storefront-1')?.[0];
  assert.ok(storedPromotion?.followersAlertedAt);

  const secondSweep = await runOwnerPromotionStartSweep();
  assert.equal(secondSweep.alertedCount, 0);
  assert.deepEqual(dispatchCalls, ['storefront-1']);
});
