# Apple Root CAs

These public certificates are bundled in the backend Docker image so
SignedDataVerifier can verify Apple App Store Server Notifications V2
signatures.

To refresh: run `node backend/scripts/fetch-apple-root-cas.mjs` from
the repo root and commit the updated files.

Source: https://www.apple.com/certificateauthority/
