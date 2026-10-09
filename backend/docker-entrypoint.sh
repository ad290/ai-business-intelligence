#!/bin/sh
set -e

echo "Applying Prisma migrations..."
npx prisma migrate deploy

exec node dist/server.js
