import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import { clearAbuseState, getAbuseScore, isIpFlagged, recordAbuseSignal } from './abuseScoring';

describe('abuseScoring', () => {
  afterEach(() => {
    clearAbuseState();
  });

  test('score reflects in-window events only (sliding window actually slides)', () => {
    const ip = '203.0.113.1';

    // Inject events directly via successive recordAbuseSignal calls. This
    // covers the regression where score was monotonic — an IP that
    // accumulated 18 points, then waited until the events expired from
    // the 10-minute window, still carried 18 + new points and could
    // flag from a single new signal.
    const realDateNow = Date.now;
    let mockNow = 1_700_000_000_000;
    Date.now = () => mockNow;

    try {
      // Three signals worth 6 points each = 18 points total.
      recordAbuseSignal(ip, 6, '/test');
      recordAbuseSignal(ip, 6, '/test');
      recordAbuseSignal(ip, 6, '/test');
      assert.equal(getAbuseScore(ip), 18);
      assert.equal(isIpFlagged(ip), false);

      // Advance past the 10-minute window — old events should fall off.
      mockNow += 11 * 60_000;

      // A single new 5-point signal: total in-window score = 5, NOT 23.
      recordAbuseSignal(ip, 5, '/test');
      assert.equal(getAbuseScore(ip), 5);
      assert.equal(isIpFlagged(ip), false);
    } finally {
      Date.now = realDateNow;
    }
  });

  test('flag triggers when in-window score crosses threshold', () => {
    const ip = '203.0.113.2';
    const realDateNow = Date.now;
    let mockNow = 1_700_000_000_000;
    Date.now = () => mockNow;

    try {
      // 20-point threshold. Stack 4 signals × 5 points within 1s.
      for (let i = 0; i < 4; i++) {
        recordAbuseSignal(ip, 5, '/test');
        mockNow += 100;
      }
      assert.equal(getAbuseScore(ip), 20);
      assert.equal(isIpFlagged(ip), true);
    } finally {
      Date.now = realDateNow;
    }
  });

  test('flag clears after FLAG_DURATION_MS expires', () => {
    const ip = '203.0.113.3';
    const realDateNow = Date.now;
    let mockNow = 1_700_000_000_000;
    Date.now = () => mockNow;

    try {
      for (let i = 0; i < 4; i++) {
        recordAbuseSignal(ip, 5, '/test');
      }
      assert.equal(isIpFlagged(ip), true);

      // 30 minutes + 1ms past flag duration.
      mockNow += 30 * 60_000 + 1;
      assert.equal(isIpFlagged(ip), false);
      assert.equal(getAbuseScore(ip), 0);
    } finally {
      Date.now = realDateNow;
    }
  });
});
