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
const { getBuildHash } = require('./build-web-hash');

const outputDir = process.argv[2] || 'dist';
const swFile = path.join(outputDir, 'service-worker.js');

if (!fs.existsSync(swFile)) {
  console.error(`Error: ${swFile} not found`);
  process.exit(1);
}

const content = fs.readFileSync(swFile, 'utf8');
if (!content.includes('__BUILD_HASH__')) {
  console.log(`Skipping ${swFile}; build hash already stamped.`);
  process.exit(0);
}

const buildHash = getBuildHash();
console.log(`Stamping service worker with hash: ${buildHash}`);
const stamped = content.replace(/__BUILD_HASH__/g, buildHash);
fs.writeFileSync(swFile, stamped, 'utf8');

console.log(`Service worker stamped successfully at ${swFile}`);
