import React from 'react';
import type { ReactTestRenderer } from 'react-test-renderer';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const animationMocks = vi.hoisted(() => ({
  timingStart: vi.fn(),
  timingStop: vi.fn(),
}));

vi.mock('react-native', () => ({
  Animated: {
    Value: class {
      constructor(public _value: number) {}
      setValue(nextValue: number) {
        this._value = nextValue;
      }
      interpolate() {
        return this;
      }
    },
    View: 'Animated.View',
    timing: () => ({
      start: () => {
        animationMocks.timingStart();
      },
      stop: animationMocks.timingStop,
    }),
  },
  Easing: {
    bezier: () => 'bezier',
  },
  Platform: {
    OS: 'ios' as const,
  },
  Text: 'Text',
  View: 'View',
}));

vi.mock('../hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}));

import { MotionInView } from './MotionInView';

describe('MotionInView', () => {
  let renderer: ReactTestRenderer | null = null;
  const requestAnimationFrameMock = vi.fn((callback: FrameRequestCallback) => {
    callback(0);
    return 42;
  });
  const cancelAnimationFrameMock = vi.fn();

  beforeEach(() => {
    renderer?.unmount();
    renderer = null;
    vi.clearAllMocks();
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrameMock);
    vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrameMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('cancels the scheduled frame and stops the animation on unmount', () => {
    act(() => {
      renderer = create(
        <MotionInView>
          <>'child'</>
        </MotionInView>,
      );
    });

    expect(requestAnimationFrameMock).toHaveBeenCalledTimes(1);
    expect(animationMocks.timingStart).toHaveBeenCalledTimes(1);

    act(() => {
      renderer?.unmount();
    });

    expect(cancelAnimationFrameMock).toHaveBeenCalledWith(42);
    expect(animationMocks.timingStop).toHaveBeenCalledTimes(1);
  });
});
