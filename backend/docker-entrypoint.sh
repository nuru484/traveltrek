#!/bin/sh
# Container entrypoint. Applies pending migrations (idempotent) before starting
# the API, so a deploy that ships a schema change is safe. Set RUN_MIGRATIONS=false
# to skip this (e.g. when migrations run as a separate release step, or on the
# dedicated worker container so only the web container migrates).
set -e

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "Applying database migrations (prisma migrate deploy)..."
  npx prisma migrate deploy
fi

# PROCESS_TYPE=worker runs the standalone BullMQ worker entry instead of the
# web server (pair it with WEB_DISABLE_WORKERS=true on the web container).
if [ "${PROCESS_TYPE:-web}" = "worker" ]; then
  echo "Starting TravelTrek worker..."
  exec node build/worker.js
fi

echo "Starting TravelTrek API..."
exec node build/server.js
