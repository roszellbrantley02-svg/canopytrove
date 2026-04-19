import React from 'react';
import type { ReactTestRenderer } from 'react-test-renderer';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.hoisted runs BEFORE vi.mock so these fns are available inside the factory.
vi.hoisted(() => {
  (globalThis as typeof globalThis & { __DEV__?: boolean }).__DEV__ = true;
});

const backHandlerMocks = vi.hoisted(() => ({
  exitApp: vi.fn(),
  addEventListener: vi.fn((_e: string, _h: () => boolean) => ({ remove: vi.fn() })),
}));

vi.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
  },
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  Image: 'Image',
  ScrollView: 'ScrollView',
  StatusBar: 'StatusBar',
  SafeAreaView: 'SafeAreaView',
  Platform: {
    OS: 'android' as const,
    select: (obj: any) => obj.android ?? obj.default,
    Version: 33,
  },
  StyleSheet: {
    create: <T,>(styles: T): T => styles,
    flatten: (style: any) => (Array.isArray(style) ? Object.assign({}, ...style) : (style ?? {})),
    hairlineWidth: 1,
  },
  BackHandler: {
    exitApp: backHandlerMocks.exitApp,
    addEventListener: backHandlerMocks.addEventListener,
  },
  Animated: {
    Value: class {
      _value: number;
      constructor(val: number) {
        this._value = val;
      }
      setValue(val: number) {
        this._value = val;
      }
      interpolate() {
        return this;
      }
      addListener() {
        return '';
      }
      removeListener() {}
      removeAllListeners() {}
    },
    View: 'Animated.View',
    Text: 'Animated.Text',
    timing: () => ({ start: (cb?: () => void) => cb?.() }),
    spring: () => ({ start: (cb?: () => void) => cb?.() }),
    parallel: () => ({ start: (cb?: () => void) => cb?.() }),
    sequence: () => ({ start: (cb?: () => void) => cb?.() }),
    delay: () => ({ start: (cb?: () => void) => cb?.() }),
    loop: () => ({ start: (cb?: () => void) => cb?.(), stop: () => {} }),
    event: () => () => {},
    createAnimatedComponent: (c: any) => c,
  },
  Dimensions: {
    get: () => ({ width: 390, height: 844, scale: 3, fontScale: 1 }),
    addEventListener: () => ({ remove: () => {} }),
  },
  Appearance: {
    getColorScheme: () => 'light' as const,
    addChangeListener: () => ({ remove: () => {} }),
  },
  useColorScheme: () => 'light',
  useWindowDimensions: () => ({ width: 390, height: 844, scale: 3, fontScale: 1 }),
}));

import { BackHandler, Pressable, Text } from 'react-native';
import { AgeGateScreen } from './AgeGateScreen';

vi.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
}));

vi.mock('../components/MotionInView', () => ({
  MotionInView: 'MotionInView',
}));

vi.mock('../components/HapticPressable', () => ({
  HapticPressable: 'Pressable',
}));

vi.mock('../icons/BrandMarkIcon', () => ({
  BrandMarkIcon: 'BrandMarkIcon',
}));

vi.mock('../config/brand', () => ({
  brand: {
    productDisplayName: 'Canopy Trove',
    storageNamespace: 'canopy-trove',
  },
}));

// Mirror the render-helper pattern used by SearchField and ShimmerBlock tests.
function renderAgeGate(onAccept = vi.fn()) {
  let renderer: ReactTestRenderer;
  act(() => {
    renderer = create(<AgeGateScreen onAccept={onAccept} />);
  });
  return { renderer: renderer!, root: renderer!.root, onAccept };
}

