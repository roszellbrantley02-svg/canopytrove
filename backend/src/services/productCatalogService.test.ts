import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { detectLab, isCoa, parseCoa } from './productCatalogService';
import type { LabName } from '../types';

describe('productCatalogService', () => {
  describe('detectLab', () => {
    test('detects Kaycha Labs by domain', () => {
      const lab = detectLab('https://coa.kaychalabs.com/reports/abc123');
      assert.equal(lab, 'kaycha_labs');
    });

    test('detects NY Green Analytics by domain', () => {
      const lab = detectLab('https://nygreenanalytics.com/reports/xyz789');
      assert.equal(lab, 'ny_green_analytics');
    });

    test('detects ProVerde Laboratories by domain', () => {
      const lab = detectLab('https://proverdelabs.com/coa/batch-456');
      assert.equal(lab, 'proverde_laboratories');
    });

    test('detects Keystone State Testing by domain', () => {
      const lab = detectLab('https://keystonestatetesting.com/results/id-999');
      assert.equal(lab, 'keystone_state_testing');
    });

    test('detects ACT Laboratories by domain', () => {
      const lab = detectLab('https://actlabs.com/coa/report-001');
      assert.equal(lab, 'act_laboratories');
    });

    test('returns null for unrecognized domain', () => {
      const lab = detectLab('https://example.com/coa/123');
      assert.equal(lab, null);
    });

    test('returns null for invalid URL', () => {
      const lab = detectLab('not-a-url');
      assert.equal(lab, null);
    });

    test('handles empty string', () => {
      const lab = detectLab('');
      assert.equal(lab, null);
    });
  });

  describe('isCoa', () => {
    test('recognizes Kaycha Labs COA URL', () => {
      assert.equal(isCoa('https://coa.kaychalabs.com/reports/abc123'), true);
    });

    test('recognizes URL with /coa path', () => {
      assert.equal(isCoa('https://example.com/coa/123'), true);
    });

    test('recognizes URL with /reports path', () => {
      assert.equal(isCoa('https://example.com/reports/456'), true);
    });

    test('recognizes URL with /batch path', () => {
      assert.equal(isCoa('https://example.com/batch/789'), true);
    });

    test('recognizes URL with ?id= query param', () => {
      assert.equal(isCoa('https://example.com/page?id=abc123'), true);
    });

    test('recognizes URL with ?batch= query param', () => {
      assert.equal(isCoa('https://example.com/page?batch=xyz'), true);
    });

    test('rejects non-HTTP URL', () => {
      assert.equal(isCoa('ftp://example.com/coa/123'), false);
    });

    test('rejects invalid URL', () => {
      assert.equal(isCoa('not-a-url'), false);
    });

    test('rejects empty string', () => {
      assert.equal(isCoa(''), false);
    });
  });

  describe('parseCoa', () => {
    test('parses Kaycha Labs COA URL and extracts batch ID', async () => {
      const result = await parseCoa('https://coa.kaychalabs.com/reports/batch-abc123');
      assert.equal(result?.labName, 'kaycha_labs');
      assert.equal(result?.batchId, 'batch-abc123');
      assert.equal(result?.coaUrl, 'https://coa.kaychalabs.com/reports/batch-abc123');
      assert(result?.retrievedAt);
    });

    test('parses ProVerde COA URL and extracts batch ID', async () => {
      const result = await parseCoa('https://proverdelabs.com/coa/pv-456');
      assert.equal(result?.labName, 'proverde_laboratories');
      assert.equal(result?.batchId, 'pv-456');
    });

    test('parses Keystone State Testing COA URL', async () => {
      const result = await parseCoa('https://keystonestatetesting.com/test/ks-789');
      assert.equal(result?.labName, 'keystone_state_testing');
      assert.equal(result?.batchId, 'ks-789');
    });

    test('parses generic COA URL with /coa path', async () => {
      const result = await parseCoa('https://example.com/coa/batch-001');
      assert.equal(result?.labName, 'generic');
      assert.equal(result?.batchId, 'batch-001');
    });

    test('parses generic COA URL with query parameters', async () => {
      const result = await parseCoa('https://example.com/page?id=abc&brand=TestBrand');
      assert.equal(result?.labName, 'generic');
      assert.equal(result?.batchId, 'abc');
      assert.equal(result?.brandName, 'TestBrand');
    });

    test('returns null for non-COA URL', async () => {
      const result = await parseCoa('https://example.com/random/page');
      assert.equal(result, null);
    });

    test('returns null for invalid URL', async () => {
      const result = await parseCoa('not-a-url');
      assert.equal(result, null);
    });

    test('returns null for non-HTTP URL', async () => {
      const result = await parseCoa('ftp://example.com/coa/123');
      assert.equal(result, null);
    });

    test('returns null for empty string', async () => {
      const result = await parseCoa('');
      assert.equal(result, null);
    });

    test('handles URL with embedded timestamp', async () => {
      const result = await parseCoa('https://example.com/reports/batch-2024-01-01');
      assert.equal(result?.labName, 'generic');
      assert.equal(result?.batchId, 'batch-2024-01-01');
    });
  });
});
