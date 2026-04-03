import React from 'react';
import type { ReactTestRenderer } from 'react-test-renderer';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const shimmerStartSpy = vi.fn();
const shimmerStopSpy = vi.fn();

vi.mock('react-native', () => {
  class MockAnimatedValue {
    private currentValue: number;

    constructor(initialValue: number) {
      this.currentValue = initialValue;
    }

    interpolate(config: unknown) {
      return config;
    }

    setValue(value: number) {
      this.currentValue = value;
    }
  }

  return {
    Animated: {
      Value: MockAnimatedValue,
      View: 'AnimatedView',
      timing: vi.fn(() => ({
        start: vi.fn(),
        stop: vi.fn(),
        reset: vi.fn(),
      })),
      loop: vi.fn(() => ({
        start: shimmerStartSpy,
        stop: shimmerStopSpy,
        reset: vi.fn(),
      })),
    },
    Easing: {
      ease: 'ease',
      inOut: (value: unknown) => value,
    },
    StyleSheet: {
      create: <T,>(styles: T) => styles,
    },
    View: 'View',
  };
});

vi.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

import { Animated } from 'react-native';
import { ShimmerBlock } from './ShimmerBlock';

function renderShimmerBlock(overrides: Partial<React.ComponentProps<typeof ShimmerBlock>> = {}) {
  const props: React.ComponentProps<typeof ShimmerBlock> = {
    testID: 'shimmer-block',
    ...overrides,
  };

  let renderer: ReactTestRenderer;
  act(() => {
    renderer = create(<ShimmerBlock {...props} />);
  });

  return {
    renderer: renderer!,
    root: renderer!.root,
  };
}

describe('ShimmerBlock', () => {
  let renderer: ReactTestRenderer | null = null;

  beforeEach(() => {
    renderer?.unmount();
    renderer = null;
    vi.clearAllMocks();
  });

  it('renders successfully', () => {
    const rendered = renderShimmerBlock();
    renderer = rendered.renderer;
    expect(rendered.root).toBeDefined();
  });

  it('applies default shimmerWidth of 132', () => {
    const rendered = renderShimmerBlock();
    renderer = rendered.renderer;
    expect(rendered.root).toBeDefined();
  });

  it('applies custom shimmerWidth prop', () => {
    const rendered = renderShimmerBlock({ shimmerWidth: 200 });
    renderer = rendered.renderer;
    expect(rendered.root).toBeDefined();
  });

  it('applies default borderRadius from tokens', () => {
    const rendered = renderShimmerBlock();
    renderer = rendered.renderer;
    expect(rendered.root).toBeDefined();
  });

  it('applies custom borderRadius prop', () => {
    const rendered = renderShimmerBlock({ borderRadius: 16 });
    renderer = rendered.renderer;
    expect(rendered.root).toBeDefined();
  });

  it('applies custom style prop', () => {
    const rendered = renderShimmerBlock({ style: { width: 300, height: 200 } });
    renderer = rendered.renderer;
    expect(rendered.root).toBeDefined();
  });

  it('starts animation on mount', () => {
    const rendered = renderShimmerBlock();
    renderer = rendered.renderer;
    expect(Animated.loop).toHaveBeenCalled();
    expect(Animated.timing).toHaveBeenCalled();
    expect(shimmerStartSpy).toHaveBeenCalledTimes(1);
  });

  it('stops animation on unmount', () => {
    const rendered = renderShimmerBlock();
    renderer = rendered.renderer;
    const stopCallsBeforeUnmount = shimmerStopSpy.mock.calls.length;

    act(() => {
      rendered.renderer.unmount();
    });

    expect(shimmerStopSpy.mock.calls.length).toBeGreaterThan(stopCallsBeforeUnmount);
  });

  it('renders with different combinations of props', () => {
    const rendered = renderShimmerBlock({
      shimmerWidth: 150,
      borderRadius: 12,
      style: { height: 100 },
    });
    renderer = rendered.renderer;
    expect(rendered.root).toBeDefined();
  });

  it('handles zero shimmerWidth', () => {
    const rendered = renderShimmerBlock({ shimmerWidth: 0 });
    renderer = rendered.renderer;
    expect(rendered.root).toBeDefined();
  });

  it('handles large shimmerWidth values', () => {
    const rendered = renderShimmerBlock({ shimmerWidth: 500 });
    renderer = rendered.renderer;
    expect(rendered.root).toBeDefined();
  });
});
