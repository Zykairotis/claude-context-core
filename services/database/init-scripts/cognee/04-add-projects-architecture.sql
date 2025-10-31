-- Add Projects Architecture for Multi-Project Isolation
-- This migration adds project-based isolation with global resource sharing

-- ============================================
-- 1. CREATE PROJECTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    
    -- Project settings
    is_active BOOLEAN DEFAULT TRUE,
    is_global BOOLEAN DEFAULT FALSE,  -- Global projects share resources across all projects
    
    -- Owner/permissions (for future multi-user support)
    owner_id VARCHAR(255),  -- Future: user ID
    permissions JSONB DEFAULT '{}'::jsonb,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    
    CONSTRAINT projects_name_check CHECK (LENGTH(name) >= 1 AND LENGTH(name) <= 255)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);
CREATE INDEX IF NOT EXISTS idx_projects_is_active ON projects(is_active);
CREATE INDEX IF NOT EXISTS idx_projects_is_global ON projects(is_global);
CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects(owner_id);

-- Create default projects
INSERT INTO projects (name, description, is_global) VALUES
    ('default', 'Default project for general content', FALSE),
    ('global', 'Global project - resources shared across all projects', TRUE)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 2. ADD project_id TO datasets TABLE
-- ============================================

-- Add project_id column
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;

-- Set default project for existing datasets
UPDATE datasets 
SET project_id = (SELECT id FROM projects WHERE name = 'default')
WHERE project_id IS NULL;

