import { describe, expect, it } from 'vitest';
import { buildWebBackResetState, getWebBackLabel } from './screenShellNavigation';

describe('ScreenShell web back helpers', () => {
  it('treats unlisted owner portal routes as workspace routes for reset state', () => {
    expect(buildWebBackResetState('OwnerPortalInsights')).toEqual({
      index: 1,
      routes: [
        { name: 'Tabs', params: { screen: 'Profile' } },
        { name: 'OwnerPortalHome' },
      ],
    });
  });

  it('treats unlisted owner portal routes as profile-backed destinations for labels', () => {
    expect(getWebBackLabel('OwnerPortalInsights')).toBe('Back to Profile');
  });
});
