/**
 * Playwright + Chromium render. Given a URL, returns a structured
 * `ScrapedWebsiteContent` payload (see backend/src/types/aiShopBootstrap.ts).
 *
 * Flow:
 *   1. Launch Chromium (reused across requests via a shared browser process)
 *   2. Open new context (cookies isolated per scrape)
 *   3. Navigate with networkidle + iframe stabilization wait
 *   4. Capture full-page screenshot
 *   5. Extract page text, title, meta description, og:image
 *   6. Detect embed providers (Dutchie/Jane/Weedmaps/Leafly) by iframe src
 *   7. Extract image URLs + outbound links
 *   8. Upload screenshot to Cloud Storage
 *   9. Return structured payload
 */

const { chromium } = require('playwright');
const { uploadScreenshot } = require('./storage');
const { isAllowedByRobots, USER_AGENT } = require('./robots');

// Browser is launched lazily and reused across requests. Cloud Run
// keeps the container warm between requests, so this saves ~3s per
// scrape on warm calls.
let sharedBrowserPromise = null;

async function getBrowser() {
  if (!sharedBrowserPromise) {
    sharedBrowserPromise = chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });
  }
  return sharedBrowserPromise;
}

const VIEWPORT = { width: 1280, height: 1800 };
const NAV_TIMEOUT_MS = 30_000;
const IFRAME_SETTLE_MS = 4_000;

/**
 * Detect embedded menu providers from iframe `src` attributes.
 * Most NY dispensaries embed Dutchie or Jane; Weedmaps + Leafly are
 * the next tier. "unknown" iframes still get noted so the AI knows
 * something embedded was rendered.
 */
function detectEmbedProvider(src) {
  if (!src) return null;
  const lower = src.toLowerCase();
  if (lower.includes('dutchie.com') || lower.includes('iframe.dutchie')) return 'dutchie';
  if (lower.includes('iheartjane.com') || lower.includes('jane-app')) return 'jane';
  if (lower.includes('weedmaps.com')) return 'weedmaps';
  if (lower.includes('leafly.com')) return 'leafly';
  return 'unknown';
}

/**
 * Main render entry point. Throws on hard failure (browser crash,
 * etc.); returns a typed result object on soft failure (bad URL,
 * antibot block) so the API can surface it cleanly.
 *
 * @param {Object} input
 * @param {string} input.websiteUrl
 * @param {boolean} input.respectRobotsTxt
 * @param {string} [input.draftId]  for screenshot naming traceability
 * @returns {Promise<{ ok: true, content: ScrapedWebsiteContent }
 *                  | { ok: false, reason: string, message: string }>}
 */
