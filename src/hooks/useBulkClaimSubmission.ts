/**
 * Phase 1 of the multi-location claim flow.
 *
 * Lets a chain owner select up to 3 storefronts and fire all the shop-phone
 * OTP calls in parallel instead of doing them one at a time. Same backend,
 * same security — just better choreography on the frontend.
 *
 * Each "slot" tracks one shop's submission lifecycle. Slots run independently
 * — a cooldown / daily_limit / shop_unavailable error on slot A doesn't block
 * slots B and C from continuing.
 *
 * Slot state machine (lean, by design):
 *   idle → submitting → awaitingCode → verifying → verified
 *                             ↓             ↓
 *                          failed       failed
 *
 * When a slot reaches `failed`, the UI surfaces an "Open verification screen"
 * affordance that routes the owner to OwnerPortalShopOwnershipVerification
 * with the failed storefrontId — letting them resolve cooldown / daily_limit
 * / shop_unavailable using the existing per-shop UI without us reimplementing
 * that whole state machine in chip form.
 *
 * Concurrency cap: 3. Twilio enforces ~1 call per second per from-number, so
 * we space the parallel sends with a 1.2s gap to stay under the per-number
 * rate cap (Risk R1.1 in the implementation plan).
 */

import React from 'react';
import {
  confirmShopVerificationCode,
  isOwnerShopVerificationError,
  type OwnerShopVerificationErrorCode,
} from '../services/ownerPortalShopVerificationService';
import { submitOwnerDispensaryClaim } from '../services/ownerPortalService';

const MAX_CONCURRENT_SLOTS = 3;
const SUBMIT_STAGGER_MS = 1_200;

export type BulkClaimSlotPhase =
  | 'idle'
  | 'submitting'
  | 'awaitingCode'
  | 'verifying'
  | 'verified'
  | 'failed';

export type BulkClaimSlot = {
  storefrontId: string;
  displayName: string;
  phase: BulkClaimSlotPhase;
  errorMessage: string | null;
  errorCode: OwnerShopVerificationErrorCode | null;
};

type SlotPatch = Partial<Omit<BulkClaimSlot, 'storefrontId'>>;

type SlotsState = Map<string, BulkClaimSlot>;

type CandidateInput = { id: string; displayName: string };

function patchSlot(prev: SlotsState, storefrontId: string, patch: SlotPatch): SlotsState {
  const existing = prev.get(storefrontId);
  if (!existing) return prev;
  const next = new Map(prev);
  next.set(storefrontId, { ...existing, ...patch });
  return next;
}

function classifyFailureFromError(error: unknown): {
  message: string;
  code: OwnerShopVerificationErrorCode | null;
} {
  if (isOwnerShopVerificationError(error)) {
    return { message: error.message, code: error.code };
  }
  if (error instanceof Error) {
    return { message: error.message, code: null };
  }
  return { message: 'Unable to submit claim.', code: null };
}

export type UseBulkClaimSubmissionResult = {
  slots: BulkClaimSlot[];
  selectedIds: string[];
  isAtCapacity: boolean;
  hasInFlightWork: boolean;
  toggleSelection: (candidate: CandidateInput) => void;
  clearSelection: () => void;
  submitAll: (ownerUid: string) => Promise<void>;
  submitCodeFor: (storefrontId: string, code: string) => Promise<void>;
  resetSlot: (storefrontId: string) => void;
};

