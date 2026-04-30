import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

// Generates one indexable HTML page per OCM-verified storefront under
// public-release-pages/storefronts/{slug}/index.html, plus a refreshed
// sitemap-storefronts.xml that the main sitemap can reference.
//
// Pattern mirrors scripts/generate-city-landing-pages.mjs so the storefront
// pages render with identical chrome (same shared head, header, footer,
// styles.css) and Google sees a consistent design surface across the
// dispensaries hub and the per-shop detail pages.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const storefrontDataPath = path.join(
  repoRoot,
  'src',
  'data',
  'ocmVerifiedStorefrontRecords.generated.ts',
);
const publicPagesRoot = path.join(repoRoot, 'public-release-pages');
const storefrontPagesRoot = path.join(publicPagesRoot, 'storefronts');
const sitemapPath = path.join(publicPagesRoot, 'sitemap-storefronts.xml');
const lastUpdated = new Date().toISOString().slice(0, 10);

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function loadStorefronts() {
  const source = readFileSync(storefrontDataPath, 'utf8');
  const exportMarker = source.indexOf('ocmVerifiedStorefrontRecords');
  const arrayStart = source.indexOf('[', source.indexOf('=', exportMarker));
  const arrayEnd = source.lastIndexOf('];');
  if (arrayStart === -1 || arrayEnd === -1) {
    throw new Error('Could not locate storefront record array in generated data file.');
  }
  // The generated TS file uses unquoted keys + single-quote strings (a
  // valid JS object literal but not valid JSON), so JSON.parse fails. Run
  // it through Node's vm sandbox instead — handles JS object syntax
  // natively, no eval pollution of the surrounding scope.
  const arrayCode = source.slice(arrayStart, arrayEnd + 1);
  return vm.runInNewContext(arrayCode);
}

function renderSharedHead({ title, description, canonical, appArgument }) {
  // Smart App Banner: iOS Safari surfaces a native "Get the App" prompt at
  // the top of the page when this meta tag is present. `app-argument` is
  // passed to the iOS app via Universal Link, so a Google search → Safari
  // tap → App install or Open lands the user on the same storefront the
  // page describes (canopytrove://storefronts/{slug}).
  const smartBanner = appArgument
    ? `\n    <meta name="apple-itunes-app" content="app-id=6762499234, app-argument=${escapeHtml(appArgument)}" />`
    : '';
  return `    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${escapeHtml(canonical)}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(canonical)}" />
    <meta property="og:image" content="https://canopytrove.com/media/og-image.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="https://canopytrove.com/media/og-image.png" />
    <link rel="icon" href="/favicon.ico" sizes="any" />
    <link rel="icon" href="/favicon.png" type="image/png" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />${smartBanner}
    <link rel="stylesheet" href="/styles.css" />`;
}

function renderIosBar() {
  // Page-top announcement that Canopy Trove is now on iPhone. Same visual
  // treatment as the homepage iOS bar so the brand reads consistently.
  return `      <div class="webapp-bar webapp-bar-ios" role="banner" style="background:linear-gradient(90deg,#0a3a1f,#0f5b32);">
        <div class="container webapp-bar-inner">
          <span class="webapp-bar-badge" style="background:#ffd84d;color:#1a1a1a;">NEW</span>
          <span class="webapp-bar-text">Canopy Trove is now on iPhone &mdash; download free from the App Store</span>
          <a class="webapp-bar-cta" href="https://apps.apple.com/us/app/canopy-trove/id6762499234">Download on iOS &rarr;</a>
        </div>
      </div>`;
}

function renderSharedHeader() {
  return `      <header class="topbar">
        <div class="container topbar-inner">
          <a class="brand" href="/">
            <span class="brand-mark" aria-hidden="true"></span>
            <span class="brand-copy">
              <span class="brand-title">Canopy Trove&#8482;</span>
              <span class="brand-subtitle">Where legal cannabis feels chosen.</span>
            </span>
          </a>
          <nav class="nav" aria-label="Canopy Trove public pages">
            <a class="pill-link" href="/">Home</a>
            <a class="pill-link" href="/dispensaries/">Cities</a>
            <a class="pill-link" href="/about/">About</a>
            <a class="pill-link" href="/support/">Support</a>
            <a class="button-primary nav-cta" href="https://app.canopytrove.com">Open Web App</a>
          </nav>
          <button class="nav-toggle" aria-label="Open navigation" aria-expanded="false">
            <span></span><span></span><span></span>
          </button>
        </div>
      </header>`;
}

