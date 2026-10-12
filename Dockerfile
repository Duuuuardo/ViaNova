ARG APP=api

FROM oven/bun:1.3.14 AS base
WORKDIR /app
ARG APP
ENV NODE_ENV=production

COPY . .
RUN bun install --frozen-lockfile
ARG VITE_VIANOVA_API_URL=https://api.vianova.software
ARG VITE_VIANOVA_WEB_URL=https://app.vianova.software
ENV VITE_VIANOVA_API_URL=$VITE_VIANOVA_API_URL
ENV VITE_VIANOVA_WEB_URL=$VITE_VIANOVA_WEB_URL
RUN bun run --cwd apps/${APP} build
RUN if [ -f apps/${APP}/dist/server/server.js ]; then \
  cd apps/${APP} && \
  bun build dist/server/server.js --bundle --target bun --outfile /tmp/server.js && \
  mv /tmp/server.js dist/server/server.js; \
fi
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
COPY --from=base /app/packages/db/drizzle ./drizzle
COPY docker-serve.mjs ./docker-serve.mjs

EXPOSE 3000
CMD ["sh", "-c", "if [ -f dist/server/server.js ]; then bun docker-serve.mjs; elif [ -f dist/migrate.js ]; then bun dist/migrate.js && bun dist/index.js; else bun dist/index.js; fi"]
