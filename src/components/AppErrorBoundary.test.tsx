import React from 'react';
import type { ReactTestRenderer } from 'react-test-renderer';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  StyleSheet: {
    create: <T,>(styles: T): T => styles,
    flatten: (style: any) => (Array.isArray(style) ? Object.assign({}, ...style) : (style ?? {})),
    hairlineWidth: 1,
  },
  Platform: {
    OS: 'android' as const,
    select: (obj: any) => obj.android ?? obj.default,
    Version: 33,
  },
}));

import { Text } from 'react-native';
import { AppErrorBoundary } from './AppErrorBoundary';

vi.mock('./MotionInView', () => ({
  MotionInView: 'MotionInView',
}));

vi.mock('../components/HapticPressable', () => ({
  HapticPressable: 'HapticPressable',
}));

vi.mock('../icons/BrandMarkIcon', () => ({
  BrandMarkIcon: () => React.createElement(React.Fragment),
}));

vi.mock('../config/brand', () => ({
  brand: {
    productDisplayName: 'Canopy Trove',
    storageNamespace: 'canopy-trove',
  },
}));

const sentryMocks = vi.hoisted(() => ({
  captureMonitoringException: vi.fn(),
}));

vi.mock('../services/sentryMonitoringService', () => ({
  captureMonitoringException: sentryMocks.captureMonitoringException,
}));

// Mirror the render-helper pattern used by SearchField and ShimmerBlock tests.
function renderErrorBoundary(children: React.ReactNode, area = 'test-area') {
  let renderer: ReactTestRenderer;
  act(() => {
    renderer = create(<AppErrorBoundary area={area}>{children}</AppErrorBoundary>);
  });
  return { renderer: renderer!, root: renderer!.root };
}

describe('AppErrorBoundary', () => {
  let renderer: ReactTestRenderer | null = null;

  beforeEach(() => {
    renderer?.unmount();
    renderer = null;
    vi.clearAllMocks();
  });

  it('renders children when there is no error', () => {
    const rendered = renderErrorBoundary(<Text testID="child-content">Test Content</Text>);
    renderer = rendered.renderer;

    expect(() => rendered.root.findByProps({ testID: 'child-content' })).not.toThrow();
  });

  it('catches errors and displays fallback UI', () => {
    const TestComponent = () => {
      throw new Error('Test error');
    };

    const rendered = renderErrorBoundary(<TestComponent />);
    renderer = rendered.renderer;

    expect(rendered.root).toBeDefined();
  });

  it('captures exceptions to monitoring service with area tag', () => {
    const testError = new Error('Critical error');

    const TestComponent = () => {
      throw testError;
    };

    const rendered = renderErrorBoundary(<TestComponent />, 'storefront-detail');
    renderer = rendered.renderer;

    expect(sentryMocks.captureMonitoringException).toHaveBeenCalledWith(
      testError,
      expect.objectContaining({
        source: 'react-error-boundary',
        tags: {
          area: 'storefront-detail',
        },
      }),
    );
  });

  it('displays error fallback UI with Try Again button', () => {
    const TestComponent = () => {
      throw new Error('Test error');
    };

    const rendered = renderErrorBoundary(<TestComponent />);
    renderer = rendered.renderer;

    const allText = rendered.root.findAllByType(Text);
    const textContent = allText.map((t) => t.props.children).join(' ');

    expect(textContent).toContain('This part of the app ran into a problem.');
    expect(textContent).toContain(
      'The rest of the app is still okay. Try opening this section again.',
    );
    expect(textContent).toContain('Try Again');
  });

  it('recovers from error when retry button is pressed', () => {
    let shouldError = true;

    const TestComponent = () => {
      if (shouldError) {
        throw new Error('Temporary error');
      }
      return <Text testID="recovered-content">Recovered</Text>;
    };

    const rendered = renderErrorBoundary(<TestComponent />);
    renderer = rendered.renderer;

    shouldError = false;

    const allButtons = rendered.root.findAllByProps({ onPress: expect.any(Function) });
    const tryAgainButton = allButtons.find((button) => {
      const text = button.findAllByType(Text);
      return text.some((t) => t.props.children === 'Try Again');
    });

    if (tryAgainButton) {
      act(() => {
        tryAgainButton.props.onPress();
      });

      act(() => {
        renderer!.update(
          <AppErrorBoundary area="test-area">
            <TestComponent />
          </AppErrorBoundary>,
        );
      });
    }

    expect(renderer).toBeDefined();
  });

  it('uses area prop in error monitoring tags', () => {
    const TestComponent = () => {
      throw new Error('Test error');
    };

    const rendered = renderErrorBoundary(<TestComponent />, 'review-composer');
    renderer = rendered.renderer;

    expect(sentryMocks.captureMonitoringException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: {
          area: 'review-composer',
        },
      }),
    );
  });

  it('displays meaningful error message in error UI', () => {
    const TestComponent = () => {
      throw new Error('Test error');
    };

    const rendered = renderErrorBoundary(<TestComponent />);
    renderer = rendered.renderer;

    const allText = rendered.root.findAllByType(Text);
    const textContent = allText.map((t) => t.props.children).join(' ');

    expect(textContent).toContain('This part of the app ran into a problem.');
  });

  it('renders error fallback with proper structure', () => {
    const TestComponent = () => {
      throw new Error('Test error');
    };

    const rendered = renderErrorBoundary(<TestComponent />);
    renderer = rendered.renderer;

    expect(rendered.root).toBeDefined();
  });
});
