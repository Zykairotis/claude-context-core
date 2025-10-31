-- Update Schema for Crawl4AI Integration (Minor Additions)
-- This script adds fields needed by the Archmine crawling code

-- ============================================
-- Add Missing Fields to web_pages
-- ============================================

-- Add char_count for character counting (different from word_count)
ALTER TABLE web_pages ADD COLUMN IF NOT EXISTS char_count INTEGER;

-- Add chunk_count to track how many chunks this page generated
ALTER TABLE web_pages ADD COLUMN IF NOT EXISTS chunk_count INTEGER DEFAULT 0;

-- Add source_type to distinguish crawl sources
ALTER TABLE web_pages ADD COLUMN IF NOT EXISTS source_type VARCHAR(50) DEFAULT 'web_crawl';

-- Update char_count for existing records
UPDATE web_pages 
SET char_count = LENGTH(markdown_content) 
WHERE char_count IS NULL AND markdown_content IS NOT NULL;

-- Create index on chunk_count for queries
CREATE INDEX IF NOT EXISTS idx_web_pages_chunk_count ON web_pages(chunk_count);

-- ============================================
-- Add Helper Function for Page Insertion
-- ============================================

-- Function to insert or update web page with all fields
CREATE OR REPLACE FUNCTION upsert_web_page(
    p_url TEXT,
    p_dataset_id UUID,
    p_markdown_content TEXT,
    p_html_content TEXT DEFAULT NULL,
    p_title TEXT DEFAULT NULL,
    p_domain VARCHAR(255) DEFAULT NULL,
    p_word_count INTEGER DEFAULT NULL,
    p_char_count INTEGER DEFAULT NULL,
    p_content_hash VARCHAR(64) DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
    page_id UUID;
BEGIN
    INSERT INTO web_pages (
        url,
        dataset_id,
        markdown_content,
        html_content,
        cleaned_content,
        title,
        domain,
        word_count,
        char_count,
        content_hash,
        crawled_at,
        processing_status,
        metadata
    ) VALUES (
        p_url,
        p_dataset_id,
        p_markdown_content,
        p_html_content,
        p_markdown_content, -- cleaned_content same as markdown
        p_title,
        p_domain,
        COALESCE(p_word_count, array_length(regexp_split_to_array(p_markdown_content, '\s+'), 1)),
        COALESCE(p_char_count, LENGTH(p_markdown_content)),
        p_content_hash,
        NOW(),
        'pending',
        p_metadata
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
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    RETURNING id INTO page_id;
    
    RETURN page_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Upsert Web Page V2 (accepts dataset_id as TEXT)
-- ============================================

-- Function to insert or update web page with dataset_id as TEXT (creates dataset if needed)
CREATE OR REPLACE FUNCTION upsert_web_page_v2(
    p_url TEXT,
    p_dataset_id TEXT,  -- Changed from UUID to TEXT
    p_markdown_content TEXT,
    p_html_content TEXT DEFAULT NULL,
    p_title TEXT DEFAULT NULL,
    p_domain VARCHAR(255) DEFAULT NULL,
    p_word_count INTEGER DEFAULT NULL,
    p_char_count INTEGER DEFAULT NULL,
    p_content_hash VARCHAR(64) DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
    page_id UUID;
    dataset_uuid UUID;
BEGIN
    -- Find or create dataset by name
    SELECT id INTO dataset_uuid
    FROM datasets
    WHERE name = p_dataset_id;

    -- If dataset doesn't exist, create it
    IF dataset_uuid IS NULL THEN
        INSERT INTO datasets (name, status)
        VALUES (p_dataset_id, 'active')
        RETURNING id INTO dataset_uuid;
    END IF;

    -- Upsert the web page
    INSERT INTO web_pages (
        url,
        dataset_id,
        markdown_content,
        html_content,
        cleaned_content,
        title,
        domain,
        word_count,
        char_count,
        content_hash,
        crawled_at,
        processing_status,
        metadata
    ) VALUES (
        p_url,
        dataset_uuid,  -- Use the UUID we found/created
        p_markdown_content,
        p_html_content,
        p_markdown_content, -- cleaned_content same as markdown
        p_title,
        p_domain,
        COALESCE(p_word_count, array_length(regexp_split_to_array(p_markdown_content, '\s+'), 1)),
        COALESCE(p_char_count, LENGTH(p_markdown_content)),
        p_content_hash,
        NOW(),
        'pending',
        p_metadata
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
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    RETURNING id INTO page_id;

    RETURN page_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Function to Update Chunk Count
-- ============================================

CREATE OR REPLACE FUNCTION update_page_chunk_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Update chunk_count when chunks are added
    UPDATE web_pages
    SET chunk_count = (
        SELECT COUNT(*)
        FROM chunks
        WHERE web_page_id = NEW.web_page_id
    )
    WHERE id = NEW.web_page_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update chunk_count
DROP TRIGGER IF EXISTS trigger_update_chunk_count ON chunks;
CREATE TRIGGER trigger_update_chunk_count
    AFTER INSERT OR DELETE ON chunks
    FOR EACH ROW
    WHEN (NEW.web_page_id IS NOT NULL OR OLD.web_page_id IS NOT NULL)
    EXECUTE FUNCTION update_page_chunk_count();

-- ============================================
-- Completion Message
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '✅ Schema updated for Crawl4AI integration';
    RAISE NOTICE '   - Added char_count and chunk_count to web_pages';
    RAISE NOTICE '   - Added upsert_web_page() helper function';
    RAISE NOTICE '   - Added upsert_web_page_v2() function (accepts dataset_id as TEXT)';
    RAISE NOTICE '   - Added automatic chunk_count tracking trigger';
END $$;
