FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat

# ---- Builder: full deps (with native builds) + Next build ----
FROM base AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
# Full install WITH lifecycle scripts so sharp + @node-rs/argon2 build their
# native binaries, and devDependencies are present for the Next build.
RUN npm ci

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- Runner: minimal standalone output, non-root ----
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# Bind to all interfaces so the container is reachable.
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 presensa && \
    adduser --system --uid 1001 presensa

# Next standalone output already includes the traced (incl. native) node_modules.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=presensa:presensa /app/.next/standalone ./
COPY --from=builder --chown=presensa:presensa /app/.next/static ./.next/static
# Migrations are read at runtime from process.cwd()/src/database/migrations.
COPY --from=builder --chown=presensa:presensa /app/src/database/migrations ./src/database/migrations

USER presensa

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
