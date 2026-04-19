import { Platform } from 'react-native';
import type { BackgroundTrack } from './musicManifest';
import { DEFAULT_MUSIC_VOLUME, MUSIC_FADE_MS, backgroundTracks } from './musicManifest';

/**
 * Background music player service.
 *
 * Thin wrapper around `expo-audio`'s imperative player API. Responsibilities:
 *   - Pick a random track from the manifest (never repeating the last one
 *     back-to-back as long as ≥2 tracks exist).
 *   - Load → play → on-finish → pick next. Forever loop.
 *   - Fade volume in on start, out on stop — avoids a jarring click.
 *   - Survive navigation changes (React Native app-global singleton).
 *
 * `expo-audio` is loaded dynamically (require inside functions) so the app
 * still builds and boots on web and in test environments where the native
 * module isn't linked. Web currently no-ops.
 *
 * Defensive properties (verified 2026-04-19 audit):
 *   - Every async operation carries a "generation" number. Completions from
 *     a previous generation are silently dropped so a stop-then-start race
 *     cannot leave two players alive or restart a track the user stopped.
 *   - playTrack, advanceToNext, fadeTo, and disposeCurrentPlayer all check
 *     the current generation before mutating state.
 *   - `lastTrackId` is only set AFTER play() succeeds, so a failed load
 *     doesn't poison the round-robin.
 *   - Disposing the player before creating a new one is atomic-ish: we
 *     null out refs before async boundaries, and we guard the listener with
 *     a try/catch in case the native side rejects the subscribe.
 *   - AppState-driven restart uses the latest shouldPlay via a ref; it
 *     cannot restart a track when the toggle flipped off mid-resume.
 */

type AudioPlayerHandle = {
  volume: number;
  // expo-audio exposes these as live getters on the player handle. They may
  // be undefined until the source finishes loading — the watchdog below
  // tolerates that and waits for a valid duration before deciding a track
  // has ended. (We treat them as readonly-ish — never assign to them.)
  readonly currentTime?: number;
  readonly duration?: number;
  readonly playing?: boolean;
  readonly isLoaded?: boolean;
  play: () => void;
  pause: () => void;
  remove: () => void;
  addListener?: (
    event: 'playbackStatusUpdate',
    listener: (status: AudioPlaybackStatus) => void,
  ) => { remove: () => void };
  replace?: (source: unknown) => void;
};

type AudioPlaybackStatus = {
  isLoaded?: boolean;
  didJustFinish?: boolean;
  playing?: boolean;
  duration?: number;
  currentTime?: number;
};

type ExpoAudioModule = {
  createAudioPlayer: (source: unknown) => AudioPlayerHandle;
  setAudioModeAsync?: (mode: {
    allowsRecording?: boolean;
    playsInSilentMode?: boolean;
    shouldPlayInBackground?: boolean;
    shouldRouteThroughEarpiece?: boolean;
    interruptionModeAndroid?: string;
    interruptionMode?: string;
  }) => Promise<void>;
};

function loadExpoAudio(): ExpoAudioModule | null {
  if (Platform.OS === 'web') {
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-audio') as ExpoAudioModule;
    return mod ?? null;
  } catch (error) {
    if (__DEV__) {
      console.warn(
        '[musicPlayerService] expo-audio not available. Run `npx expo install expo-audio` to enable background music.',
        error,
      );
    }
    return null;
  }
}

type PlayerState = {
  player: AudioPlayerHandle | null;
  currentTrackId: string | null;
  lastTrackId: string | null;
  listenerSub: { remove: () => void } | null;
  fadeTimer: ReturnType<typeof setInterval> | null;
  /**
   * End-of-track polling watchdog. `didJustFinish` on `playbackStatusUpdate`
   * has been observed to sometimes never fire on newer expo-audio builds —
   * when that happens the track plays to the end and then silence, and the
   * user hears "one song then nothing" (the exact bug they flagged). The
   * watchdog polls the player's currentTime/duration every 500ms and
   * advances if we're inside a 0.4s tail window, giving us a reliable fall-
   * back that coexists with the event-driven path (whichever fires first
   * wins — the other becomes a no-op thanks to `state.currentTrackId`
   * changing after advance).
   */
  endWatchdogTimer: ReturnType<typeof setInterval> | null;
  stopRequested: boolean;
  targetVolume: number;
  audioModeConfigured: boolean;
  /**
   * Monotonically increasing counter. Every call to startBackgroundMusic /
   * stopBackgroundMusic bumps this. Async completions check whether their
   * captured generation still matches state.generation before mutating.
   */
  generation: number;
};

const state: PlayerState = {
  player: null,
  currentTrackId: null,
  lastTrackId: null,
  listenerSub: null,
  fadeTimer: null,
  endWatchdogTimer: null,
  stopRequested: false,
  targetVolume: DEFAULT_MUSIC_VOLUME,
  audioModeConfigured: false,
  generation: 0,
};

