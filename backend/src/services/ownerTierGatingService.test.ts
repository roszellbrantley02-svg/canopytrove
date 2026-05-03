import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getTierLimits,
  hasTierAccess,
  assertTierAccess,
  TierAccessError,
} from './ownerTierGatingService';

describe('getTierLimits', () => {
  test('free tier has zero everything and no paid features', () => {
    const limits = getTierLimits('free');
    assert.equal(limits.maxPromotions, 0);
    assert.equal(limits.maxFeaturedPhotos, 0);
    assert.equal(limits.maxFollowerMessages, 0);
    assert.equal(limits.aiEnabled, false);
    assert.equal(limits.multiLocationEnabled, false);
    assert.equal(limits.fullAnalyticsEnabled, false);
    assert.equal(limits.weeklyEmailEnabled, false);
    assert.equal(limits.badgeCustomizationEnabled, false);
  });

  test('verified tier has zero promotions and no AI but allows multi-location (per-seat $99.99/mo billing)', () => {
    const limits = getTierLimits('verified');
    assert.equal(limits.maxPromotions, 0);
    assert.equal(limits.aiEnabled, false);
    // Multi-location is open to every paid tier — per-extra-location seat
    // is billed separately via STRIPE_ADDITIONAL_LOCATION_PRICE_ID.
    assert.equal(limits.multiLocationEnabled, true);
    assert.equal(limits.fullAnalyticsEnabled, false);
  });

  test('growth tier enables promotions and full analytics + multi-location (per-seat billing)', () => {
    const limits = getTierLimits('growth');
    assert.equal(limits.maxPromotions, 2);
    assert.equal(limits.fullAnalyticsEnabled, true);
    assert.equal(limits.weeklyEmailEnabled, true);
    assert.equal(limits.badgeCustomizationEnabled, true);
    assert.equal(limits.aiEnabled, false);
    assert.equal(limits.multiLocationEnabled, true);
  });

  test('pro tier enables all features', () => {
    const limits = getTierLimits('pro');
    assert.equal(limits.maxPromotions, 5);
    assert.equal(limits.aiEnabled, true);
    assert.equal(limits.multiLocationEnabled, true);
    assert.equal(limits.fullAnalyticsEnabled, true);
    assert.equal(limits.audienceTargetingEnabled, true);
    assert.equal(limits.promotionAnalyticsEnabled, true);
  });
});

describe('hasTierAccess', () => {
  test('same tier passes', () => {
    assert.equal(hasTierAccess('free', 'free'), true);
    assert.equal(hasTierAccess('verified', 'verified'), true);
    assert.equal(hasTierAccess('growth', 'growth'), true);
    assert.equal(hasTierAccess('pro', 'pro'), true);
  });

  test('higher tier passes lower requirement', () => {
    assert.equal(hasTierAccess('pro', 'free'), true);
    assert.equal(hasTierAccess('pro', 'verified'), true);
    assert.equal(hasTierAccess('pro', 'growth'), true);
    assert.equal(hasTierAccess('growth', 'free'), true);
    assert.equal(hasTierAccess('growth', 'verified'), true);
    assert.equal(hasTierAccess('verified', 'free'), true);
  });

  test('lower tier fails higher requirement', () => {
    assert.equal(hasTierAccess('free', 'verified'), false);
    assert.equal(hasTierAccess('free', 'growth'), false);
    assert.equal(hasTierAccess('free', 'pro'), false);
    assert.equal(hasTierAccess('verified', 'growth'), false);
    assert.equal(hasTierAccess('verified', 'pro'), false);
    assert.equal(hasTierAccess('growth', 'pro'), false);
  });
});

describe('assertTierAccess', () => {
  test('does not throw when tier is sufficient', () => {
    assert.doesNotThrow(() => assertTierAccess('pro', 'growth', 'Promotions'));
  });

  test('throws TierAccessError when tier is insufficient', () => {
    try {
      assertTierAccess('verified', 'pro', 'AI tools');
      assert.fail('Expected TierAccessError to be thrown');
    } catch (error: unknown) {
      assert.ok(error instanceof TierAccessError);
      assert.equal(error.requiredTier, 'pro');
      assert.equal(error.currentTier, 'verified');
      assert.equal(error.statusCode, 403);
      assert.ok(error.message.includes('AI tools'));
      assert.ok(error.message.includes('Pro'));
    }
  });

  test('includes tier label in error message', () => {
    try {
      assertTierAccess('verified', 'growth', 'Full analytics');
      assert.fail('Expected TierAccessError to be thrown');
    } catch (error: unknown) {
      assert.ok(error instanceof TierAccessError);
      assert.ok(error.message.includes('Growth'));
      assert.ok(error.message.includes('Full analytics'));
    }
  });

  test('free tier cannot access verified features', () => {
    try {
      assertTierAccess('free', 'verified', 'Hours management');
      assert.fail('Expected TierAccessError to be thrown');
    } catch (error: unknown) {
      assert.ok(error instanceof TierAccessError);
      assert.equal(error.requiredTier, 'verified');
      assert.equal(error.currentTier, 'free');
      assert.ok(error.message.includes('Verified Presence'));
      assert.ok(error.message.includes('Hours management'));
    }
  });

  test('free tier passes free-level access check', () => {
    assert.doesNotThrow(() => assertTierAccess('free', 'free', 'Basic management'));
  });
});
