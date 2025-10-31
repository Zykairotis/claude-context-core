-- Cognee PostgreSQL Database Initialization Script
-- This script sets up the core schema for Cognee metadata storage

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For text search optimization

-- ============================================
-- Datasets Table
-- ============================================
CREATE TABLE IF NOT EXISTS datasets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(50) DEFAULT 'active',
    
    -- Indexes
    CONSTRAINT datasets_status_check CHECK (status IN ('active', 'archived', 'processing'))
);

CREATE INDEX IF NOT EXISTS idx_datasets_name ON datasets(name);
CREATE INDEX IF NOT EXISTS idx_datasets_status ON datasets(status);
CREATE INDEX IF NOT EXISTS idx_datasets_created_at ON datasets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_datasets_metadata ON datasets USING GIN (metadata);

-- ============================================
-- Documents Table
-- ============================================
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dataset_id UUID REFERENCES datasets(id) ON DELETE CASCADE,
    source_path TEXT NOT NULL,
    content_type VARCHAR(100),
    file_extension VARCHAR(20),
    file_size_bytes BIGINT,
    content_hash VARCHAR(64),  -- SHA256 hash for deduplication
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(50) DEFAULT 'pending',
    error_message TEXT,
    
    -- Indexes and constraints
    CONSTRAINT documents_status_check CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_documents_dataset_id ON documents(dataset_id);
CREATE INDEX IF NOT EXISTS idx_documents_source_path ON documents(source_path);
CREATE INDEX IF NOT EXISTS idx_documents_content_type ON documents(content_type);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_content_hash ON documents(content_hash);
CREATE INDEX IF NOT EXISTS idx_documents_processed_at ON documents(processed_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_metadata ON documents USING GIN (metadata);

-- ============================================
-- Chunks Table
-- ============================================
CREATE TABLE IF NOT EXISTS chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    content_length INTEGER,
    vector_id TEXT,  -- Reference to Qdrant vector ID
    graph_entity_ids TEXT[],  -- Array of Neo4j entity IDs
    embedding_model VARCHAR(100),
    embedding_dimension INTEGER,
    chunk_type TEXT NOT NULL DEFAULT 'normal',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT chunks_chunk_type_check CHECK (chunk_type IN ('normal', 'codeblock', 'image', 'link')),
    
    -- Unique constraint to prevent duplicate chunks
    UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_chunk_index ON chunks(chunk_index);
CREATE INDEX IF NOT EXISTS idx_chunks_vector_id ON chunks(vector_id);
CREATE INDEX IF NOT EXISTS idx_chunks_content_length ON chunks(content_length);
CREATE INDEX IF NOT EXISTS idx_chunks_metadata ON chunks USING GIN (metadata);
-- Full-text search on content
CREATE INDEX IF NOT EXISTS idx_chunks_content_trgm ON chunks USING GIN (content gin_trgm_ops);

-- ============================================
-- Processing Jobs Table
-- ============================================
CREATE TABLE IF NOT EXISTS processing_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_type VARCHAR(50) NOT NULL,
    dataset_id UUID REFERENCES datasets(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending',
    progress_percentage INTEGER DEFAULT 0,
    items_total INTEGER,
    items_processed INTEGER DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    CONSTRAINT processing_jobs_status_check CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    CONSTRAINT processing_jobs_progress_check CHECK (progress_percentage BETWEEN 0 AND 100)
);

CREATE INDEX IF NOT EXISTS idx_processing_jobs_job_type ON processing_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_dataset_id ON processing_jobs(dataset_id);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_status ON processing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_created_at ON processing_jobs(created_at DESC);

-- ============================================
-- Entity Mappings Table (links to Neo4j)
-- ============================================
CREATE TABLE IF NOT EXISTS entity_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_id VARCHAR(255) NOT NULL,  -- Neo4j node ID
    entity_type VARCHAR(100) NOT NULL,
    entity_name TEXT NOT NULL,
    source_document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    source_chunk_id UUID REFERENCES chunks(id) ON DELETE CASCADE,
    confidence_score FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    
    UNIQUE (entity_id, source_chunk_id)
);

CREATE INDEX IF NOT EXISTS idx_entity_mappings_entity_id ON entity_mappings(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_mappings_entity_type ON entity_mappings(entity_type);
CREATE INDEX IF NOT EXISTS idx_entity_mappings_source_document_id ON entity_mappings(source_document_id);
CREATE INDEX IF NOT EXISTS idx_entity_mappings_source_chunk_id ON entity_mappings(source_chunk_id);
CREATE INDEX IF NOT EXISTS idx_entity_mappings_entity_name_trgm ON entity_mappings USING GIN (entity_name gin_trgm_ops);

-- ============================================
-- System Metadata Table
-- ============================================
CREATE TABLE IF NOT EXISTS system_metadata (
    key VARCHAR(255) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert initial system metadata
INSERT INTO system_metadata (key, value) VALUES 
    ('schema_version', '"1.0.0"'::jsonb),
    ('initialized_at', to_jsonb(NOW())),
    ('cognee_version', '"0.1.0"'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- Triggers for updated_at timestamps
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to datasets
CREATE TRIGGER update_datasets_updated_at
    BEFORE UPDATE ON datasets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to system_metadata
CREATE TRIGGER update_system_metadata_updated_at
    BEFORE UPDATE ON system_metadata
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Views for convenient querying
-- ============================================

-- View: Document processing statistics by dataset
CREATE OR REPLACE VIEW dataset_statistics AS
SELECT 
    d.id,
    d.name,
    COUNT(DISTINCT doc.id) as total_documents,
    COUNT(DISTINCT CASE WHEN doc.status = 'completed' THEN doc.id END) as processed_documents,
    COUNT(DISTINCT CASE WHEN doc.status = 'failed' THEN doc.id END) as failed_documents,
    COUNT(DISTINCT c.id) as total_chunks,
    SUM(doc.file_size_bytes) as total_size_bytes,
    d.created_at,
    d.updated_at
FROM datasets d
LEFT JOIN documents doc ON d.id = doc.dataset_id
LEFT JOIN chunks c ON doc.id = c.document_id
GROUP BY d.id, d.name, d.created_at, d.updated_at;

-- View: Recent processing activity
CREATE OR REPLACE VIEW recent_processing_activity AS
SELECT 
    pj.id as job_id,
    pj.job_type,
    d.name as dataset_name,
    pj.status,
    pj.progress_percentage,
    pj.items_processed,
    pj.items_total,
    pj.started_at,
    pj.completed_at,
    EXTRACT(EPOCH FROM (COALESCE(pj.completed_at, NOW()) - pj.started_at)) as duration_seconds
FROM processing_jobs pj
LEFT JOIN datasets d ON pj.dataset_id = d.id
ORDER BY pj.created_at DESC
LIMIT 100;

-- ============================================
-- Grants (if needed for specific user)
-- ============================================
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO cognee;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO cognee;

-- ============================================
-- Completion message
-- ============================================
DO $$
BEGIN
    RAISE NOTICE 'Cognee database schema initialized successfully';
    RAISE NOTICE 'Schema version: 1.0.0';
    RAISE NOTICE 'Tables created: datasets, documents, chunks, processing_jobs, entity_mappings, system_metadata';
END $$;