-- Make project_id NOT NULL after setting defaults
ALTER TABLE datasets ALTER COLUMN project_id SET NOT NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_datasets_project_id ON datasets(project_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_datasets_project_name ON datasets(project_id, name);

-- Drop old unique constraint on name (now unique per project)
ALTER TABLE datasets DROP CONSTRAINT IF EXISTS datasets_name_key;

-- ============================================
-- 3. ADD GLOBAL RESOURCE TRACKING
-- ============================================

-- Add is_global flag to datasets (can be shared across projects)
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_datasets_is_global ON datasets(is_global);

-- Add is_global to documents
ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_documents_is_global ON documents(is_global);

-- Add is_global to web_pages
ALTER TABLE web_pages ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_web_pages_is_global ON web_pages(is_global);

-- ============================================
-- 4. CREATE PROJECT SHARING TABLE
-- ============================================

-- Explicit sharing relationships between projects
CREATE TABLE IF NOT EXISTS project_shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Source project sharing the resource
    source_project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Target project receiving access
    target_project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- What's being shared
    resource_type VARCHAR(50) NOT NULL,  -- 'dataset', 'document', 'web_page'
    resource_id UUID NOT NULL,
    
    -- Permissions
    can_read BOOLEAN DEFAULT TRUE,
    can_write BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    shared_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    shared_by VARCHAR(255),  -- Future: user ID
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Unique constraint: can't share same resource to same project twice
    UNIQUE (source_project_id, target_project_id, resource_type, resource_id),
    
    -- Can't share to yourself
    CONSTRAINT no_self_share CHECK (source_project_id <> target_project_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_project_shares_source ON project_shares(source_project_id);
CREATE INDEX IF NOT EXISTS idx_project_shares_target ON project_shares(target_project_id);
CREATE INDEX IF NOT EXISTS idx_project_shares_resource ON project_shares(resource_type, resource_id);

-- ============================================
-- 5. UPDATE VIEWS FOR PROJECT ISOLATION
-- ============================================

-- Drop and recreate dataset_statistics with project info
DROP VIEW IF EXISTS dataset_statistics;
CREATE OR REPLACE VIEW dataset_statistics AS
SELECT 
    d.id,
    d.name,
    d.project_id,
    p.name as project_name,
    d.is_global,
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
LEFT JOIN projects p ON d.project_id = p.id
LEFT JOIN documents doc ON d.id = doc.dataset_id
LEFT JOIN web_pages wp ON d.id = wp.dataset_id
LEFT JOIN chunks c ON doc.id = c.document_id OR wp.id = c.web_page_id
GROUP BY d.id, d.name, d.project_id, p.name, d.is_global, d.created_at, d.updated_at;

-- Update crawl_session_summary with project info
DROP VIEW IF EXISTS crawl_session_summary;
CREATE OR REPLACE VIEW crawl_session_summary AS
SELECT 
    cs.id as session_id,
    d.name as dataset_name,
    d.project_id,
    p.name as project_name,
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
LEFT JOIN projects p ON d.project_id = p.id
ORDER BY cs.created_at DESC;

-- New view: Project statistics
CREATE OR REPLACE VIEW project_statistics AS
SELECT 
    p.id,
    p.name,
    p.is_global,
    p.is_active,
    COUNT(DISTINCT d.id) as total_datasets,
    COUNT(DISTINCT CASE WHEN d.is_global THEN d.id END) as global_datasets,
    COUNT(DISTINCT wp.id) as total_web_pages,
    COUNT(DISTINCT doc.id) as total_documents,
    COUNT(DISTINCT cs.id) as total_crawl_sessions,
    p.created_at,
    p.updated_at
FROM projects p
LEFT JOIN datasets d ON p.id = d.project_id
LEFT JOIN web_pages wp ON d.id = wp.dataset_id
LEFT JOIN documents doc ON d.id = doc.dataset_id
LEFT JOIN crawl_sessions cs ON d.id = cs.dataset_id
GROUP BY p.id, p.name, p.is_global, p.is_active, p.created_at, p.updated_at;

-- ============================================
-- 6. HELPER FUNCTIONS FOR PROJECT ISOLATION
-- ============================================

-- Function to check if a resource is accessible to a project
CREATE OR REPLACE FUNCTION is_resource_accessible(
    p_project_id UUID,
    p_resource_type VARCHAR(50),
    p_resource_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    resource_project_id UUID;
    resource_is_global BOOLEAN;
BEGIN
    -- Get resource's project and global status
    CASE p_resource_type
        WHEN 'dataset' THEN
            SELECT project_id, is_global INTO resource_project_id, resource_is_global
            FROM datasets WHERE id = p_resource_id;
        WHEN 'document' THEN
            SELECT d.project_id, doc.is_global INTO resource_project_id, resource_is_global
            FROM documents doc
            JOIN datasets d ON doc.dataset_id = d.id
            WHERE doc.id = p_resource_id;
        WHEN 'web_page' THEN
            SELECT d.project_id, wp.is_global INTO resource_project_id, resource_is_global
            FROM web_pages wp
            JOIN datasets d ON wp.dataset_id = d.id
            WHERE wp.id = p_resource_id;
        ELSE
            RETURN FALSE;
    END CASE;
    
    -- Resource not found
    IF resource_project_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Global resources are accessible to all
    IF resource_is_global THEN
        RETURN TRUE;
    END IF;
    
    -- Same project
    IF resource_project_id = p_project_id THEN
        RETURN TRUE;
    END IF;
    
    -- Check explicit sharing
    IF EXISTS (
        SELECT 1 FROM project_shares
        WHERE source_project_id = resource_project_id
          AND target_project_id = p_project_id
          AND resource_type = p_resource_type
          AND resource_id = p_resource_id
          AND can_read = TRUE
    ) THEN
        RETURN TRUE;
    END IF;
    
    -- Not accessible
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to get or create project by name
CREATE OR REPLACE FUNCTION get_or_create_project(
    p_name VARCHAR(255),
    p_description TEXT DEFAULT NULL,
    p_is_global BOOLEAN DEFAULT FALSE
) RETURNS UUID AS $$
DECLARE
    project_uuid UUID;
BEGIN
    -- Try to find existing project
    SELECT id INTO project_uuid FROM projects WHERE name = p_name;
    
    -- Create if doesn't exist
    IF project_uuid IS NULL THEN
        INSERT INTO projects (name, description, is_global)
        VALUES (p_name, p_description, p_is_global)
        RETURNING id INTO project_uuid;
    END IF;
    
    RETURN project_uuid;
END;
$$ LANGUAGE plpgsql;

-- Function to share a resource with another project
CREATE OR REPLACE FUNCTION share_resource(
    p_source_project_id UUID,
    p_target_project_id UUID,
    p_resource_type VARCHAR(50),
    p_resource_id UUID,
    p_can_write BOOLEAN DEFAULT FALSE,
    p_shared_by VARCHAR(255) DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    share_id UUID;
BEGIN
    -- Validate projects exist
    IF NOT EXISTS (SELECT 1 FROM projects WHERE id = p_source_project_id) THEN
        RAISE EXCEPTION 'Source project not found: %', p_source_project_id;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM projects WHERE id = p_target_project_id) THEN
        RAISE EXCEPTION 'Target project not found: %', p_target_project_id;
    END IF;
    
    -- Insert or update share
    INSERT INTO project_shares (
        source_project_id, target_project_id, resource_type, resource_id,
        can_read, can_write, shared_by
    ) VALUES (
        p_source_project_id, p_target_project_id, p_resource_type, p_resource_id,
        TRUE, p_can_write, p_shared_by
    )
    ON CONFLICT (source_project_id, target_project_id, resource_type, resource_id)
    DO UPDATE SET
        can_write = EXCLUDED.can_write,
        shared_at = NOW()
    RETURNING id INTO share_id;
    
    RETURN share_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. UPDATE EXISTING HELPER FUNCTIONS
-- ============================================

-- Update upsert_web_page_v2 to handle projects
CREATE OR REPLACE FUNCTION upsert_web_page_v3(
    p_url TEXT,
    p_project_name TEXT,                  -- NEW: project name
    p_dataset_name TEXT,
    p_markdown_content TEXT,
    p_html_content TEXT DEFAULT NULL,
    p_title TEXT DEFAULT NULL,
    p_domain VARCHAR(255) DEFAULT NULL,
    p_word_count INTEGER DEFAULT NULL,
    p_char_count INTEGER DEFAULT NULL,
    p_content_hash VARCHAR(64) DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb,
    p_is_global BOOLEAN DEFAULT FALSE     -- NEW: mark as global
) RETURNS UUID AS $$
DECLARE
    page_id UUID;
    project_uuid UUID;
    dataset_uuid UUID;
BEGIN
    -- Get or create project
    project_uuid := get_or_create_project(p_project_name);
    
    -- Find or create dataset within project
    SELECT id INTO dataset_uuid
    FROM datasets
    WHERE name = p_dataset_name AND project_id = project_uuid;
    
    IF dataset_uuid IS NULL THEN
        INSERT INTO datasets (name, project_id, status)
        VALUES (p_dataset_name, project_uuid, 'active')
        RETURNING id INTO dataset_uuid;
    END IF;
    
    -- Upsert web page
    INSERT INTO web_pages (
        url, dataset_id, markdown_content, html_content, cleaned_content,
        title, domain, word_count, char_count, content_hash,
        crawled_at, processing_status, is_global, metadata
    ) VALUES (
        p_url, dataset_uuid, p_markdown_content, p_html_content,
        p_markdown_content,  -- cleaned_content
        p_title, p_domain,
        COALESCE(p_word_count, array_length(regexp_split_to_array(p_markdown_content, '\s+'), 1)),
        COALESCE(p_char_count, LENGTH(p_markdown_content)),
        p_content_hash, NOW(), 'pending', p_is_global, p_metadata
    )
    ON CONFLICT (url)
    DO UPDATE SET
        markdown_content = EXCLUDED.markdown_content,
        html_content = EXCLUDED.html_content,
        cleaned_content = EXCLUDED.cleaned_content,
        title = EXCLUDED.title,
        domain = EXCLUDED.domain,
        word_count = EXCLUDED.word_count,
        char_count = EXCLUDED.char_count,
        content_hash = EXCLUDED.content_hash,
        is_global = EXCLUDED.is_global,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    RETURNING id INTO page_id;
    
    RETURN page_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. AUTO-UPDATE TRIGGERS
-- ============================================

-- Trigger to update projects.updated_at
CREATE OR REPLACE FUNCTION update_project_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_projects_timestamp ON projects;
CREATE TRIGGER trigger_update_projects_timestamp
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_project_updated_at();

-- ============================================
-- 9. PROJECT ISOLATION QUERIES (Examples)
-- ============================================

-- Get all datasets for a project (including global)
-- SELECT * FROM datasets 
-- WHERE project_id = $1 OR is_global = TRUE;

-- Get all web pages accessible to a project
-- SELECT wp.* FROM web_pages wp
-- JOIN datasets d ON wp.dataset_id = d.id
-- WHERE d.project_id = $1 OR wp.is_global = TRUE OR d.is_global = TRUE;

-- ============================================
-- Completion Message
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '✅ Projects architecture migration complete';
    RAISE NOTICE '   - Created projects table with default and global projects';
    RAISE NOTICE '   - Added project_id to datasets (with cascading)';
    RAISE NOTICE '   - Added is_global flags for resource sharing';
    RAISE NOTICE '   - Created project_shares table for explicit sharing';
    RAISE NOTICE '   - Updated views for project isolation';
    RAISE NOTICE '   - Added helper functions for project operations';
    RAISE NOTICE '   - Created upsert_web_page_v3() with project support';
    RAISE NOTICE '';
    RAISE NOTICE '🔧 Key Functions:';
    RAISE NOTICE '   - get_or_create_project(name, description, is_global)';
    RAISE NOTICE '   - share_resource(source_project, target_project, type, id)';
    RAISE NOTICE '   - is_resource_accessible(project_id, resource_type, resource_id)';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Projects created:';
    RAISE NOTICE '   - default: Regular project for general content';
    RAISE NOTICE '   - global: Shared resources accessible to all projects';
END $$;
