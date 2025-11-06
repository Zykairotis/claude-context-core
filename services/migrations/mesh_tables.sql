-- Mesh Canvas Tables
-- Creates tables for storing mesh nodes, edges, and logs

SET search_path TO claude_context, public;

-- Nodes table
CREATE TABLE IF NOT EXISTS mesh_nodes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  project TEXT NOT NULL,
  type TEXT NOT NULL,
  label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'idle',
  position JSONB NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mesh_nodes_project ON mesh_nodes(project);
CREATE INDEX IF NOT EXISTS idx_mesh_nodes_type ON mesh_nodes(type);
CREATE INDEX IF NOT EXISTS idx_mesh_nodes_status ON mesh_nodes(status);
CREATE INDEX IF NOT EXISTS idx_mesh_nodes_created ON mesh_nodes(created_at);

-- Edges table
CREATE TABLE IF NOT EXISTS mesh_edges (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  project TEXT NOT NULL,
  source TEXT NOT NULL REFERENCES mesh_nodes(id) ON DELETE CASCADE,
  target TEXT NOT NULL REFERENCES mesh_nodes(id) ON DELETE CASCADE,
  edge_type TEXT DEFAULT 'default',
  animated BOOLEAN DEFAULT false,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mesh_edges_project ON mesh_edges(project);
CREATE INDEX IF NOT EXISTS idx_mesh_edges_source ON mesh_edges(source);
CREATE INDEX IF NOT EXISTS idx_mesh_edges_target ON mesh_edges(target);
CREATE INDEX IF NOT EXISTS idx_mesh_edges_created ON mesh_edges(created_at);

-- Logs table
CREATE TABLE IF NOT EXISTS mesh_logs (
  id BIGSERIAL PRIMARY KEY,
  node_id TEXT NOT NULL REFERENCES mesh_nodes(id) ON DELETE CASCADE,
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mesh_logs_node_id ON mesh_logs(node_id);
CREATE INDEX IF NOT EXISTS idx_mesh_logs_level ON mesh_logs(level);
CREATE INDEX IF NOT EXISTS idx_mesh_logs_created ON mesh_logs(created_at DESC);

-- Helper function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_mesh_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for auto-updating updated_at
DROP TRIGGER IF EXISTS mesh_nodes_updated_at ON mesh_nodes;
CREATE TRIGGER mesh_nodes_updated_at
  BEFORE UPDATE ON mesh_nodes
  FOR EACH ROW
  EXECUTE FUNCTION update_mesh_updated_at();

DROP TRIGGER IF EXISTS mesh_edges_updated_at ON mesh_edges;
CREATE TRIGGER mesh_edges_updated_at
  BEFORE UPDATE ON mesh_edges
  FOR EACH ROW
  EXECUTE FUNCTION update_mesh_updated_at();

-- Insert some sample data for testing
INSERT INTO mesh_nodes (id, project, type, label, status, position, data) VALUES
  ('node-1', 'default', 'github', 'GitHub Repo', 'idle', '{"x": 100, "y": 100}'::jsonb, '{"repo": "example/repo"}'::jsonb),
  ('node-2', 'default', 'vectordb', 'Vector DB', 'idle', '{"x": 400, "y": 100}'::jsonb, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO mesh_edges (project, source, target, edge_type) VALUES
  ('default', 'node-1', 'node-2', 'data')
ON CONFLICT DO NOTHING;
