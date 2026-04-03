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

EXPOSE 8080

CMD ["npm", "--prefix", "backend", "run", "start"]
