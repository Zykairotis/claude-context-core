-- Simple pgvector initialization for claude-context
-- Just enable the extension and create basic schema

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create schema for better organization
CREATE SCHEMA IF NOT EXISTS claude_context;

-- Set default schema
SET search_path TO claude_context, public;

-- Create basic metadata table
CREATE TABLE IF NOT EXISTS claude_context.collections_metadata (
    collection_name TEXT PRIMARY KEY,
    dimension INTEGER NOT NULL,
    has_dual_vectors BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    entity_count INTEGER DEFAULT 0
);

-- Grant permissions
GRANT ALL PRIVILEGES ON SCHEMA claude_context TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA claude_context TO postgres;

DO $$
BEGIN
    RAISE NOTICE '✅ PostgreSQL with pgvector initialized';
    RAISE NOTICE '   - pgvector extension enabled';
    RAISE NOTICE '   - Schema "claude_context" created';
END $$;