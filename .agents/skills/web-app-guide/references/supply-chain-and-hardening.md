# Supply Chain Security, Hardening, and Threat Modeling

## Subresource Integrity (SRI)

When loading external scripts or stylesheets from CDNs, SRI ensures the browser rejects
tampered resources:

```html
<script
  src="https://cdn.example.com/lib.js"
  integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8w"
  crossorigin="anonymous">
</script>
```

How it works:
1. Generate a hash of the expected file content
2. Browser downloads the file and computes the hash
3. If hashes don't match, the browser refuses to execute/render the resource

When to use: Any `<script>` or `<link>` tag pointing to a third-party CDN.
When to skip: Self-hosted assets (you control the content) or dynamically-generated resources.

Generate hashes: `openssl dgst -sha384 -binary file.js | openssl base64 -A`

Source: MDN Subresource Integrity

## CSRF (Cross-Site Request Forgery)

If the browser sends credentials (cookies) automatically with requests, state-changing
endpoints need CSRF protection.

### Defense Strategies

1. **SameSite cookies (Lax or Strict):** The simplest defense. `SameSite=Lax` blocks cross-site
   POST requests with cookies. This is the browser default in most modern browsers.

2. **CSRF tokens:** Generate a unique token per session, embed it in forms, verify on the server.
   Still useful for older browser support or when SameSite isn't sufficient.

3. **Double-submit cookie:** Send the CSRF token both as a cookie and in a request header.
   The server verifies they match. Works without server-side state.

4. **Origin header check:** Verify the `Origin` header matches your domain on state-changing requests.

### Canopy Trove Status

Canopy Trove uses Bearer token auth (not cookies), so CSRF is not currently a concern.
If cookies are ever added for session management, CSRF defenses become necessary.

Source: MDN CSRF prevention

## Advanced Security Headers

### COOP (Cross-Origin-Opener-Policy)

Controls whether other windows can get a reference to your window:

```
Cross-Origin-Opener-Policy: same-origin
```

This prevents:
- Other windows from accessing `window.opener`
- Spectre-class side-channel attacks via shared browsing context groups
- Pop-under attacks that manipulate the opener window

Source: MDN COOP

### COEP (Cross-Origin-Embedder-Policy)

Controls which cross-origin resources your page can load:

```
Cross-Origin-Embedder-Policy: require-corp
```

When set, all cross-origin resources must explicitly opt in (via CORP header or CORS).
Required for SharedArrayBuffer and high-resolution timers.

Source: MDN COEP

### CORP (Cross-Origin-Resource-Policy)

Controls which origins can embed your resources:

```
Cross-Origin-Resource-Policy: same-origin
```

Options: `same-origin`, `same-site`, `cross-origin`
Prevents your images, scripts, or API responses from being loaded by unrelated sites.

Source: MDN CORP

### Permissions-Policy (Feature-Policy successor)

Controls which browser features are available:

```
Permissions-Policy: camera=(), microphone=(), geolocation=(self)
```

Canopy Trove's backend already sets this header. Review which features are actually needed:
- `geolocation=(self)` — needed for nearby dispensary finding
- `camera=()` — could be `(self)` if in-browser camera is used for review photos
- `microphone=()` — not needed

Source: MDN Permissions Policy

## File Upload Security

If users upload files (review photos, profile images), treat uploads as hostile:

### Server-Side Validation Checklist

- [ ] **Extension allowlist:** Only accept known-good extensions (.jpg, .jpeg, .png, .gif, .webp)
- [ ] **MIME verification:** Don't trust `Content-Type` from the client. Verify magic bytes server-side.
- [ ] **Generated filenames:** Never use the client-provided filename. Generate a UUID or hash.
- [ ] **Size limits:** Enforce maximum file size server-side (not just client-side validation)
- [ ] **Storage location:** Store outside the web root. Serve via a CDN or signed URL.
- [ ] **Image processing:** Re-encode uploaded images to strip EXIF data (location, device info)
- [ ] **Malware scanning:** Consider ClamAV or similar for user-uploaded content at scale
- [ ] **CSRF on upload endpoints:** If using cookies, protect upload endpoints from CSRF

### Canopy Trove Considerations

Review photo uploads go through the backend with Zod validation. Verify:
- File size limits are enforced server-side
- Filenames are generated, not user-provided
- EXIF stripping happens before storage (user location data in photos is a privacy risk)

