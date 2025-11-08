#!/bin/bash

# Test MCP Server Progress Tracking Integration
# This script tests how the MCP server uses the new progress tracking API

echo "================================================"
echo "MCP PROGRESS INTEGRATION TEST"
echo "================================================"
echo ""

# Test environment
PROJECT="mcp-test"
DATASET="test-data"
API_BASE="http://localhost:3030"

echo "Prerequisites:"
echo "1. MCP server should be running (node mcp-server.js or MCP inspector)"
echo "2. API server should be running (docker-compose up api-server)"
echo ""

# Step 1: Start an indexing operation via API to create trackable progress
echo "1. Starting a test indexing operation..."
echo "   POST /projects/$PROJECT/ingest/local"
echo ""

RESPONSE=$(curl -s -X POST "$API_BASE/projects/$PROJECT/ingest/local" \
  -H "Content-Type: application/json" \
  -d '{
    "path": "/home/mewtwo/Zykairotis/claude-context-core/src/utils",
    "dataset": "'"$DATASET"'",
    "force": true
  }')

OPERATION_ID=$(echo "$RESPONSE" | jq -r '.operationId' 2>/dev/null)

if [ ! -z "$OPERATION_ID" ] && [ "$OPERATION_ID" != "null" ]; then
    echo "✅ Operation started with ID: $OPERATION_ID"
else
    echo "Response: $RESPONSE"
    echo "⚠️  Operation completed synchronously or failed to start"
fi

echo ""
echo "================================================"
echo "Now test these MCP tools:"
echo ""

# Show MCP tool commands
echo "2. Test claudeContext.status - Should show active operations:"
echo ""
echo 'MCP Tool Call:'
echo '{'
echo '  "tool": "claudeContext.status",'
echo '  "params": {'
echo '    "project": "'"$PROJECT"'",'
echo '    "dataset": "'"$DATASET"'"'
echo '  }'
echo '}'
echo ""

echo "Expected: Should show progress bar and active operation status"
echo ""
echo "------------------------------------------------"
echo ""

echo "3. Test claudeContext.progress - Show all operations:"
echo ""
echo 'MCP Tool Call:'
echo '{'
echo '  "tool": "claudeContext.progress",'
echo '  "params": {'
echo '    "project": "'"$PROJECT"'"'
echo '  }'
echo '}'
echo ""

echo "Expected: List of all operations with progress bars"
echo ""
echo "------------------------------------------------"
echo ""

echo "4. Test claudeContext.progress - Active operations only:"
echo ""
echo 'MCP Tool Call:'
echo '{'
echo '  "tool": "claudeContext.progress",'
echo '  "params": {'
echo '    "activeOnly": true'
echo '  }'
echo '}'
echo ""

echo "Expected: Only active operations across all projects"
echo ""
echo "------------------------------------------------"
echo ""

if [ ! -z "$OPERATION_ID" ] && [ "$OPERATION_ID" != "null" ]; then
    echo "5. Test claudeContext.progress - Specific operation:"
    echo ""
    echo 'MCP Tool Call:'
    echo '{'
    echo '  "tool": "claudeContext.progress",'
    echo '  "params": {'
    echo '    "operationId": "'"$OPERATION_ID"'"'
    echo '  }'
    echo '}'
    echo ""
    echo "Expected: Detailed view of the specific operation"
    echo ""
fi

echo "================================================"
echo "MANUAL TESTING"
echo "================================================"
echo ""
echo "Copy the JSON tool calls above and test them in:"
echo "1. MCP Inspector (if running at http://localhost:6277)"
echo "2. Claude Desktop (if configured with mcp-server.js)"
echo "3. Any MCP-compatible client"
echo ""
echo "The status tool now shows:"
echo "- Active operations with progress bars"
echo "- Real-time phase and percentage"
echo "- Operation IDs for tracking"
echo ""
echo "The progress tool provides:"
echo "- List all operations for a project"
echo "- Filter active operations only"
echo "- Get specific operation details"
echo "- Cross-project operation tracking"
echo ""
