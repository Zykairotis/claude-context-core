-- Enhanced Schema for Web Crawling and Improved Qdrant Integration
-- This script adds web page support and improves vector storage

-- ============================================
-- Web Pages Table (Crawl4AI Integration)
-- ============================================
CREATE TABLE IF NOT EXISTS web_pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    url TEXT NOT NULL UNIQUE,
    domain VARCHAR(255),
    title TEXT,
    description TEXT,
    
    -- Crawl4AI specific fields
    html_content TEXT,
    markdown_content TEXT,
    cleaned_content TEXT,  -- Main extracted content
    
    -- Metadata
    crawled_at TIMESTAMP WITH TIME ZONE,
    last_modified TIMESTAMP WITH TIME ZONE,
    content_type VARCHAR(100),
    status_code INTEGER,
    language VARCHAR(10),
    
    -- SEO & Structure
    meta_tags JSONB DEFAULT '{}'::jsonb,
    links JSONB DEFAULT '{}'::jsonb,  -- Internal and external links
    images JSONB DEFAULT '{}'::jsonb,  -- Image URLs and alt text
    
    -- Processing
    dataset_id UUID REFERENCES datasets(id) ON DELETE CASCADE,
    processed BOOLEAN DEFAULT FALSE,
    processing_status VARCHAR(50) DEFAULT 'pending',
    error_message TEXT,
    
    -- Content analysis
    word_count INTEGER,
    content_hash VARCHAR(64),  -- For deduplication
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Additional metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    CONSTRAINT web_pages_status_check CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed'))
);

-- Indexes for web_pages
CREATE INDEX IF NOT EXISTS idx_web_pages_url ON web_pages(url);
CREATE INDEX IF NOT EXISTS idx_web_pages_domain ON web_pages(domain);
CREATE INDEX IF NOT EXISTS idx_web_pages_dataset_id ON web_pages(dataset_id);
CREATE INDEX IF NOT EXISTS idx_web_pages_crawled_at ON web_pages(crawled_at DESC);
CREATE INDEX IF NOT EXISTS idx_web_pages_processing_status ON web_pages(processing_status);
CREATE INDEX IF NOT EXISTS idx_web_pages_content_hash ON web_pages(content_hash);
CREATE INDEX IF NOT EXISTS idx_web_pages_metadata ON web_pages USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_web_pages_meta_tags ON web_pages USING GIN (meta_tags);
-- Full-text search on cleaned content
CREATE INDEX IF NOT EXISTS idx_web_pages_content_trgm ON web_pages USING GIN (cleaned_content gin_trgm_ops);

-- ============================================
-- Enhanced Chunks Table (Add Summary Support)
-- ============================================
-- Add new columns to existing chunks table for dual-vector support
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS summary_vector_id TEXT;
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS web_page_id UUID REFERENCES web_pages(id) ON DELETE CASCADE;

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_chunks_summary_vector_id ON chunks(summary_vector_id);
CREATE INDEX IF NOT EXISTS idx_chunks_web_page_id ON chunks(web_page_id);

-- Update the unique constraint to include web_page_id
-- (Drop old constraint and create new one)
ALTER TABLE chunks DROP CONSTRAINT IF EXISTS chunks_document_id_chunk_index_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_chunks_unique_doc_chunk ON chunks(document_id, chunk_index) WHERE web_page_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_chunks_unique_web_chunk ON chunks(web_page_id, chunk_index) WHERE document_id IS NULL;

-- ============================================
-- Vector Metadata Table (Optional but Recommended)
-- ============================================
-- Store metadata about vectors in Qdrant for easier querying
CREATE TABLE IF NOT EXISTS vector_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vector_id TEXT NOT NULL UNIQUE,  -- Qdrant vector ID
    chunk_id UUID REFERENCES chunks(id) ON DELETE CASCADE,
    vector_type VARCHAR(50) NOT NULL,  -- 'content', 'summary'
    collection_name VARCHAR(255) NOT NULL,  -- Qdrant collection name
    
    -- Embedding details
    embedding_model VARCHAR(100),
    embedding_dimension INTEGER,
    embedding_created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Qdrant payload snapshot (for quick access)
    qdrant_payload JSONB,
    
    -- Re-ranking support
    rerank_score FLOAT,  -- Stored re-rank score
    rerank_model VARCHAR(100),  -- Model used for re-ranking
    rerank_updated_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vector_metadata_vector_id ON vector_metadata(vector_id);
CREATE INDEX IF NOT EXISTS idx_vector_metadata_chunk_id ON vector_metadata(chunk_id);
CREATE INDEX IF NOT EXISTS idx_vector_metadata_collection ON vector_metadata(collection_name);
CREATE INDEX IF NOT EXISTS idx_vector_metadata_type ON vector_metadata(vector_type);
CREATE INDEX IF NOT EXISTS idx_vector_metadata_rerank_score ON vector_metadata(rerank_score DESC);

-- ============================================
-- Crawl Sessions Table (Track Crawling Jobs)
-- ============================================
CREATE TABLE IF NOT EXISTS crawl_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dataset_id UUID REFERENCES datasets(id) ON DELETE CASCADE,
    
    -- Session details
    start_url TEXT NOT NULL,
    crawl_type VARCHAR(50) DEFAULT 'single',  -- 'single', 'sitemap', 'recursive'
    max_depth INTEGER DEFAULT 1,
    max_pages INTEGER DEFAULT 100,
    
    -- Status
    status VARCHAR(50) DEFAULT 'pending',
    pages_crawled INTEGER DEFAULT 0,
    pages_failed INTEGER DEFAULT 0,
    
    -- Crawl4AI configuration
    crawl_config JSONB DEFAULT '{}'::jsonb,
    
    -- Timing
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Results
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    CONSTRAINT crawl_sessions_status_check CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_crawl_sessions_dataset_id ON crawl_sessions(dataset_id);
CREATE INDEX IF NOT EXISTS idx_crawl_sessions_status ON crawl_sessions(status);
CREATE INDEX IF NOT EXISTS idx_crawl_sessions_created_at ON crawl_sessions(created_at DESC);

