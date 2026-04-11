import React from 'react';
import type { ReactTestRenderer } from 'react-test-renderer';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.hoisted runs BEFORE vi.mock so these fns are available inside the factory.
const mocks = vi.hoisted(() => ({
  vibrate: vi.fn(),
  cancel: vi.fn(),
  springStart: vi.fn(),
  springStop: vi.fn(),
}));

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  View: 'View',
  Text: 'Text',
  Platform: {
    OS: 'android' as const,
    select: (obj: any) => obj.android ?? obj.default,
    Version: 33,
  },
  Vibration: {
    vibrate: mocks.vibrate,
    cancel: mocks.cancel,
  },
  Animated: {
    Value: class {
      constructor(public _value: number) {}
      interpolate() {
        return this;
      }
    },
    View: 'Animated.View',
    timing: (_value: any, _config: any) => ({ start: (cb?: () => void) => cb?.() }),
    spring: (_value: any, _config: any) => ({
      start: (cb?: () => void) => {
        mocks.springStart();
        cb?.();
      },
      stop: mocks.springStop,
    }),
  },
  StyleSheet: {
    create: <T,>(styles: T): T => styles,
  },
}));

import { Pressable, Vibration } from 'react-native';
import { HapticPressable } from './HapticPressable';

// Mirror the render-helper pattern used by SearchField and ShimmerBlock tests.
function renderHapticPressable(
  overrides: Partial<React.ComponentProps<typeof HapticPressable>> = {},
) {
  const props: React.ComponentProps<typeof HapticPressable> = {
    testID: 'haptic-button',
    ...overrides,
  };

  let renderer: ReactTestRenderer;
  act(() => {
    renderer = create(<HapticPressable {...props} />);
  });

  // Find the inner host Pressable element (not the outer component instance)
  const pressable = renderer!.root.findByType(Pressable as any);
  return { renderer: renderer!, root: renderer!.root, pressable };
}

describe('HapticPressable', () => {
  let renderer: ReactTestRenderer | null = null;

  beforeEach(() => {
    renderer?.unmount();
    renderer = null;
    vi.clearAllMocks();
  });

  it('renders as a Pressable component', () => {
    const rendered = renderHapticPressable();
    renderer = rendered.renderer;
    expect(rendered.root).toBeDefined();
  });

  it('calls onPressIn callback when pressed', () => {
    const onPressIn = vi.fn();
    const rendered = renderHapticPressable({ onPressIn });
    renderer = rendered.renderer;

    rendered.pressable.props.onPressIn({ nativeEvent: {} });

    expect(onPressIn).toHaveBeenCalledTimes(1);
  });

  it('triggers haptic feedback when hapticType is impact', () => {
    const onPressIn = vi.fn();
    const rendered = renderHapticPressable({ hapticType: 'impact', onPressIn });
    renderer = rendered.renderer;

    rendered.pressable.props.onPressIn({ nativeEvent: {} });

    expect(Vibration.vibrate).toHaveBeenCalledWith(12);
    expect(onPressIn).toHaveBeenCalledTimes(1);
  });

  it('triggers haptic feedback when hapticType is selection', () => {
    const rendered = renderHapticPressable({ hapticType: 'selection' });
    renderer = rendered.renderer;

    rendered.pressable.props.onPressIn({ nativeEvent: {} });

    expect(Vibration.vibrate).toHaveBeenCalledWith(8);
  });

  it('triggers haptic feedback when hapticType is notification', () => {
    const rendered = renderHapticPressable({ hapticType: 'notification' });
    renderer = rendered.renderer;

    rendered.pressable.props.onPressIn({ nativeEvent: {} });

    expect(Vibration.vibrate).toHaveBeenCalledWith(18);
  });

  it('does not trigger haptic when disabled', () => {
    const onPressIn = vi.fn();
    const rendered = renderHapticPressable({ hapticType: 'impact', disabled: true, onPressIn });
    renderer = rendered.renderer;

    rendered.pressable.props.onPressIn({ nativeEvent: {} });

    expect(Vibration.vibrate).not.toHaveBeenCalled();
    expect(onPressIn).toHaveBeenCalledTimes(1);
  });

  it('does not trigger haptic when hapticType is undefined', () => {
    const rendered = renderHapticPressable();
    renderer = rendered.renderer;

    rendered.pressable.props.onPressIn({ nativeEvent: {} });

    expect(Vibration.vibrate).not.toHaveBeenCalled();
  });

  it('passes through accessibility props to Pressable', () => {
    const rendered = renderHapticPressable({
      accessibilityRole: 'button',
      accessibilityLabel: 'Test Button',
      accessibilityHint: 'Test hint',
    });
    renderer = rendered.renderer;

    expect(rendered.pressable.props.accessibilityRole).toBe('button');
    expect(rendered.pressable.props.accessibilityLabel).toBe('Test Button');
    expect(rendered.pressable.props.accessibilityHint).toBe('Test hint');
  });

  it('passes through standard Pressable props', () => {
    const onPress = vi.fn();
    const pressableStyle = { padding: 10 };
    const rendered = renderHapticPressable({ onPress, style: pressableStyle });
    renderer = rendered.renderer;

    expect(rendered.pressable.props.onPress).toBe(onPress);
    expect(rendered.pressable.props.style).toEqual(
      expect.arrayContaining([pressableStyle]),
    );
  });

  it('stops the previous scale animation before starting the next one', () => {
    const rendered = renderHapticPressable({ enableScale: true });
    renderer = rendered.renderer;

    rendered.pressable.props.onPressIn({ nativeEvent: {} });
    rendered.pressable.props.onPressOut({ nativeEvent: {} });

    expect(mocks.springStart).toHaveBeenCalledTimes(2);
    expect(mocks.springStop).toHaveBeenCalledTimes(1);
  });

  it('stops the active scale animation when unmounted', () => {
    const rendered = renderHapticPressable({ enableScale: true });
    renderer = rendered.renderer;

    rendered.pressable.props.onPressIn({ nativeEvent: {} });

    act(() => {
      rendered.renderer.unmount();
    });

    expect(mocks.springStop).toHaveBeenCalled();
  });
});
