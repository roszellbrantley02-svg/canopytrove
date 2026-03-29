# Local API Mode

## Purpose

Use this flow when you want the Expo app to talk to the local backend workspace instead of `mock` or direct `firebase` mode.

## Fast path

From the project root:

```powershell
npm run dev:api
```

What it does:

1. starts the backend in a separate PowerShell window
2. keeps your local app pointed at the local backend by overriding:
   - `EXPO_PUBLIC_STOREFRONT_SOURCE=api`
   - `EXPO_PUBLIC_STOREFRONT_API_BASE_URL=http://<your-machine-ip>:4100`
3. starts Expo in the current window

## Local override file

The repo now keeps release-safe app defaults in `.env`.

Use `.env.local` for machine-specific local overrides such as:

```env
EXPO_PUBLIC_OWNER_PORTAL_MONTHLY_CHECKOUT_URL=https://buy.stripe.com/test_...
EXPO_PUBLIC_OWNER_PORTAL_ANNUAL_CHECKOUT_URL=https://buy.stripe.com/test_...
```

For the local backend URL itself, prefer `npm run dev:api`. That script injects the correct local API base URL at launch time, so you do not need to pin a machine IP in `.env.local`.

## Backend modes

Default:

- backend starts in `mock` mode

Manual alternatives:

```powershell
npm run backend:mock
npm run backend:firestore
```

## Firestore mode

If you want the backend to read Firestore:

1. set backend env values
2. run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-api-dev.ps1 -BackendSource firestore
```

If Firestore config is missing or reads fail, the backend falls back to mock.

## Android emulator note

If the Android emulator cannot reach the default machine IP, override the API base URL:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-api-dev.ps1 -ApiBaseUrl http://10.0.2.2:4100
```

## Verify

In the app:

- open Profile
- check:
  - `Data source`
  - `Backend health`

On the backend:

- `GET /health`
- `GET /admin/seed-status`
