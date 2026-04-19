# Backend Hardening Patterns for Canopy Trove

Research-backed best practices (2025-2026) for Node.js/Express on Cloud Run with Firestore.

## 1. Error Handling

- Custom error class hierarchy: operational errors (validation, auth) vs programmer errors (bugs)
- 4-parameter Express error middleware: `(err, req, res, next)`
- Consistent JSON responses: `{ code, message, statusCode, traceId, details }`
- `express-async-errors` package auto-wraps async route handlers
- Global handlers: `process.on('unhandledRejection')` and `process.on('uncaughtException')` → log + exit(1)
- Never expose internal details to clients; use error codes + correlation IDs

## 2. Logging (Pino + Cloud Run)

- Cloud Run auto-parses JSON on stdout as structured logs
- Use Pino for production (high-throughput), pino-pretty for dev only
- `pino-cloud-logging` for Cloud Logging integration
- PII redaction: `pino({ redact: { paths: ['password','token','secret','email'], censor: '[REDACTED]' } })`
- Correlation IDs: UUID v4 on entry, propagate via `X-Correlation-ID`, use `AsyncLocalStorage` for async context
- Log levels: error (failures), warn (latency/retry), info (business events), debug (dev only)

## 3. Rate Limiting

- Three-layer strategy: Cloud Armor (LB level) → In-memory per instance → Redis for global
- `express-rate-limit` with Redis store for cross-instance limits
- Per-user (`req.user?.id`) or per-IP (`req.ip`) keying
- 429 responses with `Retry-After` header
- Cloud Tasks queue for controlled backend throughput
- Monitor hits; adjust thresholds based on actual usage

## 4. Request Validation (Zod)

- Zod schemas with TypeScript inference: `z.infer<typeof Schema>`
- Validation middleware: `const validate = (schema) => (req, res, next) => { req.body = schema.parse(req.body); next(); }`
- Content-Type enforcement: reject non-JSON on POST/PUT/PATCH (415)
- Payload limits: `express.json({ limit: '10kb' })`
- `.trim()`, `.toLowerCase()` for string cleaning

## 5. Graceful Shutdown (Cloud Run)

- Cloud Run sends SIGTERM → 10s grace (configurable to 60s) → SIGKILL
- Shutdown sequence: stop accepting connections → close Firestore → close Redis → wait for in-flight → exit
- Use 9s timeout (1s buffer before Cloud Run kills)
- Deploy with `--cpu-throttling=false` if cleanup is CPU-intensive
- Readiness probe should return 503 immediately on SIGTERM

## 6. Health Checks

- `/livez` (liveness): Is process alive? Fast (<100ms), no DB check. Failure → restart container
- `/readyz` (readiness): Can serve traffic? Check Firestore connectivity. Failure → remove from LB
- Startup probe: Runs before liveness, allows slow init without restart loops
- Cloud Run config: liveness every 10s (3 failures), readiness every 10s (2 failures)

## 7. Caching

- HTTP: `Cache-Control: public, max-age=300` for storefront data, `private` for user data
- ETag + `If-None-Match` for conditional requests (304 Not Modified)
- In-memory LRU (`lru-cache`): max 500 items, 50MB, 5min TTL — instance-local only
- Firestore reads: paginate with `limit()`, index frequently-queried fields
- Single Firestore client instance (thread-safe, auto-pooled)

## 8. Security Headers (Helmet.js)

- `app.use(helmet())` — 15 headers in one line
- Custom CSP with report-uri for violation monitoring
- HSTS: 1 year, includeSubDomains, preload
- CORS: origin whitelist, credentials:true, maxAge:86400
- API key rotation: 30-90 days, grace period accepting old+new simultaneously

## 9. Observability

- Cloud Run auto-generates W3C `traceparent` headers → Cloud Trace
- OpenTelemetry SDK with `@google-cloud/opentelemetry-exporter-trace`
- Sentry for error tracking: 10% traces sample rate, request+tracing handlers
- Log-based metrics: Cloud Logging → count 5xx errors → alerting
- Alert thresholds: error rate >1%, P95 latency >2s, shutdown >8s, health check failures

## 10. Firestore Patterns (Named Database 'canopytrove')

- Init: `new Firestore({ projectId: 'canopy-trove', databaseId: 'canopytrove' })`
- Batch reads: up to 2000 docs per batch (more efficient than individual gets)
- Transactions: read→conditional write (atomic). Batches: atomic writes only (max 500)
- Firestore auto-retries transient errors (up to 25 retries)
- Connection pooling: automatic, reuse single client across requests
- Named DB gotchas: separate security rules, separate billing, slightly higher latency

## 11. API Versioning

- URL path versioning: `/api/v1/`, `/api/v2/`
- Deprecation headers: `Deprecation: true`, `Sunset: <date>`, `Link: <successor>`
- Backward compatibility: always add fields, never remove or rename
- 6-month deprecation window before removal

## 12. Idempotency

- `Idempotency-Key` header (client-generated UUID v4)
- Cache response (status + body) with 24hr TTL
- Redis-based store for production: `idempotent:{key}` → JSON response
- Critical for: payment processing, storefront claims, review submissions
- Handle 409 Conflict for operations already in progress

## Summary Config for Canopy Trove

| Component     | Tech                   | Key Config                   |
| ------------- | ---------------------- | ---------------------------- |
| Logging       | Pino + Cloud Logging   | JSON, PII redaction          |
| Errors        | express-async-errors   | Global handlers + middleware |
| Rate Limiting | express-rate-limit     | Per-user + Cloud Armor       |
| Validation    | Zod                    | Pre-route middleware         |
| Health        | Built-in endpoints     | /livez, /readyz              |
| Caching       | HTTP headers + LRU     | Cache-Control, ETag          |
| Security      | Helmet.js + CORS       | CSP, HSTS                    |
| Shutdown      | SIGTERM handlers       | 9s grace, close connections  |
| Tracing       | OpenTelemetry + Sentry | W3C traceparent, 10% sample  |
| Firestore     | Named DB               | 'canopytrove', batch reads   |
