import React from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useStorefrontProfileController } from '../context/StorefrontController';
import { useOwnerPortalAccessState } from '../hooks/useOwnerPortalAccessState';
import { DEFAULT_MUSIC_VOLUME } from './musicManifest';
import {
  MUSIC_ENABLED_DEFAULT,
  readMusicEnabledPreference,
  writeMusicEnabledPreference,
} from './musicPreferenceStorage';
import { startBackgroundMusic, stopBackgroundMusic } from './musicPlayerService';

type MusicPlayerContextValue = {
  /** User-facing on/off preference. Reflects the switch on the profile screen. */
  isMusicEnabled: boolean;
  /** True once the persisted preference has been read on boot. */
  isReady: boolean;
  /**
   * True if music is currently suppressed for reasons outside the user's
   * control (e.g. signed in as an owner). The toggle is still displayed but
   * playback is paused; when the reason clears, music resumes if enabled.
   */
  isSuppressed: boolean;
  /** Human-readable reason music is suppressed, for UI copy. */
  suppressionReason: 'owner-signed-in' | null;
  /** Flip the persisted on/off preference. */
  setMusicEnabled: (enabled: boolean) => void;
  /** Convenience toggle. */
  toggleMusic: () => void;
};

const MusicPlayerContext = React.createContext<MusicPlayerContextValue | null>(null);

type MusicPlayerProviderProps = {
  children: React.ReactNode;
  /** Volume 0..1. Default is a soft 0.28 per product spec ("plays softly"). */
  volume?: number;
};

/**
 * Provides background music state + controls.
 *
 * Rules enforced here:
 *   1. Default OFF for everyone (guests, members). Users must opt in from
 *      Profile → Background music.
 *   2. Owners get it forcibly silenced the moment they sign in or sign up.
 *      Sign out → music can resume only if the user explicitly toggled it on.
 *   3. User toggle on the profile screen is always authoritative over the
 *      default. It persists across launches via AsyncStorage.
 *
 * Must be mounted INSIDE `StorefrontControllerProvider` so that
 * `useStorefrontProfileController` and `useOwnerPortalAccessState` both have
 * a valid auth session to read from.
 *
 * Defensive properties (verified 2026-04-19 audit):
 *   - AppState listener reads `shouldPlay` / `volume` from refs so a late
 *     background→active transition NEVER restarts music that's been disabled
 *     since the listener was registered (stale-closure class bug).
 *   - Listener is created once on mount and torn down once on unmount; we
 *     don't churn subscribe/unsubscribe on every render.
 *   - Unmount cleanup captures the final "please stop" intent synchronously
 *     so a provider-remount (e.g. sign-out rebuild) can't leak a player.
 *   - The player service owns all race protection via a generation counter;
 *     this file's only job is to keep driving the right high-level intent.
 */
