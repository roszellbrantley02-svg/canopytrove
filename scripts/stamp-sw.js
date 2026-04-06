#!/usr/bin/env node
/**
 * Stamp service worker with build hash.
 * Replaces __BUILD_HASH__ with git short SHA or current timestamp.
 * Cross-platform (works on Windows, macOS, Linux).
 *
 * Usage: node scripts/stamp-sw.js [output-dir]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const outputDir = process.argv[2] || 'dist';
const swFile = path.join(outputDir, 'service-worker.js');

if (!fs.existsSync(swFile)) {
  console.error(`Error: ${swFile} not found`);
  process.exit(1);
}

// Try git short SHA; fall back to timestamp
let buildHash;
try {
  buildHash = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
} catch {
  buildHash = String(Math.floor(Date.now() / 1000));
}

console.log(`Stamping service worker with hash: ${buildHash}`);

const content = fs.readFileSync(swFile, 'utf8');
const stamped = content.replace(/__BUILD_HASH__/g, buildHash);
fs.writeFileSync(swFile, stamped, 'utf8');

console.log(`Service worker stamped successfully at ${swFile}`);
