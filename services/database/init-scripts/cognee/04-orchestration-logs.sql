-- Orchestration Logs Table
-- 
-- Provides comprehensive event tracking for the orchestrate_cognee_processing function
-- Enables debugging, monitoring, and audit trail for the integration workflow

-- ============================================
-- Create orchestration_logs table
-- ============================================

CREATE TABLE IF NOT EXISTS orchestration_logs (
    id SERIAL PRIMARY KEY,
    orchestration_id VARCHAR(255) NOT NULL,
    session_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    details JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_orchestration_logs_orchestration_id ON orchestration_logs(orchestration_id);
CREATE INDEX IF NOT EXISTS idx_orchestration_logs_session_id ON orchestration_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_orchestration_logs_event_type ON orchestration_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_orchestration_logs_created_at ON orchestration_logs(created_at DESC);

-- Add foreign key constraint
ALTER TABLE orchestration_logs 
ADD CONSTRAINT fk_orchestration_logs_session 
FOREIGN KEY (session_id) 
REFERENCES crawl_sessions(id) 
ON DELETE CASCADE
ON UPDATE NO ACTION;

-- ============================================
-- Event Type Reference Documentation
-- ============================================
-- 
-- Event types tracked by orchestrate_cognee_processing():
--
-- - 'started': Orchestration initiated
-- - 'validation_failed': Session validation failed
-- - 'status_change': Crawl status changed (pending → running → completed)
-- - 'crawl_completed': Crawl finished successfully
-- - 'timeout': Orchestration timed out waiting for crawl
-- - 'page_validation': Pages checked before processing
-- - 'processing_skipped': Processing skipped (insufficient pages)
-- - 'processing_started': Cognee processing initiated
-- - 'processing_completed': Cognee processing finished
-- - 'processing_error': Error during processing
-- - 'processing_attempt_failed': Processing attempt failed (will retry)
-- - 'retry_scheduled': Retry scheduled after failure
-- - 'all_retries_failed': All retry attempts exhausted
-- - 'orchestration_completed': Full orchestration workflow complete
-- - 'orchestration_failed': Orchestration failed unexpectedly

-- ============================================
-- Helper View: Recent Orchestrations
-- ============================================

CREATE OR REPLACE VIEW recent_orchestrations AS
SELECT 
    ol.orchestration_id,
    ol.session_id,
    cs.status as session_status,
    COUNT(*) as event_count,
    MIN(ol.created_at) as started_at,
    MAX(ol.created_at) as latest_event_at,
    EXTRACT(EPOCH FROM (MAX(ol.created_at) - MIN(ol.created_at))) as duration_seconds,
    array_agg(DISTINCT ol.event_type ORDER BY ol.event_type) as event_types
FROM orchestration_logs ol
LEFT JOIN crawl_sessions cs ON ol.session_id = cs.id
GROUP BY ol.orchestration_id, ol.session_id, cs.status
ORDER BY MAX(ol.created_at) DESC;

-- ============================================
-- Helper Function: Get Orchestration Summary
-- ============================================

CREATE OR REPLACE FUNCTION get_orchestration_summary(p_session_id VARCHAR)
RETURNS TABLE (
    orchestration_id VARCHAR,
    event_type VARCHAR,
    event_count BIGINT,
    first_occurrence TIMESTAMP,
    last_occurrence TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ol.orchestration_id,
        ol.event_type,
        COUNT(*) as event_count,
        MIN(ol.created_at) as first_occurrence,
        MAX(ol.created_at) as last_occurrence
    FROM orchestration_logs ol
    WHERE ol.session_id = p_session_id
    GROUP BY ol.orchestration_id, ol.event_type
    ORDER BY MIN(ol.created_at);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Completion Message
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '✅ Orchestration logging infrastructure created';
    RAISE NOTICE '   - orchestration_logs table with indexes';
    RAISE NOTICE '   - recent_orchestrations view for monitoring';
    RAISE NOTICE '   - get_orchestration_summary() helper function';
END $$;