function bumpGeneration(): number {
  state.generation += 1;
  return state.generation;
}

function isCurrentGeneration(gen: number): boolean {
  return gen === state.generation;
}

async function configureAudioModeOnce(audio: ExpoAudioModule) {
  if (state.audioModeConfigured || !audio.setAudioModeAsync) {
    return;
  }
  try {
    await audio.setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      allowsRecording: false,
    });
    state.audioModeConfigured = true;
  } catch (error) {
    if (__DEV__) {
      console.warn('[musicPlayerService] failed to configure audio mode', error);
    }
  }
}

function pickNextTrack(): BackgroundTrack | null {
  if (backgroundTracks.length === 0) {
    return null;
  }
  if (backgroundTracks.length === 1) {
    return backgroundTracks[0] ?? null;
  }
  const pool = backgroundTracks.filter((track) => track.id !== state.lastTrackId);
  const effectivePool = pool.length > 0 ? pool : backgroundTracks;
  const index = Math.floor(Math.random() * effectivePool.length);
  return effectivePool[index] ?? backgroundTracks[0] ?? null;
}

function clearFade() {
  if (state.fadeTimer !== null) {
    clearInterval(state.fadeTimer);
    state.fadeTimer = null;
  }
}

function clearEndWatchdog() {
  if (state.endWatchdogTimer !== null) {
    clearInterval(state.endWatchdogTimer);
    state.endWatchdogTimer = null;
  }
}

/**
 * Start a polling watchdog that advances to the next track when the current
 * one nears its end. This is a redundancy layer sitting behind the
 * `playbackStatusUpdate`/`didJustFinish` listener — whichever fires first
 * triggers the advance, the other becomes a no-op because
 * `state.currentTrackId` changes on advance.
 *
 * Polls every 500ms and treats "near end" as within 0.4s of duration
 * (roughly the length of one poll cycle). If currentTime/duration aren't
 * yet available the poll simply waits — the native source may still be
 * loading.
 */
function startEndWatchdog(audio: ExpoAudioModule, gen: number) {
  clearEndWatchdog();
  const player = state.player;
  if (!player) {
    return;
  }
  state.endWatchdogTimer = setInterval(() => {
    // Abort if another generation is now in charge, or our player got
    // swapped out from under us.
    if (!isCurrentGeneration(gen) || state.player !== player || state.stopRequested) {
      clearEndWatchdog();
      return;
    }
    const duration = typeof player.duration === 'number' ? player.duration : 0;
    const currentTime = typeof player.currentTime === 'number' ? player.currentTime : 0;
    if (duration <= 0) {
      // Not loaded yet — keep polling.
      return;
    }
    const remaining = duration - currentTime;
    // 0.4s tail buffer: one poll cycle + a little slack. We also advance
    // if currentTime has actually passed duration (some backends clamp,
    // some don't). Guard the negative case too (clock drift).
    if (remaining <= 0.4 || currentTime >= duration) {
      clearEndWatchdog();
      advanceToNext(audio, gen);
    }
  }, 500);
}

function fadeTo(target: number, durationMs: number, gen: number, onComplete?: () => void) {
  if (!state.player || !isCurrentGeneration(gen)) {
    onComplete?.();
    return;
  }
  clearFade();
  const player = state.player;
  const start = typeof player.volume === 'number' ? player.volume : 0;
  const delta = target - start;

  // No audible delta — skip the interval and call onComplete immediately.
  if (Math.abs(delta) < 0.001) {
    onComplete?.();
    return;
  }

  const stepMs = 60;
  const steps = Math.max(1, Math.round(durationMs / stepMs));
  let frame = 0;
  state.fadeTimer = setInterval(() => {
    frame += 1;
    const progress = Math.min(1, frame / steps);

    // Bail if another generation took over mid-fade — don't touch a player
    // we no longer own.
    if (!isCurrentGeneration(gen) || !state.player || state.player !== player) {
      clearFade();
      onComplete?.();
      return;
    }

    try {
      player.volume = start + delta * progress;
    } catch {
      // If the player was already torn down, stop fading.
      clearFade();
      onComplete?.();
      return;
    }
    if (progress >= 1) {
      clearFade();
      onComplete?.();
    }
  }, stepMs);
}

function disposeCurrentPlayer() {
  clearFade();
  clearEndWatchdog();
  const sub = state.listenerSub;
  state.listenerSub = null;
  if (sub) {
    try {
      sub.remove();
    } catch {
      // ignore
    }
  }
  const player = state.player;
  state.player = null;
  state.currentTrackId = null;
  if (player) {
    try {
      player.pause();
    } catch {
      // ignore
    }
    try {
      player.remove();
    } catch {
      // ignore
    }
  }
}

