import { describe, expect, it } from 'vitest';
import {
  applyReportSubmittedReward,
  applyReviewSubmittedReward,
  applyScanCompletedReward,
  applyCoaOpenedReward,
  createDefaultGamificationState,
  getBadgeDefinitions,
} from './canopyTroveGamification';

describe('canopyTroveGamification rewards', () => {
  it('does not award points or badges for submitting a report', () => {
    const state = {
      ...createDefaultGamificationState('profile-1', '2026-03-01T00:00:00.000Z'),
      badges: ['early_adopter'],
    };

    const reward = applyReportSubmittedReward(state, {
      occurredAt: '2026-03-28T12:00:00.000Z',
    });

    expect(reward.pointsEarned).toBe(0);
    expect(reward.badgesEarned).toEqual([]);
    expect(reward.updatedState.reportsSubmitted).toBe(1);
    expect(reward.updatedState.totalPoints).toBe(0);
  });

  it('rewards thoughtful photo reviews more than a bare review', () => {
    const state = {
      ...createDefaultGamificationState('profile-1', '2026-03-01T00:00:00.000Z'),
      badges: ['early_adopter', 'reviewer_1'],
      totalReviews: 1,
    };

    const reward = applyReviewSubmittedReward(state, {
      rating: 5,
      textLength: 140,
      photoCount: 2,
      occurredAt: '2026-03-28T12:00:00.000Z',
    });

    expect(reward.pointsEarned).toBe(70);
    expect(reward.updatedState.totalReviews).toBe(2);
    expect(reward.updatedState.reviewsWithPhotos).toBe(1);
    expect(reward.updatedState.detailedReviews).toBe(1);
    expect(reward.updatedState.fiveStarReviews).toBe(1);
  });

  it('removes the old reporter badge from the badge catalog', () => {
    expect(getBadgeDefinitions().some((badge) => badge.id === 'reporter')).toBe(false);
  });

  it('awards scan_first_product badge on first product scan', () => {
    const state = createDefaultGamificationState('profile-1', '2026-03-01T00:00:00.000Z');

    const reward = applyScanCompletedReward(state, {
      scanKind: 'product',
      brandId: 'brand-1',
      labName: 'kaycha_labs',
      thcPercent: 15,
      isNewBrandForUser: true,
      occurredAt: '2026-03-28T12:00:00.000Z',
    });

    expect(reward.pointsEarned).toBeGreaterThan(0);
    expect(reward.updatedState.scanStats?.productScanCount).toBe(1);
    const badgeEarned = reward.badgesEarned.find((b) => b.id === 'scan_first_product');
    expect(badgeEarned).toBeDefined();
    expect(badgeEarned?.points).toBe(25);
  });

  it('awards bonus points for scanning a new brand', () => {
    const state = createDefaultGamificationState('profile-1', '2026-03-01T00:00:00.000Z');

    const reward = applyScanCompletedReward(state, {
      scanKind: 'product',
      brandId: 'brand-1',
      labName: 'kaycha_labs',
      thcPercent: 15,
      isNewBrandForUser: true,
    });

    // Base 5 + bonus 5 for new brand
    expect(reward.pointsEarned).toBeGreaterThanOrEqual(10);
  });

  it('awards scan_brand_scout badge at 10 unique brands', () => {
    const state = {
      ...createDefaultGamificationState('profile-1', '2026-03-01T00:00:00.000Z'),
      scanStats: {
        productScanCount: 9,
        uniqueBrandIds: [
          'brand-1',
          'brand-2',
          'brand-3',
          'brand-4',
          'brand-5',
          'brand-6',
          'brand-7',
          'brand-8',
          'brand-9',
        ],
        uniqueTerpenes: [],
        coaOpenCount: 0,
        cleanPassCount: 0,
        highThcScans: 0,
      },
    };

    const reward = applyScanCompletedReward(state, {
      scanKind: 'product',
      brandId: 'brand-10',
      labName: 'kaycha_labs',
      thcPercent: 15,
      isNewBrandForUser: true,
    });

    const badgeEarned = reward.badgesEarned.find((b) => b.id === 'scan_brand_scout');
    expect(badgeEarned).toBeDefined();
    expect(reward.updatedState.scanStats?.uniqueBrandIds.length).toBe(10);
  });

  it('awards scan_clean_choice badge for clean products', () => {
    const state = {
      ...createDefaultGamificationState('profile-1', '2026-03-01T00:00:00.000Z'),
      scanStats: {
        productScanCount: 9,
        uniqueBrandIds: [],
        uniqueTerpenes: [],
        coaOpenCount: 0,
        cleanPassCount: 9,
        highThcScans: 0,
      },
    };

    const reward = applyScanCompletedReward(state, {
      scanKind: 'product',
      brandId: 'brand-1',
      labName: 'kaycha_labs',
      thcPercent: 15,
      contaminants: {
        pesticides: false,
        heavyMetals: false,
        microbial: false,
        solvents: false,
      },
      isNewBrandForUser: false,
    });

    const badgeEarned = reward.badgesEarned.find((b) => b.id === 'scan_clean_choice');
    expect(badgeEarned).toBeDefined();
    expect(reward.updatedState.scanStats?.cleanPassCount).toBe(10);
  });

  it('awards scan_cream_of_the_crop badge for high THC products', () => {
    const state = createDefaultGamificationState('profile-1', '2026-03-01T00:00:00.000Z');

    const reward = applyScanCompletedReward(state, {
      scanKind: 'product',
      brandId: 'brand-1',
      labName: 'kaycha_labs',
      thcPercent: 26,
      isNewBrandForUser: true,
    });

    const badgeEarned = reward.badgesEarned.find((b) => b.id === 'scan_cream_of_the_crop');
    expect(badgeEarned).toBeDefined();
    expect(badgeEarned?.points).toBe(50);
  });

  it('awards coa_opened badge at 5 COAs opened', () => {
    const state = {
      ...createDefaultGamificationState('profile-1', '2026-03-01T00:00:00.000Z'),
      scanStats: {
        productScanCount: 0,
        uniqueBrandIds: [],
        uniqueTerpenes: [],
        coaOpenCount: 4,
        cleanPassCount: 0,
        highThcScans: 0,
      },
    };

    const reward = applyCoaOpenedReward(state, {
      brandId: 'brand-1',
      labName: 'kaycha_labs',
    });

    const badgeEarned = reward.badgesEarned.find((b) => b.id === 'scan_lab_curious');
    expect(badgeEarned).toBeDefined();
    expect(reward.updatedState.scanStats?.coaOpenCount).toBe(5);
  });

  it('does not award points for non-product scans', () => {
    const state = createDefaultGamificationState('profile-1', '2026-03-01T00:00:00.000Z');

    const reward = applyScanCompletedReward(state, {
      scanKind: 'license',
      isNewBrandForUser: false,
    });

    expect(reward.pointsEarned).toBe(0);
    expect(reward.updatedState.scanStats?.productScanCount).toBe(0);
  });
});
