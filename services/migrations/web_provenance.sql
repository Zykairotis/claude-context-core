-- Web Provenance Tracking
-- Tracks indexing history and content changes for web pages

SET search_path TO claude_context, public;

CREATE TABLE IF NOT EXISTS web_provenance (
  url TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  first_indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_modified_at TIMESTAMPTZ,
  content_hash TEXT,
  version INTEGER DEFAULT 1,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_web_prov_domain ON web_provenance(domain);
CREATE INDEX IF NOT EXISTS idx_web_prov_last_indexed ON web_provenance(last_indexed_at DESC);
CREATE INDEX IF NOT EXISTS idx_web_prov_version ON web_provenance(version);
CREATE INDEX IF NOT EXISTS idx_web_prov_metadata_gin ON web_provenance USING gin(metadata);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_web_provenance_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS web_provenance_updated_at_trigger ON web_provenance;
CREATE TRIGGER web_provenance_updated_at_trigger
  BEFORE UPDATE ON web_provenance
  FOR EACH ROW
  EXECUTE FUNCTION update_web_provenance_updated_at();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON web_provenance TO postgres;

-- Documentation
COMMENT ON TABLE web_provenance IS 'Tracks web page indexing history and content changes for incremental updates';
COMMENT ON COLUMN web_provenance.content_hash IS 'Hash of page content to detect changes';
COMMENT ON COLUMN web_provenance.version IS 'Incremented on each re-index';
