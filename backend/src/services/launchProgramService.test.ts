import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

function loadLaunchProgramModule() {
  const configModulePath = require.resolve('../config');
  const serviceModulePath = require.resolve('./launchProgramService');
  delete require.cache[configModulePath];
  delete require.cache[serviceModulePath];
  return require('./launchProgramService') as typeof import('./launchProgramService');
}

function loadGamificationStateModule() {
  const modulePath = require.resolve('./gamificationStateService');
  delete require.cache[modulePath];
  return require('./gamificationStateService') as typeof import('./gamificationStateService');
}

afterEach(() => {
  delete process.env.LAUNCH_PROGRAM_START_AT;
  delete process.env.LAUNCH_PROGRAM_DURATION_DAYS;
  delete process.env.LAUNCH_EARLY_ADOPTER_LIMIT;
  delete process.env.OWNER_LAUNCH_TRIAL_DAYS;

  const launchProgram = loadLaunchProgramModule();
  launchProgram.clearLaunchProgramMemoryStateForTests();
});

test('caps early adopter claims at the configured limit', async () => {
  process.env.LAUNCH_PROGRAM_START_AT = '2026-04-01T00:00:00.000Z';
  process.env.LAUNCH_PROGRAM_DURATION_DAYS = '183';
  process.env.LAUNCH_EARLY_ADOPTER_LIMIT = '2';

  const launchProgram = loadLaunchProgramModule();
  const { createDefaultGamificationStateDocument } = loadGamificationStateModule();

  const firstState = await launchProgram.applyEarlyAdopterLaunchProgramToGamificationState({
    profileId: 'profile-1',
    accountId: 'account-1',
    currentState: createDefaultGamificationStateDocument(
      'profile-1',
      '2026-04-01T10:00:00.000Z'
    ),
    joinedDate: '2026-04-01T10:00:00.000Z',
    now: '2026-04-01T10:00:00.000Z',
  });
  const secondState = await launchProgram.applyEarlyAdopterLaunchProgramToGamificationState({
    profileId: 'profile-2',
    accountId: 'account-2',
    currentState: createDefaultGamificationStateDocument(
      'profile-2',
      '2026-04-01T10:05:00.000Z'
    ),
    joinedDate: '2026-04-01T10:05:00.000Z',
    now: '2026-04-01T10:05:00.000Z',
  });
  const thirdState = await launchProgram.applyEarlyAdopterLaunchProgramToGamificationState({
    profileId: 'profile-3',
    accountId: 'account-3',
    currentState: createDefaultGamificationStateDocument(
      'profile-3',
      '2026-04-01T10:10:00.000Z'
    ),
    joinedDate: '2026-04-01T10:10:00.000Z',
    now: '2026-04-01T10:10:00.000Z',
  });

  assert.deepEqual(firstState?.badges, ['early_adopter']);
  assert.deepEqual(secondState?.badges, ['early_adopter']);
  assert.deepEqual(thirdState?.badges ?? [], []);
});

test('claims a 30 day owner trial during the launch window and preserves it for retries', async () => {
  process.env.LAUNCH_PROGRAM_START_AT = '2026-04-01T00:00:00.000Z';
  process.env.LAUNCH_PROGRAM_DURATION_DAYS = '183';
  process.env.OWNER_LAUNCH_TRIAL_DAYS = '30';

  const launchProgram = loadLaunchProgramModule();

  const firstOffer = await launchProgram.resolveOwnerLaunchTrialOffer({
    ownerUid: 'owner-1',
    storefrontId: 'storefront-1',
    currentSubscription: null,
    now: '2026-04-02T10:00:00.000Z',
  });
  const retryOffer = await launchProgram.resolveOwnerLaunchTrialOffer({
    ownerUid: 'owner-1',
    storefrontId: 'storefront-1',
    currentSubscription: {
      status: 'inactive',
      externalSubscriptionId: null,
    },
    now: '2026-04-05T10:00:00.000Z',
  });
  const blockedOffer = await launchProgram.resolveOwnerLaunchTrialOffer({
    ownerUid: 'owner-1',
    storefrontId: 'storefront-1',
    currentSubscription: {
      status: 'active',
      externalSubscriptionId: 'sub_123',
    },
    now: '2026-04-10T10:00:00.000Z',
  });

  assert.equal(firstOffer.trialDays, 30);
  assert.equal(retryOffer.trialDays, 30);
  assert.equal(blockedOffer.trialDays, 0);
});
