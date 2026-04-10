/**
 * post-export.js — Runs after `expo export --platform web` to copy
 * additional web assets into the dist/ folder that Expo doesn't handle.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { getBuildHash } = require('./build-web-hash');

const DIST = 'dist';
const APP_ORIGIN = 'https://app.canopytrove.com';
const INDEXABLE_WEB_ROUTES = [
  {
    routePath: '/nearby',
    filePath: path.join(DIST, 'nearby', 'index.html'),
    title: 'Nearby Dispensaries Open Now | Canopy Trove',
    description:
      'Find licensed dispensaries open near you with live hours, directions, hot deals, and verified reviews across New York.',
    robots: 'index, follow',
    headline: 'Find nearby licensed dispensaries open now',
    body: 'Canopy Trove helps adults 21+ find verified New York dispensaries with live hours, directions, real reviews, and current offers.',
  },
  {
    routePath: '/browse',
    filePath: path.join(DIST, 'browse', 'index.html'),
    title: 'Browse Licensed Dispensaries in New York | Canopy Trove',
    description:
      'Browse verified New York dispensaries, compare storefront details, check hours, and find your next stop faster.',
    robots: 'index, follow',
    headline: 'Browse verified New York dispensaries',
    body: 'Compare storefront details, check live hours, and discover legal dispensaries across New York from one searchable directory.',
  },
  {
    routePath: '/hot-deals',
    filePath: path.join(DIST, 'hot-deals', 'index.html'),
    title: 'Hot Dispensary Deals in New York | Canopy Trove',
    description:
      'See live deals from licensed New York dispensaries, compare offers, and find nearby savings without leaving the web app.',
    robots: 'index, follow',
    headline: 'See live dispensary deals across New York',
    body: 'Track current offers from licensed dispensaries, compare savings, and decide where to shop before you head out.',
  },
];
const STATIC_ROUTE_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/nearby', label: 'Nearby dispensaries' },
  { href: '/browse', label: 'Browse dispensaries' },
  { href: '/hot-deals', label: 'Hot deals' },
];

function buildCanonicalUrl(routePath) {
  return routePath === '/' ? `${APP_ORIGIN}/` : `${APP_ORIGIN}${routePath}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function applyHtmlMetadata(html, { title, description, robots, canonicalUrl }) {
  return html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`)
    .replace(/<meta name="title" content="[^"]*" \/>/, `<meta name="title" content="${title}" />`)
    .replace(
      /<meta name="description" content="[^"]*" \/>/,
      `<meta name="description" content="${description}" />`,
    )
    .replace(
      /<meta name="robots" content="[^"]*" \/>/,
      `<meta name="robots" content="${robots}" />`,
    )
    .replace(
      /<link rel="canonical" href="[^"]*" \/>/,
      `<link rel="canonical" href="${canonicalUrl}" />`,
    )
    .replace(
      /<meta property="og:url" content="[^"]*" \/>/,
      `<meta property="og:url" content="${canonicalUrl}" />`,
    )
    .replace(
      /<meta property="og:title" content="[^"]*" \/>/,
      `<meta property="og:title" content="${title}" />`,
    )
    .replace(
      /<meta property="og:description" content="[^"]*" \/>/,
      `<meta property="og:description" content="${description}" />`,
    )
    .replace(
      /<meta property="twitter:url" content="[^"]*" \/>/,
      `<meta property="twitter:url" content="${canonicalUrl}" />`,
    )
    .replace(
      /<meta property="twitter:title" content="[^"]*" \/>/,
      `<meta property="twitter:title" content="${title}" />`,
    )
    .replace(
      /<meta property="twitter:description" content="[^"]*" \/>/,
      `<meta property="twitter:description" content="${description}" />`,
    );
}

function appendStructuredData(html, data) {
  const script = `    <script type="application/ld+json">\n${JSON.stringify(data, null, 2)}\n    </script>`;
  return html.replace('</head>', `${script}\n  </head>`);
}

function replaceNoScript(html, content) {
  return html.replace(
    /<noscript>[\s\S]*?<\/noscript>/,
    `<noscript>\n      ${content}\n    </noscript>`,
  );
}

function createStaticLinksMarkup(currentPath) {
  const links = STATIC_ROUTE_LINKS.map((link) => {
    const isCurrent = link.href === currentPath;
    return isCurrent
      ? `<strong>${escapeHtml(link.label)}</strong>`
      : `<a href="${link.href}">${escapeHtml(link.label)}</a>`;
  }).join(' · ');
  return `<p>${links}</p>`;
}

function buildCollectionNoScript(route) {
  return `
<section>
  <h1>${escapeHtml(route.headline)}</h1>
  <p>${escapeHtml(route.body)}</p>
  <p>${escapeHtml(route.description)}</p>
  ${createStaticLinksMarkup(route.routePath)}
</section>`.trim();
}

function buildStorefrontNoScript(record) {
  const locationLabel = `${record.city}, ${record.state} ${record.zip}`;
  const websiteMarkup = record.website
    ? `<p><a href="${escapeHtml(record.website)}">Visit the storefront website</a></p>`
    : '';
  return `
<section>
  <h1>${escapeHtml(record.displayName)}</h1>
  <p>${escapeHtml(`${record.addressLine1}, ${locationLabel}`)}</p>
  <p>${escapeHtml(
    record.editorialSummary ||
      `Verified New York dispensary listing for ${record.displayName} in ${record.city}.`,
  )}</p>
  <p>${escapeHtml(
    record.hours && record.hours.length
      ? `Hours: ${record.hours.join(' · ')}`
      : 'Hours not published yet.',
  )}</p>
  ${websiteMarkup}
  ${createStaticLinksMarkup('/browse')}
</section>`.trim();
}

function buildCollectionStructuredData(route) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: route.title,
    url: buildCanonicalUrl(route.routePath),
    description: route.description,
    isPartOf: {
      '@type': 'WebSite',
      name: 'Canopy Trove',
      url: APP_ORIGIN,
    },
  };
}

function loadGeneratedStorefrontRecords() {
  const generatedPath = path.join('src', 'data', 'ocmVerifiedStorefrontRecords.generated.ts');
  if (!fs.existsSync(generatedPath)) {
    return [];
  }

  const raw = fs.readFileSync(generatedPath, 'utf-8');
  const executable = raw
    .replace(/^import .*?;\r?\n/, '')
    .replace(
      /export const ocmVerifiedStorefrontRecords:\s*StorefrontRecord\[\]\s*=/,
      'module.exports =',
    );
  const sandbox = { module: { exports: [] }, exports: {} };
  vm.runInNewContext(executable, sandbox, { filename: generatedPath });
  return Array.isArray(sandbox.module.exports) ? sandbox.module.exports : [];
}

function buildStorefrontStructuredData(record) {
  const canonicalUrl = buildCanonicalUrl(`/storefronts/${record.id}`);
  const address = `${record.addressLine1}, ${record.city}, ${record.state} ${record.zip}`;
  const data = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: record.displayName,
    url: canonicalUrl,
    description:
      record.editorialSummary ||
      `Verified dispensary storefront listing for ${record.displayName} in ${record.city}, ${record.state}.`,
    address: {
      '@type': 'PostalAddress',
      streetAddress: record.addressLine1,
      addressLocality: record.city,
      addressRegion: record.state,
      postalCode: record.zip,
      addressCountry: 'US',
    },
    areaServed: `${record.city}, ${record.state}`,
    telephone: record.phone || undefined,
    sameAs: record.website ? [record.website] : undefined,
    openingHours: Array.isArray(record.hours) && record.hours.length ? record.hours : undefined,
    image: record.thumbnailUrl || record.photoUrls?.[0] || undefined,
    knowsAbout: ['licensed cannabis dispensary', 'dispensary deals', 'dispensary reviews'],
    additionalProperty: [
      {
        '@type': 'PropertyValue',
        name: 'Verification',
        value: 'Verified against the New York OCM public dispensary list',
      },
      {
        '@type': 'PropertyValue',
        name: 'Address',
        value: address,
      },
    ],
  };

  return JSON.parse(JSON.stringify(data));
}

function generateSitemapXml(urlEntries) {
  const today = new Date().toISOString().slice(0, 10);
  const xmlEntries = urlEntries
    .map(
      (entry) => `  <url>
    <loc>${entry.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority.toFixed(1)}</priority>
  </url>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${xmlEntries}\n</urlset>\n`;
}

// 1. Copy everything from public/ into dist/ (favicon, icons, manifest, etc.)
const publicDir = 'public';
if (fs.existsSync(publicDir)) {
  for (const file of fs.readdirSync(publicDir)) {
    fs.copyFileSync(path.join(publicDir, file), path.join(DIST, file));
    console.log(`Copied ${file} to dist/`);
  }
}

// 2. Copy web/index.html → dist/index.html (overwrite Expo's minimal shell)
const customIndex = path.join('web', 'index.html');
if (fs.existsSync(customIndex)) {
  // Merge: inject Expo's generated <script> tags into our custom HTML shell.
  const expoIndex = fs.readFileSync(path.join(DIST, 'index.html'), 'utf-8');
  const customHtml = fs.readFileSync(customIndex, 'utf-8');

  // Extract all <script ...src="..."> and <link rel="stylesheet" ...> from Expo output.
  // Expo may emit <script defer src="..."> or <script src="...">, so match any
  // script tag that has a src attribute (but skip type="application/ld+json" etc.).
  const scriptTags = expoIndex.match(/<script\s+[^>]*src="[^"]*"[^>]*><\/script>/g) || [];
  const linkTags = expoIndex.match(/<link\s+rel="stylesheet"[^>]*>/g) || [];

  // Inject Expo's JS bundles before closing </body>
  let merged = customHtml;
  if (scriptTags.length > 0) {
    const expoScripts = scriptTags.join('\n    ');
    merged = merged.replace('</body>', `    ${expoScripts}\n  </body>`);
  }

  // Inject modulepreload hints for the main JS bundle(s) into <head>.
  // This tells the browser to start fetching the bundle immediately instead
  // of waiting until the parser reaches the <script> tag at the end of <body>.
  const srcPattern = /src="([^"]+)"/;
  const preloadHints = scriptTags
    .map((tag) => {
      const match = tag.match(srcPattern);
      return match ? `<link rel="preload" href="${match[1]}" as="script" />` : null;
    })
    .filter(Boolean);
  if (preloadHints.length > 0) {
    const preloads = preloadHints.join('\n    ');
    merged = merged.replace(
      '</head>',
      `    <!-- Preload main JS bundle(s) for faster LCP -->\n    ${preloads}\n  </head>`,
    );
  }

  // Inject Expo's CSS before closing </head>
  if (linkTags.length > 0) {
    const expoStyles = linkTags.join('\n    ');
    merged = merged.replace('</head>', `    ${expoStyles}\n  </head>`);
  }

  // Inject VAPID public key from env var
  const vapidPublicKey = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY || '';
  if (vapidPublicKey) {
    merged = merged.replace(
      '<meta name="vapid-public-key" content="" />',
      `<meta name="vapid-public-key" content="${vapidPublicKey}" />`,
    );
    console.log('Injected VAPID public key into dist/index.html');
  } else {
    console.log('No EXPO_PUBLIC_VAPID_PUBLIC_KEY set — web push will be disabled');
  }

  // Inject API base URL from env var (avoids hardcoded production URLs)
  const apiBaseUrl =
    process.env.EXPO_PUBLIC_STOREFRONT_API_BASE_URL || 'https://api.canopytrove.com';
  merged = merged.replace(
    '<link rel="preconnect" href="https://api.canopytrove.com" crossorigin />',
    `<link rel="preconnect" href="${apiBaseUrl}" crossorigin />`,
  );
  merged = merged.replace(
    '<link rel="dns-prefetch" href="https://api.canopytrove.com" />',
    `<link rel="dns-prefetch" href="${apiBaseUrl}" />`,
  );

  fs.writeFileSync(path.join(DIST, 'index.html'), merged, 'utf-8');
  console.log('Merged web/index.html with Expo bundle references → dist/index.html');
} else {
  console.log('No web/index.html found — using Expo default');
}

// 2b. Preload the 2 critical font weights (body regular + heading bold) and inject
//     @font-face rules with font-display:optional + url() sources into the HTML.
//     Expo generates @font-face rules dynamically via JS; this makes fonts load
//     immediately with the HTML instead of waiting for the bundle to parse.
const CRITICAL_FONTS = {
  DMSans_400Regular: {
    family: 'DMSans_400Regular',
    pattern: 'dm-sans/400Regular/DMSans_400Regular',
  },
  SpaceGrotesk_700Bold: {
    family: 'SpaceGrotesk_700Bold',
    pattern: 'space-grotesk/700Bold/SpaceGrotesk_700Bold',
  },
};

const assetsDir = path.join(DIST, 'assets');
if (fs.existsSync(assetsDir)) {
  const allFontFiles = [];
  function walkDir(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) walkDir(fullPath);
      else if (entry.name.endsWith('.ttf')) allFontFiles.push(fullPath);
    }
  }
  walkDir(assetsDir);

  const preloads = [];
  const fontFaceRules = [];
  for (const [, config] of Object.entries(CRITICAL_FONTS)) {
    const match = allFontFiles.find((f) => f.replace(/\\/g, '/').includes(config.pattern));
    if (match) {
      const relPath = '/' + path.relative(DIST, match).replace(/\\/g, '/');
      preloads.push(
        `<link rel="preload" href="${relPath}" as="font" type="font/ttf" crossorigin />`,
      );
      fontFaceRules.push(
        `@font-face { font-family: '${config.family}'; font-display: optional; src: url('${relPath}') format('truetype'); }`,
      );
    }
  }

  if (preloads.length > 0) {
    const distIndex = path.join(DIST, 'index.html');
    let html = fs.readFileSync(distIndex, 'utf-8');

    // Inject preloads before </head>
    const preloadBlock = `    <!-- Preload critical fonts for instant rendering -->\n    ${preloads.join('\n    ')}`;
    html = html.replace('</head>', `${preloadBlock}\n  </head>`);

    // Replace the existing font-fallback style block with one that includes url() sources
    const fontFaceBlock = fontFaceRules.join('\n      ');
    html = html.replace(
      /<style id="ct-font-fallbacks">[\s\S]*?<\/style>/,
      `<style id="ct-font-fallbacks">\n      ${fontFaceBlock}\n    </style>`,
    );

    fs.writeFileSync(distIndex, html, 'utf-8');
    console.log(
      `Injected ${preloads.length} font preloads and @font-face rules with url() sources`,
    );
  }
}

// 2c. Patch Expo's JS bundle to inject font-display:optional into generated @font-face rules.
//     Expo's font loader creates @font-face rules without font-display, causing FOIT.
//     This adds font-display:optional after every `@font-face{` in the main bundle.
const jsDir = path.join(DIST, '_expo', 'static', 'js', 'web');
if (fs.existsSync(jsDir)) {
  for (const file of fs.readdirSync(jsDir)) {
    if (file.startsWith('index-') && file.endsWith('.js')) {
      const filePath = path.join(jsDir, file);
      let content = fs.readFileSync(filePath, 'utf-8');
      const count = (content.match(/@font-face\s*\{/g) || []).length;
      if (count > 0) {
        // Only inject if font-display isn't already present right after the brace
        content = content.replace(
          /@font-face\s*\{(?!font-display)/g,
          '@font-face{font-display:optional;',
        );
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`Patched ${count} @font-face rules with font-display:optional in ${file}`);
      }
    }
  }
}

// 3. Copy service worker and stamp the build hash so caches invalidate on deploy.
//    Without this, every deploy uses the same cache name and returning visitors
//    get stale HTML pointing to a JS bundle that no longer exists.
const swSrc = path.join('web', 'service-worker.js');
if (fs.existsSync(swSrc)) {
  const buildHash = getBuildHash();
  const apiBaseUrl =
    process.env.EXPO_PUBLIC_STOREFRONT_API_BASE_URL || 'https://api.canopytrove.com';
  const apiHostname = new URL(apiBaseUrl).hostname;

  let swContent = fs.readFileSync(swSrc, 'utf-8');
  swContent = swContent.replace(/__BUILD_HASH__/g, buildHash);
  swContent = swContent.replace(/__CT_API_HOSTNAME__/g, apiHostname);
  fs.writeFileSync(path.join(DIST, 'service-worker.js'), swContent, 'utf-8');
  console.log(
    `Stamped service-worker.js with build hash ${buildHash}, API host ${apiHostname} → dist/`,
  );
}

// 4. Copy web/scripts/ directory with build-time replacements
const scriptsDir = path.join('web', 'scripts');
if (fs.existsSync(scriptsDir)) {
  const destScripts = path.join(DIST, 'scripts');
  fs.mkdirSync(destScripts, { recursive: true });
  const scriptApiBaseUrl =
    process.env.EXPO_PUBLIC_STOREFRONT_API_BASE_URL || 'https://api.canopytrove.com';
  for (const file of fs.readdirSync(scriptsDir)) {
    const srcPath = path.join(scriptsDir, file);
    const destPath = path.join(destScripts, file);
    if (file.endsWith('.js')) {
      let content = fs.readFileSync(srcPath, 'utf-8');
      content = content.replace(/__CT_API_BASE_URL__/g, scriptApiBaseUrl);
      fs.writeFileSync(destPath, content, 'utf-8');
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
    console.log(`Copied scripts/${file} to dist/scripts/`);
  }
}

// 5. Generate route-specific static HTML for public indexed pages and a
//    separate noindex shell for all non-public SPA rewrites. Also generate
//    storefront detail HTML shells and a sitemap that matches the live site.
const distIndex = path.join(DIST, 'index.html');
if (fs.existsSync(distIndex)) {
  const baseHtml = fs.readFileSync(distIndex, 'utf-8');
  const sitemapEntries = [{ loc: buildCanonicalUrl('/'), changefreq: 'weekly', priority: 1.0 }];

  const appShellHtml = applyHtmlMetadata(baseHtml, {
    title: 'Canopy Trove',
    description:
      'Find licensed dispensaries, live hours, hot deals, and real reviews across New York.',
    robots: 'noindex, follow',
    canonicalUrl: buildCanonicalUrl('/'),
  });
  fs.writeFileSync(path.join(DIST, 'app-shell.html'), appShellHtml, 'utf-8');
  console.log('Generated dist/app-shell.html for non-public SPA routes');

  for (const route of INDEXABLE_WEB_ROUTES) {
    let routeHtml = applyHtmlMetadata(baseHtml, {
      title: route.title,
      description: route.description,
      robots: route.robots,
      canonicalUrl: buildCanonicalUrl(route.routePath),
    });
    routeHtml = appendStructuredData(routeHtml, buildCollectionStructuredData(route));
    routeHtml = replaceNoScript(routeHtml, buildCollectionNoScript(route));
    fs.mkdirSync(path.dirname(route.filePath), { recursive: true });
    fs.writeFileSync(route.filePath, routeHtml, 'utf-8');
    console.log(`Generated static route shell for ${route.routePath} → ${route.filePath}`);
    sitemapEntries.push({
      loc: buildCanonicalUrl(route.routePath),
      changefreq: 'daily',
      priority: route.routePath === '/hot-deals' ? 0.8 : 0.9,
    });
  }

  const storefrontRecords = loadGeneratedStorefrontRecords();
  for (const record of storefrontRecords) {
    const routePath = `/storefronts/${record.id}`;
    const title = `${record.displayName} in ${record.city}, ${record.state} | Canopy Trove`;
    const description =
      record.editorialSummary ||
      `View verified storefront details, hours, directions, and reviews for ${record.displayName} in ${record.city}, ${record.state}.`;
    let storefrontHtml = applyHtmlMetadata(baseHtml, {
      title,
      description,
      robots: 'index, follow',
      canonicalUrl: buildCanonicalUrl(routePath),
    });
    storefrontHtml = appendStructuredData(storefrontHtml, buildStorefrontStructuredData(record));
    storefrontHtml = replaceNoScript(storefrontHtml, buildStorefrontNoScript(record));

    const storefrontFilePath = path.join(DIST, 'storefronts', record.id, 'index.html');
    fs.mkdirSync(path.dirname(storefrontFilePath), { recursive: true });
    fs.writeFileSync(storefrontFilePath, storefrontHtml, 'utf-8');
    sitemapEntries.push({
      loc: buildCanonicalUrl(routePath),
      changefreq: 'weekly',
      priority: 0.7,
    });
  }
  console.log(`Generated ${storefrontRecords.length} storefront SEO pages`);

  fs.writeFileSync(path.join(DIST, 'sitemap.xml'), generateSitemapXml(sitemapEntries), 'utf-8');
  console.log(`Generated dist/sitemap.xml with ${sitemapEntries.length} URLs`);
}
