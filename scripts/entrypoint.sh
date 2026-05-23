#!/bin/sh
# Production entrypoint for the API container.
# Runs schema migrations + idempotent reference-data seed before starting Node.
# Order matters: migrate first (creates tables), seed second (inserts titles +
# prompt templates), then exec the API. `set -e` so any failure aborts boot
# and Coolify surfaces it as a failed deploy.

set -e

echo "[entrypoint] prisma migrate deploy..."
pnpm --filter @ticketbot/database exec prisma migrate deploy

echo "[entrypoint] prisma db seed (reference data only; SEED_DEV_ADMIN is unset in prod)..."
pnpm --filter @ticketbot/database exec prisma db seed

echo "[entrypoint] starting API..."
exec node apps/api/dist/apps/api/src/main.js