function renderSharedFooter() {
  return `      <footer class="footer">
        <div class="container">
          <div class="footer-inner">
            <div class="footer-brand">
              <a class="brand footer-brand-link" href="/">
                <span class="brand-mark" aria-hidden="true"></span>
                <span class="brand-copy">
                  <span class="brand-title">Canopy Trove&#8482;</span>
                  <span class="brand-subtitle">Where legal cannabis feels chosen.</span>
                </span>
              </a>
              <p class="footer-descriptor">Licensed dispensary discovery for adults in New York. Real storefront details, thoughtful reviews, and a calmer route into the live app.</p>
              <p class="footer-legal">Adults 21+ where lawful. Licensed dispensaries only.</p>
              <p class="footer-copy">&#169; 2026 Canopy Trove LLC. All rights reserved.</p>
            </div>

            <nav class="footer-nav" aria-label="Browse links">
              <span class="footer-nav-label">Browse</span>
              <a href="/dispensaries/">Cities</a>
              <a href="/">Home</a>
              <a href="https://app.canopytrove.com">Live Web App</a>
              <a href="/storefronts/">Storefront Links</a>
            </nav>

            <nav class="footer-nav" aria-label="Company links">
              <span class="footer-nav-label">Company</span>
              <a href="/about/">About</a>
              <a href="/privacy/">Privacy</a>
              <a href="/terms/">Terms</a>
              <a href="/community-guidelines/">Community Guidelines</a>
            </nav>

            <div class="footer-contact">
              <span class="footer-nav-label">Contact</span>
              <a href="/support/">Support</a>
              <a href="mailto:askmehere@canopytrove.com">askmehere@canopytrove.com</a>
              <a class="button-primary footer-cta" href="https://app.canopytrove.com">Open Web App</a>
            </div>
          </div>
        </div>
      </footer>`;
}

function renderShell({ title, description, canonical, body, jsonLd, appArgument }) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
${renderSharedHead({ title, description, canonical, appArgument })}
    <script type="application/ld+json">${jsonLd}</script>
  </head>
  <body>
    <div class="page-shell">
${renderIosBar()}
${renderSharedHeader()}
      <main>
${body}
      </main>
${renderSharedFooter()}
    </div>

    <script src="/scripts.js"></script>
  </body>
