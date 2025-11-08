#!/bin/bash
# Force database reinitialization by terminating all connections first

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🔌 Terminating active database connections..."

# Terminate claude_context connections
docker exec claude-context-postgres psql -U postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'claude_context' AND pid <> pg_backend_pid();" \
  2>/dev/null || true

# Terminate cognee_db connections
docker exec claude-context-postgres psql -U postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'cognee_db' AND pid <> pg_backend_pid();" \
  2>/dev/null || true

echo "✅ Connections terminated"
echo ""
echo "🔄 Running database reinitialization..."
echo ""

# Run the actual reinit script
"$SCRIPT_DIR/db-reinit.sh" "$@"
