#!/usr/bin/env bash
#
# sync-prod-to-local.sh
#
# Snapshots production Supabase data into the local Supabase stack for
# verification against realistic data.
#
# One-way by construction: uses AGENT_READ_DATABASE_URL which authenticates
# as the `agent_reader` Postgres role. That role has SELECT-only privileges
# on the public schema. This script CANNOT write to production — even if
# you try, Postgres returns "permission denied".
#
# Flow:
#   1. pg_dump --data-only from prod via agent_reader (read-only)
#   2. supabase db reset --no-seed on local (re-applies migrations, truncates)
#   3. psql restore into local (which the dev fully owns)
#
# Local stack must be running (`supabase start`) before this script.
#
# Usage:
#   pnpm sync:prod-to-local         # prompts for confirmation
#   pnpm sync:prod-to-local --yes   # skip prompt (for agent use)
#   KEEP_DUMP=1 pnpm sync:prod-to-local  # retain the dump file at /tmp

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TS="$(date +%Y%m%d-%H%M%S)"
DUMP_FILE="/tmp/rva-prod-snap-${TS}.sql"
INFO_FILE="$REPO_ROOT/.local-snapshot-info"

# ─── Load .dev.vars ──────────────────────────────────────────────────────────
if [ -f "$REPO_ROOT/.dev.vars" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$REPO_ROOT/.dev.vars"
  set +a
fi

# ─── Pre-flight checks ───────────────────────────────────────────────────────
if [ -z "${AGENT_READ_DATABASE_URL:-}" ]; then
  echo "Error: AGENT_READ_DATABASE_URL is not set in .dev.vars" >&2
  echo "       See docs/agent-read-only-setup.md for one-time setup." >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1 || ! command -v psql >/dev/null 2>&1; then
  echo "Error: pg_dump and psql are required but not on PATH." >&2
  echo "       Install: brew install libpq && brew link --force libpq" >&2
  exit 1
fi

if ! command -v supabase >/dev/null 2>&1; then
  echo "Error: supabase CLI not found." >&2
  echo "       Install: brew install supabase/tap/supabase" >&2
  exit 1
fi

if ! supabase status >/dev/null 2>&1; then
  echo "Error: Local Supabase isn't running." >&2
  echo "       Start it: supabase start" >&2
  exit 1
fi

# Extract local DB URL from `supabase status`. CLI output format varies
# across versions, so try multiple strategies in order of reliability.
LOCAL_DB_URL=""

# Strategy 1: `-o env` produces KEY=value format designed for shell consumption.
LOCAL_DB_URL="$(supabase status -o env 2>/dev/null \
  | grep -E '^(DB_URL|DATABASE_URL)=' \
  | head -n 1 \
  | cut -d= -f2- \
  | sed 's/^"\(.*\)"$/\1/')"

# Strategy 2: parse the pretty human-readable output. Match "DB URL:", "Db Url:",
# "Database URL:" case-insensitively, with optional leading whitespace.
if [ -z "$LOCAL_DB_URL" ]; then
  LOCAL_DB_URL="$(supabase status 2>/dev/null \
    | grep -iE '^[[:space:]]*(db|database)[[:space:]_]?url[[:space:]]*:' \
    | head -n 1 \
    | sed -E 's/^[^:]*:[[:space:]]*//' \
    | awk '{print $1}')"
fi

# Strategy 3: parse JSON output if jq is present.
if [ -z "$LOCAL_DB_URL" ] && command -v jq >/dev/null 2>&1; then
  LOCAL_DB_URL="$(supabase status -o json 2>/dev/null \
    | jq -r '.DB_URL // .db_url // ."DB URL" // empty' 2>/dev/null)"
fi

if [ -z "$LOCAL_DB_URL" ]; then
  echo "Error: Could not determine local DB URL from \`supabase status\`." >&2
  echo "" >&2
  echo "Diagnostic — \`supabase status\` output:" >&2
  echo "----" >&2
  supabase status 2>&1 | sed 's/^/  /' >&2
  echo "----" >&2
  echo "" >&2
  echo "Diagnostic — \`supabase status -o env\` output:" >&2
  echo "----" >&2
  supabase status -o env 2>&1 | sed 's/^/  /' >&2
  echo "----" >&2
  echo "" >&2
  echo "If your CLI version uses a different label or format, share these" >&2
  echo "diagnostics — the parser strategies in this script need to be updated." >&2
  exit 1
fi

# ─── Confirmation (unless --yes / SYNC_YES=1) ────────────────────────────────
if [ "${1:-}" != "--yes" ] && [ "${SYNC_YES:-0}" != "1" ]; then
  echo "This will REPLACE all local Supabase data with a fresh snapshot of production."
  echo "Local schema is preserved (re-applied from supabase/migrations/)."
  printf "Continue? [y/N] "
  read -r confirm
  case "$confirm" in
    y|Y|yes|YES) ;;
    *) echo "Aborted."; exit 1 ;;
  esac
