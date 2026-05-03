# canopytrove-scraper Cloud Run service
#
# Headless-browser scraper for the AI Shop Bootstrap flow. Phase-1
# scaffold — see services/scraper/README.md for the architecture and
# deployment notes.
#
# Base image: Microsoft's official Playwright image, Node 22 + Ubuntu
# Noble, with Chromium + Firefox + WebKit + all system dependencies
# preinstalled. We only use Chromium; staying on the official image is
# easier than fighting the Playwright dependency tree ourselves.

FROM mcr.microsoft.com/playwright:v1.50.0-noble

WORKDIR /app

# Install only production deps. The lockfile lives at the repo root,
# but for an isolated service we keep our own package.json here.
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

# Source. Phase-1 stub is just a placeholder server — actual render
# code lands in a follow-up commit.
COPY . .

# Cloud Run injects PORT; default to 8080 locally.
ENV PORT=8080
EXPOSE 8080

# Run as non-root for security. The Playwright image already has a
# `pwuser` account configured.
USER pwuser

CMD ["node", "src/server.js"]
