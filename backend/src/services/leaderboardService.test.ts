import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

const firestoreCollectionsModulePath = require.resolve('../firestoreCollections');
const gamificationPersistenceServiceModulePath =
  require.resolve('./gamificationPersistenceService');
const profileServiceModulePath = require.resolve('./profileService');
const leaderboardServiceModulePath = require.resolve('./leaderboardService');

const originalModuleEntries = new Map(
  [
    firestoreCollectionsModulePath,
    gamificationPersistenceServiceModulePath,
    profileServiceModulePath,
    leaderboardServiceModulePath,
  ].map((modulePath) => [modulePath, require.cache[modulePath]]),
);

function setCachedModule(modulePath: string, exports: unknown) {
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports,
    children: [],
    path: modulePath,
  } as unknown as NodeJS.Module;
}

afterEach(() => {
  delete require.cache[leaderboardServiceModulePath];

  for (const [modulePath, cachedModule] of originalModuleEntries.entries()) {
    if (cachedModule) {
      require.cache[modulePath] = cachedModule;
      continue;
    }

    delete require.cache[modulePath];
  }
});

test('getLeaderboard paginates owner account ids before excluding owners from rankings', async () => {
  const firstPageDocs = Array.from({ length: 1000 }, (_value, index) => ({
    id: `owner-${index + 1}`,
  }));
  const secondPageDocs = [{ id: 'owner-1001' }];
  let startAfterCalls = 0;

  function createQuery(pageIndex: number) {
    const docs = pageIndex === 0 ? firstPageDocs : secondPageDocs;

    return {
      startAfter(documentSnapshot: { id: string }) {
        startAfterCalls += 1;
        assert.equal(documentSnapshot.id, 'owner-1000');
        return createQuery(pageIndex + 1);
      },
      async get() {
        return {
          empty: docs.length === 0,
          docs,
        };
      },
    };
  }

  setCachedModule(firestoreCollectionsModulePath, {
    getOptionalFirestoreCollection: () => ({
      where(field: string, operator: string, values: string[]) {
        assert.equal(field, 'role');
        assert.equal(operator, 'in');
        assert.deepEqual(values, ['owner', 'admin']);

        return {
          select(selectedField: string) {
            assert.equal(selectedField, 'uid');

            return {
              limit(count: number) {
                assert.equal(count, 1000);
                return createQuery(0);
              },
            };
          },
        };
      },
    }),
  });

  setCachedModule(gamificationPersistenceServiceModulePath, {
    listGamificationStates: async () => [
      {
        profileId: 'profile-owner',
        totalPoints: 999,
        level: 9,
        badges: ['owner'],
        totalReviews: 10,
        totalPhotos: 5,
        dispensariesVisited: 3,
        totalRoutesStarted: 2,
        joinedDate: '2026-01-01T00:00:00.000Z',
        lastActiveDate: '2026-04-10T00:00:00.000Z',
      },
      {
        profileId: 'profile-member',
        totalPoints: 250,
        level: 4,
        badges: ['member'],
        totalReviews: 4,
        totalPhotos: 1,
        dispensariesVisited: 2,
        totalRoutesStarted: 1,
        joinedDate: '2026-02-01T00:00:00.000Z',
        lastActiveDate: '2026-04-10T00:00:00.000Z',
      },
    ],
  });

  setCachedModule(profileServiceModulePath, {
    listProfiles: async () => [
      {
        id: 'profile-owner',
        accountId: 'owner-1001',
        displayName: 'Owner User',
        kind: 'authenticated',
        updatedAt: '2026-04-10T00:00:00.000Z',
      },
      {
        id: 'profile-member',
        accountId: 'member-1',
        displayName: 'Member User',
        kind: 'authenticated',
        updatedAt: '2026-04-11T00:00:00.000Z',
      },
    ],
  });

  delete require.cache[leaderboardServiceModulePath];
  const { getLeaderboard } =
    require('./leaderboardService') as typeof import('./leaderboardService');

  const leaderboard = await getLeaderboard(10, 0);

  assert.equal(startAfterCalls, 1);
  assert.equal(leaderboard.total, 1);
  assert.equal(leaderboard.items.length, 1);
  assert.equal(leaderboard.items[0]?.profileId, 'profile-member');
});
