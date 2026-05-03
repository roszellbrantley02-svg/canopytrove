# canopytrove-scraper

Headless-browser web scraper for the AI Shop Bootstrap flow. Runs as a
**separate Cloud Run service** from the main `canopytrove-api` so the
Playwright + Chromium runtime (~1.5 GB image) doesn't bloat the API.

Spec: `docs/AI_SHOP_BOOTSTRAP.md`.

## Status

**Phase 1 SCAFFOLD ONLY.** This README + Dockerfile + entrypoint stub
exist so we can iterate on the deployment shape, but the actual
Playwright render code is the next concrete chunk of work in the
phase-1 sprint.

## Responsibilities

This service has exactly one job: given a `websiteUrl`, return a
`ScrapedWebsiteContent` payload (see
`backend/src/types/aiShopBootstrap.ts`). Specifically:

1. Fetch + render the URL with Playwright + Chromium
2. Wait for iframes (Dutchie / Jane / Weedmaps / Leafly menus) to
   load and stabilize
3. Capture full-page screenshot
4. Capture all visible text (post-JS, post-iframe)
5. Detect embed providers from iframe `src` attrs
6. Capture image URLs + outbound links
7. Upload the screenshot to Cloud Storage
8. Return the structured payload

**This service does NOT interpret the page.** Interpretation happens in
the main API via Claude Sonnet 4.5 vision.

## Endpoint

```
POST /render
  Auth: Cloud Run service-to-service ID token
        (audience = the scraper service URL)
  Body: { websiteUrl: string, respectRobotsTxt: boolean }
  Returns: ScrapedWebsiteContent
```

## Why a separate service

- **Image size.** Playwright base is ~700 MB; with deps + Node it lands
  ~1.5 GB. The API service stays slim (~300 MB) for fast cold starts on
  user-facing endpoints.
- **Memory.** A scrape needs 1–2 GB peak. The API runs at 512 MB
  normally; we'd have to overprovision every API instance otherwise.
- **Concurrency.** API handles many small requests; scraper handles few
  large ones.
- **Deployment cadence.** API ships frequently; scraper rarely. Decouple
  so scraper changes can't regress the API.

## Cloud Run config (target)

```
Name:                   canopytrove-scraper
Region:                 us-east4 (same as canopytrove-api)
CPU:                    2
Memory:                 2 GiB
Min instances:          0    (cold start is OK for owner-bootstrap UX)
Max instances:          5    (cap monthly cost)
Concurrency:            1    (Playwright is not safe for concurrent renders in one container)
Timeout:                120s (90s scrape budget + 30s slack)
Service account:        canopytrove-scraper@canopy-trove.iam.gserviceaccount.com
Ingress:                INTERNAL (only canopytrove-api can call it)
Auth:                   Cloud Run IAM (no public access)
```

## Service account permissions needed

- `roles/storage.objectCreator` on the screenshots bucket
- `roles/secretmanager.secretAccessor` on `RESEND_API_KEY` (for failure
  notifications) — actually no, leave that to the API. Scraper sends
  errors back via the response, API decides what to do.

## Deployment

```
# Build + push from this dir
gcloud builds submit \
  --tag us-east4-docker.pkg.dev/canopy-trove/canopytrove-api/canopytrove-scraper:latest \
  --region=us-east4 \
  ./services/scraper

# Deploy
gcloud run deploy canopytrove-scraper \
  --image us-east4-docker.pkg.dev/canopy-trove/canopytrove-api/canopytrove-scraper:latest \
  --region us-east4 \
  --memory 2Gi \
  --cpu 2 \
  --concurrency 1 \
  --max-instances 5 \
  --timeout 120 \
  --no-allow-unauthenticated \
  --service-account canopytrove-scraper@canopy-trove.iam.gserviceaccount.com
```

## Cost estimate

Per scrape: 30s × 2 vCPU × 2 GiB ≈ $0.0008 of Cloud Run usage. Plus
~$0.0001 for the screenshot in Cloud Storage. **~$0.001 per scrape.**

500 owner bootstraps a month = $0.50 in scraper costs. Trivial.

## What's NOT here

- The render code itself (`render.ts`) — to be written in the phase-1
  sprint
- Tests — scraper-level tests need a Playwright runner, separate from
  the main backend test suite
- Anti-bot evasion (residential IPs, Cloudflare bypass) — out of scope
  for v1; we surface "site blocked us" gracefully and let the owner
  enter data manually

## Related files

- `backend/src/services/aiShopWebsiteScraperService.ts` — API-side
  client that calls this service
- `backend/src/services/aiShopBootstrapService.ts` — orchestrator that
  uses the scraper output
- `backend/src/types/aiShopBootstrap.ts` — `ScrapedWebsiteContent` type
- `docs/AI_SHOP_BOOTSTRAP.md` — full architecture spec
