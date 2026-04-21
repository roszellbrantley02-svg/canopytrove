import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getSafePublicDisplayName, isEmailLike, sanitizePublicDisplayName } from './publicIdentity';

test('public identity helpers reject email-like public names', () => {
  assert.equal(isEmailLike('member@example.com'), true);
  assert.equal(isEmailLike('GreenGuide'), false);
  assert.equal(sanitizePublicDisplayName('member@example.com'), null);
  assert.equal(sanitizePublicDisplayName('  GreenGuide  '), 'GreenGuide');
  assert.equal(
    getSafePublicDisplayName('member@example.com', 'Canopy Trove member'),
    'Canopy Trove member',
  );
});