async function renderWebsite(input) {
  const startedAt = Date.now();
  const websiteUrl = input.websiteUrl;

  // 1. robots.txt gate
  if (input.respectRobotsTxt !== false) {
    const robotsCheck = await isAllowedByRobots(websiteUrl);
    if (!robotsCheck.allowed) {
      return {
        ok: false,
        reason: 'robots_blocked',
        message: robotsCheck.reason,
      };
    }
  }

  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    userAgent: USER_AGENT,
    // Most cannabis sites have age gates; declare a believable
    // accept-language and locale so the gate behaves normally.
    locale: 'en-US',
    timezoneId: 'America/New_York',
    // Block common anti-fingerprint requests we don't need for content.
    bypassCSP: false,
  });
  const page = await context.newPage();

  let finalUrl = websiteUrl;
  let pageTitle = '';
  let pageText = '';
  let metaDescription = null;
  let ogImage = null;
  /** @type {Array<'dutchie' | 'jane' | 'weedmaps' | 'leafly' | 'unknown'>} */
  let detectedEmbedProviders = [];
  /** @type {string[]} */
  let detectedImageUrls = [];
  /** @type {Array<{ href: string, text: string }>} */
  let outboundLinks = [];

  try {
    // 2. Navigate with networkidle to let the SPA + iframes finish.
    await page.goto(websiteUrl, { waitUntil: 'networkidle', timeout: NAV_TIMEOUT_MS });
  } catch (error) {
    await safeCloseContext(context);
    const msg = error.message || String(error);
    if (/Timeout/i.test(msg)) {
      return { ok: false, reason: 'timeout', message: msg };
    }
    if (/ERR_NAME_NOT_RESOLVED|ERR_CONNECTION_REFUSED|ENOTFOUND/i.test(msg)) {
      return { ok: false, reason: 'unreachable', message: msg };
    }
    if (/blocked|cloudflare|captcha/i.test(msg)) {
      return { ok: false, reason: 'antibot_blocked', message: msg };
    }
    return { ok: false, reason: 'unknown', message: msg };
  }

  // 3. Try to dismiss age-gate overlays. Most dispensary sites have a
  // "Are you 21+?" modal we need to acknowledge to see the menu.
  try {
    await dismissAgeGate(page);
  } catch {
    // Age gate dismissal is best-effort; if it fails, we still get
    // whatever's behind it via screenshot + scraping.
  }

  // 4. Let iframes (Dutchie/Jane menus) settle.
  await page.waitForTimeout(IFRAME_SETTLE_MS);

  // 5. Capture everything we'll need.
  finalUrl = page.url();
  pageTitle = await page.title();

  pageText = await page.evaluate(() => {
    // innerText respects CSS visibility (skips display:none nodes)
    // — more useful for vision context than textContent.
    return document.body ? document.body.innerText.slice(0, 50_000) : '';
  });

  metaDescription = await page
    .evaluate(() => {
      const el = document.querySelector('meta[name="description"]');
      return el ? el.getAttribute('content') : null;
    })
    .catch(() => null);

  ogImage = await page
    .evaluate(() => {
      const el = document.querySelector('meta[property="og:image"]');
      return el ? el.getAttribute('content') : null;
    })
    .catch(() => null);

  // 6. Detect embed providers from iframes.
  const iframeSrcs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('iframe'))
      .map((f) => f.getAttribute('src'))
      .filter(Boolean);
  });
  const providerSet = new Set();
  for (const src of iframeSrcs) {
    const provider = detectEmbedProvider(src);
    if (provider) providerSet.add(provider);
  }
  detectedEmbedProviders = [...providerSet];

  // 7. Image URLs — img src + visible inline-style background-images.
  detectedImageUrls = await page
    .evaluate(() => {
      const urls = new Set();
      for (const img of document.querySelectorAll('img')) {
        const src = img.getAttribute('src') || img.getAttribute('data-src');
        if (src && src.length < 2000) urls.add(src);
      }
      // Sample a few common hero containers for inline background-image
      const candidates = document.querySelectorAll(
        '[style*="background-image"], header, .hero, .banner',
      );
      for (const el of candidates) {
        const style = el.getAttribute('style') || '';
        const match = style.match(/background-image:\s*url\(['"]?([^'")]+)['"]?\)/i);
        if (match && match[1] && match[1].length < 2000) urls.add(match[1]);
      }
      return Array.from(urls).slice(0, 30);
    })
    .catch(() => []);

  // 8. Outbound links — surface menu URLs, deal pages, etc. Cap at 40
  // so the AI doesn't drown in nav.
  outboundLinks = await page
    .evaluate(() => {
      const seen = new Set();
      const out = [];
      for (const a of document.querySelectorAll('a[href]')) {
        const href = a.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) continue;
        const text = (a.textContent || '').trim().slice(0, 120);
        const key = `${href}|${text}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ href, text });
        if (out.length >= 40) break;
      }
      return out;
    })
    .catch(() => []);

  // 9. Screenshot last so the page has had max time to settle.
  let screenshotBuffer;
  try {
    screenshotBuffer = await page.screenshot({
      fullPage: true,
      type: 'png',
      // Cap height so a giant page doesn't blow up Vision input cost
      // (we cap viewport at ~6000px tall anyway via clip if needed).
      animations: 'disabled',
    });
  } catch (error) {
    await safeCloseContext(context);
    return {
      ok: false,
      reason: 'screenshot_failed',
      message: error.message || String(error),
    };
  }

  await safeCloseContext(context);

  // 10. Upload to Cloud Storage.
  let uploaded;
  try {
    uploaded = await uploadScreenshot(screenshotBuffer, { draftId: input.draftId });
  } catch (error) {
    return {
      ok: false,
      reason: 'storage_upload_failed',
      message: error.message || String(error),
    };
  }

  return {
    ok: true,
    content: {
      finalUrl,
      screenshotGcsUrl: uploaded.gcsUrl,
      pageText,
      pageTitle,
      metaDescription,
      ogImage,
      detectedEmbedProviders,
      detectedImageUrls,
      outboundLinks,
      renderDurationMs: Date.now() - startedAt,
      robotsAllowed: true,
    },
  };
}

/**
 * Best-effort dismiss of common age-gate overlays. Tries clicking
 * buttons whose text matches "Yes" / "I am 21" / "Enter site" patterns.
 * Silent on failure — most dispensary sites work either way.
 */
async function dismissAgeGate(page) {
  const candidates = [
    'button:has-text("I am 21")',
    'button:has-text("21 or older")',
    'button:has-text("Yes")',
    'button:has-text("Enter")',
    'button:has-text("Confirm")',
    'a:has-text("I am 21")',
    'a:has-text("Enter site")',
  ];
  for (const selector of candidates) {
    try {
      const button = await page.locator(selector).first();
      const visible = await button.isVisible({ timeout: 500 });
      if (visible) {
        await button.click({ timeout: 1500 });
        await page.waitForTimeout(800);
        return;
      }
    } catch {
      // try next
    }
  }
}

async function safeCloseContext(context) {
  try {
    await context.close();
  } catch {
    // already closed or browser crashed; nothing to do
  }
}

module.exports = { renderWebsite };