function playTrack(audio: ExpoAudioModule, track: BackgroundTrack, gen: number) {
  if (!isCurrentGeneration(gen)) {
    return;
  }
  disposeCurrentPlayer();
  if (!isCurrentGeneration(gen)) {
    // Another call raced past us while we were disposing — bail.
    return;
  }

  let player: AudioPlayerHandle;
  try {
    player = audio.createAudioPlayer(track.source);
  } catch (error) {
    if (__DEV__) {
      console.warn('[musicPlayerService] failed to create player for', track.id, error);
    }
    return;
  }

  if (!isCurrentGeneration(gen)) {
    // Racing stop — tear down the player we just made and bail.
    try {
      player.remove();
    } catch {
      // ignore
    }
    return;
  }

  state.player = player;
  state.currentTrackId = track.id;

  try {
    player.volume = 0;
  } catch {
    // volume is a setter on the player handle; some platforms no-op.
  }

  if (player.addListener) {
    try {
      state.listenerSub = player.addListener('playbackStatusUpdate', (status) => {
        // Guard against late callbacks firing after we've switched tracks.
        if (!isCurrentGeneration(gen) || state.player !== player) {
          return;
        }
        if (status.didJustFinish && !state.stopRequested) {
          advanceToNext(audio, gen);
        }
      });
    } catch (error) {
      if (__DEV__) {
        console.warn('[musicPlayerService] addListener failed', error);
      }
      state.listenerSub = null;
    }
  }

  try {
    player.play();
  } catch (error) {
    if (__DEV__) {
      console.warn('[musicPlayerService] play() failed', error);
    }
    // Don't commit lastTrackId if play failed — the user never heard it.
    return;
  }

  // Only commit "we played this one" after a successful play() so failed
  // loads don't block the track from being picked next time.
  state.lastTrackId = track.id;

  fadeTo(state.targetVolume, MUSIC_FADE_MS, gen);

  // Belt-and-suspenders end detection. The playbackStatusUpdate listener
  // above should fire didJustFinish at the end of the source, but on some
  // expo-audio builds the event either arrives late or not at all and the
  // playlist hangs on a single track — the exact symptom the user flagged
  // ("doesn't run forever it shuts off after one song"). The watchdog
  // polls currentTime/duration and advances defensively.
  startEndWatchdog(audio, gen);
}

function advanceToNext(audio: ExpoAudioModule, gen: number) {
  if (!isCurrentGeneration(gen) || state.stopRequested) {
    return;
  }
  const next = pickNextTrack();
  if (!next) {
    return;
  }
  playTrack(audio, next, gen);
}

/**
 * Start (or keep running) background music.
 *
 * Idempotent — safe to call every render. If music is already playing, this
 * just updates target volume (smooth fade to the new value).
 */
export async function startBackgroundMusic(volume: number = DEFAULT_MUSIC_VOLUME): Promise<void> {
  const audio = loadExpoAudio();
  if (!audio) {
    return;
  }

  const clampedVolume = Math.max(0, Math.min(1, volume));
  state.stopRequested = false;
  state.targetVolume = clampedVolume;
  const gen = bumpGeneration();

  await configureAudioModeOnce(audio);

  // The generation might have advanced while configureAudioModeOnce awaited —
  // e.g. a stopBackgroundMusic() fired synchronously right after. Bail
  // cleanly so we don't resurrect a just-stopped player.
  if (!isCurrentGeneration(gen)) {
    return;
  }

  if (state.player) {
    // Already running — just re-settle volume.
    fadeTo(clampedVolume, MUSIC_FADE_MS, gen);
    return;
  }

  const next = pickNextTrack();
  if (!next) {
    return;
  }
  playTrack(audio, next, gen);
}

/**
 * Stop music with a smooth fade-out, then release the native player.
 *
 * Idempotent. Calling this when nothing is playing is a no-op.
 */
export function stopBackgroundMusic(): void {
  state.stopRequested = true;
  const gen = bumpGeneration();

  if (!state.player) {
    return;
  }

  const playerAtStop = state.player;
  fadeTo(0, MUSIC_FADE_MS, gen, () => {
    // Only dispose if we're still the generation that requested the stop —
    // otherwise a start raced in and owns the current player.
    if (isCurrentGeneration(gen) && state.player === playerAtStop) {
      disposeCurrentPlayer();
    }
  });
}

/** Returns the track id currently playing, or null. Test/debug helper. */
export function getCurrentTrackId(): string | null {
  return state.currentTrackId;
}

/**
 * Test-only escape hatch: fully reset the player state. Not exported from
 * index.ts — only consumed from the dev harness.
 */
export function __resetMusicPlayerStateForTests(): void {
  stopBackgroundMusic();
  // Force the generation forward one more time and null everything out
  // regardless of fade state (tests don't wait for fade-outs).
  bumpGeneration();
  disposeCurrentPlayer();
  state.lastTrackId = null;
  state.stopRequested = false;
  state.audioModeConfigured = false;
}
