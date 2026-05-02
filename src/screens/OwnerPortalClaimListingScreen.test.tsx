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

const configMocks = vi.hoisted(() => ({
  ownerPortalBulkClaimQueueEnabled: false,
}));

const bulkQueueMocks = vi.hoisted(() => ({
  toggleSelection: vi.fn(),
  resetSlot: vi.fn(),
  submitAll: vi.fn(),
  submitCodeFor: vi.fn(),
  clearSelection: vi.fn(),
  selectedIds: [] as string[],
  isAtCapacity: false,
  hasInFlightWork: false,
  slots: [] as Array<{
    storefrontId: string;
    displayName: string;
    phase: string;
    errorMessage: string | null;
    errorCode: string | null;
  }>,
}));

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  Text: 'Text',
  TextInput: 'TextInput',
  View: 'View',
  // AppErrorBoundary (added when the screen was wrapped in
  // withScreenErrorBoundary) pulls in sentryMonitoringService →
  // analyticsRuntimeState (AppState.currentState) and ErrorRecoveryCard
  // (StyleSheet.create). Stub the minimum surface to keep the import
  // chain happy without bringing real native modules into the test.
  AppState: { currentState: 'active', addEventListener: () => ({ remove: () => undefined }) },
  Platform: { OS: 'ios', select: <T,>(spec: { ios?: T; default?: T }) => spec.ios ?? spec.default },
  StyleSheet: { create: <T,>(styles: T): T => styles },
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

vi.mock('../config/ownerPortalConfig', () => ({
  get ownerPortalBulkClaimQueueEnabled() {
    return configMocks.ownerPortalBulkClaimQueueEnabled;
  },
}));

vi.mock('../hooks/useBulkClaimSubmission', () => ({
  BULK_CLAIM_MAX_SLOTS: 3,
  useBulkClaimSubmission: () => bulkQueueMocks,
}));

vi.mock('./ownerPortal/BulkClaimQueueChips', () => ({
  BulkClaimQueueChips: 'BulkClaimQueueChips',
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
    configMocks.ownerPortalBulkClaimQueueEnabled = false;
    bulkQueueMocks.selectedIds = [];
    bulkQueueMocks.isAtCapacity = false;
    bulkQueueMocks.hasInFlightWork = false;
    bulkQueueMocks.slots = [];
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

  it('renders the existing per-tile Claim Listing button when bulk queue flag is OFF (regression guard)', async () => {
    configMocks.ownerPortalBulkClaimQueueEnabled = false;
    navigationMocks.routeParams = {};
    summaryMocks.useBrowseSummaries.mockReturnValue({
      data: {
        items: [
          {
            id: 'shop-1',
            displayName: 'Shop One',
            addressLine1: '1 Main St',
            city: 'Albany',
            state: 'NY',
            zip: '12207',
          },
        ],
      },
      isLoading: false,
    });

    await act(async () => {
      renderer = create(<OwnerPortalClaimListingScreen />);
    });
    if (!renderer) throw new Error('Expected renderer.');

    const searchInput = renderer.root.findByType(TextInput as any);
    await act(async () => {
      searchInput.props.onChangeText('shop');
    });
    const searchButton = renderer.root.findAllByType(Pressable as any)[0];
    await act(async () => {
      searchButton.props.onPress();
    });

    const buttonText = renderer.root
      .findAllByType(Text as any)
      .flatMap((node) => node.props.children)
      .join(' ');
    expect(buttonText).toContain('Claim Listing');
    expect(buttonText).not.toContain('Add to queue');
    expect(bulkQueueMocks.toggleSelection).not.toHaveBeenCalled();
  });

  it('shows Add to queue and wires toggleSelection when bulk queue flag is ON', async () => {
    configMocks.ownerPortalBulkClaimQueueEnabled = true;
    navigationMocks.routeParams = {};
    summaryMocks.useBrowseSummaries.mockReturnValue({
      data: {
        items: [
          {
            id: 'shop-1',
            displayName: 'Shop One',
            addressLine1: '1 Main St',
            city: 'Albany',
            state: 'NY',
            zip: '12207',
          },
        ],
      },
      isLoading: false,
    });

    await act(async () => {
      renderer = create(<OwnerPortalClaimListingScreen />);
    });
    if (!renderer) throw new Error('Expected renderer.');

    const searchInput = renderer.root.findByType(TextInput as any);
    await act(async () => {
      searchInput.props.onChangeText('shop');
    });
    const searchButton = renderer.root.findAllByType(Pressable as any)[0];
    await act(async () => {
      searchButton.props.onPress();
    });

    const buttonText = renderer.root
      .findAllByType(Text as any)
      .flatMap((node) => node.props.children)
      .join(' ');
    expect(buttonText).toContain('Add to queue');
    expect(buttonText).not.toContain('Claim Listing');

    const queueToggle = renderer.root.findAllByType(Pressable as any)[1];
    await act(async () => {
      queueToggle.props.onPress();
    });

    expect(bulkQueueMocks.toggleSelection).toHaveBeenCalledWith({
      id: 'shop-1',
      displayName: 'Shop One',
    });
  });
});
