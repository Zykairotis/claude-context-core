#!/usr/bin/env bash

set -euo pipefail

# ------------------------------------------------------------
# Clean PostgreSQL + Qdrant databases (data only, keep schema)
# ------------------------------------------------------------

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

POSTGRES_CONTAINER=${POSTGRES_CONTAINER:-claude-context-postgres}
POSTGRES_HOST=${POSTGRES_HOST:-localhost}
POSTGRES_PORT=${POSTGRES_PORT:-5533}
POSTGRES_USER=${POSTGRES_USER:-postgres}
POSTGRES_DB=${POSTGRES_DB:-claude_context}
COGNEE_DB=${COGNEE_DB:-cognee_db}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-code-context-secure-password}

QDRANT_URL=${QDRANT_URL:-http://localhost:6333}
NEO4J_CONTAINER=${NEO4J_CONTAINER:-claude-context-neo4j}
NEO4J_URL=${NEO4J_URL:-http://localhost:7474}
NEO4J_USER=${NEO4J_USER:-neo4j}
NEO4J_PASSWORD=${NEO4J_PASSWORD:-secure-graph-password}

FORCE=false
USE_COLOR=true

while [[ $# -gt 0 ]]; do
  case "$1" in
    --force|-f)
      FORCE=true
      shift
      ;;
    --no-color)
      USE_COLOR=false
      shift
      ;;
    --help|-h)
      cat <<'EOF'
Usage: scripts/db-clean.sh [--force] [--no-color]

Remove all data from:
  • PostgreSQL: claude_context schema + cognee_db database
  • Qdrant: all collections
  • Neo4j: all graph data

Preserves schemas, extensions, and container state.

Options:
  --force     Skip confirmation prompts.
  --no-color  Disable ANSI color output.
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
  RED='\033[1;31m'
  GREEN='\033[1;32m'
  YELLOW='\033[1;33m'
  CYAN='\033[1;36m'
  RESET='\033[0m'
else
  RED=''
  GREEN=''
  YELLOW=''
  CYAN=''
  RESET=''
fi

say() {
  printf '%b%s%b\n' "$1" "$2" "$RESET"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Error: required command '$1' not found" >&2
    exit 1
  fi
}

ensure_postgres() {
  if ! docker ps --filter "name=$POSTGRES_CONTAINER" --format '{{.Names}}' | grep -q "$POSTGRES_CONTAINER"; then
    echo "Error: PostgreSQL container '$POSTGRES_CONTAINER' is not running" >&2
    exit 1
  fi
}

ensure_qdrant() {
  if ! curl -sSf "$QDRANT_URL/collections" >/dev/null 2>&1; then
    echo "Warning: Unable to reach Qdrant at $QDRANT_URL" >&2
  fi
}

ensure_neo4j() {
  if ! docker ps --filter "name=$NEO4J_CONTAINER" --format '{{.Names}}' | grep -q "$NEO4J_CONTAINER"; then
    echo "Warning: Neo4j container '$NEO4J_CONTAINER' is not running" >&2
  fi
}

confirm_dangerous() {
  if [[ $FORCE == true ]]; then
    return
  fi

  echo
  say "$RED" "⚠️  This will remove ALL data from:"
  say "$RED" "   • PostgreSQL: claude_context schema + cognee_db database"
  say "$RED" "   • Qdrant: all collections"
  say "$RED" "   • Neo4j: all graph nodes and relationships"
  echo
  read -r -p "Proceed? (type 'yes' to continue): " answer
  if [[ "$answer" != "yes" ]]; then
    echo "Aborted."
    exit 0
  fi
}

psql_sql() {
  docker exec "$POSTGRES_CONTAINER" psql -At -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "$1"
}

psql_exec() {
  docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "$1"
}

show_state() {
  echo
  say "$CYAN" "═══════════════════════════════════════════="
  say "$CYAN" "  Current Database State"
  say "$CYAN" "═══════════════════════════════════════════="

  say "$YELLOW" "PostgreSQL - claude_context schema:"
  psql_exec "\dt+ claude_context.*" || echo "  (no tables)"

  echo
  say "$YELLOW" "PostgreSQL - cognee_db:"
  docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d "$COGNEE_DB" -c "\dt+ public.*" 2>/dev/null || echo "  (database not found or no tables)"

  echo
  say "$YELLOW" "Qdrant collections:"
  if command -v jq >/dev/null 2>&1; then
    curl -s "$QDRANT_URL/collections" | jq '.result.collections[]? | {name: .name, points_count: (.points_count // 0)}'
  else
    curl -s "$QDRANT_URL/collections"
  fi

  echo
  say "$YELLOW" "Neo4j graph data:"
  docker exec "$NEO4J_CONTAINER" cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" "MATCH (n) RETURN count(n) as node_count" 2>/dev/null || echo "  (unable to query)"
}

truncate_postgres() {
  # Clean claude_context schema
  local qualified_tables
  qualified_tables=$(psql_sql "SELECT string_agg(format('claude_context.%I', tablename), ', ') FROM pg_tables WHERE schemaname = 'claude_context';")

  if [[ -n "$qualified_tables" && "$qualified_tables" != "\\N" ]]; then
    say "$YELLOW" "Truncating claude_context schema tables..."
    psql_exec "TRUNCATE $qualified_tables RESTART IDENTITY CASCADE;"
    say "$GREEN" "✓ claude_context tables truncated."
  else
    say "$YELLOW" "No tables found in claude_context schema."
  fi

  # Clean cognee_db database
  echo
  say "$YELLOW" "Cleaning cognee_db database..."
  
  # Check if database exists
  local db_exists
  db_exists=$(docker exec "$POSTGRES_CONTAINER" psql -At -U "$POSTGRES_USER" -c "SELECT 1 FROM pg_database WHERE datname='$COGNEE_DB';")
  
  if [[ "$db_exists" == "1" ]]; then
    local cognee_tables
    cognee_tables=$(docker exec "$POSTGRES_CONTAINER" psql -At -U "$POSTGRES_USER" -d "$COGNEE_DB" -c "SELECT string_agg(format('%I', tablename), ', ') FROM pg_tables WHERE schemaname = 'public';")
    
    if [[ -n "$cognee_tables" && "$cognee_tables" != "\\N" ]]; then
      docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d "$COGNEE_DB" -c "TRUNCATE $cognee_tables RESTART IDENTITY CASCADE;"
      say "$GREEN" "✓ cognee_db tables truncated."
    else
      say "$YELLOW" "No tables found in cognee_db."
    fi
  else
    say "$YELLOW" "cognee_db database does not exist."
  fi
}

reset_collections_metadata() {
  say "$YELLOW" "Resetting collections metadata..."
  psql_exec "UPDATE claude_context.collections_metadata SET entity_count = 0, updated_at = NOW();"
}

clean_qdrant() {
  echo
  say "$YELLOW" "Deleting Qdrant collections..."
  if ! command -v jq >/dev/null 2>&1; then
    echo "Warning: jq not available; skipping Qdrant cleanup." >&2
    return
  fi

  local collections
  local response
  response=$(curl -s "$QDRANT_URL/collections" || true)
  collections=$(echo "$response" | jq -r '.result.collections[]?.name')

  if [[ -z "$collections" ]]; then
    say "$YELLOW" "No Qdrant collections to delete."
    return
  fi

  local deleted=0
  while IFS= read -r collection; do
    [[ -z "$collection" ]] && continue
    local status
    status=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$QDRANT_URL/collections/$collection")
    if [[ "$status" == "200" || "$status" == "202" || "$status" == "204" ]]; then
      say "$GREEN" "✓ Deleted Qdrant collection: $collection"
      deleted=$((deleted + 1))
    else
      say "$RED" "✗ Failed to delete Qdrant collection $collection (HTTP $status)"
    fi
  done <<< "$collections"

  say "$GREEN" "Qdrant collections deleted: $deleted"
}

clean_neo4j() {
  echo
  say "$YELLOW" "Cleaning Neo4j graph database..."
  
  if ! docker ps --filter "name=$NEO4J_CONTAINER" --format '{{.Names}}' | grep -q "$NEO4J_CONTAINER"; then
    say "$YELLOW" "Neo4j container not running, skipping."
    return
  fi

  # Delete all nodes and relationships
  if docker exec "$NEO4J_CONTAINER" cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" "MATCH (n) DETACH DELETE n" 2>/dev/null; then
    say "$GREEN" "✓ Neo4j graph data deleted."
  else
    say "$RED" "✗ Failed to clean Neo4j (may need manual cleanup)."
  fi
}

summary() {
  echo
  say "$CYAN" "═══════════════════════════════════════════="
  say "$CYAN" "  Cleanup Summary"
  say "$CYAN" "═══════════════════════════════════════════="

  say "$GREEN" "✓ PostgreSQL claude_context schema emptied."
  say "$GREEN" "✓ PostgreSQL cognee_db database emptied."
  say "$GREEN" "✓ Qdrant collections removed."
  say "$GREEN" "✓ Neo4j graph data deleted."
}

main() {
  require_command docker
  require_command curl
  ensure_postgres
  ensure_qdrant
  ensure_neo4j

  echo
  say "$CYAN" "PostgreSQL container : $POSTGRES_CONTAINER"
  say "$CYAN" "Cognee database      : $COGNEE_DB"
  say "$CYAN" "Qdrant endpoint      : $QDRANT_URL"
  say "$CYAN" "Neo4j container      : $NEO4J_CONTAINER"

  show_state
  confirm_dangerous

  truncate_postgres
  reset_collections_metadata
  clean_qdrant
  clean_neo4j

  summary

  echo
  say "$YELLOW" "Post-clean inspection:"
  "$ROOT_DIR/scripts/db-inspect.sh" --no-color || true
}

main "$@"

