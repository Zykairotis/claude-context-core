-- ============================================
-- Cognee Job References Table
-- ============================================
-- Track Cognee processing jobs for pages and chunks
-- This table links our local data to Cognee's async processing jobs

CREATE TABLE IF NOT EXISTS cognee_job_references (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Reference to our data
    page_id UUID REFERENCES web_pages(id) ON DELETE CASCADE,
    chunk_id UUID REFERENCES chunks(id) ON DELETE CASCADE,
    dataset_id UUID REFERENCES datasets(id) ON DELETE CASCADE,
    
    -- Cognee job details
    job_id VARCHAR(255) NOT NULL,  -- Cognee's job ID
    job_type VARCHAR(50) NOT NULL,  -- 'cognify', 'add', 'embed', 'extract_entities'
    job_status VARCHAR(50) DEFAULT 'pending',  -- 'pending', 'running', 'completed', 'failed'
    
    -- Processing details
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Results and errors
    result_data JSONB,  -- Store Cognee's response
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Constraints
    CONSTRAINT cognee_job_references_status_check CHECK (job_status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    CONSTRAINT cognee_job_references_type_check CHECK (job_type IN ('cognify', 'add', 'embed', 'extract_entities', 'summarize')),
    
    -- Ensure we don't duplicate job tracking for the same page/chunk and job type
    UNIQUE (page_id, job_type),
    UNIQUE (chunk_id, job_type)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_cognee_job_references_page_id ON cognee_job_references(page_id);
CREATE INDEX IF NOT EXISTS idx_cognee_job_references_chunk_id ON cognee_job_references(chunk_id);
CREATE INDEX IF NOT EXISTS idx_cognee_job_references_dataset_id ON cognee_job_references(dataset_id);
CREATE INDEX IF NOT EXISTS idx_cognee_job_references_job_id ON cognee_job_references(job_id);
CREATE INDEX IF NOT EXISTS idx_cognee_job_references_job_type ON cognee_job_references(job_type);
CREATE INDEX IF NOT EXISTS idx_cognee_job_references_job_status ON cognee_job_references(job_status);
CREATE INDEX IF NOT EXISTS idx_cognee_job_references_created_at ON cognee_job_references(created_at DESC);

-- ============================================
-- Additional columns for chunks table (if not exist)
-- ============================================
-- Ensure chunks table has all required columns for the pipeline

ALTER TABLE chunks ADD COLUMN IF NOT EXISTS processing_status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS embedding_dimension INTEGER;
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add constraint for processing_status
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chunks_processing_status_check'
    ) THEN
        ALTER TABLE chunks ADD CONSTRAINT chunks_processing_status_check 
        CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed'));
    END IF;
END $$;

-- Index for finding unprocessed chunks
CREATE INDEX IF NOT EXISTS idx_chunks_processing_status ON chunks(processing_status);
CREATE INDEX IF NOT EXISTS idx_chunks_processed_at ON chunks(processed_at DESC);

-- ============================================
-- Helper Functions
-- ============================================

-- Function to get pending Cognee jobs
CREATE OR REPLACE FUNCTION get_pending_cognee_jobs(
    p_limit INTEGER DEFAULT 10
) RETURNS TABLE (
    job_id VARCHAR(255),
    job_type VARCHAR(50),
    page_id UUID,
    chunk_id UUID,
    dataset_id UUID,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cjr.job_id,
        cjr.job_type,
        cjr.page_id,
        cjr.chunk_id,
        cjr.dataset_id,
        cjr.created_at
    FROM cognee_job_references cjr
    WHERE cjr.job_status = 'pending'
    ORDER BY cjr.created_at ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to update job status
CREATE OR REPLACE FUNCTION update_cognee_job_status(
    p_job_id VARCHAR(255),
    p_status VARCHAR(50),
    p_result_data JSONB DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_row_count INTEGER;
BEGIN
    UPDATE cognee_job_references
    SET 
        job_status = p_status,
        result_data = COALESCE(p_result_data, result_data),
        error_message = p_error_message,
        started_at = CASE 
            WHEN p_status = 'running' AND started_at IS NULL 
            THEN NOW() 
            ELSE started_at 
        END,
        completed_at = CASE 
            WHEN p_status IN ('completed', 'failed', 'cancelled') 
            THEN NOW() 
            ELSE completed_at 
        END
    WHERE job_id = p_job_id;
    
    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    RETURN v_row_count > 0;
END;
$$ LANGUAGE plpgsql;

-- Function to get job statistics
CREATE OR REPLACE FUNCTION get_cognee_job_statistics(
    p_dataset_id UUID DEFAULT NULL,
    p_time_window INTERVAL DEFAULT '24 hours'
) RETURNS TABLE (
    total_jobs BIGINT,
    pending_jobs BIGINT,
    running_jobs BIGINT,
    completed_jobs BIGINT,
    failed_jobs BIGINT,
    avg_processing_time INTERVAL,
    jobs_by_type JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH job_stats AS (
        SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE job_status = 'pending') as pending,
            COUNT(*) FILTER (WHERE job_status = 'running') as running,
            COUNT(*) FILTER (WHERE job_status = 'completed') as completed,
            COUNT(*) FILTER (WHERE job_status = 'failed') as failed,
            AVG(completed_at - started_at) FILTER (WHERE completed_at IS NOT NULL) as avg_time
        FROM cognee_job_references
        WHERE 
            (p_dataset_id IS NULL OR dataset_id = p_dataset_id)
            AND created_at >= NOW() - p_time_window
    ),
    type_stats AS (
        SELECT 
            jsonb_object_agg(
                job_type,
                jsonb_build_object(
                    'total', type_count,
                    'completed', completed_count,
                    'failed', failed_count
                )
            ) as by_type
        FROM (
            SELECT 
                job_type,
                COUNT(*) as type_count,
                COUNT(*) FILTER (WHERE job_status = 'completed') as completed_count,
                COUNT(*) FILTER (WHERE job_status = 'failed') as failed_count
            FROM cognee_job_references
            WHERE 
                (p_dataset_id IS NULL OR dataset_id = p_dataset_id)
                AND created_at >= NOW() - p_time_window
            GROUP BY job_type
        ) t
    )
    SELECT 
        js.total,
        js.pending,
        js.running,
        js.completed,
        js.failed,
        js.avg_time,
        ts.by_type
    FROM job_stats js, type_stats ts;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Triggers for updated_at
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to chunks table if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_chunks_updated_at'
    ) THEN
        CREATE TRIGGER update_chunks_updated_at
        BEFORE UPDATE ON chunks
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- ============================================
-- Success Message
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '✅ Cognee job tracking schema applied successfully';
    RAISE NOTICE '   - Added cognee_job_references table for job tracking';
    RAISE NOTICE '   - Enhanced chunks table with processing status';
    RAISE NOTICE '   - Added helper functions for job management';
    RAISE NOTICE '   - Added indexes for efficient querying';
END $$;
