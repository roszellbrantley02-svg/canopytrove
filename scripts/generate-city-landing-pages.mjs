import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const storefrontDataPath = path.join(
  repoRoot,
  'src',
  'data',
  'ocmVerifiedStorefrontRecords.generated.ts',
);
const publicPagesRoot = path.join(repoRoot, 'public-release-pages');
const cityPagesRoot = path.join(publicPagesRoot, 'dispensaries');
const lastUpdated = 'April 9, 2026';

const cityConfigs = [
  {
    city: 'New York',
    slug: 'new-york',
    label: 'New York, NY',
    shortLabel: 'New York',
    intro:
      'New York, NY has the deepest Canopy Trove coverage in the state. This page gives people a direct starting point for comparing licensed storefronts in the city before they open the live web app.',
  },
  {
    city: 'Brooklyn',
    slug: 'brooklyn',
    label: 'Brooklyn, NY',
    shortLabel: 'Brooklyn',
    intro:
      'Brooklyn has one of the strongest storefront clusters in the state. This landing page helps people move from broad cannabis intent into a calmer licensed-dispensary comparison flow.',
  },
  {
    city: 'Bronx',
    slug: 'bronx',
    label: 'Bronx, NY',
    shortLabel: 'Bronx',
    intro:
      'Bronx storefront coverage is already large enough to support its own search landing page. The goal here is straightforward local intent: who is licensed, where they are, and where to go next.',
  },
  {
    city: 'Buffalo',
    slug: 'buffalo',
    label: 'Buffalo, NY',
    shortLabel: 'Buffalo',
    intro:
      'Buffalo gives Canopy Trove a strong upstate search surface. This page is designed for people looking for real licensed storefronts in Western New York without forcing them through a generic national marketplace pitch.',
  },
  {
    city: 'Rochester',
    slug: 'rochester',
    label: 'Rochester, NY',
    shortLabel: 'Rochester',
    intro:
      'Rochester already has enough verified storefront coverage to justify a direct city page. This page keeps the message simple: licensed storefronts, real details, and a clean jump into the live app.',
  },
  {
    city: 'Albany',
    slug: 'albany',
    label: 'Albany, NY',
    shortLabel: 'Albany',
    intro:
      'Albany is one of the clearest capital-region entry points for the product. This landing page is meant to capture city-level search intent and push that traffic into the real storefront experience.',
  },
  {
    city: 'Syracuse',
    slug: 'syracuse',
    label: 'Syracuse, NY',
    shortLabel: 'Syracuse',
    intro:
      'Syracuse rounds out the first set of city pages with a focused Central New York entry point. It keeps the public story centered on licensed discovery and real storefront comparison.',
  },
];

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(value);
}

function loadStorefronts() {
  const source = readFileSync(storefrontDataPath, 'utf8');
  const exportMarker = source.indexOf('ocmVerifiedStorefrontRecords');
  const arrayStart = source.indexOf('[', source.indexOf('=', exportMarker));
  const arrayEnd = source.lastIndexOf('];');
  if (arrayStart === -1 || arrayEnd === -1) {
    throw new Error('Could not locate storefront record array in generated data file.');
  }

  return JSON.parse(source.slice(arrayStart, arrayEnd + 1));
}

function renderSharedHead({ title, description, canonical }) {
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
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="stylesheet" href="/styles.css" />`;
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
              <a href="mailto:support@canopytrove.com">support@canopytrove.com</a>
              <a class="button-primary footer-cta" href="https://app.canopytrove.com">Open Web App</a>
            </div>
          </div>
        </div>
      </footer>`;
}

function renderShell({ title, description, canonical, body }) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
${renderSharedHead({ title, description, canonical })}
  </head>
  <body>
    <div class="page-shell">
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

function renderCityCard(cityData) {
  const names = cityData.sampleNames.slice(0, 3).join(', ');
  return `              <a class="link-card" href="/dispensaries/${cityData.slug}/">
                <h3>${escapeHtml(cityData.shortLabel)}</h3>
                <p>Browse ${formatNumber(cityData.count)} licensed dispensaries in ${escapeHtml(cityData.label)} with real hours, reviews, and storefront links.</p>
                <p><strong>Examples:</strong> ${escapeHtml(names)}</p>
                <span class="cta-text">Open ${escapeHtml(cityData.shortLabel)} page</span>
              </a>`;
}

