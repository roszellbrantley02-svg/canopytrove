import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteCanopyTroveAccount } from './accountDeletionService';

const asyncStorageMock = vi.hoisted(() => ({
  getAllKeys: vi.fn(),
  multiRemove: vi.fn(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: asyncStorageMock,
}));

const firestoreMock = vi.hoisted(() => ({
  collection: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
}));

vi.mock('firebase/firestore', () => firestoreMock);

const firebaseConfigMock = vi.hoisted(() => ({
  getFirebaseDb: vi.fn(),
}));

vi.mock('../config/firebase', () => firebaseConfigMock);

const backendProfileMock = vi.hoisted(() => ({
  deleteStorefrontBackendProfile: vi.fn(),
}));

vi.mock('./storefrontBackendService', () => backendProfileMock);

const appProfileMock = vi.hoisted(() => ({
  createFreshAppProfile: vi.fn(),
}));

vi.mock('./appProfileService', () => appProfileMock);

const authMock = vi.hoisted(() => ({
  CANOPY_TROVE_RECENT_LOGIN_MAX_AGE_SECONDS: 300,
  deleteCanopyTroveAuthAccount: vi.fn(),
  hasRecentCanopyTroveAuthSession: vi.fn(),
  signOutCanopyTroveSession: vi.fn(),
}));

vi.mock('./canopyTroveAuthService', () => authMock);

const communitySafetyMock = vi.hoisted(() => ({
  replaceCommunitySafetyState: vi.fn(),
}));

vi.mock('./communitySafetyService', () => communitySafetyMock);

describe('deleteCanopyTroveAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    asyncStorageMock.getAllKeys.mockResolvedValue([]);
    appProfileMock.createFreshAppProfile.mockResolvedValue({
      id: 'fresh-profile',
      createdAt: '2026-04-22T00:00:00.000Z',
    });
    authMock.deleteCanopyTroveAuthAccount.mockResolvedValue({
      ok: true,
      reason: null,
      message: null,
    });
    authMock.signOutCanopyTroveSession.mockResolvedValue(true);
    authMock.hasRecentCanopyTroveAuthSession.mockResolvedValue(true);
    firebaseConfigMock.getFirebaseDb.mockReturnValue(null);
    communitySafetyMock.replaceCommunitySafetyState.mockResolvedValue(undefined);
  });

  it('blocks stale authenticated sessions before clearing account data', async () => {
    authMock.hasRecentCanopyTroveAuthSession.mockResolvedValue(false);

    const result = await deleteCanopyTroveAccount({
      profileId: 'profile-1',
      accountId: 'uid-1',
      isAuthenticatedAccount: true,
      shouldDeleteBackendProfile: true,
    });

    expect(result.ok).toBe(false);
    expect(result.partial).toBe(false);
    expect(result.reason).toBe('requires-recent-login');
    expect(result.message).toContain('No account data was removed yet');
    expect(authMock.signOutCanopyTroveSession).toHaveBeenCalledTimes(1);
    expect(backendProfileMock.deleteStorefrontBackendProfile).not.toHaveBeenCalled();
    expect(authMock.deleteCanopyTroveAuthAccount).not.toHaveBeenCalled();
    expect(asyncStorageMock.multiRemove).not.toHaveBeenCalled();
    expect(communitySafetyMock.replaceCommunitySafetyState).not.toHaveBeenCalled();
    expect(appProfileMock.createFreshAppProfile).not.toHaveBeenCalled();
  });

  it('clears data and returns a fresh profile after a recent authenticated delete', async () => {
    asyncStorageMock.getAllKeys.mockResolvedValue(['canopytrove:profile']);

    const result = await deleteCanopyTroveAccount({
      profileId: 'profile-1',
      accountId: 'uid-1',
      isAuthenticatedAccount: true,
      shouldDeleteBackendProfile: true,
    });

    expect(result.ok).toBe(true);
    expect(result.partial).toBe(false);
    expect(result.nextProfile?.id).toBe('fresh-profile');
    expect(backendProfileMock.deleteStorefrontBackendProfile).toHaveBeenCalledWith('profile-1');
    expect(authMock.deleteCanopyTroveAuthAccount).toHaveBeenCalledTimes(1);
    expect(asyncStorageMock.multiRemove).toHaveBeenCalledWith(['canopytrove:profile']);
    expect(communitySafetyMock.replaceCommunitySafetyState).toHaveBeenCalledWith(null, {
      persist: false,
      trackMutation: false,
    });
    expect(appProfileMock.createFreshAppProfile).toHaveBeenCalledTimes(1);
  });
});
