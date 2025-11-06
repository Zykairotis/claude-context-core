#!/bin/bash

# Migration script to add collection_name column to indexed_files table
# This links incremental sync to specific collections

echo "🔄 Starting migration: Add collection_name to indexed_files"

# Database connection details
DB_HOST="localhost"
DB_PORT="5533"
DB_NAME="claude_context"
DB_USER="postgres"
export PGPASSWORD="code-context-secure-password"

# Execute migration
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME << 'SQL'

-- Begin transaction
BEGIN;

-- Add collection_name column to indexed_files
ALTER TABLE claude_context.indexed_files
ADD COLUMN IF NOT EXISTS collection_name TEXT;

-- Note: We're NOT adding the foreign key constraint initially
-- because we need to backfill data first. The FK will be added
-- after backfill is complete.

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_indexed_files_collection
  ON claude_context.indexed_files(collection_name);

-- Verify column was added
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'claude_context' 
        AND table_name = 'indexed_files'
        AND column_name = 'collection_name'
    ) THEN
        RAISE NOTICE '✅ Column collection_name added to indexed_files';
    ELSE
        RAISE EXCEPTION '❌ Failed to add collection_name column';
    END IF;
END $$;

COMMIT;

SQL

if [ $? -eq 0 ]; then
    echo "✅ Migration completed successfully: collection_name added to indexed_files"
    echo "⚠️  Note: Foreign key constraint will be added after backfill"
else
    echo "❌ Migration failed"
    exit 1
fi