function renderHubPage(cityPages, statewideTotal) {
  const cards = cityPages.map(renderCityCard).join('\n');
  const topCities = cityPages
    .map(
      (cityPage) =>
        `<li><a class="inline-link" href="/dispensaries/${cityPage.slug}/">${escapeHtml(cityPage.label)}</a> — ${formatNumber(cityPage.count)} storefronts</li>`,
    )
    .join('\n');

  const body = `        <section class="hero">
          <div class="container">
            <div class="hero-card">
              <div class="hero-copy">
                <p class="eyebrow">Browse by city</p>
                <h1>Licensed dispensaries in New York by city.</h1>
                <p>
                  Canopy Trove already tracks ${formatNumber(statewideTotal)} OCM-verified storefronts across New York. These city landing pages create direct entry points for the places where coverage is already strongest.
                </p>
                <div class="hero-actions">
                  <a class="button-primary" href="https://app.canopytrove.com">Open Live Web App</a>
                  <a class="button-secondary" href="/">Return Home</a>
                </div>
              </div>
              <div class="hero-grid">
                <div class="metric-tile">
                  <strong>${formatNumber(statewideTotal)} verified storefronts</strong>
                  <span>Current New York statewide storefront count from the OCM verification feed.</span>
                </div>
                <div class="metric-tile">
                  <strong>${formatNumber(cityPages.length)} city pages live</strong>
                  <span>Focused city-level entry points tied to the strongest current coverage areas.</span>
                </div>
                <div class="metric-tile">
                  <strong>Search intent, not filler</strong>
                  <span>Each page is built from live storefront records so the public site can target local searches with real inventory behind it.</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="section-block">
          <div class="container">
            <div class="section-heading">
              <p class="eyebrow">City pages</p>
              <h2>Start with the places where the product already has depth.</h2>
              <p>
                These are the first city pages because they already have meaningful storefront coverage and real local search value.
              </p>
            </div>

            <div class="link-grid">
${cards}
            </div>
          </div>
        </section>

        <section>
          <div class="container content-grid">
            <article class="document-card">
              <h2>How to use these pages</h2>
              <div class="document-meta">Updated: ${lastUpdated}</div>
              <div class="content-stack">
                <section class="section-card">
                  <h2>What the city hub is for</h2>
                  <p>
                    The marketing site only had a handful of indexable pages before this. The city hub gives Google more public entry points tied to real storefront data instead of relying only on the app shell to rank.
                  </p>
                </section>

                <section class="section-card">
                  <h2>What happens next</h2>
                  <p>
                    As new cities build enough depth, they can be added to this hub without rewriting the entire public site. The app stays the product surface; these pages just make it easier for people to discover it from search.
                  </p>
                </section>
              </div>
            </article>

            <aside class="sidebar">
              <div class="sidebar-card">
                <h3>Current city coverage</h3>
                <ul>
${topCities}
                </ul>
              </div>

              <div class="sidebar-card">
                <h3>Next step</h3>
                <p>
                  Ready to browse the live data instead of the city summaries?
                </p>
                <p><a class="inline-link" href="https://app.canopytrove.com">Open the Canopy Trove web app</a></p>
              </div>
            </aside>
          </div>
        </section>`;

  return renderShell({
    title: 'Licensed Dispensaries in New York by City | Canopy Trove',
    description:
      'Browse licensed dispensaries in New York by city. Explore real storefront coverage for New York, Brooklyn, Bronx, Buffalo, Rochester, Albany, and Syracuse.',
    canonical: 'https://canopytrove.com/dispensaries/',
    body,
  });
}

