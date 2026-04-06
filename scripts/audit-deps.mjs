#!/usr/bin/env node
/**
 * audit-deps.mjs — Dependency security audit for CI and pre-deploy checks.
 *
 * Runs `npm audit` on both the root (frontend) and backend workspaces.
 * Exits with code 1 if any HIGH or CRITICAL vulnerabilities are found.
 *
 * Usage:
 *   node scripts/audit-deps.mjs              # Fail on high/critical
 *   node scripts/audit-deps.mjs --strict     # Fail on moderate+
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

const isStrict = process.argv.includes('--strict');
const auditLevel = isStrict ? 'moderate' : 'high';
const root = path.resolve(import.meta.dirname, '..');

console.log(`\n🔍 Auditing dependencies (fail on: ${auditLevel}+)\n`);

let hasFailure = false;

function auditWorkspace(name, dir) {
  if (!existsSync(path.join(dir, 'package.json'))) {
    console.log(`⏭  Skipping ${name} — no package.json found`);
    return;
  }

  console.log(`── ${name} ──`);
  try {
    execSync(`npm audit --audit-level=${auditLevel}`, {
      cwd: dir,
      stdio: 'inherit',
      encoding: 'utf-8',
    });
    console.log(`✅ ${name}: no ${auditLevel}+ vulnerabilities\n`);
  } catch {
    // npm audit exits with non-zero when vulnerabilities are found
    console.error(`❌ ${name}: ${auditLevel}+ vulnerabilities detected\n`);
    hasFailure = true;
  }
}

// Audit frontend (root)
auditWorkspace('Frontend (root)', root);

// Audit backend
auditWorkspace('Backend', path.join(root, 'backend'));

if (hasFailure) {
  console.error('🚨 Dependency audit failed. Run `npm audit fix` to auto-fix, or review manually.');
  process.exit(1);
} else {
  console.log('✅ All workspaces passed dependency audit.');
}
