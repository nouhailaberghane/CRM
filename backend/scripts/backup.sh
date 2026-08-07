#!/usr/bin/env bash
# Automatic PostgreSQL backup helper for cron / Railway / Render jobs.
# Usage: DATABASE_URL=postgresql://user:pass@host:5432/haircare ./backup.sh

set -euo pipefail

stamp=$(date +%Y%m%d_%H%M%S)
outdir="${BACKUP_DIR:-./backups}"
mkdir -p "$outdir"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required"
  exit 1
fi

# Convert SQLAlchemy-style URL if needed
url="${DATABASE_URL/postgresql+asyncpg:\/\//postgresql:\/\/}"
outfile="$outdir/haircare_$stamp.sql"

pg_dump "$url" > "$outfile"
echo "Backup written to $outfile"
