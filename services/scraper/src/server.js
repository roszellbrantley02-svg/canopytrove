/**
 * canopytrove-scraper — phase-1 placeholder server.
 *
 * Returns a stub response on POST /render so we can smoke-test the
 * Cloud Run deployment + service-to-service auth before wiring up the
 * actual Playwright render logic. Real implementation goes in
 * src/render.js (next concrete chunk).
 */
const express = require('express');

const app = express();
app.use(express.json({ limit: '128kb' }));

const PORT = process.env.PORT || 8080;

app.get('/livez', (_req, res) => res.json({ ok: true }));

app.post('/render', async (req, res) => {
  const { websiteUrl } = req.body || {};
  if (!websiteUrl || typeof websiteUrl !== 'string') {
    return res.status(400).json({ ok: false, error: 'websiteUrl required' });
  }

  // TODO(phase-1): replace with real Playwright render. Plan:
  //   const { chromium } = require('playwright');
  //   const browser = await chromium.launch({ headless: true });
  //   const ctx = await browser.newContext({ viewport: { width: 1280, height: 1800 }});
  //   const page = await ctx.newPage();
  //   await page.goto(websiteUrl, { waitUntil: 'networkidle', timeout: 60000 });
  //   await page.waitForTimeout(3000); // let iframes settle
  //   const screenshot = await page.screenshot({ fullPage: true, type: 'png' });
  //   const pageText = await page.evaluate(() => document.body.innerText);
  //   const pageTitle = await page.title();
  //   ... extract iframe srcs, image URLs, outbound links ...
  //   await browser.close();
  //   ... upload screenshot to Cloud Storage, return ScrapedWebsiteContent ...
  return res.status(501).json({
    ok: false,
    error: 'render not implemented yet — phase-1 placeholder',
    phase: 'scaffold',
  });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`canopytrove-scraper listening on :${PORT}`);
});
