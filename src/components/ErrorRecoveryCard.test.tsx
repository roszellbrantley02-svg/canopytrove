import React from 'react';
import type { ReactTestRenderer } from 'react-test-renderer';
import { act, create } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  StyleSheet: {
    create: <T,>(styles: T): T => styles,
  },
  Text: 'Text',
  View: 'View',
}));

vi.mock('./HapticPressable', () => ({
  HapticPressable: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./MotionInView', () => ({
  MotionInView: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { Text } from 'react-native';
import { ErrorRecoveryCard } from './ErrorRecoveryCard';

describe('ErrorRecoveryCard', () => {
  let renderer: ReactTestRenderer | null = null;

  afterEach(() => {
    renderer?.unmount();
    renderer = null;
  });

  it('truncates oversized error messages before rendering them', () => {
    const longMessage = 'x'.repeat(220);

    act(() => {
      renderer = create(
        <ErrorRecoveryCard title="Problem" message={longMessage} onRetry={() => undefined} />,
      );
    });

    const textValues = renderer!.root.findAllByType(Text as any).map((node) => node.props.children);
    const renderedMessage = textValues.find((value) => typeof value === 'string' && value.includes('…'));

    expect(renderedMessage).toBe('x'.repeat(200) + '…');
  });
});
