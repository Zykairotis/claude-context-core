-- GitHub ingestion job queue schema
-- Provides PostgreSQL-backed job queue for repository cloning and indexing

SET search_path TO claude_context, public;

-- Job status enum type
DO $$ BEGIN
  CREATE TYPE github_job_status AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'failed',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- GitHub jobs table
CREATE TABLE IF NOT EXISTS github_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  
  -- Repository information
  repo_url TEXT NOT NULL,
  repo_org TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  branch TEXT NOT NULL DEFAULT 'main',
  sha TEXT,
  
  -- Job status and tracking
  status github_job_status NOT NULL DEFAULT 'pending',
  priority INTEGER NOT NULL DEFAULT 0,
  
  -- Progress tracking (0-100)
  progress INTEGER NOT NULL DEFAULT 0,
  current_phase TEXT,
  current_file TEXT,
  
  -- Timing
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  visible_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Retry logic
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  
  -- Results and errors
  error TEXT,
  indexed_files INTEGER,
  total_chunks INTEGER,
  
  -- Additional metadata
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  CONSTRAINT github_jobs_progress_check CHECK (progress >= 0 AND progress <= 100)
);

-- Indexes for efficient job polling and querying
CREATE INDEX IF NOT EXISTS github_jobs_status_visible_idx 
  ON github_jobs(status, visible_at, priority DESC, created_at ASC)
  WHERE status IN ('pending', 'in_progress');

CREATE INDEX IF NOT EXISTS github_jobs_project_idx 
  ON github_jobs(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS github_jobs_dataset_idx 
  ON github_jobs(dataset_id);

CREATE INDEX IF NOT EXISTS github_jobs_repo_idx 
  ON github_jobs(repo_org, repo_name, branch);

-- Trigger function to notify on job updates
CREATE OR REPLACE FUNCTION notify_github_job_update()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify(
    'github_job_updates',
    json_build_object(
      'id', NEW.id,
      'project_id', NEW.project_id,
      'status', NEW.status,
      'progress', NEW.progress,
      'current_phase', NEW.current_phase,
      'current_file', NEW.current_file,
      'error', NEW.error
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on job updates
DROP TRIGGER IF EXISTS github_job_update_trigger ON github_jobs;
CREATE TRIGGER github_job_update_trigger
  AFTER UPDATE ON github_jobs
  FOR EACH ROW
  WHEN (
    OLD.status IS DISTINCT FROM NEW.status OR
    OLD.progress IS DISTINCT FROM NEW.progress OR
    OLD.current_phase IS DISTINCT FROM NEW.current_phase OR
    OLD.error IS DISTINCT FROM NEW.error
  )
  EXECUTE FUNCTION notify_github_job_update();

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_github_jobs_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS github_jobs_updated_at_trigger ON github_jobs;
CREATE TRIGGER github_jobs_updated_at_trigger
  BEFORE UPDATE ON github_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_github_jobs_updated_at();

-- View for job history with project/dataset names
CREATE OR REPLACE VIEW github_job_history AS
SELECT 
  j.id,
  j.status,
  j.progress,
  j.current_phase,
  j.repo_url,
  j.repo_org,
  j.repo_name,
  j.branch,
  j.sha,
  p.name as project_name,
  d.name as dataset_name,
  j.created_at,
  j.started_at,
  j.completed_at,
  EXTRACT(EPOCH FROM (COALESCE(j.completed_at, NOW()) - j.started_at)) as duration_seconds,
  j.indexed_files,
  j.total_chunks,
  j.error,
  j.retry_count
FROM github_jobs j
JOIN projects p ON j.project_id = p.id
JOIN datasets d ON j.dataset_id = d.id
ORDER BY j.created_at DESC;

-- Function to clean up old completed jobs (run periodically)
CREATE OR REPLACE FUNCTION cleanup_old_github_jobs(days_to_keep INTEGER DEFAULT 7)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM github_jobs
  WHERE status IN ('completed', 'failed', 'cancelled')
    AND completed_at < NOW() - (days_to_keep || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON github_jobs TO postgres;
GRANT SELECT ON github_job_history TO postgres;
GRANT EXECUTE ON FUNCTION cleanup_old_github_jobs TO postgres;

-- Insert comment for documentation
COMMENT ON TABLE github_jobs IS 'Job queue for GitHub repository ingestion with progress tracking and retry logic';
COMMENT ON FUNCTION notify_github_job_update() IS 'Broadcasts job status updates via PostgreSQL LISTEN/NOTIFY';
COMMENT ON FUNCTION cleanup_old_github_jobs(INTEGER) IS 'Removes completed/failed jobs older than specified days';