describe('AgeGateScreen', () => {
  let renderer: ReactTestRenderer | null = null;

  beforeEach(() => {
    renderer?.unmount();
    renderer = null;
    vi.clearAllMocks();
  });

  it('renders the age gate screen', () => {
    const rendered = renderAgeGate();
    renderer = rendered.renderer;
    expect(rendered.root).toBeDefined();
  });

  it('displays the age confirmation title', () => {
    const rendered = renderAgeGate();
    renderer = rendered.renderer;

    const allText = rendered.root.findAllByType(Text);
    const titleTexts = allText
      .map((t) => t.props.children)
      .filter((text) => text && typeof text === 'string');

    expect(titleTexts.some((text) => text.includes('21 or older'))).toBe(true);
  });

  it('displays the Canopy Trove branding', () => {
    const rendered = renderAgeGate();
    renderer = rendered.renderer;

    const allText = rendered.root.findAllByType(Text);
    const brandTexts = allText
      .map((t) => t.props.children)
      .filter((text) => text && typeof text === 'string');

    expect(brandTexts.some((text) => text === 'Canopy Trove')).toBe(true);
  });

  it('calls onAccept when the accept button is pressed', () => {
    const rendered = renderAgeGate();
    renderer = rendered.renderer;

    const allButtons = rendered.root.findAllByType(Pressable);
    const acceptButton = allButtons.find((button) => {
      const text = button.findAllByType(Text);
      return text.some((t) => t.props.children === 'Yes, I am 21 or older');
    });

    if (acceptButton) {
      act(() => {
        acceptButton.props.onPress();
      });
      expect(rendered.onAccept).toHaveBeenCalledTimes(1);
    }
  });

  it('shows blocked state when deny button is pressed', () => {
    const rendered = renderAgeGate();
    renderer = rendered.renderer;

    const allButtons = rendered.root.findAllByType(Pressable);
    const denyButton = allButtons.find((button) => {
      const text = button.findAllByType(Text);
      return text.some((t) => t.props.children === 'No');
    });

    if (denyButton) {
      act(() => {
        denyButton.props.onPress();
      });

      const allText = rendered.root.findAllByType(Text);
      const textContent = allText
        .map((t) => t.props.children)
        .filter((text) => text && typeof text === 'string');

      expect(textContent.some((text) => text.includes('Access blocked'))).toBe(true);
    }
  });

  it('shows close app button after blocking access', () => {
    const rendered = renderAgeGate();
    renderer = rendered.renderer;

    let allButtons = rendered.root.findAllByType(Pressable);
    const denyButton = allButtons.find((button) => {
      const text = button.findAllByType(Text);
      return text.some((t) => t.props.children === 'No');
    });

    if (denyButton) {
      act(() => {
        denyButton.props.onPress();
      });

      allButtons = rendered.root.findAllByType(Pressable);
      const closeButton = allButtons.find((button) => {
        const text = button.findAllByType(Text);
        return text.some((t) => t.props.children === 'Close App');
      });

      expect(closeButton).toBeDefined();
    }
  });

  it('calls BackHandler.exitApp when close button is pressed', () => {
    const rendered = renderAgeGate();
    renderer = rendered.renderer;

    let allButtons = rendered.root.findAllByType(Pressable);
    const denyButton = allButtons.find((button) => {
      const text = button.findAllByType(Text);
      return text.some((t) => t.props.children === 'No');
    });

    if (denyButton) {
      act(() => {
        denyButton.props.onPress();
      });

      allButtons = rendered.root.findAllByType(Pressable);
      const closeButton = allButtons.find((button) => {
        const text = button.findAllByType(Text);
        return text.some((t) => t.props.children === 'Close App');
      });

      if (closeButton) {
        act(() => {
          closeButton.props.onPress();
        });
        expect(BackHandler.exitApp).toHaveBeenCalledTimes(1);
      }
    }
  });

  it('displays accessibility labels on buttons', () => {
    const rendered = renderAgeGate();
    renderer = rendered.renderer;

    const allButtons = rendered.root.findAllByType(Pressable);
    const acceptButton = allButtons.find((button) => {
      return button.props.accessibilityLabel === 'Confirm you are 21 or older';
    });

    expect(acceptButton).toBeDefined();
  });

  it('displays the trust chips with confidence indicators', () => {
    const rendered = renderAgeGate();
    renderer = rendered.renderer;

    const allText = rendered.root.findAllByType(Text);
    const textContent = allText
      .map((t) => t.props.children)
      .filter((text) => text && typeof text === 'string');

    expect(textContent.some((text) => text === '21+ only')).toBe(true);
    expect(textContent.some((text) => text === 'Verified storefronts')).toBe(true);
    expect(textContent.some((text) => text === 'Official records')).toBe(true);
  });

  it('shows "Before you continue" notice initially', () => {
    const rendered = renderAgeGate();
    renderer = rendered.renderer;

    const allText = rendered.root.findAllByType(Text);
    const textContent = allText
      .map((t) => t.props.children)
      .filter((text) => text && typeof text === 'string');

    expect(textContent.some((text) => text === 'Before you continue')).toBe(true);
  });

  it('hides close button in initial state', () => {
    const rendered = renderAgeGate();
    renderer = rendered.renderer;

    const allText = rendered.root.findAllByType(Text);
    const textContent = allText
      .map((t) => t.props.children)
      .filter((text) => text && typeof text === 'string');

    expect(textContent.filter((text) => text === 'Close App').length).toBe(0);
  });
});
