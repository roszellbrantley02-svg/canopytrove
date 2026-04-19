import React from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ownerPortalMocks = vi.hoisted(() => ({
  getOwnerPortalAccessState: vi.fn(() => ({
    enabled: true,
    restricted: false,
    allowlisted: true,
  })),
}));

const backendServiceMocks = vi.hoisted(() => ({
  seedStorefrontBackendFirestore: vi.fn(),
  submitUsernameChangeRequest: vi.fn(),
  getPendingUsernameRequest: vi.fn(() => Promise.resolve({ request: null })),
}));

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
  seedStorefrontBackendFirestore: backendServiceMocks.seedStorefrontBackendFirestore,
  submitUsernameChangeRequest: backendServiceMocks.submitUsernameChangeRequest,
  getPendingUsernameRequest: backendServiceMocks.getPendingUsernameRequest,
}));

vi.mock('../../config/storefrontSourceConfig', () => ({
  storefrontSourceMode: 'api',
}));

vi.mock('../../services/ownerPortalService', () => ({
  getOwnerPortalAccessState: ownerPortalMocks.getOwnerPortalAccessState,
}));

import { useProfileActions } from './useProfileActions';

type UseProfileActionsArgs = Parameters<typeof useProfileActions>[0];
type HookResult = ReturnType<typeof useProfileActions>;

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
  } as unknown as UseProfileActionsArgs['navigation'];
}

function createDefaultArgs(): UseProfileActionsArgs {
  return {
    authSession: {
      status: 'signed-out',
      uid: null,
      isAnonymous: false,
      displayName: null,
      email: null,
    },
    backendHealth: { status: 'healthy', allowDevSeed: false },
    clearDisplayName: vi.fn(async () => true),
    displayNameInput: 'Test User',
    navigation: createMockNavigation(),
    profileId: 'profile-1',
    signOutSession: vi.fn(async () => true),
    startGuestSession: vi.fn(async () => true),
    updateDisplayName: vi.fn(async () => true),
  };
}

function HookHarness({
  args,
  capture,
}: {
  args: UseProfileActionsArgs;
  capture: (value: HookResult) => void;
}) {
  const result = useProfileActions(args);
  capture(result);
  return null;
}

describe('useProfileActions owner routing', () => {
  let latestResult: HookResult | null = null;

  beforeEach(() => {
    latestResult = null;
    backendServiceMocks.getPendingUsernameRequest.mockResolvedValue({ request: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('openOwnerPortal always routes to OwnerPortalAccess, never directly to preview', () => {
    const args = createDefaultArgs();

    act(() => {
      create(
        React.createElement(HookHarness, {
          args,
          capture: (v: HookResult) => {
            latestResult = v;
          },
        }),
      );
    });

    latestResult!.openOwnerPortal();

    expect(args.navigation.navigate).toHaveBeenCalledTimes(1);
    expect(args.navigation.navigate).toHaveBeenCalledWith('OwnerPortalAccess');
  });

  it('openOwnerPortal does not pass preview params', () => {
    const args = createDefaultArgs();

    act(() => {
      create(
        React.createElement(HookHarness, {
          args,
          capture: (v: HookResult) => {
            latestResult = v;
          },
        }),
      );
    });

    latestResult!.openOwnerPortal();

    const navigateCall = (args.navigation.navigate as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      unknown,
    ];
    expect(navigateCall[0]).toBe('OwnerPortalAccess');
    expect(navigateCall[1]).toBeUndefined();
  });

  it('openOwnerSignIn routes to OwnerPortalAccess', () => {
    const args = createDefaultArgs();

    act(() => {
      create(
        React.createElement(HookHarness, {
          args,
          capture: (v: HookResult) => {
            latestResult = v;
          },
        }),
      );
    });

    latestResult!.openOwnerSignIn();

    expect(args.navigation.navigate).toHaveBeenCalledWith('OwnerPortalAccess');
  });
});
