# Android Smoke E2E

Purpose: a repo-native Android smoke lane that launches the built app on a connected emulator or device, captures the first visible screen, and verifies that at least one expected app marker is present.

## What It Checks

- `adb` can see a connected Android device or emulator
- the Canopy Trove app launches cleanly
- the initial UI renders one of the expected markers:
  - `Adults 21+`
  - `Before you continue`
  - `Yes, I am 21 or older`
  - `Browse`
  - `Nearby`
  - `Profile`

## Commands

- Dry run:
  - `npm run test:e2e:android:dry-run`
- Smoke run:
  - `npm run test:e2e:android:smoke`

## Optional PowerShell Flags

- Install a fresh APK before the smoke run:
  - `powershell -ExecutionPolicy Bypass -File .\scripts\run-android-smoke-e2e.ps1 -InstallApk -ApkPath "C:\path\to\preview.apk"`
- Clear app data before launch:
  - `powershell -ExecutionPolicy Bypass -File .\scripts\run-android-smoke-e2e.ps1 -ResetData`

## Outputs

- screenshot: `build-artifacts\e2e\android-smoke-<timestamp>.png`
- UI dump: `build-artifacts\e2e\android-smoke-<timestamp>.xml`

## Notes

- This is a real device/emulator smoke lane, not a full multi-step flow runner.
- It is meant to catch bad builds quickly before manual preview testing starts.
- It does not require a phone number for the current Canopy Trove flow.
