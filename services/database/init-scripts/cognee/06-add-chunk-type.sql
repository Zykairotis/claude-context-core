-- Migration: add chunk_type classification to chunks table
-- Ensures chunks can be categorized as normal, codeblock, image, or link

ALTER TABLE IF EXISTS chunks
    ADD COLUMN IF NOT EXISTS chunk_type TEXT;

-- Backfill any existing NULL values
UPDATE chunks
SET chunk_type = 'normal'
WHERE chunk_type IS NULL;

ALTER TABLE IF EXISTS chunks
    ALTER COLUMN chunk_type SET DEFAULT 'normal';

ALTER TABLE IF EXISTS chunks
    ALTER COLUMN chunk_type SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.constraint_column_usage
        WHERE table_name = 'chunks'
          AND constraint_name = 'chunks_chunk_type_check'
    ) THEN
        ALTER TABLE chunks
            ADD CONSTRAINT chunks_chunk_type_check
            CHECK (chunk_type IN ('normal', 'codeblock', 'image', 'link'));
    END IF;
END;
$$;

