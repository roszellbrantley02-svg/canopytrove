import React from 'react';
import type { ReactTestRenderer } from 'react-test-renderer';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const navigationMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
}));

const controllerMocks = vi.hoisted(() => ({
  useStorefrontProfileController: vi.fn(),
}));

const accessStateMocks = vi.hoisted(() => ({
  useOwnerPortalAccessState: vi.fn(),
}));

const savedSummaryMocks = vi.hoisted(() => ({
  useSavedSummaries: vi.fn(),
}));

const ownerServiceMocks = vi.hoisted(() => ({
  getOwnerDispensaryClaim: vi.fn(),
  getOwnerProfile: vi.fn(),
}));

const previewServiceMocks = vi.hoisted(() => ({
  getOwnerPortalPreviewClaim: vi.fn(),
  getOwnerPortalPreviewClaimedStorefrontSummary: vi.fn(),
  getOwnerPortalPreviewProfile: vi.fn(),
}));

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: navigationMocks.navigate,
  }),
}));

vi.mock('../../context/StorefrontController', () => ({
  useStorefrontProfileController: controllerMocks.useStorefrontProfileController,
}));

vi.mock('../../hooks/useOwnerPortalAccessState', () => ({
  useOwnerPortalAccessState: accessStateMocks.useOwnerPortalAccessState,
}));

vi.mock('../../hooks/useStorefrontSummaryData', () => ({
  useSavedSummaries: savedSummaryMocks.useSavedSummaries,
}));

vi.mock('../../services/ownerPortalService', () => ({
  getOwnerDispensaryClaim: ownerServiceMocks.getOwnerDispensaryClaim,
  getOwnerProfile: ownerServiceMocks.getOwnerProfile,
}));

vi.mock('../../services/ownerPortalPreviewService', () => ({
  getOwnerPortalPreviewClaim: previewServiceMocks.getOwnerPortalPreviewClaim,
  getOwnerPortalPreviewClaimedStorefrontSummary:
    previewServiceMocks.getOwnerPortalPreviewClaimedStorefrontSummary,
  getOwnerPortalPreviewProfile: previewServiceMocks.getOwnerPortalPreviewProfile,
}));

import { useOwnerPortalHomeScreenModel } from './useOwnerPortalHomeScreenModel';
import { ownerPortalPreviewAccessState } from './ownerPortalPreviewData';

function flushEffects() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('useOwnerPortalHomeScreenModel', () => {
  let renderer: ReactTestRenderer | null = null;
  let latestValue: ReturnType<typeof useOwnerPortalHomeScreenModel> | null = null;

  beforeEach(() => {
    renderer = null;
    latestValue = null;
    vi.clearAllMocks();
    controllerMocks.useStorefrontProfileController.mockReturnValue({
      authSession: {
        status: 'authenticated',
        uid: 'owner-1',
      },
    });
    accessStateMocks.useOwnerPortalAccessState.mockReturnValue({
      accessState: {
        enabled: true,
        restricted: true,
        allowlisted: false,
      },
      isCheckingAccess: false,
    });
    savedSummaryMocks.useSavedSummaries.mockReturnValue({
      data: [],
    });
  });

  afterEach(() => {
    renderer?.unmount();
  });

  function HookHarness({ preview }: { preview: boolean }) {
    latestValue = useOwnerPortalHomeScreenModel(preview);
    return null;
  }

  it('loads preview owner data instead of live owner data in preview mode', async () => {
    const previewProfile = {
      uid: 'owner-preview',
      legalName: 'Preview Owner',
      phone: null,
      companyName: 'Preview Company',
      identityVerificationStatus: 'pending' as const,
      businessVerificationStatus: 'verified' as const,
      dispensaryId: 'store-preview',
      onboardingStep: 'subscription' as const,
      subscriptionStatus: 'inactive' as const,
      badgeLevel: 1,
      earnedBadgeIds: [],
      selectedBadgeIds: [],
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z',
    };
    const previewClaim = {
      ownerUid: 'owner-preview',
      dispensaryId: 'store-preview',
      claimStatus: 'approved' as const,
      submittedAt: '2026-04-01T00:00:00.000Z',
      reviewedAt: '2026-04-02T00:00:00.000Z',
      reviewNotes: null,
    };
    const previewStorefront = {
      id: 'store-preview',
      licenseId: 'license-preview',
      marketId: 'nyc',
      displayName: 'Preview Store',
      legalName: 'Preview Store LLC',
      addressLine1: '123 Preview St',
      city: 'New York',
      state: 'NY',
      zip: '10001',
      coordinates: {
        latitude: 40.7,
        longitude: -73.9,
      },
      distanceMiles: 1,
      travelMinutes: 5,
      rating: 4.5,
      reviewCount: 10,
      openNow: true,
      isVerified: true,
      mapPreviewLabel: '1 mi route preview',
      promotionText: null,
      thumbnailUrl: null,
    };

    previewServiceMocks.getOwnerPortalPreviewProfile.mockResolvedValue(previewProfile);
    previewServiceMocks.getOwnerPortalPreviewClaim.mockResolvedValue(previewClaim);
    previewServiceMocks.getOwnerPortalPreviewClaimedStorefrontSummary.mockResolvedValue(
      previewStorefront,
    );

    await act(async () => {
      renderer = create(<HookHarness preview />);
      await flushEffects();
      await flushEffects();
    });

    expect(previewServiceMocks.getOwnerPortalPreviewProfile).toHaveBeenCalledTimes(1);
    expect(previewServiceMocks.getOwnerPortalPreviewClaim).toHaveBeenCalledTimes(1);
    expect(previewServiceMocks.getOwnerPortalPreviewClaimedStorefrontSummary).toHaveBeenCalledTimes(
      1,
    );
    expect(ownerServiceMocks.getOwnerProfile).not.toHaveBeenCalled();
    expect(ownerServiceMocks.getOwnerDispensaryClaim).not.toHaveBeenCalled();
    expect(latestValue?.ownerProfile).toEqual(previewProfile);
    expect(latestValue?.ownerClaim).toEqual(previewClaim);
    expect(latestValue?.claimedStorefront).toEqual(previewStorefront);
    expect(latestValue?.accessState).toEqual(ownerPortalPreviewAccessState);
    expect(latestValue?.isLoading).toBe(false);
  });
});
