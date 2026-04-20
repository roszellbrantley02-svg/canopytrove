import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { CANOPYTROVE_BADGES } from '../domain/canopyTroveGamification/badgeDefinitions';
import { OWNER_EXCLUSIVE_BADGES } from '../domain/canopyTroveGamification/ownerBadgeDefinitions';

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

function readSupportedIconNames(): string[] {
  const iconFilePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'AppUiIcon.tsx');
  const source = fs.readFileSync(iconFilePath, 'utf8');
  const matches = source.matchAll(
    /(?:^|\s)(?:'([^']+)'|([A-Za-z][A-Za-z0-9-]*)):\s*\(\{ color, strokeWidth \}\)\s*=>/gm,
  );
  return [...new Set(Array.from(matches, (match) => match[1] ?? match[2]).sort())];
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

  it('supports every consumer and owner badge icon', () => {
    const supportedIconNames = new Set(readSupportedIconNames());
    const missingIcons = [
      ...new Set(
        [...CANOPYTROVE_BADGES, ...OWNER_EXCLUSIVE_BADGES]
          .map((badge) => badge.icon)
          .filter((iconName) => !supportedIconNames.has(iconName)),
      ),
    ];
    expect(missingIcons).toEqual([]);
  });
});
