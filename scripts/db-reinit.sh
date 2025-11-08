#!/usr/bin/env bash

set -euo pipefail

# ------------------------------------------------------------
# Full database reinitialization (PostgreSQL + Qdrant)
# ------------------------------------------------------------

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICES_DIR="$ROOT_DIR/services"

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

FORCE=false
WITH_CONTAINERS=false

if [[ ! -f "$SERVICES_DIR/docker-compose.yml" ]]; then
  echo "Error: services/docker-compose.yml not found" >&2
  exit 1
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --force|-f)
      FORCE=true
      shift
      ;;
    --with-containers)
      WITH_CONTAINERS=true
      shift
      ;;
    --db-only)
      WITH_CONTAINERS=false
      shift
      ;;
    --help|-h)
      cat <<'EOF'
Usage: scripts/db-reinit.sh [--with-containers] [--force]

Explicitly cleans and drops:
  • PostgreSQL claude_context schema (CASCADE)
  • ALL tables in claude_context (dynamically discovered and truncated)
  • cognee_db database (complete recreation)
  • All Qdrant collections (vector data)
  • Neo4j graph database (knowledge graph)

Automatically restarts API server to recreate pg-boss job queue tables.

Options:
  --with-containers  Stop, recreate, and start docker compose services (postgres, qdrant, neo4j).
  --db-only          Only touch databases (default).
  --force            Skip confirmation prompts.
EOF
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

CYAN='\033[1;36m'
GREEN='\033[1;32m'
YELLOW='\033[1;33m'
RED='\033[1;31m'
RESET='\033[0m'

say() {
  printf '%b%s%b\n' "$1" "$2" "$RESET"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Error: required command '$1' not found" >&2
    exit 1
  fi
}

select_compose_cmd() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    DOCKER_COMPOSE_CMD=(docker compose)
  elif command -v docker-compose >/dev/null 2>&1; then
    DOCKER_COMPOSE_CMD=(docker-compose)
  else
    echo "Error: docker compose/docker-compose not available" >&2
    exit 1
  fi
}

ensure_postgres() {
  if ! docker ps --filter "name=$POSTGRES_CONTAINER" --format '{{.Names}}' | grep -q "$POSTGRES_CONTAINER"; then
    echo "Error: PostgreSQL container '$POSTGRES_CONTAINER' is not running" >&2
    exit 1
  fi
}

psql_exec() {
  docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "$1"
}

wait_for_health() {
  local container=$1
  local retries=40
  local delay=3
  say "$YELLOW" "Waiting for $container to report healthy..."
  for ((i=1; i<=retries; i++)); do
    local status
    status=$(docker ps --filter "name=$container" --format '{{.Status}}') || status=''
    if [[ "$status" == *"(healthy)"* ]]; then
      say "$GREEN" "$container is healthy."
      return 0
    fi
    sleep "$delay"
  done
  say "$RED" "Timed out waiting for $container health status."
  return 1
}

confirm_action() {
  if [[ $FORCE == true ]]; then
    return
  fi

  echo
  say "$RED" "⚠️  This will TRUNCATE ALL TABLES in claude_context schema (dynamically discovered)"
  say "$RED" "⚠️  Then DROP and recreate the entire PostgreSQL schema (CASCADE)"
  say "$RED" "⚠️  Delete ALL Qdrant vector collections"
  say "$RED" "⚠️  Recreate cognee_db database completely"
  say "$RED" "⚠️  Clean Neo4j graph database (all nodes and relationships)"
  if [[ $WITH_CONTAINERS == true ]]; then
    say "$RED" "⚠️  Containers postgres, qdrant, and neo4j will be stopped and recreated."
  fi
  say "$RED" ""
  say "$RED" "ALL DATA WILL BE PERMANENTLY DELETED!"
  read -r -p "Proceed? (type 'reinit' to continue): " answer
  if [[ "$answer" != "reinit" ]]; then
    echo "Aborted."
    exit 0
  fi
}

