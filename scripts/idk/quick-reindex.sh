#!/bin/bash

echo "🚀 Quick re-index with new collection naming..."
echo ""

# 1. Index the GitHub repository
echo "📦 Indexing GitHub: Zykairotis/Perplexity-claude"
curl -X POST "http://localhost:3030/api/projects/AuMGFqLY-hypr-voice-ErNATJWC/ingest/github" \
  -H "Content-Type: application/json" \
  -d '{
    "repo": "Zykairotis/Perplexity-claude",
    "dataset": "github-Perplexity-claude"
  }' 2>/dev/null

echo ""
echo ""

# Wait for indexing
echo "⏳ Waiting 30 seconds for indexing to complete..."
sleep 30

# 2. Check collections
echo ""
echo "📊 Checking dataset_collections table:"
psql "postgresql://postgres:code-context-secure-password@localhost:5533/claude_context" -c "
SELECT 
    dc.collection_name,
    d.name as dataset_name,
    dc.point_count
FROM claude_context.dataset_collections dc
JOIN claude_context.datasets d ON dc.dataset_id = d.id;
"

echo ""
echo "🔍 Qdrant collections:"
curl -s http://localhost:6333/collections 2>/dev/null | grep -o '"name":"[^"]*"' | cut -d'"' -f4

echo ""
echo "✅ Done! Now test the search to see if it returns the right results."
