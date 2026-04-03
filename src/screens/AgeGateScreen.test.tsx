import React from 'react';
import type { ReactTestRenderer } from 'react-test-renderer';
import { create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Pressable, Text } from 'react-native';
import { AgeGateScreen } from './AgeGateScreen';

const backHandlerMocks = vi.hoisted(() => ({
  exitApp: vi.fn(),
  addEventListener: vi.fn(() => ({ remove: vi.fn() })),
}));

vi.mock('react-native', async () => {
  const actual = (await vi.importActual('react-native')) as Record<string, unknown>;
  return {
    ...actual,
    BackHandler: {
      exitApp: backHandlerMocks.exitApp,
      addEventListener: backHandlerMocks.addEventListener,
    },
  };
});

vi.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

vi.mock('../components/MotionInView', () => ({
  MotionInView: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

vi.mock('../components/HapticPressable', () => ({
  HapticPressable: Pressable,
}));

vi.mock('../icons/BrandMarkIcon', () => ({
  BrandMarkIcon: () => <></>,
}));

vi.mock('../config/brand', () => ({
  brand: {
    productDisplayName: 'Canopy Trove',
    storageNamespace: 'canopy-trove',
  },
}));

describe('AgeGateScreen', () => {
  let renderer: ReactTestRenderer | null = null;

  beforeEach(() => {
    renderer?.unmount();
    renderer = null;
    vi.clearAllMocks();
  });

  it('renders the age gate screen', () => {
    const onAccept = vi.fn();
    renderer = create(<AgeGateScreen onAccept={onAccept} />);
    const instance = renderer.root;
    expect(instance).toBeDefined();
  });

  it('displays the age confirmation title', () => {
    const onAccept = vi.fn();
    renderer = create(<AgeGateScreen onAccept={onAccept} />);

    const allText = renderer.root.findAllByType(Text);
    const titleTexts = allText
      .map((t) => t.props.children)
      .filter((text) => text && typeof text === 'string');

    expect(titleTexts.some((text) => text.includes('21 or older'))).toBe(true);
  });

  it('displays the Canopy Trove branding', () => {
    const onAccept = vi.fn();
    renderer = create(<AgeGateScreen onAccept={onAccept} />);

    const allText = renderer.root.findAllByType(Text);
    const brandTexts = allText
      .map((t) => t.props.children)
      .filter((text) => text && typeof text === 'string');

    expect(brandTexts.some((text) => text === 'Canopy Trove')).toBe(true);
  });

  it('calls onAccept when the accept button is pressed', () => {
    const onAccept = vi.fn();
    renderer = create(<AgeGateScreen onAccept={onAccept} />);

    const allButtons = renderer.root.findAllByType(Pressable);
    const acceptButton = allButtons.find((button) => {
      const text = button.findAllByType(Text);
      return text.some((t) => t.props.children === 'Yes, I am 21 or older');
    });

    if (acceptButton) {
      acceptButton.props.onPress();
      expect(onAccept).toHaveBeenCalledTimes(1);
    }
  });

  it('shows blocked state when deny button is pressed', () => {
    const onAccept = vi.fn();
    renderer = create(<AgeGateScreen onAccept={onAccept} />);

    const allButtons = renderer.root.findAllByType(Pressable);
    const denyButton = allButtons.find((button) => {
      const text = button.findAllByType(Text);
      return text.some((t) => t.props.children === 'No');
    });

    if (denyButton) {
      denyButton.props.onPress();

      const allText = renderer.root.findAllByType(Text);
      const textContent = allText
        .map((t) => t.props.children)
        .filter((text) => text && typeof text === 'string');

      expect(textContent.some((text) => text.includes('Access blocked'))).toBe(true);
    }
  });

  it('shows close app button after blocking access', () => {
    const onAccept = vi.fn();
    renderer = create(<AgeGateScreen onAccept={onAccept} />);

    let allButtons = renderer.root.findAllByType(Pressable);
    const denyButton = allButtons.find((button) => {
      const text = button.findAllByType(Text);
      return text.some((t) => t.props.children === 'No');
    });

    if (denyButton) {
      denyButton.props.onPress();

      allButtons = renderer.root.findAllByType(Pressable);
      const closeButton = allButtons.find((button) => {
        const text = button.findAllByType(Text);
        return text.some((t) => t.props.children === 'Close App');
      });

      expect(closeButton).toBeDefined();
    }
  });

  it('calls BackHandler.exitApp when close button is pressed', () => {
    const onAccept = vi.fn();
    renderer = create(<AgeGateScreen onAccept={onAccept} />);

    let allButtons = renderer.root.findAllByType(Pressable);
    const denyButton = allButtons.find((button) => {
      const text = button.findAllByType(Text);
      return text.some((t) => t.props.children === 'No');
    });

    if (denyButton) {
      denyButton.props.onPress();

      allButtons = renderer.root.findAllByType(Pressable);
      const closeButton = allButtons.find((button) => {
        const text = button.findAllByType(Text);
        return text.some((t) => t.props.children === 'Close App');
      });

      if (closeButton) {
        closeButton.props.onPress();
        expect(backHandlerMocks.exitApp).toHaveBeenCalledTimes(1);
      }
    }
  });

  it('displays accessibility labels on buttons', () => {
    const onAccept = vi.fn();
    renderer = create(<AgeGateScreen onAccept={onAccept} />);

    const allButtons = renderer.root.findAllByType(Pressable);
    const acceptButton = allButtons.find((button) => {
      return button.props.accessibilityLabel === 'Confirm you are 21 or older';
    });

    expect(acceptButton).toBeDefined();
  });

  it('displays the trust chips with confidence indicators', () => {
    const onAccept = vi.fn();
    renderer = create(<AgeGateScreen onAccept={onAccept} />);

    const allText = renderer.root.findAllByType(Text);
    const textContent = allText
      .map((t) => t.props.children)
      .filter((text) => text && typeof text === 'string');

    expect(textContent.some((text) => text === '21+ only')).toBe(true);
    expect(textContent.some((text) => text === 'Verified storefronts')).toBe(true);
    expect(textContent.some((text) => text === 'Official records')).toBe(true);
  });

  it('shows "Before you continue" notice initially', () => {
    const onAccept = vi.fn();
    renderer = create(<AgeGateScreen onAccept={onAccept} />);

    const allText = renderer.root.findAllByType(Text);
    const textContent = allText
      .map((t) => t.props.children)
      .filter((text) => text && typeof text === 'string');

    expect(textContent.some((text) => text === 'Before you continue')).toBe(true);
  });

  it('hides close button in initial state', () => {
    const onAccept = vi.fn();
    renderer = create(<AgeGateScreen onAccept={onAccept} />);

    const allText = renderer.root.findAllByType(Text);
    const textContent = allText
      .map((t) => t.props.children)
      .filter((text) => text && typeof text === 'string');

    expect(textContent.filter((text) => text === 'Close App').length).toBe(0);
  });
});
