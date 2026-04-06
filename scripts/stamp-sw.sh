#!/bin/bash
# Stamp service worker with build hash
# Replaces __BUILD_HASH__ with git short SHA or current timestamp
# Usage: ./scripts/stamp-sw.sh [output-dir]

set -e

OUTPUT_DIR="${1:-dist}"
SW_FILE="$OUTPUT_DIR/service-worker.js"

if [ ! -f "$SW_FILE" ]; then
  echo "Error: $SW_FILE not found"
  exit 1
fi

# Try to use git short SHA; fall back to timestamp if not in a git repo
if git rev-parse --git-dir > /dev/null 2>&1; then
  BUILD_HASH=$(git rev-parse --short HEAD)
else
  BUILD_HASH=$(date +%s)
fi

echo "Stamping service worker with hash: $BUILD_HASH"

# Replace __BUILD_HASH__ with the actual hash
sed -i "s/__BUILD_HASH__/$BUILD_HASH/g" "$SW_FILE"

echo "Service worker stamped successfully at $SW_FILE"
