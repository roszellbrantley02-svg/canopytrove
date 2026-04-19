# Identity, Sessions, and Browser Storage

## Authentication — Modern Options

### Passkeys / WebAuthn

Passkeys are now a mature web option. They replace passwords with public-key cryptography tied
to the user's device (or synced via iCloud/Google Password Manager). Benefits over passwords:

- Phishing-resistant: the credential is bound to the origin — it can't be entered on a fake site
- No password reuse: each site gets a unique key pair
- No credential stuffing: there's nothing to stuff
- Better UX for returning users: biometric or device unlock instead of typing

Implementation path for a web app:
1. Use the Web Authentication API (navigator.credentials.create / .get)
2. Store the public key server-side, keyed to the user account
3. Support passkeys alongside traditional login initially — don't force migration
4. Follow Google's passkey UX guidance for clear enrollment and sign-in flows

Sources: MDN WebAuthn, MDN Passkeys, NIST SP 800-63B, Google passkey UX guidance

### Password Recovery

Reset flows are a major attack path. OWASP guidance:

- Return consistent responses for existing and non-existing accounts (prevent user enumeration)
- Use single-use expiring tokens (not "security questions")
- Don't email passwords — email a reset link with a time-limited token
- Rate-limit reset requests per account and per IP
- Log all reset attempts for audit

Source: OWASP Forgot Password Cheat Sheet

### MFA Quality

MFA helps, but not all MFA is equal:

| Method | Phishing Resistance | User Friction | Recommendation |
|--------|-------------------|---------------|----------------|
| SMS OTP | Low (SIM swap, interception) | Medium | Acceptable fallback only |
| TOTP (authenticator app) | Medium | Medium | Good default |
| Push notification | Medium | Low | Good for mobile-first apps |
| Passkey/WebAuthn | High | Low | Best option when available |
| Hardware security key | High | High | Best for high-value accounts |

Sources: OWASP MFA Cheat Sheet, NIST SP 800-63B

## Session Design

### Server-Side Sessions

- Session IDs must be cryptographically random and unpredictable
- Generate session IDs server-side, never accept client-provided IDs
- Regenerate the session ID after successful login (prevents session fixation)
- Invalidate sessions server-side on logout (don't just clear the cookie)
- Set absolute and idle timeouts — balance security vs UX

### Cookie Configuration

For apps that use cookies (not applicable to stateless JWT like Canopy Trove currently):

```
Set-Cookie: session_id=abc123;
  Secure;           /* HTTPS only */
  HttpOnly;         /* No JavaScript access */
  SameSite=Lax;     /* CSRF protection */
  Path=/;           /* Scope */
  Max-Age=3600;     /* 1 hour */
  __Host-           /* Cookie prefix: locked to origin */
```

Key flags:
- `Secure`: Only sent over HTTPS
- `HttpOnly`: Blocks `document.cookie` access (mitigates XSS token theft)
- `SameSite=Lax`: Blocks cross-site POST requests with the cookie (CSRF baseline)
- `SameSite=Strict`: Blocks all cross-site requests with the cookie (stronger but breaks some flows)
- `__Host-` prefix: Ensures the cookie is Secure, from the exact host, and Path=/

### Session Visibility and Control

Good session UX includes:
- Showing users their active sessions (device, location, last active)
- Remote session termination ("sign out all other devices")
- Careful cache cleanup on logout (no sensitive data persisted in browser cache)

Sources: OWASP Session Management Cheat Sheet, MDN Set-Cookie

## Browser Storage Strategy

### Storage Options and Limits

| Storage | Capacity | Persistence | Access | Best For |
|---------|----------|-------------|--------|----------|
| Cookies | ~4 KB per cookie | Configurable | Server + client | Auth tokens, session IDs |
| localStorage | ~5 MB | Until cleared | Client only | User preferences, small state |
| sessionStorage | ~5 MB | Tab lifetime | Client only | Tab-specific temporary data |
| IndexedDB | Large (quota-managed) | Until cleared | Client only | Structured data, offline cache |
| Cache API | Large (quota-managed) | Until cleared | Client only | HTTP response caching (service workers) |

### Quota and Eviction

Browsers cap storage tightly and vary widely on quota and eviction:
- Most browsers give 5-10 MB for localStorage per origin
- IndexedDB/Cache API share a larger quota pool (varies: 50% of disk on Chrome, 2 GB on Firefox)
- Under storage pressure, browsers will evict data from non-persistent origins
- Use `navigator.storage.estimate()` to check available quota
- Request persistent storage with `navigator.storage.persist()` for critical data

### Cross-Site Storage Constraints

Modern browsers are increasingly restricting cross-site storage:

- **State partitioning**: Third-party storage is now partitioned per first-party origin in most browsers.
  A third-party iframe on site-a.com gets different storage than the same iframe on site-b.com.
- **Storage Access API**: If your app uses cross-site embeds or federated login that needs storage
  access, you may need to use `document.requestStorageAccess()`.
- **ITP/ETP**: Safari and Firefox aggressively limit third-party cookie and storage lifetime.

If your app uses federated login (Firebase Auth with Google/Apple sign-in), these constraints
are usually handled by the auth SDK. But if you build custom cross-site features, understand
the partitioning model.

Sources: MDN Storage quotas, MDN State Partitioning, MDN Storage Access API

## Privacy Architecture

### Privacy by Design

Collect only what you need, explain why, and let users control their data:

- Minimize data collection to what's necessary for the feature
- Explain purpose at the point of collection (not buried in a privacy policy)
- Allow users to view, export, and delete their data
- Default to the most privacy-preserving option
- Anonymize or pseudonymize analytics data where possible

### Consent UX

Research shows cookie-consent burden is real and interface choices directly affect behavior:

- Don't use dark patterns (hiding "reject" behind extra clicks, pre-checked boxes)
- Make "accept" and "reject" equally easy
- Provide granular choices (analytics, marketing, functional)
- Remember consent choices — don't re-prompt on every visit
- Plain-language explanations, not legalese

Sources: ICO privacy by design, FTC privacy-by-design, "Okay, whatever" consent UX study
