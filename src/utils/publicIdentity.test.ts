import { describe, expect, it } from 'vitest';
import { getProfileFallbackName, getSafePublicDisplayName, isEmailLike } from './publicIdentity';

describe('publicIdentity', () => {
  it('detects email-like values', () => {
    expect(isEmailLike('member@example.com')).toBe(true);
    expect(isEmailLike('  member@example.com  ')).toBe(true);
    expect(isEmailLike('Canopy Member')).toBe(false);
  });

  it('replaces email-like display names with the provided fallback', () => {
    expect(getSafePublicDisplayName('member@example.com', 'Canopy Trove member')).toBe(
      'Canopy Trove member',
    );
    expect(getSafePublicDisplayName('  GreenGuide  ', 'Canopy Trove member')).toBe('GreenGuide');
  });

  it('builds stable anonymous profile fallbacks without using email', () => {
    expect(getProfileFallbackName('canopytrove-profile-abc123')).toBe('Canopy Trove abc123');
    expect(getProfileFallbackName('')).toBe('Canopy Trove member');
  });
});
