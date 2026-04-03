/**
 * Lightweight react-native mock for Vitest.
 *
 * Vitest 4.x uses Rolldown which cannot parse React Native's Flow-typed source.
 * The Vite plugin in vitest.config.ts redirects all 'react-native' imports here
 * before the bundler ever touches node_modules/react-native/index.js.
 */

import React from 'react';

/* ---------- Primitives ---------- */
// React 19's react-test-renderer requires bare strings (host element names)
// rather than forwardRef wrappers. Using strings matches what the passing tests
// already do (e.g. SearchField.test.tsx: `View: 'View'`).

export const View = 'View' as unknown as React.ComponentType<any>;
export const Text = 'Text' as unknown as React.ComponentType<any>;
export const Image = 'Image' as unknown as React.ComponentType<any>;
export const ScrollView = 'ScrollView' as unknown as React.ComponentType<any>;
export const FlatList = 'FlatList' as unknown as React.ComponentType<any>;
export const SectionList = 'SectionList' as unknown as React.ComponentType<any>;
export const TextInput = 'TextInput' as unknown as React.ComponentType<any>;
export const TouchableOpacity = 'TouchableOpacity' as unknown as React.ComponentType<any>;
export const TouchableHighlight = 'TouchableHighlight' as unknown as React.ComponentType<any>;
export const TouchableWithoutFeedback =
  'TouchableWithoutFeedback' as unknown as React.ComponentType<any>;
export const ActivityIndicator = 'ActivityIndicator' as unknown as React.ComponentType<any>;
export const Switch = 'Switch' as unknown as React.ComponentType<any>;
export const Modal = 'Modal' as unknown as React.ComponentType<any>;
export const SafeAreaView = 'SafeAreaView' as unknown as React.ComponentType<any>;
export const KeyboardAvoidingView = 'KeyboardAvoidingView' as unknown as React.ComponentType<any>;
export const StatusBar = 'StatusBar' as unknown as React.ComponentType<any>;
export const ImageBackground = 'ImageBackground' as unknown as React.ComponentType<any>;
export const Pressable = 'Pressable' as unknown as React.ComponentType<any>;

/* ---------- APIs ---------- */

export const StyleSheet = {
  create: <T extends Record<string, any>>(styles: T): T => styles,
  flatten: (style: any) => (Array.isArray(style) ? Object.assign({}, ...style) : (style ?? {})),
  hairlineWidth: 1,
  absoluteFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 } as any,
  absoluteFillObject: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 } as any,
};

export const Platform = {
  OS: 'android' as const,
  select: (obj: any) => obj.android ?? obj.default,
  Version: 33,
};

export const Dimensions = {
  get: () => ({ width: 390, height: 844, scale: 3, fontScale: 1 }),
  addEventListener: () => ({ remove: () => {} }),
};

export const PixelRatio = {
  get: () => 3,
  getFontScale: () => 1,
  getPixelSizeForLayoutSize: (size: number) => size * 3,
  roundToNearestPixel: (size: number) => Math.round(size * 3) / 3,
};

export const Vibration = {
  vibrate: () => {},
  cancel: () => {},
};

export const BackHandler = {
  exitApp: () => {},
  addEventListener: (_event: string, _handler: () => boolean) => ({ remove: () => {} }),
};

export const Animated = {
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
  View: 'Animated.View' as unknown as React.ComponentType<any>,
  Text: 'Animated.Text' as unknown as React.ComponentType<any>,
  Image: 'Animated.Image' as unknown as React.ComponentType<any>,
  ScrollView: 'Animated.ScrollView' as unknown as React.ComponentType<any>,
  FlatList: 'Animated.FlatList' as unknown as React.ComponentType<any>,
  timing: () => ({ start: (cb?: () => void) => cb?.() }),
  spring: () => ({ start: (cb?: () => void) => cb?.() }),
  decay: () => ({ start: (cb?: () => void) => cb?.() }),
  sequence: () => ({ start: (cb?: () => void) => cb?.() }),
  parallel: () => ({ start: (cb?: () => void) => cb?.() }),
  delay: () => ({ start: (cb?: () => void) => cb?.() }),
  loop: () => ({ start: (cb?: () => void) => cb?.(), stop: () => {} }),
  event: () => () => {},
  createAnimatedComponent: (c: any) => c,
};

export const Linking = {
  openURL: async () => {},
  canOpenURL: async () => true,
  getInitialURL: async () => null,
  addEventListener: () => ({ remove: () => {} }),
};

export const Alert = {
  alert: () => {},
  prompt: () => {},
};

export const Keyboard = {
  dismiss: () => {},
  addListener: () => ({ remove: () => {} }),
  removeListener: () => {},
};

export const AppState = {
  currentState: 'active' as const,
  addEventListener: () => ({ remove: () => {} }),
};

export const Appearance = {
  getColorScheme: () => 'light' as const,
  addChangeListener: () => ({ remove: () => {} }),
};

export const NativeModules = {};
export const NativeEventEmitter = class {
  addListener() {
    return { remove: () => {} };
  }
  removeAllListeners() {}
};

export const useColorScheme = () => 'light';
export const useWindowDimensions = () => ({ width: 390, height: 844, scale: 3, fontScale: 1 });

/* ---------- Type re-exports (no-ops for test compilation) ---------- */

export type PressableProps = any;
export type ViewProps = any;
export type TextProps = any;
export type ImageProps = any;
export type TextInputProps = any;
export type ScrollViewProps = any;
export type FlatListProps<T = any> = any;
export type StyleProp<T = any> = any;
export type ViewStyle = any;
export type TextStyle = any;
export type ImageStyle = any;
export type ColorValue = string;
export type GestureResponderEvent = any;
export type LayoutChangeEvent = any;
export type NativeSyntheticEvent<T = any> = any;
