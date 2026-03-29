import { describe, expect, it } from 'vitest';
import { getStorefrontRatingDisplay, MIN_PUBLIC_RATING_COUNT } from './storefrontRatings';

describe('getStorefrontRatingDisplay', () => {
  it('shows a waiting state below the rating threshold', () => {
    expect(
      getStorefrontRatingDisplay({
        publishedRating: 4.8,
        publishedReviewCount: 3,
      })
    ).toEqual({
      isReady: false,
      average: null,
      badgeLabel: 'Rating Pending',
      countLabel: `3 / ${MIN_PUBLIC_RATING_COUNT} ratings`,
      helperLabel: 'Ratings waiting for you to rate them.',
    });
  });

  it('shows the published average once the threshold is met', () => {
    expect(
      getStorefrontRatingDisplay({
        publishedRating: 4.6,
        publishedReviewCount: 12,
      })
    ).toEqual({
      isReady: true,
      average: 4.6,
      badgeLabel: '4.6',
      countLabel: '12 ratings',
      helperLabel: null,
    });
  });

  it('prefers the CanopyTrove community average once it reaches the threshold', () => {
    expect(
      getStorefrontRatingDisplay({
        publishedRating: 4.9,
        publishedReviewCount: 50,
        appReviews: Array.from({ length: 10 }, (_, index) => ({
          id: `review-${index}`,
          authorName: `User ${index}`,
          authorProfileId: `profile-${index}`,
          rating: 5,
          relativeTime: 'Just now',
          text: 'Solid storefront.',
          tags: [],
          helpfulCount: 0,
        })),
      })
    ).toEqual({
      isReady: true,
      average: 5,
      badgeLabel: '5.0',
      countLabel: '10 ratings',
      helperLabel: null,
    });
  });
});
