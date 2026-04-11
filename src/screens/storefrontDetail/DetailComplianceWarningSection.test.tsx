import React from 'react';
import type { ReactTestRenderer, ReactTestRendererJSON } from 'react-test-renderer';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  StyleSheet: {
    create: <T,>(styles: T): T => styles,
  },
  Text: 'Text',
  View: 'View',
}));

vi.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

vi.mock('../../icons/AppUiIcon', () => ({
  AppUiIcon: 'AppUiIcon',
}));

import { DetailComplianceWarningSection } from './DetailComplianceWarningSection';

const PRIMARY_WARNING_SNIPPET = 'For use only by adults 21 years of age and older.';
const HOPELINE_SNIPPET = 'Need help? Call the NY HOPEline: 1-877-8-HOPENY';
const ROTATING_WARNINGS = [
  'Cannabis can impair concentration and coordination. Do not operate a vehicle or machinery under the influence of cannabis.',
  'There may be health risks associated with consumption of this product.',
  'Cannabis is not recommended for use by persons who are pregnant or nursing.',
  'Cannabis can be addictive.',
];

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

describe('DetailComplianceWarningSection', () => {
  it('renders the required primary warning and HOPEline copy', () => {
    let renderer!: ReactTestRenderer;

    act(() => {
      renderer = create(<DetailComplianceWarningSection storefrontId="storefront-alpha" />);
    });

    const renderedText = flattenText(renderer.toJSON()).join(' ');
    expect(renderedText).toContain(PRIMARY_WARNING_SNIPPET);
    expect(renderedText).toContain(HOPELINE_SNIPPET);
    expect(renderedText).toContain('Compliance Notice');
  });

  it('selects a deterministic rotating warning for a storefront id', () => {
    let firstRenderer!: ReactTestRenderer;
    let secondRenderer!: ReactTestRenderer;

    act(() => {
      firstRenderer = create(<DetailComplianceWarningSection storefrontId="storefront-bravo" />);
      secondRenderer = create(<DetailComplianceWarningSection storefrontId="storefront-bravo" />);
    });

    const firstText = flattenText(firstRenderer.toJSON()).join(' ');
    const secondText = flattenText(secondRenderer.toJSON()).join(' ');
    const selectedWarning = ROTATING_WARNINGS.find((warning) => firstText.includes(warning));

    expect(selectedWarning).toBeDefined();
    expect(secondText).toContain(selectedWarning as string);
  });
});
