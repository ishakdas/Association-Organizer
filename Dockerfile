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

# Compile the bot first — api imports it as a plain package (`bot`, not a path
# alias), so api's tsc needs `apps/bot/dist/index.d.ts` to resolve the type.
RUN pnpm --filter bot build

# Flatten the bot dist: tsc infers rootDir = repo root (because path-aliased libs
# pull files in), so bot's emit lands at apps/bot/dist/apps/bot/src/*. Bring those
# files up to apps/bot/dist/* so package.json `main: "./dist/index.js"` resolves.
RUN if [ -d apps/bot/dist/apps/bot/src ]; then \
      cp -r apps/bot/dist/apps/bot/src/. apps/bot/dist/; \
    fi

# Compile the API (tsc pulls libs in via path aliases; output lands in dist/apps/api/src/
# for api and dist/libs/<x>/src/ for each lib).
RUN pnpm --filter api build

# Each workspace package's `main` points to `./dist/index.js`. Copy the compiled
# lib output from api's dist into each lib's own dist so Node module resolution
# (pnpm symlink → package.json main → dist/index.js) finds a real file at runtime.
RUN for pkg in database ai shared-types shared-validation; do \
      if [ -d "apps/api/dist/libs/$pkg/src" ]; then \
        mkdir -p "libs/$pkg/dist" && \
        cp -r "apps/api/dist/libs/$pkg/src/." "libs/$pkg/dist/"; \
      fi; \
    done

ENV NODE_ENV=production
EXPOSE 3000

# tini -> node so SIGTERM cleanly shuts the API down
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "apps/api/dist/apps/api/src/main.js"]
