#!/usr/bin/env bash
#
# load.sh — apply a local UI scenario fixture (or (re)ingest the baseline).
#
# LOCAL ONLY. Targets the local Supabase Postgres. Contains no production
# connection string and cannot write to prod.
#
# Usage:
#   ./scripts/scenarios/load.sh <scenario>   # apply scripts/scenarios/<scenario>.sql
#   ./scripts/scenarios/load.sh --list       # list available scenarios
#   ./scripts/scenarios/load.sh baseline     # curl the local cron routes to ingest
#                                            # a fresh live-public-API baseline
#
# Env overrides:
#   LOCAL_DB_URL   (default postgresql://postgres:postgres@127.0.0.1:54322/postgres)
#   PORT           dev-server port for `baseline` (default 3001)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOCAL_DB_URL="${LOCAL_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

usage() { sed -n '2,18p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }

list() {
  echo "Available scenarios:"
  for f in "$SCRIPT_DIR"/*.sql; do
    name="$(basename "$f" .sql)"
    desc="$(grep -m1 '^-- DESC:' "$f" | sed 's/^-- DESC: //')"
    printf "  %-18s %s\n" "$name" "$desc"
  done
  echo "  baseline           (re)ingest live public-API data via local cron routes"
}

# ── baseline: re-ingest from the live PUBLIC apis (never prod) ────────────────
baseline() {
  local port="${PORT:-3001}"
  local secret
  secret="$(grep '^CRON_SECRET=' "$REPO_ROOT/.env.development.local" | cut -d= -f2- | tr -d '"'"'"'"')"
  if [ -z "$secret" ]; then
    echo "Error: CRON_SECRET not found in .env.development.local" >&2; exit 1
  fi
  if ! curl -fsS -m 5 -o /dev/null "http://localhost:${port}/"; then
    echo "Error: dev server not reachable on :${port}. Start it first." >&2; exit 1
  fi
  for route in usgs usgs-percentiles nws cso jra; do
    printf "  ingest %-18s " "$route"
    curl -fsS -m 60 -H "x-cron-secret: ${secret}" "http://localhost:${port}/api/cron/${route}" \
      | head -c 200; echo
  done
  echo "✓ baseline ingested"
}

main() {
  case "${1:-}" in
    ""|-h|--help) usage; exit 0 ;;
    --list|-l)    list; exit 0 ;;
    baseline)     baseline; exit 0 ;;
  esac

  local scenario="$1"
  local sql="$SCRIPT_DIR/${scenario}.sql"
  if [ ! -f "$sql" ]; then
    echo "Error: no scenario '${scenario}'. Run --list." >&2; exit 1
  fi
  echo "Applying scenario: ${scenario}"
  psql "$LOCAL_DB_URL" -X --quiet --set ON_ERROR_STOP=on -f "$sql"
  echo "✓ Applied ${scenario}. Reload http://localhost:${PORT:-3001}/"
}

main "$@"
