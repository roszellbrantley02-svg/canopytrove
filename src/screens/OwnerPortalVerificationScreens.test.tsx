import React from 'react';
import type { ReactTestRenderer, ReactTestRendererJSON } from 'react-test-renderer';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigationMocks = vi.hoisted(() => ({
  routeParams: {} as Record<string, unknown>,
  navigate: vi.fn(),
}));

const modelMocks = vi.hoisted(() => ({
  useOwnerPortalBusinessVerificationModel: vi.fn(),
  useOwnerPortalIdentityVerificationModel: vi.fn(),
}));

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  StyleSheet: {
    create: <T,>(styles: T): T => styles,
  },
  Text: 'Text',
  TextInput: 'TextInput',
  View: 'View',
}));

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: navigationMocks.navigate,
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

vi.mock('./ownerPortal/OwnerPortalStageList', () => ({
  OwnerPortalStageList: 'OwnerPortalStageList',
}));

vi.mock('./ownerPortal/ownerPortalStyles', () => ({
  ownerPortalStyles: new Proxy(
    {},
    {
      get: () => ({}),
    },
  ),
}));

vi.mock('./ownerPortal/useOwnerPortalBusinessVerificationModel', () => ({
  useOwnerPortalBusinessVerificationModel: modelMocks.useOwnerPortalBusinessVerificationModel,
}));

vi.mock('./ownerPortal/useOwnerPortalIdentityVerificationModel', () => ({
  useOwnerPortalIdentityVerificationModel: modelMocks.useOwnerPortalIdentityVerificationModel,
}));

import { OwnerPortalBusinessVerificationScreen } from './OwnerPortalBusinessVerificationScreen';
import { OwnerPortalIdentityVerificationScreen } from './OwnerPortalIdentityVerificationScreen';

function flattenText(
  node: ReactTestRendererJSON | ReactTestRendererJSON[] | string | string[] | null,
): string[] {
  if (!node) {
    return [];
  }

  if (typeof node === 'string') {
    return [node];
  }

  if (Array.isArray(node)) {
    return node.flatMap((child) => flattenText(child));
  }

  return flattenText(node.children as ReactTestRendererJSON[] | string[] | null);
}

function renderText(element: React.ReactElement) {
  let renderer!: ReactTestRenderer;

  act(() => {
    renderer = create(element);
  });

  const renderedText = flattenText(renderer.toJSON()).join(' ');

  act(() => {
    renderer.unmount();
  });

  return renderedText;
}

describe('Owner portal verification preview screens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigationMocks.routeParams = {};
    navigationMocks.navigate.mockReset();

    modelMocks.useOwnerPortalBusinessVerificationModel.mockReturnValue({
      claimedStorefront: null,
      isLoading: false,
      isLoadingClaimedStorefront: false,
      licenseFile: null,
      businessDocFile: null,
      legalBusinessName: '',
      storefrontName: '',
      licenseNumber: '',
      licenseType: '',
      stateValue: '',
      address: '',
      setLegalBusinessName: vi.fn(),
      setStorefrontName: vi.fn(),
      setLicenseNumber: vi.fn(),
      setLicenseType: vi.fn(),
      setStateValue: vi.fn(),
      setAddress: vi.fn(),
      chooseLicenseFile: vi.fn(),
      chooseBusinessDocFile: vi.fn(),
      statusText: null,
      isSubmitDisabled: true,
      isSubmitting: false,
      submit: vi.fn(),
    });

    modelMocks.useOwnerPortalIdentityVerificationModel.mockReturnValue({
      isAlreadyVerified: false,
      isLoading: false,
      isProcessing: false,
      isSubmitDisabled: false,
      isSubmitting: false,
      statusText: null,
      verificationStarted: false,
      startVerification: vi.fn(),
      checkStatus: vi.fn(),
    });
  });

  it('renders the business verification preview without calling the live model', () => {
    navigationMocks.routeParams = { preview: true };

    const renderedText = renderText(<OwnerPortalBusinessVerificationScreen />);

    expect(modelMocks.useOwnerPortalBusinessVerificationModel).not.toHaveBeenCalled();
    expect(renderedText).toContain('Inspect the business-proof step.');
    expect(renderedText).toContain('Preview-license.pdf');
  });

  it('uses the business verification live model when preview mode is off', () => {
    navigationMocks.routeParams = {};

    renderText(<OwnerPortalBusinessVerificationScreen />);

    expect(modelMocks.useOwnerPortalBusinessVerificationModel).toHaveBeenCalledTimes(1);
  });

  it('renders the identity verification preview without calling the live model', () => {
    navigationMocks.routeParams = { preview: true };

    const renderedText = renderText(<OwnerPortalIdentityVerificationScreen />);

    expect(modelMocks.useOwnerPortalIdentityVerificationModel).not.toHaveBeenCalled();
    expect(renderedText).toContain('Inspect the final identity-review step.');
    expect(renderedText).toContain('Continue To Owner Access');
  });

  it('uses the identity verification live model when preview mode is off', () => {
    navigationMocks.routeParams = {};

    renderText(<OwnerPortalIdentityVerificationScreen />);

    expect(modelMocks.useOwnerPortalIdentityVerificationModel).toHaveBeenCalledTimes(1);
  });
});
