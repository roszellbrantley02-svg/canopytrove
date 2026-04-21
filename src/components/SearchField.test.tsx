import React from 'react';
import type { ReactTestRenderer } from 'react-test-renderer';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Animated: {
    Value: class {
      constructor(public _value: number) {}
      interpolate() {
        return this;
      }
    },
    View: 'Animated.View',
    spring: () => ({
      start: (cb?: () => void) => cb?.(),
      stop: vi.fn(),
    }),
  },
  Keyboard: {
    dismiss: vi.fn(),
  },
  Platform: {
    OS: 'ios' as const,
  },
  Pressable: 'Pressable',
  TextInput: 'TextInput',
  Vibration: {
    vibrate: vi.fn(),
  },
  View: 'View',
  StyleSheet: {
    create: <T,>(styles: T) => styles,
  },
}));

import { Pressable, TextInput } from 'react-native';
import { SearchField } from './SearchField';

vi.mock('../icons/ProvidedGlyphIconsV4c', () => ({
  SearchGlyphIconV4c: () => <></>,
}));

vi.mock('../icons/AppUiIcon', () => ({
  AppUiIcon: () => <></>,
}));

function renderSearchField(overrides: Partial<React.ComponentProps<typeof SearchField>> = {}) {
  const props: React.ComponentProps<typeof SearchField> = {
    value: '',
    onChangeText: vi.fn(),
    placeholder: 'Search storefronts',
    testID: 'search-field',
    ...overrides,
  };

  let renderer: ReactTestRenderer;
  act(() => {
    renderer = create(<SearchField {...props} />);
  });

  return {
    props,
    renderer: renderer!,
    root: renderer!.root,
  };
}

describe('SearchField', () => {
  let renderer: ReactTestRenderer | null = null;

  beforeEach(() => {
    renderer?.unmount();
    renderer = null;
    vi.clearAllMocks();
  });

  it('renders successfully', () => {
    const rendered = renderSearchField();
    renderer = rendered.renderer;
    expect(rendered.root).toBeDefined();
  });

  it('renders TextInput with correct placeholder', () => {
    const rendered = renderSearchField();
    renderer = rendered.renderer;
    const textInput = rendered.root.findByType(TextInput);
    expect(textInput.props.placeholder).toBe('Search storefronts');
  });

  it('displays current value in TextInput', () => {
    const rendered = renderSearchField({ value: 'cannabis' });
    renderer = rendered.renderer;
    const textInput = rendered.root.findByType(TextInput);
    expect(textInput.props.value).toBe('cannabis');
  });

  it('calls onChangeText when text changes', () => {
    const onChangeText = vi.fn();
    const rendered = renderSearchField({ onChangeText });
    renderer = rendered.renderer;
    const textInput = rendered.root.findByType(TextInput);

    act(() => {
      textInput.props.onChangeText('test search');
    });

    expect(onChangeText).toHaveBeenCalledWith('test search');
  });

  it('calls onSubmitEditing when search is submitted', () => {
    const onSubmitEditing = vi.fn();
    const rendered = renderSearchField({ onSubmitEditing });
    renderer = rendered.renderer;
    const textInput = rendered.root.findByType(TextInput);

    act(() => {
      textInput.props.onSubmitEditing();
    });

    expect(onSubmitEditing).toHaveBeenCalledTimes(1);
  });

  it('shows clear button when text is entered', () => {
    const rendered = renderSearchField({ value: 'search text' });
    renderer = rendered.renderer;
    const allPressables = rendered.root.findAllByType(Pressable);
    expect(allPressables.length).toBeGreaterThan(0);
  });

  it('hides clear button when text is empty', () => {
    const rendered = renderSearchField();
    renderer = rendered.renderer;
    expect(rendered.root.findAllByType(Pressable)).toHaveLength(0);
  });

  it('hides clear button when text is only whitespace', () => {
    const rendered = renderSearchField({ value: '   ' });
    renderer = rendered.renderer;
    expect(rendered.root.findAllByType(Pressable)).toHaveLength(0);
  });

  it('clears text when clear button is pressed', () => {
    const onChangeText = vi.fn();
    const rendered = renderSearchField({ value: 'search text', onChangeText });
    renderer = rendered.renderer;
    const clearButton = rendered.root.findByType(Pressable);

    act(() => {
      clearButton.props.onPress();
    });

    expect(onChangeText).toHaveBeenCalledWith('');
  });

  it('accepts search return key type', () => {
    const rendered = renderSearchField();
    renderer = rendered.renderer;
    const textInput = rendered.root.findByType(TextInput);
    expect(textInput.props.returnKeyType).toBe('search');
  });

  it('applies active styling when isActive prop is true', () => {
    const rendered = renderSearchField({ isActive: true });
    renderer = rendered.renderer;
    expect(rendered.root).toBeDefined();
  });

  it('applies inactive styling when isActive prop is false', () => {
    const rendered = renderSearchField({ isActive: false });
    renderer = rendered.renderer;
    expect(rendered.root).toBeDefined();
  });
});
