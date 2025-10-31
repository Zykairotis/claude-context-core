-- Phase 3.8 Migration: Enhanced Session Status & Management
-- This script adds advanced session tracking capabilities for SHARD_4 Phase 3.8

-- Add processing_status column to crawl_sessions
ALTER TABLE crawl_sessions ADD COLUMN IF NOT EXISTS processing_status VARCHAR(50) DEFAULT 'pending';

-- Add processing_completed_at timestamp
ALTER TABLE crawl_sessions ADD COLUMN IF NOT EXISTS processing_completed_at TIMESTAMP WITH TIME ZONE;

-- Add processing_statistics JSONB column for detailed metrics
ALTER TABLE crawl_sessions ADD COLUMN IF NOT EXISTS processing_stats JSONB DEFAULT '{}'::jsonb;

-- Add orchestration-related columns
ALTER TABLE crawl_sessions ADD COLUMN IF NOT EXISTS orchestration_id VARCHAR(255);
ALTER TABLE crawl_sessions ADD COLUMN IF NOT EXISTS orchestration_status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE crawl_sessions ADD COLUMN IF NOT EXISTS orchestration_started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE crawl_sessions ADD COLUMN IF NOT EXISTS orchestration_completed_at TIMESTAMP WITH TIME ZONE;

-- Add enhanced progress tracking
ALTER TABLE crawl_sessions ADD COLUMN IF NOT EXISTS current_progress INTEGER DEFAULT 0;  -- 0-100 percentage
ALTER TABLE crawl_sessions ADD COLUMN IF NOT EXISTS estimated_time_remaining INTEGER;  -- seconds
ALTER TABLE crawl_sessions ADD COLUMN IF NOT EXISTS current_url TEXT;  -- URL being processed
ALTER TABLE crawl_sessions ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add performance metrics
ALTER TABLE crawl_sessions ADD COLUMN IF NOT EXISTS avg_page_processing_time FLOAT;  -- seconds
ALTER TABLE crawl_sessions ADD COLUMN IF NOT EXISTS crawl_speed FLOAT;  -- pages per minute
ALTER TABLE crawl_sessions ADD COLUMN IF NOT EXISTS processing_speed FLOAT;  -- pages per minute
ALTER TABLE crawl_sessions ADD COLUMN IF NOT EXISTS total_data_processed BIGINT;  -- bytes

-- Add enhanced error tracking
ALTER TABLE crawl_sessions ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
ALTER TABLE crawl_sessions ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE crawl_sessions ADD COLUMN IF NOT EXISTS error_details JSONB DEFAULT '[]'::jsonb;  -- Array of error objects

-- Add system resource tracking
ALTER TABLE crawl_sessions ADD COLUMN IF NOT EXISTS peak_memory_usage BIGINT;  -- bytes
ALTER TABLE crawl_sessions ADD COLUMN IF NOT EXISTS peak_cpu_usage FLOAT;  -- percentage
ALTER TABLE crawl_sessions ADD COLUMN IF NOT EXISTS total_network_requests INTEGER DEFAULT 0;

-- Update constraints for new status columns
ALTER TABLE crawl_sessions ADD CONSTRAINT IF NOT EXISTS crawl_sessions_processing_status_check
    CHECK (processing_status IN ('pending', 'crawling', 'crawling_completed', 'processing', 'processing_completed', 'failed', 'cancelled', 'timeout'));

ALTER TABLE crawl_sessions ADD CONSTRAINT IF NOT EXISTS crawl_sessions_orchestration_status_check
    CHECK (orchestration_status IN ('pending', 'started', 'crawling_completed', 'processing_started', 'completed', 'failed', 'timeout', 'cancelled'));

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_crawl_sessions_processing_status ON crawl_sessions(processing_status);
CREATE INDEX IF NOT EXISTS idx_crawl_sessions_orchestration_status ON crawl_sessions(orchestration_status);
CREATE INDEX IF NOT EXISTS idx_crawl_sessions_processing_completed_at ON crawl_sessions(processing_completed_at);
CREATE INDEX IF NOT EXISTS idx_crawl_sessions_orchestration_id ON crawl_sessions(orchestration_id);
CREATE INDEX IF NOT EXISTS idx_crawl_sessions_current_progress ON crawl_sessions(current_progress);
CREATE INDEX IF NOT EXISTS idx_crawl_sessions_last_activity ON crawl_sessions(last_activity DESC);
CREATE INDEX IF NOT EXISTS idx_crawl_sessions_retry_count ON crawl_sessions(retry_count);
CREATE INDEX IF NOT EXISTS idx_crawl_sessions_processing_stats ON crawl_sessions USING GIN (processing_stats);
CREATE INDEX IF NOT EXISTS idx_crawl_sessions_error_details ON crawl_sessions USING GIN (error_details);

