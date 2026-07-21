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

FROM oven/bun:1.3.14-slim AS runtime
WORKDIR /app
ARG APP
ENV NODE_ENV=production
ENV APP=${APP}

COPY --from=base /app/apps/${APP}/dist ./dist
COPY --from=base /app/node_modules ./node_modules

EXPOSE 3000
CMD ["sh", "-c", "bun dist/index.js"]
