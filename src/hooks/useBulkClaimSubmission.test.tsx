import React from 'react';
import type { ReactTestRenderer } from 'react-test-renderer';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock both services BEFORE importing the hook so the hook picks up the mocks.
vi.mock('../services/ownerPortalService', () => ({
  submitOwnerDispensaryClaim: vi.fn(),
}));

vi.mock('../services/ownerPortalShopVerificationService', async () => {
  const actual = await vi.importActual<typeof shopVerificationModule>(
    '../services/ownerPortalShopVerificationService',
  );
  return {
    ...actual,
    confirmShopVerificationCode: vi.fn(),
  };
});

import type * as shopVerificationModule from '../services/ownerPortalShopVerificationService';

import { submitOwnerDispensaryClaim } from '../services/ownerPortalService';
import {
  confirmShopVerificationCode,
  OwnerShopVerificationError,
} from '../services/ownerPortalShopVerificationService';
import {
  BULK_CLAIM_MAX_SLOTS,
  useBulkClaimSubmission,
  type UseBulkClaimSubmissionResult,
} from './useBulkClaimSubmission';

describe('useBulkClaimSubmission', () => {
  let renderer: ReactTestRenderer | null = null;
  let latest: UseBulkClaimSubmissionResult | null = null;

  function HookHarness() {
    latest = useBulkClaimSubmission();
    return null;
  }

  beforeEach(() => {
    renderer?.unmount();
    renderer = null;
    latest = null;
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    renderer?.unmount();
  });

  function mountHook() {
    act(() => {
      renderer = create(<HookHarness />);
    });
  }

  it('toggles a slot in and out of the selection set', () => {
    mountHook();

    act(() => {
      latest?.toggleSelection({ id: 'shop-1', displayName: 'Shop 1' });
    });
    expect(latest?.selectedIds).toEqual(['shop-1']);
    expect(latest?.slots[0].phase).toBe('idle');

    act(() => {
      latest?.toggleSelection({ id: 'shop-1', displayName: 'Shop 1' });
    });
    expect(latest?.selectedIds).toEqual([]);
  });

  it(`caps selection at ${BULK_CLAIM_MAX_SLOTS} slots`, () => {
    mountHook();

    act(() => {
      latest?.toggleSelection({ id: 'shop-1', displayName: 'Shop 1' });
      latest?.toggleSelection({ id: 'shop-2', displayName: 'Shop 2' });
      latest?.toggleSelection({ id: 'shop-3', displayName: 'Shop 3' });
      latest?.toggleSelection({ id: 'shop-4', displayName: 'Shop 4' });
    });

    expect(latest?.selectedIds).toEqual(['shop-1', 'shop-2', 'shop-3']);
    expect(latest?.isAtCapacity).toBe(true);
  });

  it('moves a slot from idle to awaitingCode on successful submit', async () => {
    (submitOwnerDispensaryClaim as ReturnType<typeof vi.fn>).mockResolvedValue({});
    mountHook();

    act(() => {
      latest?.toggleSelection({ id: 'shop-1', displayName: 'Shop 1' });
    });

    await act(async () => {
      const submitPromise = latest?.submitAll('owner-uid');
      await vi.runAllTimersAsync();
      await submitPromise;
    });

    expect(submitOwnerDispensaryClaim).toHaveBeenCalledWith('owner-uid', {
      id: 'shop-1',
      displayName: 'Shop 1',
    });
    expect(latest?.slots[0].phase).toBe('awaitingCode');
  });

  it('moves a slot to failed when submitOwnerDispensaryClaim throws', async () => {
    (submitOwnerDispensaryClaim as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Network down'),
    );
    mountHook();

    act(() => {
      latest?.toggleSelection({ id: 'shop-1', displayName: 'Shop 1' });
    });

    await act(async () => {
      const submitPromise = latest?.submitAll('owner-uid');
      await vi.runAllTimersAsync();
      await submitPromise;
    });

    expect(latest?.slots[0].phase).toBe('failed');
    expect(latest?.slots[0].errorMessage).toBe('Network down');
  });

  it('moves a slot to verified when submitCodeFor succeeds', async () => {
    (submitOwnerDispensaryClaim as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (confirmShopVerificationCode as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      storefrontId: 'shop-1',
      verifiedAt: '2026-05-02T00:00:00Z',
    });
    mountHook();

    act(() => {
      latest?.toggleSelection({ id: 'shop-1', displayName: 'Shop 1' });
    });

    await act(async () => {
      const p = latest?.submitAll('owner-uid');
      await vi.runAllTimersAsync();
      await p;
    });
    expect(latest?.slots[0].phase).toBe('awaitingCode');

    await act(async () => {
      await latest?.submitCodeFor('shop-1', '123456');
    });

    expect(confirmShopVerificationCode).toHaveBeenCalledWith('shop-1', '123456');
    expect(latest?.slots[0].phase).toBe('verified');
  });

  it('keeps slot in awaitingCode for soft errors (invalid code) so owner can retype', async () => {
    (submitOwnerDispensaryClaim as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (confirmShopVerificationCode as ReturnType<typeof vi.fn>).mockRejectedValue(
      new OwnerShopVerificationError('invalid_verification_code', 'That code is incorrect.'),
    );
    mountHook();

    act(() => {
      latest?.toggleSelection({ id: 'shop-1', displayName: 'Shop 1' });
    });
    await act(async () => {
      const p = latest?.submitAll('owner-uid');
      await vi.runAllTimersAsync();
      await p;
    });
    await act(async () => {
      await latest?.submitCodeFor('shop-1', '999999');
    });

    expect(latest?.slots[0].phase).toBe('awaitingCode');
    expect(latest?.slots[0].errorCode).toBe('invalid_verification_code');
  });

  it('moves slot to failed for hard-stop errors (cooldown) so chip surfaces escape hatch', async () => {
    (submitOwnerDispensaryClaim as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (confirmShopVerificationCode as ReturnType<typeof vi.fn>).mockRejectedValue(
      new OwnerShopVerificationError(
        'cooldown_active',
        'Wait before requesting another call.',
        '2026-05-02T01:00:00Z',
      ),
    );
    mountHook();

    act(() => {
      latest?.toggleSelection({ id: 'shop-1', displayName: 'Shop 1' });
    });
    await act(async () => {
      const p = latest?.submitAll('owner-uid');
      await vi.runAllTimersAsync();
      await p;
    });
    await act(async () => {
      await latest?.submitCodeFor('shop-1', '123456');
    });

    expect(latest?.slots[0].phase).toBe('failed');
    expect(latest?.slots[0].errorCode).toBe('cooldown_active');
  });

  it('rejects malformed codes locally without hitting the network', async () => {
    (submitOwnerDispensaryClaim as ReturnType<typeof vi.fn>).mockResolvedValue({});
    mountHook();

    act(() => {
      latest?.toggleSelection({ id: 'shop-1', displayName: 'Shop 1' });
    });
    await act(async () => {
      const p = latest?.submitAll('owner-uid');
      await vi.runAllTimersAsync();
      await p;
    });
    await act(async () => {
      await latest?.submitCodeFor('shop-1', '12');
    });

    expect(confirmShopVerificationCode).not.toHaveBeenCalled();
    expect(latest?.slots[0].phase).toBe('awaitingCode');
    expect(latest?.slots[0].errorMessage).toBe('Enter the full 6-digit code.');
  });

  it('removes a slot via resetSlot', () => {
    mountHook();
    act(() => {
      latest?.toggleSelection({ id: 'shop-1', displayName: 'Shop 1' });
    });
    expect(latest?.selectedIds).toEqual(['shop-1']);

    act(() => {
      latest?.resetSlot('shop-1');
    });
    expect(latest?.selectedIds).toEqual([]);
  });

  it('staggers submissions across multiple slots to respect Twilio per-number rate cap', async () => {
    let resolveFirst: ((value: unknown) => void) | null = null;
    let resolveSecond: ((value: unknown) => void) | null = null;
    (submitOwnerDispensaryClaim as ReturnType<typeof vi.fn>)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve;
          }),
      );

    mountHook();
    act(() => {
      latest?.toggleSelection({ id: 'shop-1', displayName: 'Shop 1' });
      latest?.toggleSelection({ id: 'shop-2', displayName: 'Shop 2' });
    });

    let submitPromise: Promise<void> | undefined;
    act(() => {
      submitPromise = latest?.submitAll('owner-uid');
    });

    // Microtask flush so the first submitOne kicks off.
    await act(async () => {
      await Promise.resolve();
    });

    expect(submitOwnerDispensaryClaim).toHaveBeenCalledTimes(1);

    // Advance past the 1.2s stagger and let the second submission start.
    await act(async () => {
      vi.advanceTimersByTime(1300);
      await Promise.resolve();
    });

    expect(submitOwnerDispensaryClaim).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolveFirst?.({});
      resolveSecond?.({});
      await vi.runAllTimersAsync();
      await submitPromise;
    });
  });
});