export function MusicPlayerProvider({
  children,
  volume = DEFAULT_MUSIC_VOLUME,
}: MusicPlayerProviderProps) {
  const { authSession } = useStorefrontProfileController();
  const { accessState, isCheckingAccess } = useOwnerPortalAccessState(authSession);

  const [isMusicEnabled, setIsMusicEnabledState] = React.useState<boolean>(MUSIC_ENABLED_DEFAULT);
  const [isReady, setIsReady] = React.useState(false);

  // True the moment the user touches the toggle. If they tap before the
  // persisted preference has finished loading from AsyncStorage (~50-200ms
  // window on iOS), we honor the user's intent and skip overwriting their
  // value with the loaded one. Without this guard the toggle appeared to
  // "flip back on its own" — manifest as the bug the user flagged.
  const userOverrideRef = React.useRef(false);

  // Load persisted preference once on mount. `active` guards against the rare
  // case where the provider unmounts before AsyncStorage resolves (strict
  // mode, fast-remount, sign-out tree rebuild).
  React.useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const stored = await readMusicEnabledPreference();
        if (!active) {
          return;
        }
        // Only adopt the stored value if the user hasn't already taken
        // action since mount. Otherwise their flip would be silently
        // overwritten the moment AsyncStorage resolves.
        if (!userOverrideRef.current) {
          setIsMusicEnabledState(stored);
        }
        setIsReady(true);
      } catch {
        // Storage failure falls back to default — never block app boot on it.
        if (active) {
          setIsReady(true);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Owner suppression — we pause music while an owner session is active.
  // We don't wait for `isCheckingAccess` to finish, but we also don't flip
  // on/off mid-check to avoid flicker at sign-in.
  const isOwner =
    authSession.status === 'authenticated' && accessState.allowlisted === true && !isCheckingAccess;

  const isSuppressed = isOwner;
  const suppressionReason: MusicPlayerContextValue['suppressionReason'] = isOwner
    ? 'owner-signed-in'
    : null;

  // Drive the player service from the derived "should we actually be making
  // noise right now?" signal.
  const shouldPlay = isReady && isMusicEnabled && !isSuppressed;

  // Refs mirror the latest driving values so async callbacks (AppState
  // listener, cleanup teardown) always see fresh data instead of a stale
  // snapshot captured at effect-creation time.
  const shouldPlayRef = React.useRef(shouldPlay);
  shouldPlayRef.current = shouldPlay;
  const volumeRef = React.useRef(volume);
  volumeRef.current = volume;

  // App backgrounded → iOS keeps playing by default (playsInSilentMode +
  // background mode). We still track app state so we can restart playback
  // cleanly after a long suspension if the native side paused us.
  //
  // CRITICAL: this effect registers the listener ONCE on mount and tears it
  // down ONCE on unmount. If we put `shouldPlay` / `volume` in the dep array,
  // we churn subscribe/unsubscribe on every flip, which has been observed to
  // race with iOS delivering the state event — occasionally the listener
  // registered for the OLD shouldPlay would fire just after toggle-off and
  // restart music the user just turned off. Reading from refs eliminates the
  // stale-closure class entirely.
  const appStateRef = React.useRef<AppStateStatus>(AppState.currentState);
  React.useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const wasBackground =
        appStateRef.current === 'background' || appStateRef.current === 'inactive';
      appStateRef.current = next;
      // Check the live ref — not a stale snapshot. If the user toggled music
      // off while we were backgrounded, we must NOT resume.
      if (wasBackground && next === 'active' && shouldPlayRef.current) {
        void startBackgroundMusic(volumeRef.current);
      }
    });
    return () => {
      sub.remove();
    };
  }, []);

  // Primary playback driver: translate the `shouldPlay` derived state into
  // calls on the player service. Idempotent — calling startBackgroundMusic
  // repeatedly with the same volume just re-settles the fade.
  React.useEffect(() => {
    if (!isReady) {
      return;
    }
    if (shouldPlay) {
      void startBackgroundMusic(volume);
    } else {
      stopBackgroundMusic();
    }
  }, [shouldPlay, isReady, volume]);

  // Ensure we clean up if the provider ever unmounts (e.g. sign-out flows
  // that rebuild the tree). The service's generation counter protects us
  // from an unmount-during-start race: stop() bumps the gen, so the pending
  // start's callbacks will self-cancel.
  React.useEffect(() => {
    return () => {
      stopBackgroundMusic();
    };
  }, []);

  const setMusicEnabled = React.useCallback((enabled: boolean) => {
    userOverrideRef.current = true;
    setIsMusicEnabledState(enabled);
    void writeMusicEnabledPreference(enabled).catch(() => {
      // Preference persistence is best-effort — a write failure just means
      // the toggle won't survive an app restart. Not worth surfacing to the
      // user; the in-memory state is already applied.
    });
  }, []);

  const toggleMusic = React.useCallback(() => {
    userOverrideRef.current = true;
    setIsMusicEnabledState((prev) => {
      const next = !prev;
      void writeMusicEnabledPreference(next).catch(() => {
        // See note in setMusicEnabled — best-effort persistence.
      });
      return next;
    });
  }, []);

  const value = React.useMemo<MusicPlayerContextValue>(
    () => ({
      isMusicEnabled,
      isReady,
      isSuppressed,
      suppressionReason,
      setMusicEnabled,
      toggleMusic,
    }),
    [isMusicEnabled, isReady, isSuppressed, suppressionReason, setMusicEnabled, toggleMusic],
  );

  return <MusicPlayerContext.Provider value={value}>{children}</MusicPlayerContext.Provider>;
}

/**
 * Hook for the profile screen toggle + any other consumers that want to
 * inspect/control background music.
 *
 * Falls back to a no-op shape if used outside the provider (so unit tests
 * and storybook don't have to mount the provider just to render a screen).
 */
export function useMusicPlayer(): MusicPlayerContextValue {
  const ctx = React.useContext(MusicPlayerContext);
  if (!ctx) {
    return {
      isMusicEnabled: MUSIC_ENABLED_DEFAULT,
      isReady: false,
      isSuppressed: false,
      suppressionReason: null,
      setMusicEnabled: () => undefined,
      toggleMusic: () => undefined,
    };
  }
  return ctx;
}
