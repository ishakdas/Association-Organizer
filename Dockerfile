# syntax=docker/dockerfile:1.7
# Single-stage image for the API (Telegraf bot runs in-process).
# Uses Debian slim so Prisma's debian-openssl-3.0.x engine works without alpine/musl quirks.

FROM node:20-slim

# Prisma needs openssl + ca-certificates; tini gives a real PID 1 for graceful shutdown.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates tini \
    && rm -rf /var/lib/apt/lists/*

# Enable pnpm via corepack (must match packageManager field in root package.json)
RUN corepack enable && corepack prepare pnpm@10.29.3 --activate

WORKDIR /app

# Copy the whole repo (filtered by .dockerignore)
COPY . .

# Install all workspace deps from the lockfile (no postinstall scripts run for safety)
RUN pnpm install --frozen-lockfile

# Generate Prisma client (no DB connection needed here; just reads schema.prisma)
RUN pnpm --filter @ticketbot/database exec prisma generate

# Compile the API (tsc pulls libs + bot in via path aliases; output lands in dist/apps/api/src/)
RUN pnpm --filter api build

ENV NODE_ENV=production
EXPOSE 3000

# tini -> node so SIGTERM cleanly shuts the API down
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "apps/api/dist/apps/api/src/main.js"]
