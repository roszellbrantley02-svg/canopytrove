import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  StyleSheet: {
    create: <T,>(styles: T): T => styles,
  },
}));

vi.mock('react-native-svg', () => ({
  __esModule: true,
  default: 'Svg',
  Circle: 'Circle',
  Line: 'Line',
  Path: 'Path',
  Rect: 'Rect',
}));

import { AppUiIcon } from './AppUiIcon';

function renderIcon(name: string) {
  act(() => {
    create(<AppUiIcon name={name as never} />);
  });
}

describe('AppUiIcon', () => {
  it('falls back safely when an unknown runtime icon name is passed', () => {
    expect(() => renderIcon('not-a-real-icon')).not.toThrow();
  });

  it('renders the owner badge icon set without crashing', () => {
    expect(() =>
      ['diamond-outline', 'brush-outline', 'chatbubbles-outline', 'people'].forEach(renderIcon),
    ).not.toThrow();
  });
});
