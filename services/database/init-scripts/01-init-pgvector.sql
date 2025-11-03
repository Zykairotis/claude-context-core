-- Simple pgvector initialization for claude-context (backup copy)

CREATE EXTENSION IF NOT EXISTS vector;

CREATE SCHEMA IF NOT EXISTS claude_context;

SET search_path TO claude_context, public;

CREATE TABLE IF NOT EXISTS claude_context.collections_metadata (
    collection_name TEXT PRIMARY KEY,
    dimension INTEGER NOT NULL,
    has_dual_vectors BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    entity_count INTEGER DEFAULT 0
);

GRANT ALL PRIVILEGES ON SCHEMA claude_context TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA claude_context TO postgres;

DO $$
BEGIN
    RAISE NOTICE '✅ PostgreSQL with pgvector initialized (backup)';
END $$;

