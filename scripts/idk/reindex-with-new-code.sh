#!/bin/bash

# Script to re-index datasets with the new scope-based collection naming

echo "🔄 Re-indexing datasets with new scope-based collection naming..."
echo ""

# Check if API server is running
if ! curl -s http://localhost:3030/health > /dev/null 2>&1; then
    echo "❌ API server is not running at http://localhost:3030"
    echo "Starting API server..."
    cd /home/mewtwo/Zykairotis/claude-context-core/services/api-server
    npm start > /tmp/api-server.log 2>&1 &
    echo "Waiting for API server to start..."
    sleep 5
fi

echo "✅ API server is running"
echo ""

# Function to index and verify
index_and_verify() {
    local PROJECT="$1"
    local DATASET="$2"
    local PATH="$3"
    local TYPE="$4"  # "local" or "github"
    
    echo "📦 Indexing $TYPE: $PROJECT/$DATASET"
    echo "   Path/Repo: $PATH"
    
    if [ "$TYPE" = "local" ]; then
        # Index local codebase
        curl -X POST http://localhost:3030/api/ingest/local \
          -H "Content-Type: application/json" \
          -d "{
            \"codebasePath\": \"$PATH\",
            \"project\": \"$PROJECT\",
            \"dataset\": \"$DATASET\",
            \"forceReindex\": true
          }" 2>/dev/null | jq -r '.message // .error'
    else
        # Index GitHub repo
        curl -X POST http://localhost:3030/api/ingest/github \
          -H "Content-Type: application/json" \
          -d "{
            \"repo\": \"$PATH\",
            \"project\": \"$PROJECT\",
            \"dataset\": \"$DATASET\",
            \"forceReindex\": true
          }" 2>/dev/null | jq -r '.message // .error'
    fi
    
    echo ""
}

# 1. Index the local Hypr-Voice project
echo "=== Phase 1: Index Local Project ==="
index_and_verify "AuMGFqLY-hypr-voice-ErNATJWC" "local" "/home/mewtwo/Zykairotis/Hypr-Voice" "local"

echo "Waiting for indexing to complete..."
sleep 10

# 2. Index the GitHub repository
echo "=== Phase 2: Index GitHub Repository ==="
index_and_verify "AuMGFqLY-hypr-voice-ErNATJWC" "github-Perplexity-claude" "Zykairotis/Perplexity-claude" "github"

echo "Waiting for indexing to complete..."
sleep 10

# 3. Verify dataset_collections table
echo "=== Phase 3: Verify Dataset Collections ==="
echo "Checking dataset_collections table:"
psql "postgresql://postgres:code-context-secure-password@localhost:5533/claude_context" -c "
SELECT 
    dc.collection_name,
    d.name as dataset_name,
    dc.point_count,
    dc.is_hybrid,
    dc.created_at
FROM claude_context.dataset_collections dc
JOIN claude_context.datasets d ON dc.dataset_id = d.id
ORDER BY dc.created_at DESC;
" 2>&1

echo ""

# 4. Verify Qdrant collections
echo "=== Phase 4: Verify Qdrant Collections ==="
echo "Collections in Qdrant:"
curl -s http://localhost:6333/collections | jq '.result.collections[] | {name: .name, vectors_count: .vectors_count}'

echo ""

# 5. Test search isolation
echo "=== Phase 5: Test Search Isolation ==="
echo "Testing search in github-Perplexity-claude dataset..."
curl -X POST http://localhost:3030/api/query/project \
  -H "Content-Type: application/json" \
  -d '{
    "project": "AuMGFqLY-hypr-voice-ErNATJWC",
    "dataset": "github-Perplexity-claude",
    "query": "perplexity models",
    "topK": 5
  }' 2>/dev/null | jq '{
    query: .query,
    dataset: .dataset,
    results_count: (.results | length),
    first_result_file: .results[0].file
  }'

echo ""
echo "✅ Re-indexing complete! Check the results above to verify:"
echo "   1. Dataset collections table should have entries"
echo "   2. Qdrant should have project_* collections"
echo "   3. Search should return results from the correct dataset"
