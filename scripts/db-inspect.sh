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
COGNEE_DB=${COGNEE_DB:-cognee_db}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-code-context-secure-password}

QDRANT_URL=${QDRANT_URL:-http://localhost:6333}
NEO4J_CONTAINER=${NEO4J_CONTAINER:-claude-context-neo4j}
NEO4J_USER=${NEO4J_USER:-neo4j}
NEO4J_PASSWORD=${NEO4J_PASSWORD:-secure-graph-password}

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
  say "$MAGENTA" "All Tables with Exact Row Counts"
  local tables
  tables=$(psql_sql "SELECT tablename FROM pg_tables WHERE schemaname = 'claude_context' ORDER BY tablename;")
  
  if [[ -z "$tables" ]]; then
    say "$YELLOW" "No tables found in claude_context schema."
  else
    printf "%-30s %15s\n" "Table" "Row Count"
    printf "%s\n" "────────────────────────────────────────────────"
    while IFS= read -r table; do
      [[ -z "$table" ]] && continue
      local count
      count=$(psql_sql "SELECT COUNT(*) FROM claude_context.\"$table\";" 2>/dev/null || echo "ERROR")
      printf "%-30s %15s\n" "$table" "$count"
    done <<< "$tables"
  fi

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

  echo
  say "$MAGENTA" "Mesh Nodes Summary"
  psql_exec -c "SELECT project, type, status, COUNT(*) as count FROM claude_context.mesh_nodes GROUP BY project, type, status ORDER BY project, type;" || true

  echo
  say "$MAGENTA" "Web Provenance Summary"
  psql_exec -c "SELECT domain, COUNT(*) as pages, MAX(last_indexed_at) as last_indexed FROM claude_context.web_provenance GROUP BY domain ORDER BY pages DESC LIMIT 10;" || true

  if [[ $SHOW_FULL == true ]]; then
    echo
    say "$MAGENTA" "Table Details (Schema + Sample Data)"
    local tables
    tables=$(psql_sql "SELECT tablename FROM pg_tables WHERE schemaname = 'claude_context' ORDER BY tablename;")
    if [[ -z "$tables" ]]; then
      say "$YELLOW" "No tables found in schema claude_context."
    else
      while IFS= read -r table; do
        [[ -z "$table" ]] && continue
        echo
        say "$GREEN" "▶▶▶ claude_context.$table"
        
        # Show table schema
        echo
        say "$YELLOW" "Schema:"
        psql_exec -c "\d+ claude_context.\"$table\""
        
        # Show row count
        local count
        count=$(psql_sql "SELECT COUNT(*) FROM claude_context.\"$table\";" 2>/dev/null || echo "0")
        echo
        say "$YELLOW" "Total Rows: $count"
        
        # Show sample data if table has rows
        if [[ "$count" -gt 0 ]]; then
          echo
          say "$YELLOW" "Sample Data (first 5 rows):"
          psql_exec -c "SELECT * FROM claude_context.\"$table\" LIMIT 5;"
        else
          echo
          say "$YELLOW" "⚠ Table is empty (no data)"
        fi
        
        echo
        printf "%s\n" "────────────────────────────────────────────────────────────────"
      done <<< "$tables"
    fi
  fi
}

cognee_db_overview() {
  pretty_header "Cognee Database Overview"
  say "$YELLOW" "Database : $COGNEE_DB"
  
  # Check if cognee_db exists
  local db_exists
  db_exists=$(docker exec "$POSTGRES_CONTAINER" psql -At -U "$POSTGRES_USER" -c "SELECT 1 FROM pg_database WHERE datname='$COGNEE_DB';" 2>/dev/null || echo "")
  
  if [[ "$db_exists" != "1" ]]; then
    say "$YELLOW" "cognee_db database does not exist."
    return
  fi
  
  echo
  say "$MAGENTA" "Tables"
  docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d "$COGNEE_DB" -c "\dt+ public.*" 2>/dev/null || say "$YELLOW" "No tables found."
  
  if [[ $SHOW_FULL == true ]]; then
    echo
    say "$MAGENTA" "Table Details"
    local tables
    tables=$(docker exec "$POSTGRES_CONTAINER" psql -At -U "$POSTGRES_USER" -d "$COGNEE_DB" -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;" 2>/dev/null)
    if [[ -n "$tables" ]]; then
      while IFS= read -r table; do
        [[ -z "$table" ]] && continue
        echo
        say "$GREEN" "▶ public.$table"
        docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d "$COGNEE_DB" -c "\d+ public.\"$table\""
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

neo4j_overview() {
  pretty_header "Neo4j Graph Database Overview"
  say "$YELLOW" "Container : $NEO4J_CONTAINER"
  
  if ! docker ps --filter "name=$NEO4J_CONTAINER" --format '{{.Names}}' | grep -q "$NEO4J_CONTAINER"; then
    say "$YELLOW" "Neo4j container not running."
    return
  fi
  
  echo
  say "$MAGENTA" "Node Count"
  docker exec "$NEO4J_CONTAINER" cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" "MATCH (n) RETURN count(n) as node_count" 2>/dev/null || say "$YELLOW" "Unable to query Neo4j."
  
  echo
  say "$MAGENTA" "Relationship Count"
  docker exec "$NEO4J_CONTAINER" cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" "MATCH ()-[r]->() RETURN count(r) as relationship_count" 2>/dev/null || say "$YELLOW" "Unable to query Neo4j."
  
  if [[ $SHOW_FULL == true ]]; then
    echo
    say "$MAGENTA" "Node Types"
    docker exec "$NEO4J_CONTAINER" cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" "MATCH (n) RETURN DISTINCT labels(n) as label, count(*) as count ORDER BY count DESC" 2>/dev/null || true
  fi
}

main() {
  require_command docker
  require_command curl
  ensure_postgres
  ensure_qdrant

  postgres_overview
  cognee_db_overview
  qdrant_overview
  neo4j_overview
}

main "$@"

