import assert from 'node:assert/strict';
import test from 'node:test';

test('owner portal allowlist normalizes and matches approved emails', async () => {
  process.env.OWNER_PORTAL_PRELAUNCH_ENABLED = 'true';
  process.env.OWNER_PORTAL_ALLOWLIST = 'owner@example.com';
  const {
    isOwnerPortalEmailAllowlisted,
  } = await import(`./ownerPortalAuthClaimsService?allowlist=${Date.now()}`);

  assert.equal(isOwnerPortalEmailAllowlisted('OWNER@example.com'), true);
  assert.equal(isOwnerPortalEmailAllowlisted('not-approved@example.com'), false);
});

test('owner portal claim sync stops requiring a private allowlist when prelaunch is disabled', async () => {
  process.env.OWNER_PORTAL_PRELAUNCH_ENABLED = 'false';
  process.env.OWNER_PORTAL_ALLOWLIST = '';
  const {
    isOwnerPortalEmailAllowlisted,
  } = await import(`./ownerPortalAuthClaimsService?public=${Date.now()}`);

  assert.equal(isOwnerPortalEmailAllowlisted('owner@example.com'), true);
  assert.equal(isOwnerPortalEmailAllowlisted('OWNER@example.com'), true);
});

test('admin claims stay admin while non-admin claims resolve to owner', async () => {
  const {
    resolveOwnerPortalClaimRole,
  } = await import(`./ownerPortalAuthClaimsService?claims=${Date.now()}`);

  assert.equal(resolveOwnerPortalClaimRole({ admin: true }), 'admin');
  assert.equal(resolveOwnerPortalClaimRole({ role: 'admin' }), 'admin');
  assert.equal(resolveOwnerPortalClaimRole({ role: 'owner' }), 'owner');
  assert.equal(resolveOwnerPortalClaimRole(undefined), 'owner');
});
