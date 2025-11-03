-- Stats update triggers for real-time WebSocket notifications
-- This eliminates the need for polling by triggering stats recalculation
-- only when actual data changes occur

SET search_path TO claude_context, public;

-- Function to notify stats updates
CREATE OR REPLACE FUNCTION notify_stats_update()
RETURNS trigger AS $$
BEGIN
  -- Notify on any data change that affects stats
  PERFORM pg_notify(
    'stats_updates',
    json_build_object(
      'table', TG_TABLE_NAME,
      'operation', TG_OP,
      'timestamp', NOW()
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on chunks table (affects chunk counts)
DROP TRIGGER IF EXISTS chunks_stats_trigger ON claude_context.chunks;
CREATE TRIGGER chunks_stats_trigger
  AFTER INSERT OR DELETE ON claude_context.chunks
  FOR EACH ROW
  EXECUTE FUNCTION notify_stats_update();

-- Trigger on datasets table (affects dataset counts)
DROP TRIGGER IF EXISTS datasets_stats_trigger ON claude_context.datasets;
CREATE TRIGGER datasets_stats_trigger
  AFTER INSERT OR DELETE OR UPDATE ON claude_context.datasets
  FOR EACH ROW
  WHEN (
    TG_OP = 'DELETE' OR
    (TG_OP = 'UPDATE' AND (
      OLD.status IS DISTINCT FROM NEW.status OR
      OLD.project_id IS DISTINCT FROM NEW.project_id
    ))
  )
  EXECUTE FUNCTION notify_stats_update();

-- Trigger on web_pages table (affects web page counts)
DROP TRIGGER IF EXISTS web_pages_stats_trigger ON claude_context.web_pages;
CREATE TRIGGER web_pages_stats_trigger
  AFTER INSERT OR DELETE ON claude_context.web_pages
  FOR EACH ROW
  EXECUTE FUNCTION notify_stats_update();

-- Trigger on projects table (affects project counts)
DROP TRIGGER IF EXISTS projects_stats_trigger ON claude_context.projects;
CREATE TRIGGER projects_stats_trigger
  AFTER INSERT OR DELETE OR UPDATE ON claude_context.projects
  FOR EACH ROW
  WHEN (
    TG_OP = 'DELETE' OR
    (TG_OP = 'UPDATE' AND (
      OLD.is_active IS DISTINCT FROM NEW.is_active
    ))
  )
  EXECUTE FUNCTION notify_stats_update();

DO $$
BEGIN
  RAISE NOTICE '✅ Stats update triggers initialized for real-time notifications';
END $$;

