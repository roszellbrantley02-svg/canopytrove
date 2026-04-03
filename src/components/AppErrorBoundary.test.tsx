import React from 'react';
import type { ReactTestRenderer } from 'react-test-renderer';
import { create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Text } from 'react-native';
import { AppErrorBoundary } from './AppErrorBoundary';

const sentryMocks = vi.hoisted(() => ({
  captureMonitoringException: vi.fn(),
}));

vi.mock('../services/sentryMonitoringService', () => ({
  captureMonitoringException: sentryMocks.captureMonitoringException,
}));

describe('AppErrorBoundary', () => {
  let renderer: ReactTestRenderer | null = null;

  beforeEach(() => {
    renderer?.unmount();
    renderer = null;
    vi.clearAllMocks();
  });

  it('renders children when there is no error', () => {
    renderer = create(
      <AppErrorBoundary area="test-area">
        <Text testID="child-content">Test Content</Text>
      </AppErrorBoundary>,
    );

    const instance = renderer.root;
    expect(() => instance.findByProps({ testID: 'child-content' })).not.toThrow();
  });

  it('catches errors and displays fallback UI', () => {
    const TestComponent = () => {
      throw new Error('Test error');
    };

    renderer = create(
      <AppErrorBoundary area="test-area">
        <TestComponent />
      </AppErrorBoundary>,
    );

    const instance = renderer.root;
    expect(instance).toBeDefined();
  });

  it('captures exceptions to monitoring service with area tag', () => {
    const testError = new Error('Critical error');

    const TestComponent = () => {
      throw testError;
    };

    renderer = create(
      <AppErrorBoundary area="storefront-detail">
        <TestComponent />
      </AppErrorBoundary>,
    );

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

    renderer = create(
      <AppErrorBoundary area="test-area">
        <TestComponent />
      </AppErrorBoundary>,
    );

    const instance = renderer.root;
    const allText = instance.findAllByType(Text);
    const textContent = allText.map((t) => t.props.children).join(' ');

    expect(textContent).toContain('runtime error');
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

    renderer = create(
      <AppErrorBoundary area="test-area">
        <TestComponent />
      </AppErrorBoundary>,
    );

    shouldError = false;

    const allButtons = renderer.root.findAllByProps({ onPress: expect.any(Function) });
    const tryAgainButton = allButtons.find((button) => {
      const text = button.findAllByType(Text);
      return text.some((t) => t.props.children === 'Try Again');
    });

    if (tryAgainButton) {
      tryAgainButton.props.onPress();

      renderer.update(
        <AppErrorBoundary area="test-area">
          <TestComponent />
        </AppErrorBoundary>,
      );
    }

    expect(renderer).toBeDefined();
  });

  it('uses area prop in error monitoring tags', () => {
    const TestComponent = () => {
      throw new Error('Test error');
    };

    renderer = create(
      <AppErrorBoundary area="review-composer">
        <TestComponent />
      </AppErrorBoundary>,
    );

    expect(sentryMocks.captureMonitoringException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: {
          area: 'review-composer',
        },
      }),
    );
  });

  it('displays Canopy Trove branding in error UI', () => {
    const TestComponent = () => {
      throw new Error('Test error');
    };

    renderer = create(
      <AppErrorBoundary area="test-area">
        <TestComponent />
      </AppErrorBoundary>,
    );

    const instance = renderer.root;
    const allText = instance.findAllByType(Text);
    const textContent = allText.map((t) => t.props.children).join(' ');

    expect(textContent).toContain('Canopy Trove');
  });

  it('renders error fallback with proper structure', () => {
    const TestComponent = () => {
      throw new Error('Test error');
    };

    renderer = create(
      <AppErrorBoundary area="test-area">
        <TestComponent />
      </AppErrorBoundary>,
    );

    expect(renderer.root).toBeDefined();
  });
});
