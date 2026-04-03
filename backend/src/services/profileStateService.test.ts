import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

function loadProfileStateModule() {
  const modulePaths = [
    require.resolve('../config'),
    require.resolve('../firestoreCollections'),
    require.resolve('../firebase'),
    require.resolve('./gamificationStateService'),
    require.resolve('./gamificationPersistenceService'),
    require.resolve('./launchProgramService'),
    require.resolve('./profileService'),
    require.resolve('./routeStateService'),
    require.resolve('./profileStateService'),
  ];

  for (const modulePath of modulePaths) {
    delete require.cache[modulePath];
  }

  return require('./profileStateService') as typeof import('./profileStateService');
}

function loadLaunchProgramModule() {
  const configModulePath = require.resolve('../config');
  const serviceModulePath = require.resolve('./launchProgramService');
  delete require.cache[configModulePath];
  delete require.cache[serviceModulePath];
  return require('./launchProgramService') as typeof import('./launchProgramService');
}

afterEach(() => {
  delete process.env.LAUNCH_PROGRAM_START_AT;
  delete process.env.LAUNCH_PROGRAM_DURATION_DAYS;
  delete process.env.LAUNCH_EARLY_ADOPTER_LIMIT;
  delete process.env.OWNER_LAUNCH_TRIAL_DAYS;

  const launchProgram = loadLaunchProgramModule();
  launchProgram.clearLaunchProgramMemoryStateForTests();
});

test('saveProfileState awards the early adopter badge only to the first configured accounts', async () => {
  process.env.LAUNCH_PROGRAM_START_AT = '2026-04-01T00:00:00.000Z';
  process.env.LAUNCH_PROGRAM_DURATION_DAYS = '183';
  process.env.LAUNCH_EARLY_ADOPTER_LIMIT = '1';

  const { saveProfileState } = loadProfileStateModule();

  const firstState = await saveProfileState('profile-early-1', {
    profile: {
      kind: 'authenticated',
      accountId: 'account-early-1',
      displayName: 'Early One',
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-01T10:00:00.000Z',
    },
    gamificationState: {
      badges: [],
    },
  });
  const secondState = await saveProfileState('profile-early-2', {
    profile: {
      kind: 'authenticated',
      accountId: 'account-early-2',
      displayName: 'Early Two',
      createdAt: '2026-04-01T10:05:00.000Z',
      updatedAt: '2026-04-01T10:05:00.000Z',
    },
    gamificationState: {
      badges: [],
    },
  });

  assert.deepEqual(firstState.gamificationState.badges, ['early_adopter']);
  assert.deepEqual(secondState.gamificationState.badges ?? [], []);
});

test('saveProfileState strips a forged early adopter badge when there is no authenticated launch claim', async () => {
  process.env.LAUNCH_PROGRAM_START_AT = '2026-04-01T00:00:00.000Z';
  process.env.LAUNCH_PROGRAM_DURATION_DAYS = '183';
  process.env.LAUNCH_EARLY_ADOPTER_LIMIT = '500';

  const { saveProfileState } = loadProfileStateModule();

  const savedState = await saveProfileState('profile-anon-1', {
    profile: {
      kind: 'anonymous',
      accountId: null,
      displayName: 'Anonymous One',
      createdAt: '2026-04-01T11:00:00.000Z',
      updatedAt: '2026-04-01T11:00:00.000Z',
    },
    gamificationState: {
      badges: ['early_adopter'],
    },
  });

  assert.deepEqual(savedState.gamificationState.badges ?? [], []);
});