-- ============================================
-- Re-ranking Results Table (Store Re-rank Scores)
-- ============================================
CREATE TABLE IF NOT EXISTS rerank_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    query_text TEXT NOT NULL,
    chunk_id UUID REFERENCES chunks(id) ON DELETE CASCADE,
    
    -- Original scores
    vector_score FLOAT,  -- From Qdrant similarity search
    bm25_score FLOAT,    -- If using BM25
    
    -- Re-ranking
    rerank_score FLOAT NOT NULL,
    rerank_model VARCHAR(100) NOT NULL,
    final_rank INTEGER,
    
    -- Context
    search_session_id UUID,  -- Group related searches
    user_id VARCHAR(255),    -- If tracking users
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_rerank_results_query_hash ON rerank_results(MD5(query_text));
CREATE INDEX IF NOT EXISTS idx_rerank_results_chunk_id ON rerank_results(chunk_id);
CREATE INDEX IF NOT EXISTS idx_rerank_results_rerank_score ON rerank_results(rerank_score DESC);
CREATE INDEX IF NOT EXISTS idx_rerank_results_session_id ON rerank_results(search_session_id);
CREATE INDEX IF NOT EXISTS idx_rerank_results_created_at ON rerank_results(created_at DESC);

-- ============================================
-- Update Views to Include Web Pages
-- ============================================

-- Drop and recreate dataset_statistics to include web pages
DROP VIEW IF EXISTS dataset_statistics;
CREATE OR REPLACE VIEW dataset_statistics AS
SELECT 
    d.id,
    d.name,
    COUNT(DISTINCT doc.id) as total_documents,
    COUNT(DISTINCT CASE WHEN doc.status = 'completed' THEN doc.id END) as processed_documents,
    COUNT(DISTINCT CASE WHEN doc.status = 'failed' THEN doc.id END) as failed_documents,
    COUNT(DISTINCT wp.id) as total_web_pages,
    COUNT(DISTINCT CASE WHEN wp.processed = TRUE THEN wp.id END) as processed_web_pages,
    COUNT(DISTINCT c.id) as total_chunks,
    SUM(doc.file_size_bytes) as total_size_bytes,
    d.created_at,
    d.updated_at
FROM datasets d
LEFT JOIN documents doc ON d.id = doc.dataset_id
LEFT JOIN web_pages wp ON d.id = wp.dataset_id
LEFT JOIN chunks c ON doc.id = c.document_id OR wp.id = c.web_page_id
GROUP BY d.id, d.name, d.created_at, d.updated_at;

-- View for crawl session monitoring
CREATE OR REPLACE VIEW crawl_session_summary AS
SELECT 
    cs.id as session_id,
    d.name as dataset_name,
    cs.start_url,
    cs.crawl_type,
    cs.status,
    cs.pages_crawled,
    cs.pages_failed,
    cs.started_at,
    cs.completed_at,
    EXTRACT(EPOCH FROM (COALESCE(cs.completed_at, NOW()) - cs.started_at)) as duration_seconds,
    CASE 
        WHEN cs.pages_crawled > 0 THEN 
            ROUND((cs.pages_crawled::FLOAT / (cs.pages_crawled + cs.pages_failed)) * 100, 2)
        ELSE 0
    END as success_rate
FROM crawl_sessions cs
LEFT JOIN datasets d ON cs.dataset_id = d.id
ORDER BY cs.created_at DESC;

-- ============================================
-- Triggers
-- ============================================

-- Auto-update updated_at for web_pages
CREATE TRIGGER update_web_pages_updated_at
    BEFORE UPDATE ON web_pages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Helper Functions
-- ============================================

-- Function to get chunk with all vector IDs
CREATE OR REPLACE FUNCTION get_chunk_vectors(chunk_uuid UUID)
RETURNS TABLE (
    chunk_id UUID,
    content_vector_id TEXT,
    summary_vector_id TEXT,
    content TEXT,
    summary TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.vector_id as content_vector_id,
        c.summary_vector_id,
        c.content,
        c.summary
    FROM chunks c
    WHERE c.id = chunk_uuid;
END;
$$ LANGUAGE plpgsql;

-- Function to find chunks by web page URL
CREATE OR REPLACE FUNCTION get_chunks_by_url(page_url TEXT)
RETURNS TABLE (
    chunk_id UUID,
    chunk_index INTEGER,
    content TEXT,
    vector_id TEXT,
    summary_vector_id TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.chunk_index,
        c.content,
        c.vector_id,
        c.summary_vector_id
    FROM chunks c
    JOIN web_pages wp ON c.web_page_id = wp.id
    WHERE wp.url = page_url
    ORDER BY c.chunk_index;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Completion message
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '✅ Enhanced schema with web crawling support applied successfully';
    RAISE NOTICE '   - Added web_pages table for Crawl4AI integration';
    RAISE NOTICE '   - Enhanced chunks table with dual-vector support (content + summary)';
    RAISE NOTICE '   - Added vector_metadata table for Qdrant metadata';
    RAISE NOTICE '   - Added crawl_sessions table for crawl tracking';
    RAISE NOTICE '   - Added rerank_results table for re-ranking support';
    RAISE NOTICE '   - Updated views to include web pages';
    RAISE NOTICE '   - Added helper functions for common queries';
END $$;
