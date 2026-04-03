import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react-native';

vi.mock('../../repositories/storefrontRepository', () => ({
  clearStorefrontRepositoryCache: vi.fn(),
}));
vi.mock('../../services/firestoreSeedService', () => ({
  seedMockStorefrontCollections: vi.fn(),
  getMockFirestoreSeedCounts: () => ({ summaryCount: 0, detailCount: 0 }),
}));
vi.mock('../../config/firebase', () => ({
  getFirebaseDb: () => null,
  hasFirebaseConfig: false,
}));
vi.mock('../../services/storefrontBackendService', () => ({
  seedStorefrontBackendFirestore: vi.fn(),
}));
vi.mock('../../config/storefrontSourceConfig', () => ({
  storefrontSourceMode: 'api',
}));
vi.mock('../../services/ownerPortalService', () => ({
  getOwnerPortalAccessState: () => ({ enabled: true, restricted: false, allowlisted: true }),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

function createMockNavigation() {
  return {
    navigate: vi.fn(),
    goBack: vi.fn(),
    reset: vi.fn(),
    dispatch: vi.fn(),
    setParams: vi.fn(),
    setOptions: vi.fn(),
    isFocused: vi.fn(() => true),
    canGoBack: vi.fn(() => false),
    getId: vi.fn(),
    getParent: vi.fn(),
    getState: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  } as any;
}

function createDefaultArgs(overrides?: Record<string, unknown>) {
  return {
    authSession: { status: 'authenticated', email: 'test@canopytrove.test', uid: 'uid-1' },
    backendHealth: { status: 'healthy', allowDevSeed: false },
    clearDisplayName: vi.fn(async () => true),
    displayNameInput: 'Test User',
    navigation: createMockNavigation(),
    profileId: 'profile-1',
    signOutSession: vi.fn(async () => true),
    startGuestSession: vi.fn(async () => true),
    updateDisplayName: vi.fn(async () => true),
    ...overrides,
  } as any;
}

describe('useProfileActions owner routing', () => {
  it('openOwnerPortal always routes to OwnerPortalAccess, never directly to preview', () => {
    const args = createDefaultArgs();
    const { result } = renderHook(() => {
      const { useProfileActions } = require('./useProfileActions');
      return useProfileActions(args);
    });

    result.current.openOwnerPortal();

    expect(args.navigation.navigate).toHaveBeenCalledTimes(1);
    expect(args.navigation.navigate).toHaveBeenCalledWith('OwnerPortalAccess');
  });

  it('openOwnerPortal does not pass preview params', () => {
    const args = createDefaultArgs();
    const { result } = renderHook(() => {
      const { useProfileActions } = require('./useProfileActions');
      return useProfileActions(args);
    });

    result.current.openOwnerPortal();

    const navigateCall = args.navigation.navigate.mock.calls[0];
    // Should only have the screen name, no params (or undefined params)
    expect(navigateCall[0]).toBe('OwnerPortalAccess');
    expect(navigateCall[1]).toBeUndefined();
  });

  it('openOwnerSignIn routes to OwnerPortalAccess', () => {
    const args = createDefaultArgs();
    const { result } = renderHook(() => {
      const { useProfileActions } = require('./useProfileActions');
      return useProfileActions(args);
    });

    result.current.openOwnerSignIn();

    expect(args.navigation.navigate).toHaveBeenCalledWith('OwnerPortalAccess');
  });
});
