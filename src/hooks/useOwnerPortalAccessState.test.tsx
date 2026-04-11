import React from 'react';
import type { ReactTestRenderer } from 'react-test-renderer';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CanopyTroveAuthSession } from '../types/identity';

vi.mock('../services/ownerPortalShared', () => ({
  getOwnerPortalAccessState: ({ claimRole }: { claimRole?: 'owner' | 'admin' | null }) => ({
    enabled: true,
    restricted: true,
    allowlisted: claimRole === 'owner' || claimRole === 'admin',
  }),
}));

vi.mock('../services/ownerPortalSessionService', () => ({
  getCurrentOwnerPortalClaimRole: vi.fn(),
  ensureOwnerPortalSessionReady: vi.fn(),
}));

vi.mock('../services/ownerPortalProfileService', () => ({
  hasOwnerProfileDocument: vi.fn(),
}));

import { useOwnerPortalAccessState } from './useOwnerPortalAccessState';
import {
  ensureOwnerPortalSessionReady,
  getCurrentOwnerPortalClaimRole,
} from '../services/ownerPortalSessionService';
import { hasOwnerProfileDocument } from '../services/ownerPortalProfileService';

function flushEffects() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('useOwnerPortalAccessState', () => {
  let renderer: ReactTestRenderer | null = null;
  let latestValue: ReturnType<typeof useOwnerPortalAccessState> | null = null;

  beforeEach(() => {
    renderer = null;
    latestValue = null;
    vi.mocked(getCurrentOwnerPortalClaimRole).mockReset();
    vi.mocked(ensureOwnerPortalSessionReady).mockReset();
    vi.mocked(hasOwnerProfileDocument).mockReset();
    vi.stubGlobal('__DEV__', false);
  });

  afterEach(() => {
    renderer?.unmount();
    vi.unstubAllGlobals();
  });

  function HookHarness({ authSession }: { authSession: CanopyTroveAuthSession }) {
    latestValue = useOwnerPortalAccessState(authSession);
    return null;
  }

  it('recovers owner access for an authenticated user with an owner profile', async () => {
    vi.mocked(getCurrentOwnerPortalClaimRole).mockResolvedValue(null);
    vi.mocked(hasOwnerProfileDocument).mockResolvedValue(true);
    vi.mocked(ensureOwnerPortalSessionReady).mockResolvedValue({
      ok: true,
      role: 'owner',
      syncedAt: '2026-04-10T00:00:00.000Z',
    });

    await act(async () => {
      renderer = create(
        <HookHarness
          authSession={{
            status: 'authenticated',
            uid: 'owner-1',
            isAnonymous: false,
            displayName: 'Owner',
            email: 'owner@example.com',
          }}
        />,
      );
      await flushEffects();
      await flushEffects();
    });

    expect(hasOwnerProfileDocument).toHaveBeenCalledWith('owner-1');
    expect(ensureOwnerPortalSessionReady).toHaveBeenCalledTimes(1);
    expect(latestValue?.claimRole).toBe('owner');
    expect(latestValue?.accessState.allowlisted).toBe(true);
    expect(latestValue?.isCheckingAccess).toBe(false);
  });

  it('leaves member sessions alone when there is no owner profile', async () => {
    vi.mocked(getCurrentOwnerPortalClaimRole).mockResolvedValue(null);
    vi.mocked(hasOwnerProfileDocument).mockResolvedValue(false);

    await act(async () => {
      renderer = create(
        <HookHarness
          authSession={{
            status: 'authenticated',
            uid: 'member-1',
            isAnonymous: false,
            displayName: 'Member',
            email: 'member@example.com',
          }}
        />,
      );
      await flushEffects();
      await flushEffects();
    });

    expect(hasOwnerProfileDocument).toHaveBeenCalledWith('member-1');
    expect(ensureOwnerPortalSessionReady).not.toHaveBeenCalled();
    expect(latestValue?.claimRole).toBe(null);
    expect(latestValue?.accessState.allowlisted).toBe(false);
    expect(latestValue?.isCheckingAccess).toBe(false);
  });

  it('clears a stale owner claim when a later claim lookup fails', async () => {
    vi.mocked(getCurrentOwnerPortalClaimRole)
      .mockResolvedValueOnce('owner')
      .mockRejectedValueOnce(new Error('claim lookup failed'));

    await act(async () => {
      renderer = create(
        <HookHarness
          authSession={{
            status: 'authenticated',
            uid: 'owner-1',
            isAnonymous: false,
            displayName: 'Owner',
            email: 'owner@example.com',
          }}
        />,
      );
      await flushEffects();
    });

    expect(latestValue?.claimRole).toBe('owner');
    expect(latestValue?.accessState.allowlisted).toBe(true);

    await act(async () => {
      renderer?.update(
        <HookHarness
          authSession={{
            status: 'authenticated',
            uid: 'owner-2',
            isAnonymous: false,
            displayName: 'New Owner',
            email: 'new-owner@example.com',
          }}
        />,
      );
      await flushEffects();
      await flushEffects();
    });

    expect(latestValue?.claimRole).toBe(null);
    expect(latestValue?.accessState.allowlisted).toBe(false);
    expect(latestValue?.isCheckingAccess).toBe(false);
  });
});
