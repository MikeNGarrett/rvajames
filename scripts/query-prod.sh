#!/usr/bin/env bash
#
# query-prod.sh
#
# Read-only SQL query against production Supabase via the agent_reader
# Postgres role. The role has SELECT-only privileges on the public schema
# — writes are rejected by Postgres at the role level, not by this script.
#
# Usage:
#   pnpm query:prod "<sql>"
#   pnpm query:prod -f path/to/query.sql
#
# Examples:
#   pnpm query:prod "select count(*) from water_quality_readings"
#   pnpm query:prod "select source, max(finished_at) from ingestion_runs group by source"
#
# Output is plain psql formatting. Add `-P expanded=on` for vertical output
# on wide rows. Pipe to `| less -S` for long results.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ─── Load .dev.vars ──────────────────────────────────────────────────────────
if [ -f "$REPO_ROOT/.dev.vars" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$REPO_ROOT/.dev.vars"
  set +a
fi

if [ -z "${AGENT_READ_DATABASE_URL:-}" ]; then
  echo "Error: AGENT_READ_DATABASE_URL is not set in .dev.vars" >&2
  echo "       See docs/agent-read-only-setup.md for one-time setup." >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "Error: psql is required but not on PATH." >&2
  echo "       Install: brew install libpq && brew link --force libpq" >&2
  exit 1
fi

if [ $# -eq 0 ]; then
  cat >&2 <<EOF
Usage:
  $(basename "$0") "<sql>"
  $(basename "$0") -f path/to/query.sql

Examples:
  $(basename "$0") "select count(*) from locations"
  $(basename "$0") "select source, max(finished_at) from ingestion_runs group by source"

Writes are rejected by Postgres — agent_reader has SELECT only.
EOF
  exit 1
fi

# Pass through to psql. Postgres enforces SELECT-only via the role; this
# script does not attempt to second-guess SQL keywords (regex-based
# detection causes false positives on legitimate strings and column names).
exec psql "$AGENT_READ_DATABASE_URL" "$@"
