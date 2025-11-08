#!/bin/bash
# Quick test script for various Cognee search types

COGNEE_URL="http://localhost:8340"
TOKEN="local-development-only"
DATASET_ID="37df7223-7647-57df-9ea1-1526ca3e3e8a"

echo "🧪 Testing Cognee Search Types"
echo "================================"
echo ""

# Test 1: CHUNKS
echo "1️⃣  CHUNKS - Raw text retrieval"
curl -s -X POST "${COGNEE_URL}/api/v1/search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{
    \"searchType\": \"CHUNKS\",
    \"query\": \"batch processing\",
    \"datasetIds\": [\"${DATASET_ID}\"],
    \"topK\": 3
  }" | jq -r '.[] | "\(.metadata.index_fields[0] // "N/A") - Score: \(.score // "N/A")"' | head -3
echo ""

# Test 2: CODE
echo "2️⃣  CODE - Code-specific search"
curl -s -X POST "${COGNEE_URL}/api/v1/search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{
    \"searchType\": \"CODE\",
    \"query\": \"memory allocation function\",
    \"datasetIds\": [\"${DATASET_ID}\"],
    \"topK\": 2
  }" | jq -r 'if type == "array" then "Found \(length) results" else "Response: \(.status // .error // .)" end'
echo ""

# Test 3: GRAPH_COMPLETION
echo "3️⃣  GRAPH_COMPLETION - Knowledge graph search"
curl -s -X POST "${COGNEE_URL}/api/v1/search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{
    \"searchType\": \"GRAPH_COMPLETION\",
    \"query\": \"What are the main optimization techniques?\",
    \"datasetIds\": [\"${DATASET_ID}\"],
    \"systemPrompt\": \"List the top 3 techniques briefly.\",
    \"topK\": 5
  }" | jq -r 'if type == "string" then . elif type == "object" then .result // .answer // . else "Found \(length) results" end' | head -10
echo ""

# Test 4: CHUNKS_LEXICAL
echo "4️⃣  CHUNKS_LEXICAL - Keyword search"
curl -s -X POST "${COGNEE_URL}/api/v1/search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{
    \"searchType\": \"CHUNKS_LEXICAL\",
    \"query\": \"performance monitoring\",
    \"datasetIds\": [\"${DATASET_ID}\"],
    \"topK\": 2
  }" | jq -r 'if type == "array" then "Found \(length) results" else . end'
echo ""

echo "✅ Test complete! See COGNEE_SEARCH_EXAMPLES.md for all 15 search types"
