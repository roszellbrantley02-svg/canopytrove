import { AppReview, StorefrontSummary } from './storefront';

export type StorefrontRecord = StorefrontSummary & {
  phone: string | null;
  website: string | null;
  hours: string[];
  appReviewCount: number;
  appReviews: AppReview[];
  photoUrls: string[];
  amenities: string[];
  editorialSummary: string | null;
  routeMode: 'preview' | 'verified';
};