function renderCityPage(cityPage, cityPages, statewideTotal) {
  const otherCities = cityPages
    .filter((otherCity) => otherCity.slug !== cityPage.slug)
    .map(
      (otherCity) =>
        `                  <a href="/dispensaries/${otherCity.slug}/">${escapeHtml(otherCity.label)}</a>`,
    )
    .join('\n');

  const sampleStores = cityPage.sampleNames
    .map((name) => `                    <li>${escapeHtml(name)}</li>`)
    .join('\n');

  const featuredCards = [
    {
      title: 'Check the basics quickly',
      copy: 'These pages are tuned for people who want licensed storefronts, real hours, and direct next steps without wading through marketplace clutter first.',
    },
    {
      title: 'Move into the live app when ready',
      copy: 'Once someone is ready to compare more deeply, the city page hands them straight into the live Canopy Trove web app for browse, storefront details, and reviews.',
    },
    {
      title: 'Built from actual storefront coverage',
      copy: 'The city pages are generated from the same verified storefront dataset that powers the app, so the public story and the real product surface stay aligned.',
    },
    {
      title: 'Verify the shop or product on the spot',
      copy: 'Once you walk in, the Verify tab in the live app cross-checks the shop license against the public OCM registry and resolves product QR codes to lab Certificate of Analysis details. Anonymous by default, no sign-in.',
    },
  ]
    .map(
      (card) => `              <article class="feature-card">
                <h3>${escapeHtml(card.title)}</h3>
                <p>${escapeHtml(card.copy)}</p>
              </article>`,
    )
    .join('\n');

  const cityBrowseLink = `https://app.canopytrove.com/browse?q=${encodeURIComponent(cityPage.shortLabel)}`;
  const body = `        <section class="hero">
          <div class="container">
            <div class="hero-card">
              <div class="hero-copy">
                <p class="eyebrow"><a class="inline-link" href="/dispensaries/">Dispensaries by city</a> / ${escapeHtml(cityPage.label)}</p>
                <h1>Licensed dispensaries in ${escapeHtml(cityPage.label)}.</h1>
                <p>
                  ${escapeHtml(cityPage.intro)}
                </p>
                <div class="hero-actions">
                  <a class="button-primary" href="${escapeHtml(cityBrowseLink)}">Browse ${escapeHtml(cityPage.shortLabel)} in the Web App</a>
                  <a class="button-secondary" href="/dispensaries/">See all city pages</a>
                </div>
              </div>
              <div class="hero-grid">
                <div class="metric-tile">
                  <strong>${formatNumber(cityPage.count)} licensed storefronts</strong>
                  <span>Current Canopy Trove count for ${escapeHtml(cityPage.label)} from the verified OCM storefront dataset.</span>
                </div>
                <div class="metric-tile">
                  <strong>${formatNumber(cityPage.sampleNames.length)} examples featured</strong>
                  <span>${escapeHtml(cityPage.sampleNames.slice(0, 3).join(', '))}</span>
                </div>
                <div class="metric-tile">
                  <strong>${cityPage.coverageShare}% of statewide coverage</strong>
                  <span>${escapeHtml(cityPage.shortLabel)} already represents a meaningful share of the public New York storefront coverage tracked by Canopy Trove.</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="section-block">
          <div class="container">
            <div class="section-heading">
              <p class="eyebrow">Why this page exists</p>
              <h2>${escapeHtml(cityPage.shortLabel)} is already a real entry point for the product.</h2>
              <p>
                The public site now needs city-level pages that match actual storefront depth. ${escapeHtml(cityPage.shortLabel)} already clears that bar, so this page can compete for local licensed-dispensary searches while still routing people into the live app.
              </p>
            </div>

            <div class="feature-grid">
${featuredCards}
            </div>
          </div>
        </section>

        <section>
          <div class="container content-grid">
            <article class="document-card">
              <h2>Featured licensed dispensaries in ${escapeHtml(cityPage.label)}</h2>
              <div class="document-meta">Updated: ${lastUpdated}</div>
              <p class="document-intro">
                These example storefronts come directly from the verified New York dispensary dataset Canopy Trove already uses. They are here to make the city page concrete, not to act like a marketplace catalog.
              </p>

              <div class="content-stack">
                <section class="section-card">
                  <h2>Example storefronts</h2>
                  <ul>
${sampleStores}
                  </ul>
                </section>

                <section class="section-card">
                  <h2>What you can check next</h2>
                  <ul>
                    <li>storefront hours and whether the location appears open now</li>
                    <li>ratings, review count, and real storefront details before you choose</li>
                    <li>website and location links that move you toward the right storefront faster</li>
                  </ul>
                </section>

                <section class="section-card">
                  <h2>How this fits the bigger site</h2>
                  <p>
                    Canopy Trove currently tracks ${formatNumber(statewideTotal)} verified storefronts statewide. The city pages are the public search layer; the live web app is still where deeper browsing, storefront detail, and review exploration happen.
                  </p>
                </section>
              </div>
            </article>

            <aside class="sidebar">
              <div class="sidebar-card">
                <h3>Browse another city</h3>
                <div class="sidebar-list">
${otherCities}
                </div>
              </div>

              <div class="sidebar-card">
                <h3>Open the live app</h3>
                <p>
                  Want the real browse experience instead of the city summary?
                </p>
                <p><a class="inline-link" href="${escapeHtml(cityBrowseLink)}">Browse ${escapeHtml(cityPage.shortLabel)} in Canopy Trove</a></p>
              </div>
            </aside>
          </div>
        </section>`;

  return renderShell({
    title: `Licensed Dispensaries in ${cityPage.label} | Canopy Trove`,
    description: `Browse ${formatNumber(cityPage.count)} licensed dispensaries in ${cityPage.label}. Compare real storefront coverage and jump into the live Canopy Trove web app.`,
    canonical: `https://canopytrove.com/dispensaries/${cityPage.slug}/`,
    body,
  });
}

function main() {
  const storefronts = loadStorefronts();
  const statewideTotal = storefronts.length;

  const cityPages = cityConfigs.map((config) => {
    const matches = storefronts.filter((record) => record.city === config.city);
    if (matches.length === 0) {
      throw new Error(`No storefront records found for ${config.city}.`);
    }

    const uniqueSampleNames = [...new Set(matches.map((record) => record.displayName))].slice(0, 8);
    return {
      ...config,
      count: matches.length,
      coverageShare: Math.max(1, Math.round((matches.length / statewideTotal) * 100)),
      sampleNames: uniqueSampleNames,
    };
  });

  mkdirSync(cityPagesRoot, { recursive: true });

  const hubHtml = renderHubPage(cityPages, statewideTotal);
  writeFileSync(path.join(cityPagesRoot, 'index.html'), hubHtml, 'utf8');

  for (const cityPage of cityPages) {
    const cityDir = path.join(cityPagesRoot, cityPage.slug);
    mkdirSync(cityDir, { recursive: true });
    writeFileSync(
      path.join(cityDir, 'index.html'),
      renderCityPage(cityPage, cityPages, statewideTotal),
      'utf8',
    );
  }

  console.log(
    `Generated ${cityPages.length + 1} public dispensary landing pages in ${cityPagesRoot}`,
  );
}

main();
