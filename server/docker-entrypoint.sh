#!/bin/sh
set -e

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
