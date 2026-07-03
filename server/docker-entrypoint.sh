#!/bin/sh
set -e

echo "[server] applying prisma migrations..."
npx prisma migrate deploy

echo "[server] seeding default admin and models..."
node dist/seed.js

echo "[server] starting api..."
exec node dist/index.js
