#!/bin/bash

# Test the unified status tool that now handles both index status and progress tracking

echo "================================================"
echo "UNIFIED STATUS TOOL TEST"
echo "================================================"
echo ""
echo "The status tool now handles everything:"
echo ""

# Examples of using the unified status tool
echo "1. Check regular index status (default behavior):"
echo "claudeContext.status({ project: 'my-project', dataset: 'my-dataset' })"
echo ""
echo "Expected: Shows index status, or active operation if running"
echo ""
echo "------------------------------------------------"
echo ""

echo "2. Show all recent operations:"
echo "claudeContext.status({ showOperations: true })"
echo ""
echo "Expected: Lists recent operations with progress bars"
echo ""
echo "------------------------------------------------"
echo ""

echo "3. Show only active operations:"
echo "claudeContext.status({ activeOnly: true })"
echo ""
echo "Expected: Lists only operations currently running"
echo ""
echo "------------------------------------------------"
echo ""

echo "4. Show all operations across all projects:"
echo "claudeContext.status({ project: 'all' })"
echo ""
echo "Expected: Lists all operations from all projects"
echo ""
echo "------------------------------------------------"
echo ""

echo "5. Check specific operation by ID:"
echo "claudeContext.status({ operationId: 'abc-123...' })"
echo ""
echo "Expected: Detailed view of that specific operation"
echo ""
echo "------------------------------------------------"
echo ""

# Start a test operation
API_BASE="http://localhost:3030"
PROJECT="test-unified"
DATASET="test-data"

echo "Starting a test operation to demonstrate..."
RESPONSE=$(curl -s -X POST "$API_BASE/projects/$PROJECT/ingest/local" \
  -H "Content-Type: application/json" \
  -d '{
    "path": "/home/mewtwo/Zykairotis/claude-context-core/src/utils",
    "dataset": "'"$DATASET"'",
    "force": true
  }')

OPERATION_ID=$(echo "$RESPONSE" | jq -r '.operationId' 2>/dev/null)

if [ ! -z "$OPERATION_ID" ] && [ "$OPERATION_ID" != "null" ]; then
    echo "✅ Test operation started: $OPERATION_ID"
    echo ""
    echo "Now you can test these commands:"
    echo ""
    echo "// Check this specific operation"
    echo "claudeContext.status({ operationId: '$OPERATION_ID' })"
    echo ""
    echo "// Check status (will show active op if still running)"
    echo "claudeContext.status({ project: '$PROJECT', dataset: '$DATASET' })"
    echo ""
    echo "// Show all operations for this project"
    echo "claudeContext.status({ project: '$PROJECT', showOperations: true })"
fi

echo ""
echo "================================================"
echo "BENEFITS OF UNIFIED APPROACH:"
echo "================================================"
echo ""
echo "✅ Single tool for all status/progress needs"
echo "✅ Default behavior unchanged (backward compatible)"
echo "✅ Optional parameters add new functionality"
echo "✅ Less confusion - one tool to rule them all"
echo ""
