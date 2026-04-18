import React from 'react';
import type { ReactTestRenderer } from 'react-test-renderer';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigationMocks = vi.hoisted(() => ({
  routeParams: {} as Record<string, unknown>,
  replace: vi.fn(),
}));

const serviceMocks = vi.hoisted(() => ({
  saveOwnerBusinessDetails: vi.fn(),
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

vi.mock('../components/withScreenErrorBoundary', () => ({
  withScreenErrorBoundary: <T,>(Component: T) => Component,
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

vi.mock('../services/ownerPortalService', () => ({
  saveOwnerBusinessDetails: serviceMocks.saveOwnerBusinessDetails,
}));

import { Pressable, Text, TextInput } from 'react-native';
import { OwnerPortalBusinessDetailsScreen } from './OwnerPortalBusinessDetailsScreen';

describe('OwnerPortalBusinessDetailsScreen', () => {
  let renderer: ReactTestRenderer | null = null;

  beforeEach(() => {
    if (renderer) {
      act(() => {
        renderer?.unmount();
      });
    }
    renderer = null;
    vi.clearAllMocks();
    navigationMocks.routeParams = {};
    serviceMocks.saveOwnerBusinessDetails.mockResolvedValue(undefined);
  });

  it('uses preview defaults and routes to the preview claim step without saving', async () => {
    navigationMocks.routeParams = { preview: true };

    await act(async () => {
      renderer = create(<OwnerPortalBusinessDetailsScreen />);
    });

    if (!renderer) {
      throw new Error('Expected business details renderer.');
    }

    const inputs = renderer.root.findAllByType(TextInput as any);
    expect(inputs[0]?.props.value).toBeTruthy();
    expect(inputs[1]?.props.value).toBeTruthy();

    const button = renderer.root.findAllByType(Pressable as any).at(-1);
    if (!button) {
      throw new Error('Expected save button.');
    }

    await act(async () => {
      button.props.onPress();
      await Promise.resolve();
    });

    expect(serviceMocks.saveOwnerBusinessDetails).not.toHaveBeenCalled();
    expect(navigationMocks.replace).toHaveBeenCalledWith('OwnerPortalClaimListing', {
      preview: true,
    });
  });

  it('blocks saving when the owner session is missing outside preview mode', async () => {
    navigationMocks.routeParams = {
      initialLegalName: 'Owner Legal Name',
      initialCompanyName: 'Owner Company',
      initialPhone: '555-0000',
    };

    await act(async () => {
      renderer = create(<OwnerPortalBusinessDetailsScreen />);
    });

    if (!renderer) {
      throw new Error('Expected business details renderer.');
    }

    const button = renderer.root.findAllByType(Pressable as any).at(-1);
    if (!button) {
      throw new Error('Expected save button.');
    }

    await act(async () => {
      button.props.onPress();
      await Promise.resolve();
    });

    const renderedText = renderer.root
      .findAllByType(Text as any)
      .flatMap((node) => node.props.children)
      .join(' ');

    expect(serviceMocks.saveOwnerBusinessDetails).not.toHaveBeenCalled();
    expect(navigationMocks.replace).not.toHaveBeenCalled();
    expect(renderedText).toContain(
      'You are not signed in as an owner. Please sign in again from the Owner Portal.',
    );
  });
});
