/**
 * canopytrove-scraper HTTP server.
 *
 * One real endpoint: POST /render. Accepts a website URL, returns a
 * ScrapedWebsiteContent payload (or a typed failure). Service-to-
 * service auth via Cloud Run audience tokens — only canopytrove-api
 * can call this in production.
 *
 * See services/scraper/README.md for deployment notes.
 */

const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const { renderWebsite } = require('./render');

const app = express();
app.use(express.json({ limit: '128kb' }));

const PORT = process.env.PORT || 8080;

// Service-to-service auth. When deployed to Cloud Run with
// --no-allow-unauthenticated, Cloud Run itself rejects unauthenticated
// requests at the IAM layer before they reach this code. The check
// here is an additional layer for defense-in-depth (and for non-Cloud-
// Run deployments where IAM isn't in front).
//
// ALLOW_UNAUTH_RENDER=1 in env disables for local dev.
const oauthClient = new OAuth2Client();

async function requireServiceToken(req, res, next) {
  if (process.env.ALLOW_UNAUTH_RENDER === '1') {
    return next();
  }
  const auth = req.header('authorization') || '';
  const [scheme, token] = auth.split(/\s+/, 2);
  if (!token || (scheme || '').toLowerCase() !== 'bearer') {
    return res.status(401).json({ ok: false, error: 'bearer token required' });
  }
  try {
    // Cloud Run audience-token verification: the token's `aud` claim
    // must match this service's URL.
    const expectedAudience = process.env.SCRAPER_AUDIENCE || `https://${req.headers.host}`;
    const ticket = await oauthClient.verifyIdToken({
      idToken: token,
      audience: expectedAudience,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(401).json({ ok: false, error: 'invalid token payload' });
    }
    // Optional: tighten further by checking payload.email matches the
    // expected canopytrove-api service account.
    return next();
  } catch (error) {
    return res.status(401).json({
      ok: false,
      error: 'token verification failed',
      detail: error.message,
    });
  }
}

app.get('/livez', (_req, res) => res.json({ ok: true, service: 'canopytrove-scraper' }));

app.post('/render', requireServiceToken, async (req, res) => {
  const websiteUrl = typeof req.body?.websiteUrl === 'string' ? req.body.websiteUrl.trim() : '';
  if (!websiteUrl) {
    return res.status(400).json({ ok: false, error: 'websiteUrl required' });
  }
  if (!/^https?:\/\//i.test(websiteUrl)) {
    return res.status(400).json({ ok: false, error: 'websiteUrl must use http(s)' });
  }
  const respectRobotsTxt = req.body?.respectRobotsTxt !== false;
  const draftId = typeof req.body?.draftId === 'string' ? req.body.draftId : undefined;

  try {
    const result = await renderWebsite({ websiteUrl, respectRobotsTxt, draftId });
    if (!result.ok) {
      // Map soft failures to 4xx vs 5xx based on cause.
      const httpStatus =
        result.reason === 'robots_blocked' || result.reason === 'unreachable'
          ? 422
          : result.reason === 'antibot_blocked'
            ? 403
            : 502;
      return res.status(httpStatus).json(result);
    }
    return res.json(result);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[scraper] render threw for ${websiteUrl}:`, error);
    return res.status(500).json({
      ok: false,
      error: 'render threw',
      detail: error.message || String(error),
    });
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`canopytrove-scraper listening on :${PORT}`);
});
