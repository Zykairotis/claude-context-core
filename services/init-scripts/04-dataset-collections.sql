-- Create dataset_collections table for tracking collection mappings
-- This table links datasets to their Qdrant collections for proper isolation

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

-- Create indexes for efficient lookups
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