fi

# ─── 1. Dump production (data-only, public schema) ───────────────────────────
echo ""
echo "[1/3] Dumping production → $DUMP_FILE"
pg_dump \
  --no-acl \
  --no-owner \
  --data-only \
  --schema=public \
  --file="$DUMP_FILE" \
  "$AGENT_READ_DATABASE_URL"

DUMP_SIZE="$(du -h "$DUMP_FILE" | cut -f1)"
echo "      ✓ Dump complete ($DUMP_SIZE)"

# ─── 2. Reset local schema + wipe migration-seeded rows ─────────────────────
# Migrations seed initial data (locations, activities, location_resources)
# via INSERT statements. `--no-seed` only skips supabase/seed.sql, NOT data
# inserts inside migrations. We must truncate after reset, or the restore
# hits unique-constraint violations on seed slugs.
echo "[2/3] Resetting local schema and clearing seed data..."
(
  cd "$REPO_ROOT"
  supabase db reset --no-seed >/dev/null
)
echo "      ✓ Schema reset (migrations re-applied)"

psql "$LOCAL_DB_URL" \
  --quiet \
  --set ON_ERROR_STOP=on \
  -c "DO \$\$
      DECLARE r RECORD;
      BEGIN
        FOR r IN (
          SELECT tablename
          FROM pg_tables
          WHERE schemaname = 'public'
        ) LOOP
          EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' RESTART IDENTITY CASCADE';
        END LOOP;
      END \$\$;" >/dev/null
echo "      ✓ Migration-seeded rows truncated (schema preserved)"

# ─── 3. Restore production data into local ───────────────────────────────────
echo "[3/3] Restoring production data into local..."
psql "$LOCAL_DB_URL" \
  --quiet \
  --single-transaction \
  --set ON_ERROR_STOP=on \
  --file="$DUMP_FILE" >/dev/null
echo "      ✓ Restore complete"

# ─── Snapshot metadata ───────────────────────────────────────────────────────
SNAPSHOT_TIME="$(date '+%Y-%m-%d %H:%M:%S %Z')"
cat > "$INFO_FILE" <<EOF
# Local Supabase snapshot metadata — auto-generated by sync-prod-to-local.sh
# This file is gitignored. Re-run \`pnpm sync:prod-to-local\` to refresh.

snapshot_taken_at = "$SNAPSHOT_TIME"
dump_size = "$DUMP_SIZE"
source = "production via agent_reader (read-only)"
EOF

# ─── Cleanup ─────────────────────────────────────────────────────────────────
if [ "${KEEP_DUMP:-0}" = "1" ]; then
  echo ""
  echo "      ⓘ Dump retained at $DUMP_FILE (KEEP_DUMP=1)"
else
  rm -f "$DUMP_FILE"
fi

echo ""
echo "✓ Local Supabase mirrors production as of $SNAPSHOT_TIME"
echo "  Metadata: $INFO_FILE"
