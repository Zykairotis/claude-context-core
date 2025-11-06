#!/usr/bin/env bash
#
# migrate-add-indexed-files.sh
# Add indexed_files table for incremental sync feature
#

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-claude-context-postgres}"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5533}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-claude_context}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-code-context-secure-password}"

# Helper functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $*"
}

success() {
    echo -e "${GREEN}✓${NC} $*"
}

error() {
    echo -e "${RED}✗${NC} $*" >&2
}

warning() {
    echo -e "${YELLOW}⚠${NC} $*"
}

# Check if PostgreSQL container is running
check_postgres() {
    if ! docker ps | grep -q "$POSTGRES_CONTAINER"; then
        error "PostgreSQL container '$POSTGRES_CONTAINER' is not running"
        echo "Start it with: cd services && docker compose up -d postgres"
        exit 1
    fi
    success "PostgreSQL container is running"
}

# Execute SQL via docker exec
exec_sql() {
    local sql="$1"
    docker exec -i "$POSTGRES_CONTAINER" \
        psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
        -c "$sql" 2>&1
}

# Check if table already exists
check_table_exists() {
    local result
    result=$(exec_sql "SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'claude_context' 
        AND table_name = 'indexed_files'
    );" | grep -oP '(t|f)' | head -1)
    
    if [ "$result" = "t" ]; then
        return 0  # exists
    else
        return 1  # doesn't exist
    fi
}

# Create indexed_files table
create_table() {
    log "Creating indexed_files table..."
    
    local sql=$(cat <<'EOF'
-- File metadata tracking for incremental sync
CREATE TABLE IF NOT EXISTS claude_context.indexed_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES claude_context.projects(id) ON DELETE CASCADE,
    dataset_id UUID NOT NULL REFERENCES claude_context.datasets(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    relative_path TEXT NOT NULL,
    sha256_hash TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    last_indexed_at TIMESTAMPTZ DEFAULT NOW(),
    chunk_count INTEGER DEFAULT 0,
    language TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, dataset_id, file_path)
);
EOF
    )
    
    exec_sql "$sql" > /dev/null
    success "Table created"
}

# Create indexes
create_indexes() {
    log "Creating indexes..."
    
    exec_sql "CREATE INDEX IF NOT EXISTS idx_indexed_files_lookup 
              ON claude_context.indexed_files(project_id, dataset_id, file_path);" > /dev/null
    
    exec_sql "CREATE INDEX IF NOT EXISTS idx_indexed_files_hash 
              ON claude_context.indexed_files(sha256_hash);" > /dev/null
    
    exec_sql "CREATE INDEX IF NOT EXISTS idx_indexed_files_dataset 
              ON claude_context.indexed_files(dataset_id);" > /dev/null
    
    success "Indexes created"
}

# Create trigger for updated_at timestamp
create_trigger() {
    log "Creating timestamp trigger..."
    
    local sql=$(cat <<'EOF'
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION claude_context.update_indexed_files_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
DROP TRIGGER IF EXISTS trigger_update_indexed_files_timestamp ON claude_context.indexed_files;
CREATE TRIGGER trigger_update_indexed_files_timestamp
    BEFORE UPDATE ON claude_context.indexed_files
    FOR EACH ROW
    EXECUTE FUNCTION claude_context.update_indexed_files_timestamp();
EOF
    )
    
    exec_sql "$sql" > /dev/null
    success "Trigger created"
}

# Verify migration
verify_migration() {
    log "Verifying migration..."
    
    # Check table exists
    if ! check_table_exists; then
        error "Table was not created successfully"
        exit 1
    fi
    
    # Check indexes
    local index_count
    index_count=$(exec_sql "SELECT COUNT(*) FROM pg_indexes 
                            WHERE schemaname = 'claude_context' 
                            AND tablename = 'indexed_files';" | grep -oP '\d+' | head -1)
    
    if [ "$index_count" -lt 3 ]; then
        error "Not all indexes were created (found $index_count, expected 3+)"
        exit 1
    fi
    
    # Check trigger
    local trigger_count
    trigger_count=$(exec_sql "SELECT COUNT(*) FROM pg_trigger 
                              WHERE tgname = 'trigger_update_indexed_files_timestamp';" | grep -oP '\d+' | head -1)
    
    if [ "$trigger_count" -lt 1 ]; then
        error "Trigger was not created"
        exit 1
    fi
    
    success "Migration verified successfully"
}

# Show table info
show_table_info() {
    log "Table information:"
    
    echo ""
    echo "Columns:"
    exec_sql "\d claude_context.indexed_files" | grep -A 20 "Column"
    
    echo ""
    echo "Indexes:"
    exec_sql "\d claude_context.indexed_files" | grep -A 10 "Indexes:"
    
    echo ""
    echo "Triggers:"
    exec_sql "\d claude_context.indexed_files" | grep -A 5 "Triggers:"
}

# Main execution
main() {
    echo ""
    log "Incremental Sync Migration Script"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # Check prerequisites
    check_postgres
    
    # Check if already migrated
    if check_table_exists; then
        warning "Table 'indexed_files' already exists"
        echo ""
        read -p "Do you want to show table info? (y/N): " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            show_table_info
        fi
        exit 0
    fi
    
    # Confirm migration
    echo ""
    warning "This will add the 'indexed_files' table to your database"
    echo "This is required for the incremental sync feature."
    echo ""
    read -p "Continue with migration? (y/N): " -n 1 -r
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log "Migration cancelled"
        exit 0
    fi
    
    echo ""
    
    # Run migration steps
    create_table
    create_indexes
    create_trigger
    
    echo ""
    
    # Verify
    verify_migration
    
    echo ""
    show_table_info
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    success "Migration completed successfully!"
    echo ""
    log "Next steps:"
    echo "  1. Run a full index to populate file metadata:"
    echo "     claudeContext.indexLocal({ path: '/path/to/project' })"
    echo ""
    echo "  2. Use incremental sync for fast updates:"
    echo "     claudeContext.syncLocal({ path: '/path/to/project' })"
    echo ""
    log "See docs/INCREMENTAL-SYNC.md for detailed usage"
    echo ""
}

# Run main function
main