recreate_containers() {
  select_compose_cmd
  pushd "$SERVICES_DIR" >/dev/null
  say "$YELLOW" "Stopping compose services (postgres, qdrant)..."
  "${DOCKER_COMPOSE_CMD[@]}" stop postgres qdrant
  say "$YELLOW" "Rebuilding core library..."
  pushd "$ROOT_DIR" >/dev/null
  if ! npm run build 2>&1 | grep -i "error" >&2; then
    say "$GREEN" "Core library rebuilt successfully"
  else
    say "$RED" "Warning: Core library build had errors (continuing anyway)"
  fi
  popd >/dev/null
  
  say "$YELLOW" "Rebuilding API server..."
  pushd "$SERVICES_DIR/api-server" >/dev/null
  if ! npm run build 2>&1 | grep -i "error" >&2; then
    say "$GREEN" "API server rebuilt successfully"
  else
    say "$RED" "Warning: API server build had errors (continuing anyway)"
  fi
  popd >/dev/null

  say "$YELLOW" "Removing containers and volumes..."
  "${DOCKER_COMPOSE_CMD[@]}" down --volumes
  say "$YELLOW" "Starting postgres and qdrant..."
  "${DOCKER_COMPOSE_CMD[@]}" up -d postgres qdrant

  wait_for_health "$POSTGRES_CONTAINER"
  wait_for_health claude-context-qdrant || true
}

clean_critical_tables() {
  say "$YELLOW" "Explicitly cleaning ALL tables before schema drop..."
  
  # Get list of all tables in claude_context schema (excluding views)
  local tables
  tables=$(docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c \
    "SELECT tablename FROM pg_tables WHERE schemaname = 'claude_context';" 2>/dev/null | tr -d ' ') || true
  
  if [[ -z "$tables" ]]; then
    say "$YELLOW" "No tables found in claude_context schema."
    return 0
  fi
  
  local table_count=0
  while IFS= read -r table; do
    [[ -z "$table" ]] && continue
    
    # Try to truncate, ignore errors
    if docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
       -c "TRUNCATE TABLE claude_context.\"$table\" CASCADE;" >/dev/null 2>&1; then
      say "$GREEN" "  ✓ Truncated: $table"
      ((table_count++)) || true
    else
      say "$YELLOW" "  ⚠ Skipped: $table (may have dependencies or be protected)"
    fi
  done <<< "$tables"
  
  say "$GREEN" "Cleaned $table_count tables (will be fully removed by schema drop)."
  return 0
}

drop_schema() {
  say "$YELLOW" "Dropping schema claude_context..."
  psql_exec "DROP SCHEMA IF EXISTS claude_context CASCADE;"
}

create_schema_and_extensions() {
  say "$YELLOW" "Recreating schema and extensions..."
  psql_exec "CREATE SCHEMA IF NOT EXISTS claude_context;"
  psql_exec "CREATE EXTENSION IF NOT EXISTS vector;"
  psql_exec "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
  psql_exec "CREATE EXTENSION IF NOT EXISTS pg_trgm;"
  psql_exec "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
}

run_init_scripts() {
  local scripts=(
    "$ROOT_DIR/services/init-scripts/01-init-pgvector.sql"
    "$ROOT_DIR/services/init-scripts/02-init-schema.sql"
    "$ROOT_DIR/services/init-scripts/03-github-jobs.sql"
    "$ROOT_DIR/services/init-scripts/04-dataset-collections.sql"
  )

  for init_script in "${scripts[@]}"; do
    if [[ ! -f "$init_script" ]]; then
      say "$RED" "Init script not found: $init_script"
      exit 1
    fi

    say "$YELLOW" "Running init script: $init_script"
    docker exec -i "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$init_script"
  done
}

run_migrations() {
  local migrations_dir="$ROOT_DIR/services/migrations"
  
  if [[ ! -d "$migrations_dir" ]]; then
    say "$YELLOW" "No migrations directory found, skipping migrations."
    return
  fi

  local migrations=(
    "$migrations_dir/web_provenance.sql"
    "$migrations_dir/mesh_tables.sql"
  )

  for migration in "${migrations[@]}"; do
    if [[ ! -f "$migration" ]]; then
      say "$YELLOW" "Migration not found: $migration (skipping)"
      continue
    fi

    say "$YELLOW" "Running migration: $(basename "$migration")"
    docker exec -i "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$migration"
  done
}

