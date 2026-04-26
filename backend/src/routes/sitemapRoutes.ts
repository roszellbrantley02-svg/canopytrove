import { Router } from 'express';
import { logger } from '../observability/logger';

const APP_ORIGIN = 'https://app.canopytrove.com';
const SITE_ORIGIN = 'https://canopytrove.com';

/**
 * Static pages on the web app that should be indexed.
 * Priority: 1.0 = homepage, 0.8 = main sections, 0.6 = storefront pages.
 */
const STATIC_PAGES: Array<{ path: string; changefreq: string; priority: string }> = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/browse', changefreq: 'daily', priority: '0.8' },
  { path: '/nearby', changefreq: 'daily', priority: '0.8' },
  { path: '/hot-deals', changefreq: 'daily', priority: '0.8' },
  { path: '/verify', changefreq: 'daily', priority: '0.8' },
];

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function todayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

function buildCanonicalUrl(path: string): string {
  if (path === '/') {
    return `${APP_ORIGIN}/`;
  }

  return `${APP_ORIGIN}${path.endsWith('/') ? path : `${path}/`}`;
}

export const sitemapRoutes = Router();

/**
 * GET /sitemap.xml
 *
 * Generates a dynamic XML sitemap containing only the strongest public
 * landing pages. Individual storefront URLs remain crawlable, but are
 * intentionally excluded from the sitemap until they earn stronger,
 * more unique index signals.
 *
 * Cached with a 1-hour public cache header.
 */
sitemapRoutes.get('/sitemap.xml', async (_request, response) => {
  try {
    const today = todayDateString();

    const urlEntries: string[] = [];

    for (const page of STATIC_PAGES) {
      urlEntries.push(
        `  <url>`,
        `    <loc>${escapeXml(buildCanonicalUrl(page.path))}</loc>`,
        `    <lastmod>${today}</lastmod>`,
        `    <changefreq>${page.changefreq}</changefreq>`,
        `    <priority>${page.priority}</priority>`,
        `  </url>`,
      );
    }

    const xml = [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
      ...urlEntries,
      `</urlset>`,
    ].join('\n');

    response.setHeader('Content-Type', 'application/xml; charset=utf-8');
    response.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=1800');
    response.status(200).send(xml);

    logger.info('[sitemap] Served sitemap.xml', {
      staticPages: STATIC_PAGES.length,
      storefrontPages: 0,
      totalUrls: STATIC_PAGES.length,
    });
  } catch (error) {
    logger.error('[sitemap] Failed to generate sitemap', {
      error: error instanceof Error ? error.message : String(error),
    });
    response.status(500).send('<!-- Sitemap generation failed -->');
  }
});

/**
 * GET /robots.txt
 *
 * Serves a robots.txt that points crawlers to the sitemap
 * and allows full crawling of the site.
 */
sitemapRoutes.get('/robots.txt', (_request, response) => {
  const robotsTxt = [
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${APP_ORIGIN}/sitemap.xml`,
    '',
  ].join('\n');

  response.setHeader('Content-Type', 'text/plain; charset=utf-8');
  response.setHeader('Cache-Control', 'public, max-age=86400');
  response.status(200).send(robotsTxt);
});
