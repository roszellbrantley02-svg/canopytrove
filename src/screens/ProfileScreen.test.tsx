import React from 'react';
import type * as ThemeTokensModule from '../theme/tokens';
import type { ReactTestRenderer } from 'react-test-renderer';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Platform: {
    OS: 'web' as const,
  },
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
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

vi.mock('expo-constants', () => ({
  default: {},
}));

vi.mock('../components/MotionInView', () => ({
  MotionInView: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../components/QuickActionsRow', () => ({
  QuickActionsRow: () => null,
}));

vi.mock('../components/ScreenShell', () => ({
  ScreenShell: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../components/SectionCard', () => ({
  SectionCard: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../components/SectionHeader', () => ({
  SectionHeader: () => null,
}));

vi.mock('../components/withScreenErrorBoundary', () => ({
  withScreenErrorBoundary: <T,>(Component: T) => Component,
}));

vi.mock('../config/brand', () => ({
  brand: {
    productDisplayName: 'Canopy Trove',
  },
}));

vi.mock('../config/ownerPortalConfig', () => ({
  ownerPortalAccessAvailable: true,
}));

vi.mock('../context/StorefrontController', () => ({
  useStorefrontProfileController: vi.fn(),
}));

vi.mock('../hooks/useOwnerPortalAccessState', () => ({
  useOwnerPortalAccessState: vi.fn(() => ({
    accessState: { allowlisted: false },
    isCheckingAccess: false,
  })),
}));

vi.mock('../icons/AppUiIcon', () => ({
  AppUiIcon: 'AppUiIcon',
}));

vi.mock('../music/MusicToggleRow', () => ({
  MusicToggleRow: () => null,
}));

vi.mock('../theme/tokens', async (importOriginal) => {
  const actual = await importOriginal<typeof ThemeTokensModule>();
  return actual;
});

vi.mock('./profile/ProfileSections', () => ({
  ProfileHeroCard: () => null,
  StorefrontCollectionSection: () => null,
  UsernameRequestSection: () => null,
}));

vi.mock('./profile/useProfileScreenModel', () => ({
  useProfileScreenModel: vi.fn(),
}));

import { Text } from 'react-native';
import { BadgeShowcase } from './ProfileScreen';

function renderNode(node: React.ReactElement) {
  let renderer: ReactTestRenderer;
  act(() => {
    renderer = create(node);
  });
  return renderer!;
}

describe('BadgeShowcase', () => {
  it('renders badge icons with AppUiIcon instead of showing raw icon ids', () => {
    const renderer = renderNode(
      <BadgeShowcase
        badges={[
          {
            icon: 'rocket-outline',
            name: 'Early Adopter',
            color: '#FFD166',
          },
        ]}
      />,
    );

    const textValues = renderer.root
      .findAllByType(Text)
      .map((node) => node.props.children)
      .flat()
      .filter((value) => typeof value === 'string');

    expect(textValues).toContain('Early Adopter');
    expect(textValues).not.toContain('rocket-outline');

    const icon = renderer.root.find((node) => (node.type as unknown) === 'AppUiIcon');
    expect(icon.props.name).toBe('rocket-outline');
    expect(icon.props.color).toBe('#FFD166');
  });
});
