#!/bin/bash

echo "================================================"
echo "DATASET FILTERING TEST"
echo "================================================"
echo ""
echo "Testing the dataset filtering fix"
echo ""

# Test data
PROJECT="test-filtering"
DATASET1="dataset-a"
DATASET2="dataset-b"
API_BASE="http://localhost:3030"

echo "Step 1: Create test project and datasets"
echo "----------------------------------------"

# Create project and datasets
echo "Creating project: $PROJECT"
echo "Creating dataset: $DATASET1"
echo "Creating dataset: $DATASET2"

# Ingest different content to each dataset
echo ""
echo "Step 2: Ingest unique content to each dataset"
echo "----------------------------------------"

# Ingest to dataset-a
echo "Ingesting Python files to $DATASET1..."
curl -s -X POST "$API_BASE/projects/$PROJECT/ingest/local" \
  -H "Content-Type: application/json" \
  -d '{
    "path": "/home/mewtwo/Zykairotis/claude-context-core/src/utils",
    "dataset": "'"$DATASET1"'",
    "force": true
  }' | jq '.operationId' 2>/dev/null

# Ingest to dataset-b
echo "Ingesting TypeScript files to $DATASET2..."
curl -s -X POST "$API_BASE/projects/$PROJECT/ingest/local" \
  -H "Content-Type: application/json" \
  -d '{
    "path": "/home/mewtwo/Zykairotis/claude-context-core/src/api",
    "dataset": "'"$DATASET2"'",
    "force": true
  }' | jq '.operationId' 2>/dev/null

echo ""
echo "Step 3: Test dataset filtering with searches"
echo "----------------------------------------"
echo ""

# Test 1: Search dataset-a only
echo "Test 1: Search $DATASET1 for 'function' (should only return utils files)"
echo "Expected: Results from src/utils only"
echo ""
curl -s -X POST "$API_BASE/projects/$PROJECT/search" \
  -H "Content-Type: application/json" \
  -d '{
    "dataset": "'"$DATASET1"'",
    "query": "function",
    "topK": 5
  }' | jq '.results[].file' 2>/dev/null | head -5

echo ""
echo "Test 2: Search $DATASET2 for 'function' (should only return api files)"
echo "Expected: Results from src/api only"
echo ""
curl -s -X POST "$API_BASE/projects/$PROJECT/search" \
  -H "Content-Type: application/json" \
  -d '{
    "dataset": "'"$DATASET2"'",
    "query": "function",
    "topK": 5
  }' | jq '.results[].file' 2>/dev/null | head -5

echo ""
echo "Step 4: Verify dataset isolation"
echo "----------------------------------------"
echo ""

# Verify no cross-contamination
echo "Searching $DATASET1 for content that should only be in $DATASET2"
echo "Expected: No results or only from utils"
echo ""
curl -s -X POST "$API_BASE/projects/$PROJECT/search" \
  -H "Content-Type: application/json" \
  -d '{
    "dataset": "'"$DATASET1"'",
    "query": "queryProject",
    "topK": 3
  }' | jq '.results[].file' 2>/dev/null

echo ""
echo "================================================"
echo "EXPECTED BEHAVIOR AFTER FIX:"
echo "------------------------------------------------"
echo "✅ Each dataset returns ONLY its own content"
echo "✅ No mixing of results between datasets"
echo "✅ Dataset parameter is properly respected"
echo ""
echo "BEFORE FIX:"
echo "❌ All searches return mixed results from all datasets"
echo "❌ Dataset parameter is ignored"
echo "================================================"
