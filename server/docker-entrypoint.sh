#!/bin/sh
set -e

if [ "${JEMALLOC_ENABLED:-true}" = "true" ] && [ -z "${LD_PRELOAD:-}" ]; then
  JEMALLOC_PATH="$(find /usr/lib -name libjemalloc.so.2 -print -quit 2>/dev/null || true)"
  if [ -n "$JEMALLOC_PATH" ]; then
    export LD_PRELOAD="$JEMALLOC_PATH"
    export MALLOC_CONF="${MALLOC_CONF:-background_thread:true,dirty_decay_ms:1000,muzzy_decay_ms:1000}"
  fi
fi

echo "[server] applying prisma migrations..."
npx prisma migrate deploy

if [ "$SKIP_DB_SEED" = "true" ]; then
  echo "[server] skipping database seed because SKIP_DB_SEED=true"
else
  echo "[server] seeding missing default admin and models..."
  node dist/seed.js
fi

echo "[server] starting api..."
exec node dist/index.js