</html>
`;
}

// Slug strategy: use the existing storefront `id` directly (e.g.
// `ocm-10923-garnerville-202-cannabis-co`). The id is stable, unique, and
// already used for app deep-link routing (`/storefronts/*`), so the web
// page URL matches the path the iOS Universal Link expects.
function slugFor(storefront) {
  return storefront.id;
}

function buildAddressLine(storefront) {
  const parts = [storefront.addressLine1, storefront.city, storefront.state, storefront.zip].filter(
    Boolean,
  );
  return parts.join(', ');
}

function buildFaqEntries(storefront) {
  const cityLabel = `${storefront.city}, ${storefront.state}`;
  const fullAddress = buildAddressLine(storefront);
  const hoursAnswer =
    Array.isArray(storefront.hours) && storefront.hours.length > 0
      ? storefront.hours.join('; ')
      : 'Hours have not been published yet for this storefront. Check the Open in Web App link for live status.';
  return [
    {
      question: `Is ${storefront.displayName} a licensed cannabis dispensary?`,
      answer: `Yes. ${storefront.displayName} appears in the New York Office of Cannabis Management (OCM) public dispensary registry under license ID ${storefront.licenseId}. Canopy Trove cross-references the OCM registry hourly to keep verification current.`,
    },
    {
      question: `Where is ${storefront.displayName} located?`,
      answer: `${storefront.displayName} is located at ${fullAddress}.`,
    },
    {
      question: `What time does ${storefront.displayName} open?`,
      answer: hoursAnswer,
    },
    {
      question: `How can I verify ${storefront.displayName}'s NY cannabis license?`,
      answer: `${storefront.displayName} is verified through the New York OCM public dispensary registry. You can confirm the license at cannabis.ny.gov/dispensary-location-verification or use the Verify tab inside the Canopy Trove iOS app to scan the storefront's state-issued QR placard.`,
    },
    {
      question: `Is ${storefront.displayName} open to adults 21 and older?`,
      answer: `Yes. NY OCM-licensed dispensaries are restricted to adults 21 and older. Bring a valid ID. Canopy Trove is licensed-discovery only and does not sell, deliver, or process payment for cannabis products.`,
    },
  ];
}

function buildSchemaJsonLd(storefront, canonicalUrl) {
  // The page ships TWO JSON-LD blocks merged into a single @graph: a richer
  // LocalBusiness/Store entity for the dispensary and a FAQPage for the
  // question/answer block on the page. Keeping them in one @graph means
  // Google ingests both without us needing two <script> tags.
  const storeData = {
    '@type': ['Store', 'LocalBusiness'],
    '@id': canonicalUrl,
    name: storefront.displayName,
    legalName: storefront.legalName ?? undefined,
    url: canonicalUrl,
    image: storefront.thumbnailUrl ?? 'https://canopytrove.com/media/og-image.png',
    priceRange: '$$',
    currenciesAccepted: 'USD',
    paymentAccepted: 'Cash, Debit Card',
    address: {
      '@type': 'PostalAddress',
      streetAddress: storefront.addressLine1 ?? undefined,
      addressLocality: storefront.city ?? undefined,
      addressRegion: storefront.state ?? undefined,
      postalCode: storefront.zip ?? undefined,
      addressCountry: 'US',
    },
    geo:
      storefront.coordinates &&
      storefront.coordinates.latitude !== 0 &&
      storefront.coordinates.longitude !== 0
        ? {
            '@type': 'GeoCoordinates',
            latitude: storefront.coordinates.latitude,
            longitude: storefront.coordinates.longitude,
          }
        : undefined,
    telephone: storefront.phone ?? undefined,
    sameAs: storefront.website ? [storefront.website] : undefined,
    isAccessibleForFree: true,
    publicAccess: true,
    additionalProperty: [
      {
        '@type': 'PropertyValue',
        name: 'NY OCM License Verification',
        value: storefront.licenseId,
      },
      {
        '@type': 'PropertyValue',
        name: 'Verification Source',
        value: 'New York Office of Cannabis Management public dispensary registry',
      },
      {
        '@type': 'PropertyValue',
        name: 'Minimum Age',
        value: '21',
      },
    ],
    description:
      storefront.editorialSummary ??
      `${storefront.displayName} is a New York OCM-verified licensed cannabis dispensary in ${storefront.city}, ${storefront.state}.`,
  };

  const faqData = {
    '@type': 'FAQPage',
    '@id': `${canonicalUrl}#faq`,
    mainEntity: buildFaqEntries(storefront).map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: entry.answer,
      },
    })),
  };

  const graph = {
    '@context': 'https://schema.org',
    '@graph': [storeData, faqData],
  };

  // Strip undefined values so the JSON-LD is clean.
  const cleaned = JSON.parse(JSON.stringify(graph));
  return JSON.stringify(cleaned);
}

function renderFaqSection(storefront) {
  const entries = buildFaqEntries(storefront);
  const items = entries
    .map(
      (entry) => `              <article class="section-card">
                <h3>${escapeHtml(entry.question)}</h3>
                <p>${escapeHtml(entry.answer)}</p>
              </article>`,
    )
    .join('\n');
  return `        <section class="section-block">
          <div class="container">
            <div class="section-heading">
              <p class="eyebrow">Common questions</p>
              <h2>Frequently asked about ${escapeHtml(storefront.displayName)}.</h2>
              <p>
                Quick answers to the things people search for most about NY-licensed dispensaries.
              </p>
            </div>
            <div class="content-stack">
${items}
            </div>
          </div>
        </section>`;
}

function renderHoursList(hours) {
  if (!Array.isArray(hours) || hours.length === 0) {
    return '<p class="text-muted">Hours not published yet.</p>';
  }
  const items = hours.map((line) => `              <li>${escapeHtml(line)}</li>`).join('\n');
  return `            <ul class="content-list">\n${items}\n            </ul>`;
}

function renderAmenities(amenities) {
  if (!Array.isArray(amenities) || amenities.length === 0) {
    return '';
  }
  const pills = amenities
    .map((a) => `              <span class="badge-pill">${escapeHtml(a)}</span>`)
    .join('\n');
  return `          <div class="badge-row">\n${pills}\n          </div>`;
}

// Cities that currently have their own /dispensaries/{slug}/ landing page.
// Storefronts in cities outside this set link back to the /dispensaries/
// hub instead of a 404 city URL.
const KNOWN_CITY_SLUGS = new Set([
  'new-york',
  'brooklyn',
  'bronx',
  'buffalo',
  'rochester',
  'albany',
  'syracuse',
]);

function renderStorefrontPage(storefront) {
  const slug = slugFor(storefront);
  const canonical = `https://canopytrove.com/storefronts/${slug}/`;
  const fullAddress = buildAddressLine(storefront);
  const cityLabel = `${storefront.city}, ${storefront.state}`;
  const title = `${storefront.displayName} — ${cityLabel} | Canopy Trove`;
  const description = `${storefront.displayName} is a New York OCM-verified licensed cannabis dispensary in ${cityLabel}. License: ${storefront.licenseId}. View hours, location, license verification, and reviews on Canopy Trove.`;

  const citySlug = storefront.city.toLowerCase().replace(/\s+/g, '-');
  const hasCityPage = KNOWN_CITY_SLUGS.has(citySlug);
  const cityHref = hasCityPage ? `/dispensaries/${citySlug}/` : '/dispensaries/';
  const cityCtaLabel = hasCityPage
    ? `More in ${storefront.city}`
    : 'Browse all NY dispensaries';
  const mapHref = storefront.coordinates
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        fullAddress,
      )}`
    : null;

  const phoneBlock = storefront.phone
    ? `              <div class="metric-tile">
                <strong>Phone</strong>
                <span><a class="inline-link" href="tel:${escapeHtml(
                  String(storefront.phone).replace(/[^0-9+]/g, ''),
                )}">${escapeHtml(storefront.phone)}</a></span>
              </div>`
    : '';

  const websiteBlock = storefront.website
    ? `              <div class="metric-tile">
                <strong>Website</strong>
                <span><a class="inline-link" href="${escapeHtml(
                  storefront.website,
                )}" rel="noopener nofollow ugc">${escapeHtml(
                  storefront.website.replace(/^https?:\/\//, ''),
                )}</a></span>
              </div>`
    : '';

  const mapBlock = mapHref
    ? `              <div class="metric-tile">
                <strong>Directions</strong>
                <span><a class="inline-link" href="${escapeHtml(
                  mapHref,
                )}" rel="noopener" target="_blank">Open in Google Maps</a></span>
              </div>`
    : '';

  const body = `        <section class="hero">
          <div class="container">
            <div class="hero-card">
              <div class="hero-copy">
                <p class="eyebrow"><a class="inline-link" href="/dispensaries/">Dispensaries</a> / ${
                  hasCityPage
                    ? `<a class="inline-link" href="${escapeHtml(cityHref)}">${escapeHtml(cityLabel)}</a>`
                    : escapeHtml(cityLabel)
                } / ${escapeHtml(storefront.displayName)}</p>
                <h1>${escapeHtml(storefront.displayName)}</h1>
                <p>
                  ${escapeHtml(
                    storefront.editorialSummary ??
                      `${storefront.displayName} is a New York OCM-verified licensed cannabis dispensary in ${cityLabel}.`,
                  )}
                </p>
                <p class="text-muted">${escapeHtml(fullAddress)}</p>
                <div class="hero-actions">
                  <a class="button-primary" href="https://app.canopytrove.com/storefronts/${escapeHtml(
                    slug,
                  )}">Open in Web App</a>
                  <a class="button-secondary" href="${escapeHtml(
                    cityHref,
                  )}">${escapeHtml(cityCtaLabel)}</a>
                </div>
              </div>
              <div class="hero-grid">
                <div class="metric-tile">
                  <strong>Verified Licensed</strong>
                  <span>Cross-referenced against the New York Office of Cannabis Management public dispensary registry.</span>
                </div>
                <div class="metric-tile">
                  <strong>License</strong>
                  <span>${escapeHtml(storefront.licenseId)}</span>
                </div>
                <div class="metric-tile">
                  <strong>Adults 21+</strong>
                  <span>Licensed adult-use storefront. Bring a valid ID.</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="section-block">
          <div class="container">
            <div class="section-heading">
              <p class="eyebrow">Storefront details</p>
              <h2>${escapeHtml(storefront.displayName)} at a glance.</h2>
              <p>
                Real address, hours, and license-verified status, pulled directly from the OCM public dispensary registry.
              </p>
            </div>
            <div class="hero-grid">
              <div class="metric-tile">
                <strong>Address</strong>
                <span>${escapeHtml(fullAddress)}</span>
              </div>
${[phoneBlock, websiteBlock, mapBlock].filter(Boolean).join('\n')}
            </div>
          </div>
        </section>

        <section>
          <div class="container content-grid">
            <article class="document-card">
              <h2>Hours</h2>
              <div class="document-meta">Updated: ${lastUpdated}</div>
${renderHoursList(storefront.hours)}
${renderAmenities(storefront.amenities)}
            </article>

            <aside class="sidebar">
              <div class="sidebar-card">
                <h3>License verification</h3>
                <p>This storefront appears in the official New York Office of Cannabis Management public dispensary registry.</p>
                <p><strong>Registry ID:</strong> ${escapeHtml(storefront.licenseId)}</p>
                <p><a class="inline-link" href="https://cannabis.ny.gov/dispensary-location-verification" rel="noopener" target="_blank">View OCM verification source</a></p>
              </div>

              <div class="sidebar-card">
                <h3>Open in the live app</h3>
                <p>See current hours, photos, reviews, and brand inventory in the Canopy Trove web app.</p>
                <p><a class="inline-link" href="https://app.canopytrove.com/storefronts/${escapeHtml(
                  slug,
                )}">Open ${escapeHtml(storefront.displayName)}</a></p>
              </div>

              <div class="sidebar-card">
                <h3>Adults only, where lawful</h3>
                <p>Canopy Trove is licensed-discovery only. We do not sell, deliver, or process payment for cannabis products. All purchases happen in person at the licensed dispensary.</p>
              </div>
            </aside>
          </div>
        </section>

${renderFaqSection(storefront)}`;

  return renderShell({
    title,
    description,
    canonical,
    body,
    jsonLd: buildSchemaJsonLd(storefront, canonical),
    appArgument: `canopytrove://storefronts/${slug}`,
  });
}

function writeStorefrontPage(storefront) {
  const slug = slugFor(storefront);
  const dir = path.join(storefrontPagesRoot, slug);
  mkdirSync(dir, { recursive: true });
  const html = renderStorefrontPage(storefront);
  writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
}

function writeStorefrontSitemap(storefronts) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = storefronts
    .map(
      (storefront) => `  <url>
    <loc>https://canopytrove.com/storefronts/${slugFor(storefront)}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`,
    )
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
  writeFileSync(sitemapPath, xml, 'utf8');
}

function main() {
  const storefronts = loadStorefronts().filter(
    (record) => record && record.isVerified === true && record.routeMode === 'verified',
  );

  if (storefronts.length === 0) {
    throw new Error('No verified storefront records found. Refusing to generate empty pages.');
  }

  const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
  const limit = limitArg ? Number.parseInt(limitArg.split('=')[1], 10) : storefronts.length;
  const target = storefronts.slice(0, Math.max(0, Math.min(limit, storefronts.length)));

  if (process.argv.includes('--clean')) {
    // Wipe the existing storefronts/ directory so stale records don't linger.
    // The /storefronts/index.html deep-link fallback gets regenerated by the
    // existing build pipeline elsewhere, so we'd lose it here — preserve it.
    const fallbackPath = path.join(storefrontPagesRoot, 'index.html');
    let fallback = null;
    try {
      fallback = readFileSync(fallbackPath, 'utf8');
    } catch {
      // ignore
    }
    rmSync(storefrontPagesRoot, { recursive: true, force: true });
    mkdirSync(storefrontPagesRoot, { recursive: true });
    if (fallback) {
      writeFileSync(fallbackPath, fallback, 'utf8');
    }
  }

  for (const storefront of target) {
    writeStorefrontPage(storefront);
  }
  writeStorefrontSitemap(target);

  const skipped = storefronts.length - target.length;
  console.log(
    `Generated ${target.length} storefront pages under public-release-pages/storefronts/.${
      skipped > 0 ? ` (Skipped ${skipped} due to --limit).` : ''
    }`,
  );
  console.log(`Refreshed sitemap-storefronts.xml at ${path.relative(repoRoot, sitemapPath)}.`);
}

main();
