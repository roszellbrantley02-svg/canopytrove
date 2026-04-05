FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY backend/package.json backend/package-lock.json ./backend/
RUN npm --prefix backend ci

COPY backend ./backend
COPY src ./src

RUN npm --prefix backend run build

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PORT=8080

WORKDIR /app

COPY backend/package.json backend/package-lock.json ./backend/
RUN npm --prefix backend ci --omit=dev && npm cache clean --force

COPY --from=build /app/backend/dist ./backend/dist

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:8080/livez || exit 1

CMD ["npm", "--prefix", "backend", "run", "start"]
