#!/usr/bin/env bash
# Installs pgvector into EDB PostgreSQL 17 (macOS). Requires sudo for make install.
set -euo pipefail

PG_CONFIG="${PG_CONFIG:-/Library/PostgreSQL/17/bin/pg_config}"

if [[ ! -x "$PG_CONFIG" ]]; then
  echo "pg_config not found at $PG_CONFIG — set PG_CONFIG to your PostgreSQL bin/pg_config"
  exit 1
fi

WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

git clone --depth 1 https://github.com/pgvector/pgvector.git "$WORKDIR/pgvector"
cd "$WORKDIR/pgvector"
make PG_CONFIG="$PG_CONFIG"
sudo make install PG_CONFIG="$PG_CONFIG"

echo "pgvector installed. From backend/: npx prisma migrate deploy && npm run db:verify-pgvector"
