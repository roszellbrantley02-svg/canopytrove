import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

function loadCommunitySafetyStateModule() {
  const modulePaths = [
    require.resolve('../config'),
    require.resolve('../firestoreCollections'),
    require.resolve('../firebase'),
    require.resolve('./communitySafetyStateService'),
  ];

  for (const modulePath of modulePaths) {
    delete require.cache[modulePath];
  }

  return require('./communitySafetyStateService') as typeof import('./communitySafetyStateService');
}

afterEach(() => {
  const { clearCommunitySafetyMemoryStateForTests } = loadCommunitySafetyStateModule();
  clearCommunitySafetyMemoryStateForTests();
});

test('saveCommunitySafetyState normalizes and deduplicates blocked authors', async () => {
  const { saveCommunitySafetyState, getCommunitySafetyState } = loadCommunitySafetyStateModule();

  await saveCommunitySafetyState('profile-1', {
    acceptedGuidelinesVersion: '2026-03-28',
    blockedReviewAuthors: [
      {
        storefrontId: 'storefront-1',
        storefrontName: 'Storefront One',
        authorId: 'author-1',
      },
      {
        storefrontId: 'storefront-1',
        storefrontName: 'Duplicate Storefront One',
        authorId: 'author-1',
      },
      {
        storefrontId: 'storefront-2',
        storefrontName: 'Storefront Two',
        authorId: 'author-2',
      },
    ],
  });

  const state = await getCommunitySafetyState('profile-1');

  assert.equal(state.acceptedGuidelinesVersion, '2026-03-28');
  assert.deepEqual(state.blockedReviewAuthors, [
    {
      storefrontId: 'storefront-1',
      storefrontName: 'Storefront One',
      authorId: 'author-1',
    },
    {
      storefrontId: 'storefront-2',
      storefrontName: 'Storefront Two',
      authorId: 'author-2',
    },
  ]);
});
