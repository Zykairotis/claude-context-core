#!/bin/bash

# Ensure indexed_files table exists for SHA-256 tracking
# This is required for the checkIndex tool to work

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Checking indexed_files table for SHA-256 tracking...${NC}"

# Database connection
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5533}"
DB_NAME="${POSTGRES_DB:-claude_context}"
DB_USER="${POSTGRES_USER:-postgres}"
DB_PASSWORD="${POSTGRES_PASSWORD:-code-context-secure-password}"

export PGPASSWORD=$DB_PASSWORD

# Check if table exists
TABLE_EXISTS=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'claude_context' 
        AND table_name = 'indexed_files'
    );
" | xargs)

if [ "$TABLE_EXISTS" = "t" ]; then
    echo -e "${GREEN}✅ Table 'indexed_files' already exists${NC}"
    
    # Check columns
    echo "Checking table structure..."
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'claude_context' 
        AND table_name = 'indexed_files'
        AND column_name IN ('sha256_hash', 'file_path', 'file_size', 'chunk_count')
        ORDER BY ordinal_position;
    "
else
    echo -e "${YELLOW}Creating indexed_files table...${NC}"
    
    # Create table
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME <<EOF
-- Create schema if not exists
CREATE SCHEMA IF NOT EXISTS claude_context;

-- File metadata tracking for incremental sync
CREATE TABLE IF NOT EXISTS claude_context.indexed_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    dataset_id UUID NOT NULL,
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_indexed_files_lookup 
ON claude_context.indexed_files(project_id, dataset_id, file_path);

CREATE INDEX IF NOT EXISTS idx_indexed_files_hash 
ON claude_context.indexed_files(sha256_hash);

CREATE INDEX IF NOT EXISTS idx_indexed_files_dataset 
ON claude_context.indexed_files(dataset_id);

-- Add foreign key constraints if tables exist
DO \$\$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'claude_context' 
        AND table_name = 'projects'
    ) THEN
        ALTER TABLE claude_context.indexed_files 
        ADD CONSTRAINT fk_indexed_files_project 
        FOREIGN KEY (project_id) 
        REFERENCES claude_context.projects(id) 
        ON DELETE CASCADE;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'claude_context' 
        AND table_name = 'datasets'
    ) THEN
        ALTER TABLE claude_context.indexed_files 
        ADD CONSTRAINT fk_indexed_files_dataset 
        FOREIGN KEY (dataset_id) 
        REFERENCES claude_context.datasets(id) 
        ON DELETE CASCADE;
    END IF;
END\$\$;
EOF

    echo -e "${GREEN}✅ Table 'indexed_files' created successfully${NC}"
fi

# Show statistics
echo ""
echo -e "${YELLOW}Current indexed files statistics:${NC}"
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
    SELECT 
        p.name as project,
        d.name as dataset,
        COUNT(f.id) as files_indexed,
        SUM(f.chunk_count) as total_chunks,
        pg_size_pretty(SUM(f.file_size)) as total_size,
        MAX(f.last_indexed_at) as last_indexed
    FROM claude_context.indexed_files f
    JOIN claude_context.projects p ON p.id = f.project_id
    JOIN claude_context.datasets d ON d.id = f.dataset_id
    GROUP BY p.name, d.name
    ORDER BY p.name, d.name;
" 2>/dev/null || echo "No indexed files yet"

echo -e "${GREEN}✅ Database ready for SHA-256 based index checking${NC}"