clean_qdrant() {
  say "$YELLOW" "Deleting Qdrant collections..."
  if ! command -v jq >/dev/null 2>&1; then
    echo "Warning: jq not available; skipping Qdrant cleanup." >&2
    return
  fi

  local response collections
  response=$(curl -s "$QDRANT_URL/collections" || true)
  collections=$(echo "$response" | jq -r '.result.collections[]?.name')

  if [[ -z "$collections" ]]; then
    say "$YELLOW" "No Qdrant collections found."
    return
  fi

  while IFS= read -r collection; do
    [[ -z "$collection" ]] && continue
    local status
    status=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$QDRANT_URL/collections/$collection")
    if [[ "$status" == "200" || "$status" == "202" || "$status" == "204" ]]; then
      say "$GREEN" "Deleted Qdrant collection: $collection"
    else
      say "$RED" "Failed to delete Qdrant collection $collection (HTTP $status)"
    fi
  done <<< "$collections"
}

recreate_cognee_db() {
  say "$YELLOW" "Recreating cognee_db database..."
  
  # Drop and recreate cognee_db
  psql_exec "DROP DATABASE IF EXISTS $COGNEE_DB;"
  psql_exec "CREATE DATABASE $COGNEE_DB OWNER $POSTGRES_USER;"
  
  # Add extensions to cognee_db
  docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d "$COGNEE_DB" -c "CREATE EXTENSION IF NOT EXISTS vector;"
  docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d "$COGNEE_DB" -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
  
  say "$GREEN" "cognee_db database recreated."
}

clean_neo4j() {
  say "$YELLOW" "Cleaning Neo4j graph database..."
  
  if ! docker ps --filter "name=$NEO4J_CONTAINER" --format '{{.Names}}' | grep -q "$NEO4J_CONTAINER"; then
    say "$YELLOW" "Neo4j container not running, skipping."
    return
  fi

  # Delete all nodes and relationships
  if docker exec "$NEO4J_CONTAINER" cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" "MATCH (n) DETACH DELETE n" 2>/dev/null; then
    say "$GREEN" "Neo4j graph data deleted."
  else
    say "$YELLOW" "Failed to clean Neo4j (may need manual cleanup)."
  fi
}

restart_api_server() {
  local api_container="claude-context-api-server"
  
  if ! docker ps --filter "name=$api_container" --format '{{.Names}}' | grep -q "$api_container"; then
    say "$YELLOW" "API server container not running, skipping restart."
    return 0
  fi

  say "$YELLOW" "Restarting API server to recreate pg-boss tables..."
  select_compose_cmd
  pushd "$SERVICES_DIR" >/dev/null
  "${DOCKER_COMPOSE_CMD[@]}" restart api-server >/dev/null 2>&1 || true
  popd >/dev/null

  # Wait for API server to start
  say "$YELLOW" "Waiting for API server to start..."
  sleep 5

  # Wait for pg-boss tables to be created (max 60 seconds)
  say "$YELLOW" "Waiting for pg-boss tables to be created..."
  local max_wait=60
  local waited=0
  local interval=2

  while [[ $waited -lt $max_wait ]]; do
    if psql_exec "SELECT 1 FROM information_schema.tables WHERE table_schema = 'claude_context' AND table_name = 'job'" 2>/dev/null | grep -q "1"; then
      say "$GREEN" "pg-boss tables created successfully."
      return 0
    fi
    sleep $interval
    waited=$((waited + interval))
  done

  say "$RED" "Warning: pg-boss tables not found after $max_wait seconds."
  say "$YELLOW" "API server may need manual restart or there may be connection issues."
  return 1
}

postgres_summary() {
  say "$CYAN" "PostgreSQL state after reinit:"
  psql_exec "\dt+ claude_context.*"
  psql_exec "\dx"
}

main() {
  require_command docker
  require_command curl

  confirm_action

  if [[ $WITH_CONTAINERS == true ]]; then
    recreate_containers
  else
    ensure_postgres
  fi

  # Clean critical tables first before dropping schema
  clean_critical_tables
  
  drop_schema
  create_schema_and_extensions
  run_init_scripts
  run_migrations
  
  recreate_cognee_db
  clean_qdrant
  clean_neo4j

  # Restart API server to recreate pg-boss tables
  restart_api_server || true

  say "$GREEN" "Reinitialization complete."
  postgres_summary
  echo
  say "$CYAN" "Run scripts/db-inspect.sh --full for detailed inspection."
}

main "$@"

