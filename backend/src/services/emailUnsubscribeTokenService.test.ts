import assert from 'node:assert/strict';
import path from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';

function clearBackendModuleCache() {
  const backendSourceRoot = `${path.resolve(__dirname, '..')}${path.sep}`;
  for (const modulePath of Object.keys(require.cache)) {
    if (modulePath.includes(backendSourceRoot)) {
      delete require.cache[modulePath];
    }
  }
}

beforeEach(() => {
  delete process.env.EMAIL_UNSUBSCRIBE_TOKEN_SECRET;
  delete process.env.EMAIL_UNSUBSCRIBE_BASE_URL;
  process.env.STOREFRONT_BACKEND_SOURCE = 'mock';
  clearBackendModuleCache();
});

afterEach(() => {
  delete process.env.EMAIL_UNSUBSCRIBE_TOKEN_SECRET;
  delete process.env.EMAIL_UNSUBSCRIBE_BASE_URL;
  clearBackendModuleCache();
});

test('signUnsubscribeToken returns null when secret is unset', async () => {
  const { signUnsubscribeToken } = await import('./emailUnsubscribeTokenService');
  const token = signUnsubscribeToken({ accountId: 'acct_abc', scope: 'deal_digest' });
  assert.equal(token, null);
});

test('signUnsubscribeToken returns null when secret is shorter than 32 chars', async () => {
  process.env.EMAIL_UNSUBSCRIBE_TOKEN_SECRET = 'too-short';
  clearBackendModuleCache();
  const { signUnsubscribeToken } = await import('./emailUnsubscribeTokenService');
  const token = signUnsubscribeToken({ accountId: 'acct_abc', scope: 'deal_digest' });
  assert.equal(token, null);
});

test('sign + verify round-trip for valid payload', async () => {
  process.env.EMAIL_UNSUBSCRIBE_TOKEN_SECRET = 'a'.repeat(64);
  clearBackendModuleCache();
  const { signUnsubscribeToken, verifyUnsubscribeToken } =
    await import('./emailUnsubscribeTokenService');

  const token = signUnsubscribeToken({ accountId: 'acct_abc', scope: 'deal_digest' });
  assert.ok(token, 'token should be signed');

  const verified = verifyUnsubscribeToken(token!);
  assert.deepEqual(verified, { accountId: 'acct_abc', scope: 'deal_digest' });
});

test('verifyUnsubscribeToken rejects tampered payload', async () => {
  process.env.EMAIL_UNSUBSCRIBE_TOKEN_SECRET = 'a'.repeat(64);
  clearBackendModuleCache();
  const { signUnsubscribeToken, verifyUnsubscribeToken } =
    await import('./emailUnsubscribeTokenService');

  const token = signUnsubscribeToken({ accountId: 'acct_abc', scope: 'deal_digest' });
  assert.ok(token);

  // Flip one character in the payload portion (before the dot).
  const dotIndex = token!.indexOf('.');
  const tampered =
    token!.slice(0, dotIndex - 1) +
    (token!.charAt(dotIndex - 1) === 'A' ? 'B' : 'A') +
    token!.slice(dotIndex);

  const verified = verifyUnsubscribeToken(tampered);
  assert.equal(verified, null);
});

test('verifyUnsubscribeToken rejects token signed with a different secret', async () => {
  process.env.EMAIL_UNSUBSCRIBE_TOKEN_SECRET = 'a'.repeat(64);
  clearBackendModuleCache();
  const mod1 = await import('./emailUnsubscribeTokenService');
  const token = mod1.signUnsubscribeToken({ accountId: 'acct_abc', scope: 'deal_digest' });
  assert.ok(token);

  process.env.EMAIL_UNSUBSCRIBE_TOKEN_SECRET = 'b'.repeat(64);
  clearBackendModuleCache();
  const mod2 = await import('./emailUnsubscribeTokenService');
  const verified = mod2.verifyUnsubscribeToken(token!);
  assert.equal(verified, null);
});

test('verifyUnsubscribeToken rejects malformed input', async () => {
  process.env.EMAIL_UNSUBSCRIBE_TOKEN_SECRET = 'a'.repeat(64);
  clearBackendModuleCache();
  const { verifyUnsubscribeToken } = await import('./emailUnsubscribeTokenService');

  for (const bad of ['', 'no-dot-here', 'foo.', '.bar', 'foo.bar.baz']) {
    assert.equal(verifyUnsubscribeToken(bad), null, `expected reject: ${JSON.stringify(bad)}`);
  }
});

test('buildUnsubscribeUrl uses configured base URL', async () => {
  process.env.EMAIL_UNSUBSCRIBE_TOKEN_SECRET = 'a'.repeat(64);
  process.env.EMAIL_UNSUBSCRIBE_BASE_URL = 'https://example.test';
  clearBackendModuleCache();
  const { buildUnsubscribeUrl } = await import('./emailUnsubscribeTokenService');

  const url = buildUnsubscribeUrl({ accountId: 'acct_abc', scope: 'deal_digest' });
  assert.ok(url, 'should build a url');
  assert.match(url!, /^https:\/\/example\.test\/email\/unsubscribe\?token=/);
});
