-- Backup copy of the core relational schema for Claude Context

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS claude_context;
ALTER DATABASE claude_context SET search_path TO claude_context, public;
SET search_path TO claude_context, public;

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_global BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  is_global BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, name)
);

CREATE INDEX IF NOT EXISTS datasets_project_idx ON datasets(project_id);
CREATE INDEX IF NOT EXISTS datasets_status_idx ON datasets(status);
CREATE INDEX IF NOT EXISTS datasets_global_idx ON datasets(is_global) WHERE is_global;

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  title TEXT,
  content TEXT,
  file_extension TEXT,
  is_global BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (dataset_id, path)
);

CREATE INDEX IF NOT EXISTS documents_dataset_idx ON documents(dataset_id);

CREATE TABLE IF NOT EXISTS web_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  content TEXT,
  status TEXT NOT NULL DEFAULT 'fetched',
  is_global BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  crawled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (dataset_id, url)
);

CREATE INDEX IF NOT EXISTS web_pages_dataset_idx ON web_pages(dataset_id);

CREATE TABLE IF NOT EXISTS chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  web_page_id UUID REFERENCES web_pages(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL DEFAULT 'document',
  chunk_index INTEGER,
  text TEXT NOT NULL,
  summary TEXT,
  embedding vector(768),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (document_id IS NOT NULL) OR
    (web_page_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS chunks_dataset_idx ON chunks(dataset_id);
CREATE INDEX IF NOT EXISTS chunks_document_idx ON chunks(document_id);
CREATE INDEX IF NOT EXISTS chunks_web_page_idx ON chunks(web_page_id);
CREATE INDEX IF NOT EXISTS chunks_embedding_idx
  ON chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE TABLE IF NOT EXISTS crawl_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  external_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  pages_crawled INTEGER NOT NULL DEFAULT 0,
  pages_failed INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS crawl_sessions_dataset_idx ON crawl_sessions(dataset_id);
CREATE INDEX IF NOT EXISTS crawl_sessions_status_idx ON crawl_sessions(status);
CREATE INDEX IF NOT EXISTS crawl_sessions_recent_idx
  ON crawl_sessions(dataset_id, started_at DESC);

CREATE TABLE IF NOT EXISTS project_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  to_project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,
  resource_id UUID NOT NULL,
  can_read BOOLEAN NOT NULL DEFAULT true,
  can_write BOOLEAN NOT NULL DEFAULT false,
  can_delete BOOLEAN NOT NULL DEFAULT false,
  shared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS project_shares_unique_idx
  ON project_shares(from_project_id, to_project_id, resource_type, resource_id);
CREATE INDEX IF NOT EXISTS project_shares_target_idx
  ON project_shares(to_project_id, resource_type)
  INCLUDE (resource_id, can_read, can_write, can_delete);

INSERT INTO projects (name, description, is_active, is_global)
VALUES ('default', 'Default project', true, true)
ON CONFLICT (name) DO NOTHING;

DO $$
BEGIN
  RAISE NOTICE '✅ Core relational schema initialized for Claude Context (backup)';
END $$;

