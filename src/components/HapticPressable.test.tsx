import React from 'react';
import type { ReactTestRenderer } from 'react-test-renderer';
import { create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Vibration } from 'react-native';
import { HapticPressable } from './HapticPressable';

vi.mock('react-native', async () => {
  const actual = (await vi.importActual('react-native')) as Record<string, unknown>;
  return {
    ...actual,
    Vibration: {
      vibrate: vi.fn(),
    },
  };
});

describe('HapticPressable', () => {
  let renderer: ReactTestRenderer | null = null;

  beforeEach(() => {
    renderer?.unmount();
    renderer = null;
    vi.clearAllMocks();
  });

  it('renders as a Pressable component', () => {
    renderer = create(<HapticPressable testID="haptic-button" />);
    const instance = renderer.root;
    expect(instance).toBeDefined();
  });

  it('calls onPressIn callback when pressed', () => {
    const onPressIn = vi.fn();
    renderer = create(<HapticPressable onPressIn={onPressIn} testID="haptic-button" />);

    const pressable = renderer.root.findByProps({ testID: 'haptic-button' });
    pressable.props.onPressIn({ nativeEvent: {} });

    expect(onPressIn).toHaveBeenCalledTimes(1);
  });

  it('triggers haptic feedback when hapticType is impact', () => {
    const onPressIn = vi.fn();
    renderer = create(
      <HapticPressable hapticType="impact" onPressIn={onPressIn} testID="haptic-button" />,
    );

    const pressable = renderer.root.findByProps({ testID: 'haptic-button' });
    pressable.props.onPressIn({ nativeEvent: {} });

    expect(Vibration.vibrate).toHaveBeenCalledWith(12);
    expect(onPressIn).toHaveBeenCalledTimes(1);
  });

  it('triggers haptic feedback when hapticType is selection', () => {
    renderer = create(<HapticPressable hapticType="selection" testID="haptic-button" />);

    const pressable = renderer.root.findByProps({ testID: 'haptic-button' });
    pressable.props.onPressIn({ nativeEvent: {} });

    expect(Vibration.vibrate).toHaveBeenCalledWith(8);
  });

  it('triggers haptic feedback when hapticType is notification', () => {
    renderer = create(<HapticPressable hapticType="notification" testID="haptic-button" />);

    const pressable = renderer.root.findByProps({ testID: 'haptic-button' });
    pressable.props.onPressIn({ nativeEvent: {} });

    expect(Vibration.vibrate).toHaveBeenCalledWith(18);
  });

  it('does not trigger haptic when disabled', () => {
    const onPressIn = vi.fn();
    renderer = create(
      <HapticPressable hapticType="impact" disabled onPressIn={onPressIn} testID="haptic-button" />,
    );

    const pressable = renderer.root.findByProps({ testID: 'haptic-button' });
    pressable.props.onPressIn({ nativeEvent: {} });

    expect(Vibration.vibrate).not.toHaveBeenCalled();
    expect(onPressIn).toHaveBeenCalledTimes(1);
  });

  it('does not trigger haptic when hapticType is undefined', () => {
    renderer = create(<HapticPressable testID="haptic-button" />);

    const pressable = renderer.root.findByProps({ testID: 'haptic-button' });
    pressable.props.onPressIn({ nativeEvent: {} });

    expect(Vibration.vibrate).not.toHaveBeenCalled();
  });

  it('passes through accessibility props to Pressable', () => {
    renderer = create(
      <HapticPressable
        accessibilityRole="button"
        accessibilityLabel="Test Button"
        accessibilityHint="Test hint"
        testID="haptic-button"
      />,
    );

    const pressable = renderer.root.findByProps({ testID: 'haptic-button' });
    expect(pressable.props.accessibilityRole).toBe('button');
    expect(pressable.props.accessibilityLabel).toBe('Test Button');
    expect(pressable.props.accessibilityHint).toBe('Test hint');
  });

  it('passes through standard Pressable props', () => {
    const onPress = vi.fn();
    const pressableStyle = { padding: 10 };
    renderer = create(
      <HapticPressable onPress={onPress} style={pressableStyle} testID="haptic-button" />,
    );

    const pressable = renderer.root.findByProps({ testID: 'haptic-button' });
    expect(pressable.props.onPress).toBe(onPress);
    expect(pressable.props.style).toEqual(pressableStyle);
  });
});
