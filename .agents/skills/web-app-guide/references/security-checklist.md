# Security Checklist — OWASP Baseline

A practical checklist for web app security, sourced from OWASP cheat sheets.

## Transport Layer

- [ ] TLS/HTTPS on every page, every endpoint, every environment
- [ ] HSTS header enabled with long max-age
- [ ] No mixed content (HTTP resources on HTTPS pages)

Source: OWASP TLS Cheat Sheet

## Authentication

- [ ] Strong password policy enforced
- [ ] Secure password storage (bcrypt, scrypt, or Argon2)
- [ ] Multi-factor authentication available
- [ ] Account lockout or rate limiting on failed attempts
- [ ] Secure password reset flow (time-limited tokens, no info leakage)
- [ ] Prefer server-managed sessions or secure auth flows over long-lived browser tokens

Source: OWASP Authentication Cheat Sheet

## Authorization

- [ ] Enforce authorization per object/resource, not just "is logged in"
- [ ] Server-side checks on every sensitive action
- [ ] Deny by default — explicit grants only
- [ ] Validate that the authenticated user owns the resource they're accessing

Source: OWASP Authorization Cheat Sheet

## Session Management

- [ ] Session cookies use `Secure` flag
- [ ] Session cookies use `HttpOnly` flag
- [ ] Session cookies use appropriate `SameSite` setting
- [ ] Sessions expire after reasonable idle timeout
- [ ] Session ID regenerated after login
- [ ] Logout actually invalidates the session server-side

Source: OWASP Session Management Cheat Sheet

## Cross-Site Scripting (XSS)

- [ ] Output encoding on all user-supplied data rendered in HTML
- [ ] Content Security Policy (CSP) header deployed
- [ ] CSP blocks inline scripts (no `unsafe-inline` unless absolutely necessary)
- [ ] No `eval()` or `innerHTML` with user data
- [ ] User-generated content sanitized before storage and display

Sources: OWASP XSS Prevention Cheat Sheet, OWASP CSP Cheat Sheet

## HTTP Security Headers

- [ ] `Content-Security-Policy` — restricts script/style/image sources
- [ ] `Strict-Transport-Security` — forces HTTPS
- [ ] `X-Content-Type-Options: nosniff` — prevents MIME sniffing
- [ ] `X-Frame-Options: DENY` or `SAMEORIGIN` — prevents clickjacking
- [ ] `Referrer-Policy` — controls referrer leakage
- [ ] `Permissions-Policy` — restricts browser features (camera, mic, geolocation)

Source: OWASP HTTP Headers Cheat Sheet

## Input Validation

- [ ] All API payloads validated server-side (Zod, Joi, or similar)
- [ ] File upload type and size validated server-side
- [ ] No reliance on client-side validation alone
- [ ] Query parameters and path parameters sanitized

## Secrets Management

- [ ] No API keys, tokens, or credentials in frontend code
- [ ] Secrets stored in environment variables or secret manager (not git)
- [ ] Backend gateway pattern for third-party API keys
- [ ] `.env` files in `.gitignore`

## Rate Limiting

- [ ] Login endpoint rate-limited
- [ ] Signup endpoint rate-limited
- [ ] Password reset endpoint rate-limited
- [ ] API endpoints with abuse potential rate-limited
- [ ] Rate limit responses include `Retry-After` header

## Dependencies

- [ ] Dependencies pinned to known-good versions
- [ ] `npm audit` or `snyk` runs in CI
- [ ] No known critical vulnerabilities in dependency tree
- [ ] Regular dependency update schedule

## Logging and Monitoring

- [ ] Authentication events logged (login success, failure, lockout)
- [ ] Authorization failures logged
- [ ] Log entries include timestamp, user ID, IP, action
- [ ] Sensitive data NOT logged (passwords, tokens, PII)
- [ ] Alerts configured for suspicious patterns
- [ ] Sentry or equivalent for runtime error tracking

## Canopy Trove Status

Already implemented:

- Helmet.js security headers
- Backend gateway for API keys (Google Maps, GIPHY)
- Firebase Auth
- Zod request validation
- Pino structured logging
- Sentry integration
- expo-secure-store on native
- Firebase App Check

To review/strengthen:

- CSP policy specificity (is it locked down beyond Helmet defaults?)
- Rate limiting coverage on all auth endpoints
- Session/cookie hardening for web sessions
- HSTS configuration
