import { describe, expect, it } from 'vitest';
import {
  createFavoriteStoreDealNotificationPayload,
  parseNotificationPayload,
} from './notificationPayloadService';

describe('notificationPayloadService', () => {
  it('creates a favorite deal payload with a normalized storefront id', () => {
    expect(createFavoriteStoreDealNotificationPayload(' store-1 ')).toEqual({
      kind: 'favorite_store_deal',
      storefrontId: 'store-1',
    });
  });

  it('parses owner and runtime payloads into typed app payloads', () => {
    expect(
      parseNotificationPayload({
        kind: 'owner_review',
        storefrontId: 'store-2',
        reviewId: 'review-8',
      }),
    ).toEqual({
      kind: 'owner_review',
      storefrontId: 'store-2',
      reviewId: 'review-8',
    });

    expect(
      parseNotificationPayload({
        kind: 'runtime_incident_alert',
        source: 'admin_runtime',
        targetId: 'api-health',
      }),
    ).toEqual({
      kind: 'runtime_incident_alert',
      source: 'admin_runtime',
      targetId: 'api-health',
    });
  });

  it('returns null for unknown payload kinds', () => {
    expect(
      parseNotificationPayload({
        kind: 'unknown_kind',
      }),
    ).toBeNull();
  });
});
