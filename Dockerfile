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
RUN bun run --cwd apps/${APP} build
# Bundle web app server into a single self-contained file so the runtime stage
# needs no node_modules. API apps already produce a standalone dist/index.js.
RUN if [ -f apps/${APP}/dist/server/server.js ]; then \
  cd apps/${APP} && \
  bun build dist/server/server.js --bundle --target bun --outfile /tmp/server.js && \
  mv /tmp/server.js dist/server/server.js; \
fi

FROM oven/bun:1.3.14-slim AS runtime
WORKDIR /app
ARG APP
ENV NODE_ENV=production
ENV APP=${APP}

COPY --from=base /app/apps/${APP}/dist ./dist
# docker-serve.mjs: static-file server + SSR fallback for web apps.
# For API apps this file is present but ignored (CMD uses dist/index.js).
COPY docker-serve.mjs ./docker-serve.mjs

EXPOSE 3000
CMD ["sh", "-c", "if [ -f dist/server/server.js ]; then bun docker-serve.mjs; else bun dist/index.js; fi"]
