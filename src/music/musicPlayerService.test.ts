import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const audioMocks = vi.hoisted(() => {
  type PlaybackStatus = {
    isLoaded?: boolean;
    didJustFinish?: boolean;
    playing?: boolean;
    duration?: number;
    currentTime?: number;
  };
  type PlaybackListener = (status: PlaybackStatus) => void;
  type MockPlayer = {
    source: unknown;
    volume: number;
    currentTime: number;
    duration: number;
    playing: boolean;
    isLoaded: boolean;
    loop?: boolean;
    play: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    addListener: ReturnType<typeof vi.fn>;
    emitStatus: (status: PlaybackStatus) => void;
  };

  const players: MockPlayer[] = [];
  const setAudioModeAsync = vi.fn(async (): Promise<void> => undefined);
  const createAudioPlayer = vi.fn((source: unknown) => {
    const listeners: PlaybackListener[] = [];
    const player: MockPlayer = {
      source,
      volume: 1,
      currentTime: 0,
      duration: 0,
      playing: false,
      isLoaded: true,
      play: vi.fn(() => {
        player.playing = true;
      }),
      pause: vi.fn(() => {
        player.playing = false;
      }),
      remove: vi.fn(),
      addListener: vi.fn((_event: string, listener: PlaybackListener) => {
        listeners.push(listener);
        return {
          remove: vi.fn(() => {
            const index = listeners.indexOf(listener);
            if (index >= 0) {
              listeners.splice(index, 1);
            }
          }),
        };
      }),
      emitStatus: (status) => {
        for (const listener of [...listeners]) {
          listener(status);
        }
      },
    };
    players.push(player);
    return player;
  });

  return {
    players,
    createAudioPlayer,
    setAudioModeAsync,
    reset: () => {
      players.length = 0;
      createAudioPlayer.mockClear();
      setAudioModeAsync.mockReset();
      setAudioModeAsync.mockImplementation(async (): Promise<void> => undefined);
    },
  };
});

vi.mock('react-native', () => ({
  Platform: {
    OS: 'ios' as const,
    select: (options: Record<string, unknown>) => options.ios ?? options.default,
  },
}));

vi.mock('./musicManifest', () => ({
  DEFAULT_MUSIC_VOLUME: 0.28,
  MUSIC_FADE_MS: 120,
  backgroundTracks: [
    { id: 'track-a', title: 'Track A', mood: 'test', source: { uri: 'track-a.mp3' } },
    { id: 'track-b', title: 'Track B', mood: 'test', source: { uri: 'track-b.mp3' } },
    { id: 'track-c', title: 'Track C', mood: 'test', source: { uri: 'track-c.mp3' } },
  ],
}));

async function loadService() {
  const service = await import('./musicPlayerService');
  type TestAudioModule = NonNullable<Parameters<typeof service.__setExpoAudioModuleForTests>[0]>;
  const audioModule: TestAudioModule = {
    createAudioPlayer:
      audioMocks.createAudioPlayer as unknown as TestAudioModule['createAudioPlayer'],
    setAudioModeAsync: audioMocks.setAudioModeAsync,
  };
  service.__setExpoAudioModuleForTests(audioModule);
  return service;
}

describe('musicPlayerService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    audioMocks.reset();
  });

  afterEach(async () => {
    const service = await loadService();
    service.__resetMusicPlayerStateForTests();
    service.__setExpoAudioModuleForTests(undefined);
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('native-loops the current track so missed finish events cannot leave silence', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const service = await loadService();

    await service.startBackgroundMusic(0.35);

    expect(audioMocks.setAudioModeAsync).toHaveBeenCalledWith({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      allowsRecording: false,
    });
    expect(audioMocks.createAudioPlayer).toHaveBeenCalledTimes(1);
    expect(audioMocks.players[0]?.loop).toBe(true);
    expect(audioMocks.players[0]?.play).toHaveBeenCalledTimes(1);
    expect(service.getCurrentTrackId()).toBe('track-a');
  });

  it('does not resurrect playback when stop wins a start/configure race', async () => {
    let resolveAudioMode!: () => void;
    audioMocks.setAudioModeAsync.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveAudioMode = resolve;
        }),
    );
    const service = await loadService();

    const startPromise = service.startBackgroundMusic();
    service.stopBackgroundMusic();
    resolveAudioMode();
    await startPromise;

    expect(audioMocks.createAudioPlayer).not.toHaveBeenCalled();
    expect(service.getCurrentTrackId()).toBeNull();
  });

  it('watchdog advances when expo-audio does not emit didJustFinish', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const service = await loadService();

    await service.startBackgroundMusic();
    const firstPlayer = audioMocks.players[0];
    expect(firstPlayer).toBeDefined();
    firstPlayer!.duration = 10;
    firstPlayer!.currentTime = 9.75;

    vi.advanceTimersByTime(500);

    expect(audioMocks.createAudioPlayer).toHaveBeenCalledTimes(2);
    expect(audioMocks.players[1]?.play).toHaveBeenCalledTimes(1);
    expect(service.getCurrentTrackId()).toBe('track-b');
  });
});
