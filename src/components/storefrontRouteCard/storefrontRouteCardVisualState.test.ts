import { describe, expect, it } from 'vitest';
import {
  getStorefrontCardPreviewTone,
  getStorefrontCardVisualLane,
} from './storefrontRouteCardVisualState';

type VisualLaneInput = Parameters<typeof getStorefrontCardVisualLane>[0];

function createState(overrides: Partial<VisualLaneInput> = {}): VisualLaneInput {
  return {
    isSaved: false,
    isVisited: false,
    hasPromotion: false,
    premiumCardVariant: undefined,
    ...overrides,
  };
}

describe('storefrontRouteCardVisualState', () => {
  describe('visual lane priority', () => {
    it('prioritizes hot deal over owner featured, saved, and visited states', () => {
      expect(
        getStorefrontCardVisualLane(
          createState({
            hasPromotion: true,
            premiumCardVariant: 'owner_featured',
            isSaved: true,
            isVisited: true,
          }),
        ),
      ).toBe('hotDeal');
    });

    it('prioritizes owner featured over saved and visited when there is no hot deal', () => {
      expect(
        getStorefrontCardVisualLane(
          createState({
            premiumCardVariant: 'owner_featured',
            isSaved: true,
            isVisited: true,
          }),
        ),
      ).toBe('ownerFeatured');
    });

    it('prioritizes saved over visited when both member states are active', () => {
      expect(
        getStorefrontCardVisualLane(
          createState({
            isSaved: true,
            isVisited: true,
          }),
        ),
      ).toBe('saved');
    });

    it('uses visited when it is the strongest available signal', () => {
      expect(
        getStorefrontCardVisualLane(
          createState({
            isVisited: true,
          }),
        ),
      ).toBe('visited');
    });

    it('uses new-to-you when no stronger lane is active', () => {
      expect(getStorefrontCardVisualLane(createState())).toBe('newToYou');
    });
  });

  describe('preview tone mapping', () => {
    it.each([
      ['hotDeal', 'promotion'],
      ['ownerFeatured', 'ownerFeatured'],
      ['saved', 'saved'],
      ['visited', 'visited'],
      ['newToYou', 'neverVisited'],
      ['default', 'default'],
    ] as const)('maps %s lanes to %s preview tones', (lane, expectedTone) => {
      expect(getStorefrontCardPreviewTone(lane)).toBe(expectedTone);
    });
  });
});
