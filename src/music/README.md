# Background music

Soft ambient background music for Canopy Trove. On by default for guests and
members; automatically paused when an owner is signed in. A switch on the
profile screen lets anyone (including pre-auth visitors) turn it off.

## Install the dependency

The player uses `expo-audio`. It's already listed in `package.json`, but run
the Expo installer once after pulling this change so the native side gets
linked:

```bash
npx expo install expo-audio
```

Then rebuild the dev/preview client (EAS) — this adds the iOS background-audio
capability and the `expo-audio` native module. A plain OTA update is not
enough for the first install; the capability has to land in a new native
build. The `app.json` already has:

- `ios.infoPlist.UIBackgroundModes: ["audio"]` — so music keeps playing when
  the user switches to Maps / navigation / background.
- `expo-audio` in `plugins`.

## Files

| File | Role |
| --- | --- |
| `musicManifest.ts` | Track list + default volume + fade duration. Add new songs here. |
| `musicPlayerService.ts` | Imperative wrapper around `expo-audio`: random shuffle, fade in/out, finish-advance loop. |
| `musicPreferenceStorage.ts` | Reads/writes the on/off toggle to AsyncStorage. |
| `MusicPlayerContext.tsx` | Provider + `useMusicPlayer()` hook. Handles owner suppression and app-state resume. |
| `MusicToggleRow.tsx` | Profile-screen row with a description + Switch. |
| `index.ts` | Barrel exports. |

## Adding more songs

1. Drop the MP3 into `assets/music/<kebab-case-name>.mp3`.
2. Append a new entry to `backgroundTracks` in `musicManifest.ts`:

```ts
{
  id: 'your-new-track',
  title: 'Your New Track',
  mood: 'chill',
  source: require('../../assets/music/your-new-track.mp3'),
},
```

The player picks tracks at random from the manifest (never the same track
twice in a row as long as there are ≥2 tracks).

## Tweaking volume / fade

Defaults live in `musicManifest.ts`:

- `DEFAULT_MUSIC_VOLUME = 0.28` — soft enough to not drown out speech.
- `MUSIC_FADE_MS = 900` — fade in on start / fade out on stop.

You can also pass a different volume to `<MusicPlayerProvider volume={0.2} />`
if you want a quieter mix in a specific build.

## How owner suppression works

`MusicPlayerContext` reads:

- `useStorefrontProfileController().authSession` — the current auth state.
- `useOwnerPortalAccessState(authSession)` — whether the signed-in account
  is allowlisted as a Canopy Trove owner.

When `authSession.status === 'authenticated'` AND `accessState.allowlisted`
(and the role check has finished), `isSuppressed` flips to `true` and
playback is paused via a smooth fade. The user's toggle preference is NOT
changed — so when they sign out again, music resumes automatically.

## Notes on web and tests

The service dynamically `require`s `expo-audio`, so web and unit-test
environments where the native module isn't present silently no-op (you'll
see a dev-only warning). `App.test.tsx` mocks `MusicPlayerProvider` to a
passthrough to avoid touching audio internals.
