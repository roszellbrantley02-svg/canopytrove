import React from 'react';
import type { ReactTestRenderer } from 'react-test-renderer';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigationMocks = vi.hoisted(() => ({
  routeParams: {} as Record<string, unknown>,
  replace: vi.fn(),
}));

const controllerMocks = vi.hoisted(() => ({
  useStorefrontProfileController: vi.fn(),
  useStorefrontQueryController: vi.fn(),
}));

const summaryMocks = vi.hoisted(() => ({
  useBrowseSummaries: vi.fn(),
}));

const serviceMocks = vi.hoisted(() => ({
  submitOwnerDispensaryClaim: vi.fn(),
}));

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  Text: 'Text',
  TextInput: 'TextInput',
  View: 'View',
}));

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    replace: navigationMocks.replace,
  }),
  useRoute: () => ({
    params: navigationMocks.routeParams,
  }),
}));

vi.mock('../components/MotionInView', () => ({
  MotionInView: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../components/ScreenShell', () => ({
  ScreenShell: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../components/SectionCard', () => ({
  SectionCard: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../icons/AppUiIcon', () => ({
  AppUiIcon: 'AppUiIcon',
}));

vi.mock('../context/StorefrontController', () => ({
  useStorefrontProfileController: controllerMocks.useStorefrontProfileController,
  useStorefrontQueryController: controllerMocks.useStorefrontQueryController,
}));

vi.mock('../hooks/useStorefrontSummaryData', () => ({
  useBrowseSummaries: summaryMocks.useBrowseSummaries,
}));

vi.mock('../services/ownerPortalService', () => ({
  submitOwnerDispensaryClaim: serviceMocks.submitOwnerDispensaryClaim,
}));

vi.mock('./ownerPortal/OwnerPortalHeroPanel', () => ({
  OwnerPortalHeroPanel: 'OwnerPortalHeroPanel',
}));

vi.mock('./ownerPortal/ownerPortalStyles', () => ({
  ownerPortalStyles: new Proxy(
    {},
    {
      get: () => ({}),
    },
  ),
}));

vi.mock('./ownerPortal/ownerPortalPreviewData', () => ({
  ownerPortalPreviewSearchResults: [
    {
      id: 'preview-storefront-1',
      displayName: 'Preview Dispensary',
      addressLine1: '123 Preview Ave',
      city: 'Albany',
      state: 'NY',
      zip: '12207',
    },
  ],
}));

import { Pressable, Text, TextInput } from 'react-native';
import { OwnerPortalClaimListingScreen } from './OwnerPortalClaimListingScreen';

describe('OwnerPortalClaimListingScreen', () => {
  let renderer: ReactTestRenderer | null = null;

  beforeEach(() => {
    if (renderer) {
      act(() => {
        renderer?.unmount();
      });
    }
    renderer = null;
    vi.clearAllMocks();
    navigationMocks.routeParams = { preview: true };
    controllerMocks.useStorefrontProfileController.mockReturnValue({
      authSession: {
        uid: 'owner-1',
        status: 'authenticated',
      },
    });
    controllerMocks.useStorefrontQueryController.mockReturnValue({
      activeLocation: null,
      activeLocationLabel: 'Albany',
    });
    summaryMocks.useBrowseSummaries.mockReturnValue({
      data: { items: [] },
      isLoading: false,
    });
    serviceMocks.submitOwnerDispensaryClaim.mockResolvedValue(undefined);
  });

  it('uses preview results and routes to preview verification without submitting a live claim', async () => {
    await act(async () => {
      renderer = create(<OwnerPortalClaimListingScreen />);
    });

    if (!renderer) {
      throw new Error('Expected claim listing renderer.');
    }

    const searchInput = renderer.root.findByType(TextInput as any);
    const searchButton = renderer.root.findAllByType(Pressable as any)[0];

    await act(async () => {
      searchInput.props.onChangeText('Preview');
    });

    await act(async () => {
      searchButton.props.onPress();
    });

    const renderedText = renderer.root
      .findAllByType(Text as any)
      .flatMap((node) => node.props.children)
      .join(' ');

    expect(renderedText).toContain('Preview Dispensary');

    const claimButton = renderer.root.findAllByType(Pressable as any)[1];

    await act(async () => {
      claimButton.props.onPress();
      await Promise.resolve();
    });

    expect(serviceMocks.submitOwnerDispensaryClaim).not.toHaveBeenCalled();
    expect(navigationMocks.replace).toHaveBeenCalledWith('OwnerPortalBusinessVerification', {
      preview: true,
    });
  });
});
