#!/usr/bin/env node
// Downloads Apple's public Root CA certificates and writes them to
// backend/src/certs/apple-root-cas/. The SignedDataVerifier in
// @apple/app-store-server-library needs these to verify the signature on
// App Store Server Notifications V2 payloads.
//
// Run once before deploying the backend; the certs get baked into the
// Docker image. Re-run only if Apple rotates root CAs (rare).
//
// Usage:
//   node backend/scripts/fetch-apple-root-cas.mjs
//
// Source URLs are public and Apple-published:
//   https://www.apple.com/certificateauthority/
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TARGET_DIR = path.resolve(__dirname, '..', 'src', 'certs', 'apple-root-cas');

const CERTS = [
  {
    name: 'AppleRootCA-G3.cer',
    url: 'https://www.apple.com/certificateauthority/AppleRootCA-G3.cer',
    description: 'Apple Root CA - G3 (used for App Store Server Notifications V2)',
  },
  {
    name: 'AppleIncRootCertificate.cer',
    url: 'https://www.apple.com/appleca/AppleIncRootCertificate.cer',
    description: 'Apple Inc. Root Certificate (legacy fallback)',
  },
];

async function fetchCert({ name, url }) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'CanopyTroveBackend/1.0 (apple-root-ca-fetcher)' },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${url}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 500) {
    throw new Error(`${name} body suspiciously small (${buffer.length} bytes)`);
  }
  return buffer;
}

async function main() {
  await fs.mkdir(TARGET_DIR, { recursive: true });
  for (const cert of CERTS) {
    process.stdout.write(`Fetching ${cert.name}... `);
    const data = await fetchCert(cert);
    const target = path.join(TARGET_DIR, cert.name);
    await fs.writeFile(target, data);
    console.log(`OK (${data.length} bytes)`);
  }

  const readme = `# Apple Root CAs

These public certificates are bundled in the backend Docker image so
SignedDataVerifier can verify Apple App Store Server Notifications V2
signatures.

To refresh: run \`node backend/scripts/fetch-apple-root-cas.mjs\` from
the repo root and commit the updated files.

Source: https://www.apple.com/certificateauthority/
`;
  await fs.writeFile(path.join(TARGET_DIR, 'README.md'), readme);
  console.log('\nDone. Certs written to', TARGET_DIR);
}

main().catch((error) => {
  console.error('\nfetch-apple-root-cas failed:', error.message);
  process.exit(1);
});
