#!/bin/bash

# Migration script to add dataset_collections table
# This table tracks the mapping between datasets and vector collections

echo "🔄 Starting migration: Add dataset_collections table"

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

-- Create dataset_collections table
CREATE TABLE IF NOT EXISTS claude_context.dataset_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID NOT NULL REFERENCES claude_context.datasets(id) ON DELETE CASCADE,
  collection_name TEXT NOT NULL UNIQUE,
  
  -- Collection metadata
  vector_db_type TEXT NOT NULL DEFAULT 'qdrant',
  dimension INTEGER NOT NULL DEFAULT 768,
  is_hybrid BOOLEAN NOT NULL DEFAULT true,
  point_count BIGINT NOT NULL DEFAULT 0,
  
  -- Timestamps
  last_indexed_at TIMESTAMPTZ,
  last_point_count_sync TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT one_collection_per_dataset UNIQUE(dataset_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS dataset_collections_dataset_idx 
  ON claude_context.dataset_collections(dataset_id);
  
CREATE INDEX IF NOT EXISTS dataset_collections_name_idx 
  ON claude_context.dataset_collections(collection_name);

-- Create trigger for updated_at timestamp
CREATE OR REPLACE FUNCTION claude_context.update_dataset_collections_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_dataset_collections_timestamp
    BEFORE UPDATE ON claude_context.dataset_collections
    FOR EACH ROW
    EXECUTE FUNCTION claude_context.update_dataset_collections_timestamp();

-- Verify table was created
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'claude_context' 
        AND table_name = 'dataset_collections'
    ) THEN
        RAISE NOTICE '✅ Table dataset_collections created successfully';
    ELSE
        RAISE EXCEPTION '❌ Failed to create dataset_collections table';
    END IF;
END $$;

COMMIT;

SQL

if [ $? -eq 0 ]; then
    echo "✅ Migration completed successfully: dataset_collections table added"
else
    echo "❌ Migration failed"
    exit 1
fi
