# Generic Dockerfile for any Vianova app.
# Build with: docker build --build-arg APP=api -t vianova-api ./vianova
ARG APP=api

FROM oven/bun:1.3.14 AS base
WORKDIR /app
ARG APP
ENV NODE_ENV=production

# Copy full source (workspace resolution needs real package dirs).
COPY . .
RUN bun install --frozen-lockfile
# VITE_ vars are baked into the client bundle at build time.
# Defaults are the production URLs; override via --build-arg if needed.
ARG VITE_VIANOVA_API_URL=https://api.vianova.software
ARG VITE_VIANOVA_WEB_URL=https://app.vianova.software
ENV VITE_VIANOVA_API_URL=$VITE_VIANOVA_API_URL
ENV VITE_VIANOVA_WEB_URL=$VITE_VIANOVA_WEB_URL
RUN bun run --cwd apps/${APP} build
# Bundle web app server into a single self-contained file so the runtime stage
# needs no node_modules. API apps already produce a standalone dist/index.js.
RUN if [ -f apps/${APP}/dist/server/server.js ]; then \
  cd apps/${APP} && \
  bun build dist/server/server.js --bundle --target bun --outfile /tmp/server.js && \
  mv /tmp/server.js dist/server/server.js; \
fi
# For API: build migrate and seed scripts so they can be run via docker exec.
RUN if [ "${APP}" = "api" ]; then \
  bun build apps/api/src/migrate.ts --bundle --target bun --outfile apps/api/dist/migrate.js && \
  bun build packages/db/src/seed.ts --bundle --target bun --outfile apps/api/dist/seed.js; \
fi

FROM oven/bun:1.3.14-slim AS runtime
WORKDIR /app
ARG APP
ENV NODE_ENV=production
ENV APP=${APP}

COPY --from=base /app/apps/${APP}/dist ./dist
# Migration SQL files — needed at runtime by migrate.js (drizzle-orm/migrator).
COPY --from=base /app/packages/db/drizzle ./drizzle
# docker-serve.mjs: static-file server + SSR fallback for web apps.
# For API apps this file is present but ignored (CMD uses dist/index.js).
COPY docker-serve.mjs ./docker-serve.mjs

EXPOSE 3000
# API: aplica as migrations antes de subir — migration falhando impede o boot
# (deploy quebra na hora, não no primeiro request contra schema velho).
# Web (dist/server) e workers (sem migrate.js) sobem direto.
CMD ["sh", "-c", "if [ -f dist/server/server.js ]; then bun docker-serve.mjs; elif [ -f dist/migrate.js ]; then bun dist/migrate.js && bun dist/index.js; else bun dist/index.js; fi"]
