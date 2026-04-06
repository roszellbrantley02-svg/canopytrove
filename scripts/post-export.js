/**
 * post-export.js — Runs after `expo export --platform web` to copy
 * additional web assets into the dist/ folder that Expo doesn't handle.
 */
const fs = require('fs');
const path = require('path');

const DIST = 'dist';

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

  // Extract all <script src="..."> and <link rel="stylesheet" ...> from Expo output
  const scriptTags = expoIndex.match(/<script\s+src="[^"]*"><\/script>/g) || [];
  const linkTags = expoIndex.match(/<link\s+rel="stylesheet"[^>]*>/g) || [];

  // Inject Expo's JS bundles before closing </body>
  let merged = customHtml;
  if (scriptTags.length > 0) {
    const expoScripts = scriptTags.join('\n    ');
    merged = merged.replace('</body>', `    ${expoScripts}\n  </body>`);
  }

  // Inject Expo's CSS before closing </head>
  if (linkTags.length > 0) {
    const expoStyles = linkTags.join('\n    ');
    merged = merged.replace('</head>', `    ${expoStyles}\n  </head>`);
  }

  fs.writeFileSync(path.join(DIST, 'index.html'), merged, 'utf-8');
  console.log('Merged web/index.html with Expo bundle references → dist/index.html');
} else {
  console.log('No web/index.html found — using Expo default');
}

// 3. Copy service worker
const swSrc = path.join('web', 'service-worker.js');
if (fs.existsSync(swSrc)) {
  fs.copyFileSync(swSrc, path.join(DIST, 'service-worker.js'));
  console.log('Copied service-worker.js to dist/');
}

// 4. Copy web/scripts/ directory
const scriptsDir = path.join('web', 'scripts');
if (fs.existsSync(scriptsDir)) {
  const destScripts = path.join(DIST, 'scripts');
  fs.mkdirSync(destScripts, { recursive: true });
  for (const file of fs.readdirSync(scriptsDir)) {
    fs.copyFileSync(path.join(scriptsDir, file), path.join(destScripts, file));
    console.log(`Copied scripts/${file} to dist/scripts/`);
  }
}
