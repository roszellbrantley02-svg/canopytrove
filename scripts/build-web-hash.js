#!/usr/bin/env node

const { execSync } = require('child_process');

function getBuildHash() {
  const explicitHash = process.env.CT_WEB_BUILD_HASH?.trim();
  if (explicitHash) {
    return explicitHash;
  }

  let gitHash = 'nogit';
  try {
    gitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim() || gitHash;
  } catch {
    // Fall back to a non-git prefix when running from an exported or detached workspace.
  }

  return `${gitHash}-${Date.now().toString(36)}`;
}

module.exports = {
  getBuildHash,
};