Sources: OWASP File Upload Cheat Sheet, OWASP Input Validation Cheat Sheet

## Server-Side Request Forgery (SSRF)

If your backend fetches URLs (e.g., from user input or webhooks):

- Never fetch arbitrary user-provided URLs without validation
- Allowlist target domains and IP ranges
- Block internal/private IP ranges (127.0.0.1, 10.x, 172.16-31.x, 169.254.x, etc.)
- Set timeouts on outbound requests
- Don't return raw response bodies to the client

### Canopy Trove Relevance

The GIPHY gateway endpoint fetches from GIPHY's API — this is safe because the target is
hardcoded. The Google Places API gateway is similarly safe. Risk would increase if any endpoint
allows user-controlled URLs.

Source: OWASP SSRF Prevention Cheat Sheet

## Authorization Design

### Core Principles

- **Deny by default:** If no explicit grant exists, deny access
- **Object-level authorization:** Check that the authenticated user owns/can access the specific
  resource, not just that they're logged in
- **Validate on every request:** Don't cache authorization decisions client-side
- **Test authorization paths directly:** Write tests that verify unauthorized users can't access
  resources that belong to others (IDOR prevention)

### Common Failures (IDOR)

Insecure Direct Object Reference (IDOR) is when a user can change an ID in the request
to access someone else's data:

```
GET /api/profiles/user-123/reviews    ← my reviews
GET /api/profiles/user-456/reviews    ← someone else's reviews (should be blocked)
```

Canopy Trove's `ensureProfileReadAccess` and `ensureProfileWriteAccess` middleware handle this.
Verify the pattern is applied consistently across all resource endpoints.

Sources: OWASP Authorization Cheat Sheet, OWASP IDOR Prevention

## API Abuse Protection

Rate limiting is the first line, but comprehensive API protection includes:

- **Pagination bounds:** Cap page size (e.g., max 100 items per request)
- **Query complexity limits:** If using GraphQL, enforce depth and cost limits
- **Request body size limits:** Reject oversized payloads before parsing
- **Field-level validation:** Don't just validate types — validate ranges, lengths, and formats
- **Abuse detection:** Track patterns beyond simple rate counting (e.g., enumeration, scraping)
- **Response size limits:** Don't return unlimited data in list endpoints

Sources: OWASP GraphQL Security, OWASP Serverless/FaaS Security

## Threat Modeling

Both NIST and OWASP recommend threat modeling as part of the engineering process.

### STRIDE Framework

For each component/boundary in your system, ask:

| Threat | Question | Example |
|--------|----------|---------|
| **S**poofing | Can someone pretend to be someone else? | Fake auth tokens |
| **T**ampering | Can someone modify data in transit or at rest? | Modify review content |
| **R**epudiation | Can someone deny they took an action? | Delete audit logs |
| **I**nformation Disclosure | Can someone see data they shouldn't? | Leaking user emails |
| **D**enial of Service | Can someone make the system unavailable? | API flooding |
| **E**levation of Privilege | Can someone gain unauthorized access? | Regular user → admin |

### When to Threat Model

- Before launching a new feature that handles user data
- When adding a new API endpoint or integration
- When changing authentication or authorization logic
- After a security incident (update the model with new learnings)
- On any significant architecture change

### Canopy Trove Trust Boundaries

Key boundaries to review:
1. Browser ↔ Firebase Hosting (static assets)
2. Browser ↔ Cloud Run API (authenticated requests)
3. Cloud Run API ↔ Firestore (service account access)
4. Cloud Run API ↔ Google Places API (backend gateway)
5. Cloud Run API ↔ GIPHY API (backend gateway)
6. Cloud Run API ↔ Stripe (webhooks + API calls)

Sources: NIST minimum code verification, OWASP Secure Code Review, NIST LINDDUN reference

## Secrets Management

- Never hardcode secrets in source code
- Use environment variables or a secret manager (Google Secret Manager for Cloud Run)
- Rotate secrets on a regular schedule
- Audit who can access secrets
- Minimize the blast radius: each service gets only the secrets it needs
- Log secret access events

Canopy Trove uses Google Secret Manager for API keys on Cloud Run and `.env` files for
local development. Verify `.env` files are in `.gitignore`.

Source: OWASP Secrets Management Cheat Sheet
