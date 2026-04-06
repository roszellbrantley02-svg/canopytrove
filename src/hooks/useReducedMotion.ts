import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

/**
 * Returns `true` when the user's OS/browser has "reduce motion" enabled.
 * On native, always returns `false` (native animations use the OS accessibility
 * layer directly). On web, listens to the `prefers-reduced-motion` media query
 * so animations can be skipped for users who need it.
 */
export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
    return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
  });

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const mql = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mql) return;

    const handler = (event: MediaQueryListEvent) => {
      setReducedMotion(event.matches);
    };

    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return reducedMotion;
}