export function useBulkClaimSubmission(): UseBulkClaimSubmissionResult {
  const [slots, setSlots] = React.useState<SlotsState>(() => new Map());
  const slotsRef = React.useRef(slots);
  React.useEffect(() => {
    slotsRef.current = slots;
  }, [slots]);

  const slotsArray = React.useMemo(() => Array.from(slots.values()), [slots]);
  const selectedIds = React.useMemo(() => Array.from(slots.keys()), [slots]);

  const isAtCapacity = slots.size >= MAX_CONCURRENT_SLOTS;
  const hasInFlightWork = slotsArray.some(
    (slot) => slot.phase === 'submitting' || slot.phase === 'verifying',
  );

  const toggleSelection = React.useCallback((candidate: CandidateInput) => {
    setSlots((prev) => {
      if (prev.has(candidate.id)) {
        const existing = prev.get(candidate.id);
        // Don't let the user remove a slot that's mid-submit — would orphan
        // the OTP call. They can wait for it to land in awaitingCode/failed,
        // then reset.
        if (existing && (existing.phase === 'submitting' || existing.phase === 'verifying')) {
          return prev;
        }
        const next = new Map(prev);
        next.delete(candidate.id);
        return next;
      }
      if (prev.size >= MAX_CONCURRENT_SLOTS) {
        return prev;
      }
      const next = new Map(prev);
      next.set(candidate.id, {
        storefrontId: candidate.id,
        displayName: candidate.displayName,
        phase: 'idle',
        errorMessage: null,
        errorCode: null,
      });
      return next;
    });
  }, []);

  const clearSelection = React.useCallback(() => {
    setSlots((prev) => {
      // Keep any slot that's mid-flight or already verified — clearing a
      // verified slot would lose the receipt the owner needs to see.
      const next = new Map<string, BulkClaimSlot>();
      prev.forEach((slot, id) => {
        if (
          slot.phase === 'submitting' ||
          slot.phase === 'verifying' ||
          slot.phase === 'verified' ||
          slot.phase === 'awaitingCode'
        ) {
          next.set(id, slot);
        }
      });
      return next;
    });
  }, []);

  const resetSlot = React.useCallback((storefrontId: string) => {
    setSlots((prev) => {
      if (!prev.has(storefrontId)) return prev;
      const next = new Map(prev);
      next.delete(storefrontId);
      return next;
    });
  }, []);

  const submitOne = React.useCallback(
    async (ownerUid: string, slot: BulkClaimSlot): Promise<void> => {
      setSlots((prev) =>
        patchSlot(prev, slot.storefrontId, {
          phase: 'submitting',
          errorMessage: null,
          errorCode: null,
        }),
      );
      try {
        await submitOwnerDispensaryClaim(ownerUid, {
          id: slot.storefrontId,
          displayName: slot.displayName,
        });
        // submitOwnerDispensaryClaim auto-fires the merged voice OTP call
        // (notifyShopOfPendingClaim, fail-soft). On success here we know the
        // claim doc is created; the call may or may not have reached the
        // shop. Either way the owner now needs to enter the 6-digit code
        // they hear (or open the per-shop screen if no call arrives).
        setSlots((prev) =>
          patchSlot(prev, slot.storefrontId, {
            phase: 'awaitingCode',
          }),
        );
      } catch (error) {
        const failure = classifyFailureFromError(error);
        setSlots((prev) =>
          patchSlot(prev, slot.storefrontId, {
            phase: 'failed',
            errorMessage: failure.message,
            errorCode: failure.code,
          }),
        );
      }
    },
    [],
  );

  const submitAll = React.useCallback(
    async (ownerUid: string) => {
      // Snapshot the slots that need work — anything still in 'idle'.
      const pending = Array.from(slotsRef.current.values()).filter((slot) => slot.phase === 'idle');
      if (pending.length === 0) return;

      // Fire serially with a stagger to stay under Twilio's per-number rate
      // cap (Risk R1.1). The OTP calls are still effectively parallel from
      // the owner's perspective — each subsequent one starts before the
      // previous shop's phone has finished ringing.
      for (let i = 0; i < pending.length; i += 1) {
        const slot = pending[i];
        // Don't await this — kick off the submission and let it run while we
        // sleep before kicking off the next one. The sleep is the rate-cap
        // gap, not a dependency on the previous submission completing.
        void submitOne(ownerUid, slot);
        if (i < pending.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, SUBMIT_STAGGER_MS));
        }
      }
    },
    [submitOne],
  );

  const submitCodeFor = React.useCallback(async (storefrontId: string, code: string) => {
    const slot = slotsRef.current.get(storefrontId);
    if (!slot || slot.phase !== 'awaitingCode') return;
    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      setSlots((prev) =>
        patchSlot(prev, storefrontId, {
          phase: 'awaitingCode',
          errorMessage: 'Enter the full 6-digit code.',
          errorCode: 'invalid_verification_code',
        }),
      );
      return;
    }
    setSlots((prev) =>
      patchSlot(prev, storefrontId, {
        phase: 'verifying',
        errorMessage: null,
        errorCode: null,
      }),
    );
    try {
      await confirmShopVerificationCode(storefrontId, trimmed);
      setSlots((prev) =>
        patchSlot(prev, storefrontId, {
          phase: 'verified',
          errorMessage: null,
          errorCode: null,
        }),
      );
    } catch (error) {
      const failure = classifyFailureFromError(error);
      // Keep the slot in awaitingCode for transient/recoverable failures
      // so the owner can re-type the code without losing their place.
      // Only push to 'failed' for hard stops (cooldown, daily_limit,
      // shop_unavailable) where they need the dedicated screen.
      const isHardStop =
        failure.code === 'cooldown_active' ||
        failure.code === 'daily_limit_reached' ||
        failure.code === 'shop_phone_unavailable';
      setSlots((prev) =>
        patchSlot(prev, storefrontId, {
          phase: isHardStop ? 'failed' : 'awaitingCode',
          errorMessage: failure.message,
          errorCode: failure.code,
        }),
      );
    }
  }, []);

  return {
    slots: slotsArray,
    selectedIds,
    isAtCapacity,
    hasInFlightWork,
    toggleSelection,
    clearSelection,
    submitAll,
    submitCodeFor,
    resetSlot,
  };
}

export const BULK_CLAIM_MAX_SLOTS = MAX_CONCURRENT_SLOTS;
