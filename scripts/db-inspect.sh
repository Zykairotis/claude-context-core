#!/usr/bin/env bash

set -euo pipefail

# ------------------------------------------------------------
# Database inspection helper for PostgreSQL + Qdrant
# ------------------------------------------------------------

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

POSTGRES_CONTAINER=${POSTGRES_CONTAINER:-claude-context-postgres}
POSTGRES_HOST=${POSTGRES_HOST:-localhost}
POSTGRES_PORT=${POSTGRES_PORT:-5533}
POSTGRES_USER=${POSTGRES_USER:-postgres}
POSTGRES_DB=${POSTGRES_DB:-claude_context}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-code-context-secure-password}

QDRANT_URL=${QDRANT_URL:-http://localhost:6333}

SHOW_FULL=false
USE_COLOR=true

while [[ $# -gt 0 ]]; do
  case "$1" in
    --full)
      SHOW_FULL=true
      shift
      ;;
    --no-color)
      USE_COLOR=false
      shift
      ;;
    --help|-h)
      cat <<'EOF'
Usage: scripts/db-inspect.sh [--full] [--no-color]

Inspect the current state of PostgreSQL and Qdrant databases.

Options:
  --full       Show detailed column information for each PostgreSQL table.
  --no-color   Disable ANSI color output.
EOF
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ $USE_COLOR == true ]]; then
  CYAN='\033[1;36m'
  GREEN='\033[1;32m'
  YELLOW='\033[1;33m'
  MAGENTA='\033[1;35m'
  RESET='\033[0m'
else
  CYAN=''
  GREEN=''
  YELLOW=''
  MAGENTA=''
  RESET=''
fi

say() {
  printf '%b%s%b\n' "$1" "$2" "$RESET"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Error: required command '$1' not found in PATH" >&2
    exit 1
  fi
}

psql_exec() {
  docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"
}

psql_sql() {
  docker exec "$POSTGRES_CONTAINER" psql -At -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "$1"
}

ensure_postgres() {
  if ! docker ps --format '{{.Names}}' --filter "name=$POSTGRES_CONTAINER" | grep -q "$POSTGRES_CONTAINER"; then
    echo "Error: PostgreSQL container '$POSTGRES_CONTAINER' is not running" >&2
    exit 1
  fi
}

ensure_qdrant() {
  if ! curl -sSf "$QDRANT_URL/collections" >/dev/null 2>&1; then
    echo "Warning: Unable to reach Qdrant at $QDRANT_URL" >&2
  fi
}

pretty_header() {
  say "$CYAN" "\n════════════════════════════════════════════════════"
  say "$CYAN" "  $1"
  say "$CYAN" "════════════════════════════════════════════════════"
}

postgres_overview() {
  pretty_header "PostgreSQL Overview"
  say "$YELLOW" "Container : $POSTGRES_CONTAINER"
  say "$YELLOW" "Host      : $POSTGRES_HOST:$POSTGRES_PORT"
  say "$YELLOW" "Database  : $POSTGRES_DB"
  say "$YELLOW" "User      : $POSTGRES_USER"

  echo
  say "$MAGENTA" "Schemas"
  psql_exec -c '\dn'

  echo
  say "$MAGENTA" "Tables (row estimates)"
  psql_exec -c "\dt+ claude_context.*"

  echo
  say "$MAGENTA" "Extensions"
  psql_exec -c '\dx'

  echo
  say "$MAGENTA" "collections_metadata"
  psql_exec -c "SELECT collection_name, dimension, entity_count, created_at, updated_at FROM claude_context.collections_metadata ORDER BY created_at;" || true

  echo
  say "$MAGENTA" "GitHub Jobs Summary"
  psql_exec -c "SELECT status, COUNT(*) as count FROM claude_context.github_jobs GROUP BY status ORDER BY status;" || true
  
  echo
  say "$MAGENTA" "Recent GitHub Jobs (last 10)"
  psql_exec -c "SELECT id, repo_org || '/' || repo_name as repository, branch, status, progress, created_at FROM claude_context.github_jobs ORDER BY created_at DESC LIMIT 10;" || true

  if [[ $SHOW_FULL == true ]]; then
    echo
    say "$MAGENTA" "Table Details"
    local tables
    tables=$(psql_sql "SELECT tablename FROM pg_tables WHERE schemaname = 'claude_context' ORDER BY tablename;")
    if [[ -z "$tables" ]]; then
      say "$YELLOW" "No tables found in schema claude_context."
    else
      while IFS= read -r table; do
        [[ -z "$table" ]] && continue
        echo
        say "$GREEN" "▶ claude_context.$table"
        psql_exec -c "\d+ claude_context.\"$table\""
      done <<< "$tables"
    fi
  fi
}

qdrant_overview() {
  pretty_header "Qdrant Overview"
  say "$YELLOW" "Endpoint : $QDRANT_URL"

  if ! command -v jq >/dev/null 2>&1; then
    echo "Warning: jq not installed. Showing raw JSON." >&2
    curl -s "$QDRANT_URL/collections"
    return
  fi

  local response
  response=$(curl -s "$QDRANT_URL/collections" || true)

  if [[ -z "$response" ]]; then
    say "$YELLOW" "No response from Qdrant API."
    return
  fi

  echo
  say "$MAGENTA" "Collections"
  echo "$response" | jq '.result.collections[]? | {name: .name, points_count: (.points_count // 0), vectors_count: (.vectors_count // 0)}'
}

main() {
  require_command docker
  require_command curl
  ensure_postgres
  ensure_qdrant

  postgres_overview
  qdrant_overview
}

main "$@"

