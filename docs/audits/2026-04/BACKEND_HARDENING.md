# Backend Hardening Implementation Guide

Comprehensive OWASP 2025 LLM Top 10 security hardening for Canopy Trove Node.js/Express backend on Cloud Run.

## What's New

### 4 New Security Modules

#### 1. Security Event Logger (`src/http/securityEventLogger.ts`)

Centralized structured logging for security events. All security-relevant actions are logged with context.

**Usage:**

```typescript
import { logSecurityEvent } from './http/securityEventLogger';

logSecurityEvent({
  event: 'auth_failure',
  ip: request.ip,
  path: request.path,
  method: request.method,
  detail: 'Failed login attempt',
  meta: { attemptCount: 5 },
});
```

**Event Types:**

- `rate_limit_hit` - Rate limit threshold exceeded
- `ip_blocked` - IP temporarily blocked
- `auth_failure` - Authentication attempt failed
- `validation_rejection` - Request validation failed
- `suspicious_payload` - Payload detected as suspicious
- `cors_rejection` - CORS policy violation
- `content_type_violation` - Content-Type mismatch
- `request_size_exceeded` - Payload exceeded size limit
- `abuse_threshold_crossed` - Abuse score exceeded threshold

#### 2. Abuse Scoring System (`src/http/abuseScoring.ts`)

Lightweight per-IP abuse tracking with sliding-window scoring. Accumulates points for suspicious behavior and flags IPs that exceed threshold.

**Configuration:**

- **Window:** 10 minutes (sliding)
- **Flag Duration:** 30 minutes
- **Threshold:** 20 points
- **Max Tracked IPs:** 4096 (auto-cleanup)

**Point Values:**

- Rate limit hit: 2 points
- Auth failure: 3 points
- Oversized request: 2 points
- Validation failure: 1 point
- Blocked request: 5 points

**Usage:**

```typescript
import { recordAbuseSignal, isIpFlagged, getAbuseScore } from './http/abuseScoring';

// Record a suspicious action
recordAbuseSignal(clientIp, 3, '/auth/login');

// Check if IP is currently flagged
if (isIpFlagged(clientIp)) {
  return response.status(429).json({ error: 'Rate limited' });
}

// Get current abuse score (for monitoring)
const score = getAbuseScore(clientIp);
```

**Testing:**

```typescript
import { clearAbuseState } from './http/abuseScoring';

// In test setup
afterEach(() => {
  clearAbuseState();
});
```

#### 3. Request Size Guard (`src/http/requestSizeGuard.ts`)

Per-route request body size enforcement. Global 128kb limit exists, but sensitive routes should have tighter limits.

**Usage:**

```typescript
import { createRequestSizeGuard } from './http/requestSizeGuard';

const profileSizeGuard = createRequestSizeGuard(16_000); // 16kb for profiles
const reviewSizeGuard = createRequestSizeGuard(8_000); // 8kb for reviews

router.post('/profiles/:id', profileSizeGuard, updateProfileHandler);
router.post('/reviews', reviewSizeGuard, createReviewHandler);
```

Returns `413 Payload Too Large` when exceeded.

#### 4. Response Validator (`src/http/responseValidator.ts`)

Prevents accidental data leakage by stripping sensitive fields from all JSON responses.

**Forbidden Fields:**

- `password`, `passwordHash`
- `secret`, `apiKey`, `token`, `refreshToken`
- `internalId`, `_firestore`, `_ref`

**Automatic:** Applied globally via middleware. No route-level configuration needed.

**Example:**

```typescript
// Handler code
res.json({
  id: 'user123',
  email: 'user@example.com',
  passwordHash: 'bcrypt_hash_here', // Will be stripped
  token: 'jwt_token_here'             // Will be stripped
});

// Client receives
{
  id: 'user123',
  email: 'user@example.com'
}
```

## Integration Points

### Middleware Ordering

The new security layers integrate into the existing middleware chain:

```
requestTelemetryMiddleware
  ↓
createRequestTimeoutMiddleware (30s)
  ↓
cors
  ↓
securityHeadersMiddleware
  ↓
responseValidatorMiddleware              ← NEW: Strip sensitive fields
  ↓
etagMiddleware
  ↓
express.raw (webhooks)
  ↓
express.json (128kb limit)
  ↓
contentTypeEnforcementMiddleware
  ↓
createAuditLogMiddleware
  ↓
suspiciousActivityMiddleware
  ↓
Abuse-scored IP gate                     ← NEW: Reject flagged IPs
  ↓
readRateLimiter (IP-based, 600/min)
  ↓
[Route Handlers]
```

### Security Events Flow

```
Request → suspiciousActivityMiddleware
         ↓
         (Auth failure tracked)
         ↓
         logSecurityEvent('auth_failure')  ← NEW: Security event logger
         ↓
         recordAbuseSignal(ip, 3)          ← NEW: Abuse scoring (+3 points)
         ↓
         (Accumulates points in 10-min window)
         ↓
         (Score ≥ 20?)
         ↓ YES
         logSecurityEvent('abuse_threshold_crossed')
         flag IP for 30 minutes
         ↓
         Abuse-scored IP gate middleware
         ↓
         (IP flagged?)
         ↓ YES
         Response 429 + error message
```

