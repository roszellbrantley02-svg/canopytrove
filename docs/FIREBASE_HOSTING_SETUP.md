# Firebase Hosting Setup

This repo can publish the static public site from:

- `public-release-pages`

That includes the currently published public surfaces:

- `/`
- `/privacy`
- `/terms`
- `/community-guidelines`
- `/support`
- `/account-deletion`

## What this does

Firebase Hosting here is for the public site pages only.

It does **not** host the Express backend in `backend/`.

The backend is a separate Node/Express service and should move to Cloud Run if you want it on Google-managed hosting.

## One-time setup

1. Install the Firebase CLI if needed:
   - `npm install -g firebase-tools`
   - or use `npx firebase-tools ...`
2. Log in:
   - `firebase login`
3. Create or choose the Firebase project in the Firebase console.
4. Copy `.firebaserc.example` to `.firebaserc`
5. Replace `your-firebase-project-id` with the real Firebase project id

## Local preview

From the repo root:

```powershell
npm run hosting:firebase:serve
```

Firebase Hosting emulator will serve the contents of `public-release-pages`.

## Deploy

From the repo root:

```powershell
npm run hosting:firebase:deploy
```

That deploys the static public site using `firebase.json`.

## Backend note

The backend already supports Cloud Run-style runtime detection through Firebase Admin application default credentials.

That means the next Google-hosted backend step should be:

1. deploy `backend/` to Cloud Run
2. set backend env vars there
3. point `api.canopytrove.com` at the Cloud Run service

Do not put backend secrets like `OPENAI_API_KEY` into Firebase Hosting. Hosting is for static files, not Node runtime secrets.
