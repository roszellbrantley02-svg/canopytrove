import React from 'react';
import type { ReactTestRenderer } from 'react-test-renderer';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

const controllerMocks = vi.hoisted(() => ({
  useStorefrontRouteController: vi.fn(),
}));

const summaryMocks = vi.hoisted(() => ({
  useSavedSummaries: vi.fn(),
}));

vi.mock('react-native', () => ({
  FlatList: 'FlatList',
  Platform: {
    OS: 'web' as const,
  },
  StyleSheet: {
    create: <T,>(styles: T): T => styles,
  },
  Text: 'Text',
  View: 'View',
}));

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: vi.fn(),
  }),
}));

vi.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

vi.mock('../components/MotionInView', () => ({
  MotionInView: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../components/ScreenShell', () => ({
  ScreenShell: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../components/StorefrontRouteCard', () => ({
  StorefrontRouteCard: 'StorefrontRouteCard',
}));

vi.mock('../components/StorefrontRouteCardSkeleton', () => ({
  StorefrontRouteCardSkeleton: 'StorefrontRouteCardSkeleton',
}));

vi.mock('../components/withScreenErrorBoundary', () => ({
  withScreenErrorBoundary: <T,>(Component: T) => Component,
}));

vi.mock('../context/StorefrontController', () => ({
  useStorefrontRouteController: controllerMocks.useStorefrontRouteController,
}));

vi.mock('../hooks/useStorefrontSummaryData', () => ({
  useSavedSummaries: summaryMocks.useSavedSummaries,
}));

import { Text } from 'react-native';
import { SavedStorefrontsScreen } from './SavedStorefrontsScreen';

describe('SavedStorefrontsScreen', () => {
  function renderScreen(total: number) {
    const savedIds = Array.from({ length: total }, (_, index) => `storefront-${index + 1}`);
    const savedStorefronts = savedIds.map((id, index) => ({
      id,
      displayName: `Storefront ${index + 1}`,
    }));
    controllerMocks.useStorefrontRouteController.mockReturnValue({
      savedStorefrontIds: savedIds,
    });
    summaryMocks.useSavedSummaries.mockReturnValue({
      data: savedStorefronts,
      isLoading: false,
    });

    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(<SavedStorefrontsScreen />);
    });

    return renderer;
  }

  function collectTextContent(renderer: ReactTestRenderer) {
    return renderer.root
      .findAllByType(Text as any)
      .flatMap((node) => node.props.children)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  it('renders the full saved list when it stays below the render cap', () => {
    const renderer = renderScreen(60);

    const cards = renderer.root.findAll((node) => (node.type as unknown) === 'StorefrontRouteCard');
    const textContent = renderer.root
      .findAllByType(Text as any)
      .flatMap((node) => node.props.children)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    expect(cards).toHaveLength(50);
    expect(textContent).toContain('Showing 50 of 60 saved storefronts');
  });
});