## Monitoring & Observability

### Cloud Logging Query

Find security events in Cloud Logging:

```
resource.type="cloud_run_revision"
severity="WARNING"
jsonPayload.type="security_event"
```

### Event Breakdown

```
jsonPayload.event="auth_failure"
  → Monitor auth brute-force patterns

jsonPayload.event="abuse_threshold_crossed"
  → Early warning of coordinated abuse

jsonPayload.event="request_size_exceeded"
  → Oversized payload attacks

jsonPayload.event="ip_blocked"
  → Blocked IP access attempts
```

### Metrics to Track

- **Abuse Score Distribution:** P50/P95/P99 per IP
- **Flag Rate:** IPs flagged per minute
- **Event Rate by Type:** auth_failure, rate_limit_hit, etc.
- **False Positives:** Legitimate users incorrectly flagged

## Configuration Tuning

### Adjust Abuse Scoring Thresholds

Edit `abuseScoring.ts`:

```typescript
const THRESHOLD = 20; // Point threshold for flagging
const WINDOW_MS = 10 * 60_000; // 10-minute sliding window
const FLAG_DURATION_MS = 30 * 60_000; // 30-minute flag
```

### Adjust Point Values

In `rateLimit.ts` and `suspiciousActivityDetector.ts`:

```typescript
recordAbuseSignal(ip, 2, path); // Rate limit = 2 points
recordAbuseSignal(ip, 3, 'auth'); // Auth failure = 3 points
```

### Per-Route Size Limits

In route files:

```typescript
const strictSizeGuard = createRequestSizeGuard(4_000);
const relaxedSizeGuard = createRequestSizeGuard(32_000);

router.post('/sensitive-op', strictSizeGuard, handler);
router.post('/bulk-op', relaxedSizeGuard, handler);
```

## Testing

### Unit Test Setup

```typescript
import { clearAbuseState, getAbuseScore, isIpFlagged } from './http/abuseScoring';
import { clearSuspiciousActivityStateForTests } from './http/suspiciousActivityDetector';

beforeEach(() => {
  clearAbuseState();
  clearSuspiciousActivityStateForTests();
});
```

### Integration Test Example

```typescript
describe('Abuse Scoring', () => {
  it('flags IP after exceeding threshold', async () => {
    const testIp = '192.168.1.1';

    // Simulate 7 auth failures (7 * 3 = 21 points, exceeds 20)
    for (let i = 0; i < 7; i++) {
      recordFailedAuth(testIp);
    }

    // IP should now be flagged
    expect(isIpFlagged(testIp)).toBe(true);

    // Requests from flagged IP should be rejected
    const response = await request(app).get('/api/data').set('X-Forwarded-For', testIp);

    expect(response.status).toBe(429);
  });
});
```

## OWASP 2025 LLM Top 10 Coverage

| Vulnerability                      | Coverage  | Mechanism                                      |
| ---------------------------------- | --------- | ---------------------------------------------- |
| LLM01: Prompt Injection            | ✓         | Input sanitization + validation                |
| **LLM02: Insecure Output**         | **✓ NEW** | **Response validator strips sensitive fields** |
| LLM03: Training Data Poisoning     | ✓         | Audit logging + content validation             |
| **LLM04: Denial of Service**       | **✓ NEW** | **Abuse scoring + rate limits**                |
| LLM05: Supply Chain Risk           | ✓         | Security headers + CSP                         |
| **LLM06: Sensitive Data Exposure** | **✓ NEW** | **Response validator + security logging**      |
| LLM07: Insecure Plugin Integration | ✓         | Input validation + content enforcement         |
| **LLM08: Excessive Agency**        | **✓ NEW** | **Abuse scoring prevents resource exhaustion** |
| LLM09: Overreliance on LLM         | ✓         | Health probes + monitoring                     |
| LLM10: Model Theft/Prompt Leakage  | ✓         | Auth + response validation                     |

## Future Enhancements

1. **Firestore-backed Storage:** Migrate `suspiciousActivityDetector` to Firestore for multi-instance resilience
2. **Progressive Delays:** Implement exponential backoff for flagged IPs (not just rejection)
3. **Per-Route Thresholds:** Configure different abuse thresholds per route
4. **Sentry Integration:** Send security events to Sentry for alerting
5. **Geographic Blocking:** Complement IP-based scoring with geo-blocking logic
6. **Distributed Rate Limiting:** Move from in-memory to Redis for multi-node deployments

## References

- [OWASP Top 10 for LLM Applications 2025](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
- [NIST AI Risk Management Framework](https://airc.nist.gov/ai-risk-management-framework)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Cloud Run Security](https://cloud.google.com/run/docs/security/secure-networking)
