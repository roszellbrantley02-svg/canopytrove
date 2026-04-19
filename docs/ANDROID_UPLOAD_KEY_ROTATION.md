# Android Upload Key Rotation

This runbook exists because Android signing files must not live in git history.
The repo now blocks commits that stage `credentials.json`, `credentials/`, or
private signing material. Use this document when rotating the Google Play upload
key for `com.rezell.canopytrove`.

## Why rotate

Rotate the upload key immediately if any of the following happened:

- `credentials.json` or `credentials/android/keystore.jks` was committed,
  force-added, uploaded, emailed, or shared outside the machine.
- someone other than the intended operators may have had access to the private
  keystore or its passwords.

Google Play App Signing separates the Play app signing key from the upload key,
so you can reset the upload key without breaking installed users. Google states
that if the upload key is lost or compromised, you can request an upload key
reset in the Play Console. Expo documents the same recovery path for EAS-managed
credentials.

Official references:

- https://developer.android.com/guide/publishing/app-signing.html
- https://docs.expo.dev/app-signing/app-credentials/

## Local artifact generation

Generate a new upload key outside the repository:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\generate-android-upload-key.ps1
```

The script writes the artifacts under:

```text
%USERPROFILE%\.canopytrove-secrets\android-upload-key\<timestamp>\
```

Artifacts created:

- `upload-keystore.jks`
- `upload-certificate.pem`
- `metadata.json`
- `secrets.clixml`
- `next-steps.txt`

`secrets.clixml` stores the keystore passwords using Windows DPAPI for the
current user account instead of leaving them in plaintext in the repo.

To recover the generated passwords later:

```powershell
$secrets = Import-Clixml "$env:USERPROFILE\.canopytrove-secrets\android-upload-key\<timestamp>\secrets.clixml"
$storePassword = [System.Net.NetworkCredential]::new('', $secrets.keystorePassword).Password
$keyPassword = [System.Net.NetworkCredential]::new('', $secrets.keyPassword).Password
```

## Google Play reset

1. Open the Play Console for `Canopy Trove`.
2. Go to the app-level signing area described by Google as the Play App Signing
   flow.
3. Request an upload key reset.
4. Attach the generated `upload-certificate.pem`.
5. Wait for Google's reset to take effect before attempting a new Android
   submission.

Google notes that after the reset is processed, the new upload certificate may
have a delayed validity window before the first submission succeeds.

## Expo / EAS follow-up

After Google accepts the new upload certificate:

1. Run `eas credentials -p android`.
2. Replace the Android keystore stored for the project with the newly generated
   `upload-keystore.jks`.
3. Use the alias and passwords from the generated metadata plus `secrets.clixml`
   recovery snippet.
4. Build a fresh Android AAB with `eas build --platform android --profile production`.
5. Submit again with `eas submit --platform android --profile production --latest --wait`.

## Repo policy

- Do not check `credentials.json` into git.
- Do not keep private signing files under version control.
- Keep signing material outside the repository or in EAS-managed credentials.
- If a real leak happened in another clone or remote, rewrite that actual leaked
  history there before assuming this checkout is enough.