-- Create GIN index for processing_stats JSONB for efficient querying
CREATE INDEX IF NOT EXISTS idx_crawl_sessions_stats_gin ON crawl_sessions USING GIN (processing_stats);

-- Create orchestration logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS orchestration_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    orchestration_id VARCHAR(255) NOT NULL,
    session_id UUID REFERENCES crawl_sessions(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orchestration_logs_orchestration_id ON orchestration_logs(orchestration_id);
CREATE INDEX IF NOT EXISTS idx_orchestration_logs_session_id ON orchestration_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_orchestration_logs_event_type ON orchestration_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_orchestration_logs_created_at ON orchestration_logs(created_at DESC);

-- Create session analytics view
CREATE OR REPLACE VIEW session_analytics AS
SELECT
    cs.id as session_id,
    d.name as dataset_name,
    cs.start_url,
    cs.crawl_type,
    cs.status as crawl_status,
    cs.processing_status,
    cs.orchestration_status,
    cs.pages_crawled,
    cs.pages_failed,
    cs.current_progress,
    cs.estimated_time_remaining,
    cs.current_url,
    cs.crawl_speed,
    cs.processing_speed,
    cs.total_data_processed,
    cs.retry_count,
    cs.avg_page_processing_time,
    cs.peak_memory_usage,
    cs.peak_cpu_usage,
    cs.total_network_requests,
    cs.started_at,
    cs.completed_at,
    cs.processing_completed_at,
    cs.orchestration_started_at,
    cs.orchestration_completed_at,
    cs.last_activity,
    cs.error_message,
    cs.processing_stats,
    cs.error_details,
    -- Calculated fields
    EXTRACT(EPOCH FROM (COALESCE(cs.completed_at, NOW()) - cs.started_at)) as total_duration_seconds,
    EXTRACT(EPOCH FROM (COALESCE(cs.processing_completed_at, NOW()) - cs.processing_started_at)) as processing_duration_seconds,
    CASE
        WHEN cs.pages_crawled > 0 THEN
            ROUND((cs.pages_crawled::FLOAT / (cs.pages_crawled + cs.pages_failed)) * 100, 2)
        ELSE 0
    END as success_rate,
    CASE
        WHEN cs.started_at IS NOT NULL AND cs.completed_at IS NOT NULL THEN
            ROUND(cs.pages_crawled::FLOAT / EXTRACT(EPOCH FROM (cs.completed_at - cs.started_at)) * 60, 2)
        ELSE 0
    END as actual_pages_per_minute
FROM crawl_sessions cs
LEFT JOIN datasets d ON cs.dataset_id = d.id;

-- Create session status aggregation view for dashboard
CREATE OR REPLACE VIEW session_status_summary AS
SELECT
    d.name as dataset_name,
    COUNT(*) as total_sessions,
    COUNT(CASE WHEN cs.status = 'completed' THEN 1 END) as completed_sessions,
    COUNT(CASE WHEN cs.status = 'failed' THEN 1 END) as failed_sessions,
    COUNT(CASE WHEN cs.status = 'running' THEN 1 END) as running_sessions,
    COUNT(CASE WHEN cs.processing_status = 'processing_completed' THEN 1 END) as processing_completed_sessions,
    COUNT(CASE WHEN cs.orchestration_status = 'completed' THEN 1 END) as orchestration_completed_sessions,
    SUM(cs.pages_crawled) as total_pages_crawled,
    SUM(cs.pages_failed) as total_pages_failed,
    SUM(COALESCE(cs.total_data_processed, 0)) as total_data_processed,
    AVG(COALESCE(cs.avg_page_processing_time, 0)) as avg_processing_time,
    MAX(COALESCE(cs.peak_memory_usage, 0)) as max_memory_usage,
    ROUND(AVG(CASE
        WHEN cs.pages_crawled > 0 THEN
            (cs.pages_crawled::FLOAT / (cs.pages_crawled + cs.pages_failed)) * 100
        ELSE 0
    END), 2) as avg_success_rate
FROM datasets d
LEFT JOIN crawl_sessions cs ON d.id = cs.dataset_id
GROUP BY d.name
ORDER BY total_sessions DESC;

-- Function to update session activity timestamp
CREATE OR REPLACE FUNCTION update_session_activity(session_uuid UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE crawl_sessions
    SET last_activity = NOW()
    WHERE id = session_uuid;
END;
$$ LANGUAGE plpgsql;

-- Function to get session progress statistics
CREATE OR REPLACE FUNCTION get_session_progress_stats(session_uuid UUID)
RETURNS TABLE (
    session_id UUID,
    crawl_progress INTEGER,
    processing_progress INTEGER,
    orchestration_progress INTEGER,
    overall_progress INTEGER,
    estimated_completion TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        cs.id,
        CASE
            WHEN cs.max_pages > 0 THEN LEAST(ROUND((cs.pages_crawled::FLOAT / cs.max_pages) * 100), 100)
            ELSE 0
        END as crawl_progress,
        CASE
            WHEN cs.processing_status = 'processing_completed' THEN 100
            WHEN cs.processing_status = 'processing' THEN COALESCE(cs.current_progress, 0)
            WHEN cs.processing_status = 'crawling_completed' THEN 0
            ELSE 0
        END as processing_progress,
        CASE
            WHEN cs.orchestration_status = 'completed' THEN 100
            WHEN cs.orchestration_status = 'processing_started' THEN 50
            WHEN cs.orchestration_status = 'crawling_completed' THEN 25
            ELSE 0
        END as orchestration_progress,
        CASE
            WHEN cs.status = 'completed' AND cs.processing_status = 'processing_completed' AND cs.orchestration_status = 'completed' THEN 100
            WHEN cs.status = 'completed' AND cs.processing_status = 'processing_completed' THEN 75
            WHEN cs.status = 'completed' THEN 50
            WHEN cs.processing_status = 'processing' THEN 25
            ELSE COALESCE(cs.current_progress, 0)
        END as overall_progress,
        CASE
            WHEN cs.started_at IS NOT NULL AND cs.current_progress > 0 AND cs.current_progress < 100 THEN
                cs.started_at + (INTERVAL '1 second' *
                    (EXTRACT(EPOCH FROM NOW() - cs.started_at) * (100 / cs.current_progress)))
            ELSE NULL
        END as estimated_completion
    FROM crawl_sessions cs
    WHERE cs.id = session_uuid;
END;
$$ LANGUAGE plpgsql;

-- Function to add error to session error_details
CREATE OR REPLACE FUNCTION add_session_error(
    session_uuid UUID,
    error_message TEXT,
    error_type VARCHAR(100) DEFAULT 'general',
    error_context JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID AS $$
BEGIN
    UPDATE crawl_sessions
    SET
        error_details = error_details || jsonb_build_object(
            'timestamp', NOW(),
            'message', error_message,
            'type', error_type,
            'context', error_context
        ),
        last_activity = NOW()
    WHERE id = session_uuid;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update last_activity
CREATE TRIGGER update_crawl_sessions_last_activity
    BEFORE UPDATE ON crawl_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Update existing sessions to set default values for new columns
UPDATE crawl_sessions
SET
    processing_status = CASE
        WHEN status = 'completed' THEN 'processing_completed'
        WHEN status = 'failed' THEN 'failed'
        WHEN status = 'cancelled' THEN 'cancelled'
        ELSE 'pending'
    END,
    orchestration_status = CASE
        WHEN status = 'completed' THEN 'completed'
        WHEN status = 'failed' THEN 'failed'
        WHEN status = 'cancelled' THEN 'cancelled'
        ELSE 'pending'
    END,
    current_progress = CASE
        WHEN status = 'completed' THEN 100
        WHEN status = 'failed' THEN COALESCE(pages_crawled, 0)
        ELSE 0
    END,
    last_activity = COALESCE(completed_at, started_at, created_at, NOW())
WHERE processing_status IS NULL OR processing_status = 'pending';

-- Completion message
DO $$
BEGIN
    RAISE NOTICE '✅ Phase 3.8: Enhanced Session Status & Management migration completed';
    RAISE NOTICE '   - Added processing_status, processing_completed_at, processing_stats columns';
    RAISE NOTICE '   - Added orchestration tracking columns';
    RAISE NOTICE '   - Added enhanced progress and performance tracking';
    RAISE NOTICE '   - Added error tracking and system resource monitoring';
    RAISE NOTICE '   - Created orchestration_logs table for detailed event tracking';
    RAISE NOTICE '   - Created session_analytics and session_status_summary views';
    RAISE NOTICE '   - Added helper functions for session management';
    RAISE NOTICE '   - Created appropriate indexes for performance optimization';
END $$;