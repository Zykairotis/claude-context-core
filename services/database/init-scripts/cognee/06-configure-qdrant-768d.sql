-- Configure Qdrant for 768-dimensional embeddings
-- Both GTE and CodeRank produce 768d vectors (unified storage!)
--
-- This is a metadata file to document Qdrant configuration
-- Actual Qdrant collection creation happens via Cognee API
--
-- Collection Configuration:
--   - Vector size: 768 dimensions
--   - Distance metric: Cosine similarity
--   - Auto-created by Cognee on first use
--
-- Models:
--   - GTE (gte-Qwen2-1.5B-instruct): 768d for text/documentation
--   - CodeRank: 768d for code files
--   - AutoEmbeddingMonster: Automatically switches between models

-- Mark that Qdrant is configured for 768d
DO $$
BEGIN
    RAISE NOTICE '✅ Qdrant Configuration:';
    RAISE NOTICE '   Vector Dimension: 768d';
    RAISE NOTICE '   Distance Metric: Cosine';
    RAISE NOTICE '   Models: GTE (text/docs) + CodeRank (code)';
    RAISE NOTICE '   Auto-Selection: Enabled via EMBEDDING_MODEL=auto';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 AutoEmbeddingMonster will automatically:';
    RAISE NOTICE '   • Use GTE for .md, .txt, .json, .yaml, etc.';
    RAISE NOTICE '   • Use CodeRank for .py, .js, .ts, .java, etc.';
    RAISE NOTICE '   • Produce unified 768d vectors for all files';
END $$;
