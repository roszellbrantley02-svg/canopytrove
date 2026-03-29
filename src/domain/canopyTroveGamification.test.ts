import { describe, expect, it } from 'vitest';
import {
  applyReportSubmittedReward,
  applyReviewSubmittedReward,
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
});
