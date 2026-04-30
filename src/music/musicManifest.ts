/* eslint-disable @typescript-eslint/no-require-imports */
import type { AVPlaybackSource } from '../types/expoAudioShim';

/**
 * Background music track manifest.
 *
 * Adding more songs later:
 *   1. Drop the mp3 into `assets/music/<kebab-case-name>.mp3`
 *   2. Append a new entry to `backgroundTracks` below
 *   3. That's it — the player picks up the new track on the next shuffle.
 *
 * Keep file sizes reasonable (~3–5 MB each). These ship in the app bundle.
 * For big libraries, switch the `source` field to a remote URL and let
 * `expo-audio` stream it instead.
 */
export type BackgroundTrack = {
  /** Stable id (used for logging + "currently playing" UI if ever added). */
  id: string;
  /** Human-facing title. */
  title: string;
  /** Short mood / genre tag — purely informational. */
  mood: string;
  /** `require(...)`'d bundled asset, or a `{ uri: string }` remote source. */
  source: AVPlaybackSource;
};

export const backgroundTracks: BackgroundTrack[] = [
  {
    id: 'neon-cloudscape-2032',
    title: 'Neon Cloudscape 2032',
    mood: 'ambient synth',
    source: require('../../assets/music/neon-cloudscape-2032.mp3'),
  },
  {
    id: 'cloud-nine-2005',
    title: 'Cloud Nine 2005',
    mood: 'warm chill',
    source: require('../../assets/music/cloud-nine-2005.mp3'),
  },
  {
    id: 'midnight-highway-rain',
    title: 'Midnight Highway Rain',
    mood: 'nocturnal drive',
    source: require('../../assets/music/midnight-highway-rain.mp3'),
  },
  {
    id: 'freeminded',
    title: 'Freeminded',
    mood: 'open mind',
    source: require('../../assets/music/freeminded.mp3'),
  },
  {
    id: 'finding-a-deal',
    title: 'Finding a Deal',
    mood: 'city wander',
    source: require('../../assets/music/finding-a-deal.mp3'),
  },
  {
    id: 'skyline',
    title: 'Skyline',
    mood: 'elevated calm',
    source: require('../../assets/music/skyline.mp3'),
  },
  {
    id: 'afterglow',
    title: 'Afterglow',
    mood: 'post-sunset',
    source: require('../../assets/music/afterglow.mp3'),
  },
  {
    id: 'pioneer',
    title: 'Pioneer',
    mood: 'open road',
    source: require('../../assets/music/pioneer.mp3'),
  },
  {
    id: 'serene',
    title: 'Serene',
    mood: 'calm focus',
    source: require('../../assets/music/serene.mp3'),
  },
  {
    id: 'featherweight',
    title: 'Featherweight',
    mood: 'light air',
    source: require('../../assets/music/featherweight.mp3'),
  },
  {
    id: 'classified',
    title: 'Classified',
    mood: 'quiet confidence',
    source: require('../../assets/music/classified.mp3'),
  },
  {
    id: 'stealth',
    title: 'Stealth',
    mood: 'low-key',
    source: require('../../assets/music/stealth.mp3'),
  },
  {
    id: 'lakeside',
    title: 'Lakeside',
    mood: 'still water',
    source: require('../../assets/music/lakeside.mp3'),
  },
  {
    id: 'brightside',
    title: 'Brightside',
    mood: 'uplift',
    source: require('../../assets/music/brightside.mp3'),
  },
  {
    id: 'interface-flow',
    title: 'Interface Flow',
    mood: 'tech ambient',
    source: require('../../assets/music/interface-flow.mp3'),
  },
  {
    id: 'open-highway',
    title: 'Open Highway',
    mood: 'drive-time',
    source: require('../../assets/music/open-highway.mp3'),
  },
  {
    id: 'nice-day',
    title: 'Nice Day',
    mood: 'warm afternoon',
    source: require('../../assets/music/nice-day.mp3'),
  },
];

/** Soft-volume default — heightens the experience without drowning out speech. */
export const DEFAULT_MUSIC_VOLUME = 0.28;

/** Fade in/out duration when the player is toggled on/off. */
export const MUSIC_FADE_MS = 900;
