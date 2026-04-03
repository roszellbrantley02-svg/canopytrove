import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseStorefrontSummariesQuery } from './validationStorefront';

describe('parseStorefrontSummariesQuery', () => {
  it('treats areaId=all as an unrestricted browse query', () => {
    const result = parseStorefrontSummariesQuery({
      areaId: 'all',
      originLat: '40.7128',
      originLng: '-74.0060',
      limit: '8',
    });

    assert.equal(result.areaId, undefined);
  });

  it('treats areaId=nearby as an unrestricted area filter', () => {
    const result = parseStorefrontSummariesQuery({
      areaId: 'nearby',
      originLat: '40.7128',
      originLng: '-74.0060',
      limit: '3',
    });

    assert.equal(result.areaId, undefined);
  });

  it('keeps real market ids intact', () => {
    const result = parseStorefrontSummariesQuery({
      areaId: 'nyc',
      originLat: '40.7128',
      originLng: '-74.0060',
      limit: '8',
    });

    assert.equal(result.areaId, 'nyc');
  });
});
