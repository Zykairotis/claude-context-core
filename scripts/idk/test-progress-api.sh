#!/bin/bash

# Test Progress API Endpoints
# Run this script to test the progress tracking functionality

API_BASE="http://localhost:3030"
PROJECT="test-project"

echo "================================================"
echo "PROGRESS TRACKING API TEST"
echo "================================================"
echo ""

# Test 1: Get all operations for a project
echo "1. Get all operations for project '$PROJECT'"
echo "   GET /projects/$PROJECT/progress"
echo ""
curl -X GET "$API_BASE/projects/$PROJECT/progress" 2>/dev/null | jq '.' || echo "No operations found"
echo ""
echo "------------------------------------------------"

# Test 2: Get active operations only
echo "2. Get only active operations for project '$PROJECT'"
echo "   GET /projects/$PROJECT/progress?active=true"
echo ""
curl -X GET "$API_BASE/projects/$PROJECT/progress?active=true" 2>/dev/null | jq '.' || echo "No active operations"
echo ""
echo "------------------------------------------------"

# Test 3: Get all operations across all projects
echo "3. Get all operations across all projects"
echo "   GET /projects/all/progress"
echo ""
curl -X GET "$API_BASE/projects/all/progress" 2>/dev/null | jq '.' || echo "No operations found"
echo ""
echo "------------------------------------------------"

# Test 4: Start a local ingestion to track progress
echo "4. Start a local ingestion job (this creates a trackable operation)"
echo "   POST /projects/$PROJECT/ingest/local"
echo ""
RESPONSE=$(curl -X POST "$API_BASE/projects/$PROJECT/ingest/local" \
  -H "Content-Type: application/json" \
  -d '{
    "path": "/home/mewtwo/Zykairotis/claude-context-core/src",
    "dataset": "test-dataset",
    "force": false
  }' 2>/dev/null)

echo "Response:"
echo "$RESPONSE" | jq '.' || echo "$RESPONSE"

# Extract operationId if present
OPERATION_ID=$(echo "$RESPONSE" | jq -r '.operationId' 2>/dev/null)

if [ "$OPERATION_ID" != "null" ] && [ ! -z "$OPERATION_ID" ]; then
  echo ""
  echo "------------------------------------------------"
  
  # Test 5: Get specific operation progress
  echo "5. Get progress for specific operation"
  echo "   GET /projects/$PROJECT/progress?operationId=$OPERATION_ID"
  echo ""
  
  # Poll the operation status a few times
  for i in 1 2 3; do
    echo "Poll $i/3 (waiting 2 seconds)..."
    sleep 2
    curl -X GET "$API_BASE/projects/$PROJECT/progress?operationId=$OPERATION_ID" 2>/dev/null | jq '.'
    echo ""
  done
fi

echo "------------------------------------------------"
echo ""

# Test 6: Get existing project status (different from progress)
echo "6. Get project indexing status (existing endpoint)"
echo "   GET /projects/$PROJECT/status"
echo ""
curl -X GET "$API_BASE/projects/$PROJECT/status" 2>/dev/null | jq '.' || echo "Status endpoint not available"
echo ""
echo "------------------------------------------------"

# Test 7: Start a GitHub ingestion job
echo "7. Start a GitHub ingestion job (async with progress tracking)"
echo "   POST /projects/$PROJECT/ingest/github"
echo ""
GH_RESPONSE=$(curl -X POST "$API_BASE/projects/$PROJECT/ingest/github" \
  -H "Content-Type: application/json" \
  -d '{
    "repository": "https://github.com/torvalds/linux",
    "dataset": "linux-kernel",
    "branch": "master",
    "force": false
  }' 2>/dev/null)

echo "Response:"
echo "$GH_RESPONSE" | jq '.' || echo "$GH_RESPONSE"

JOB_ID=$(echo "$GH_RESPONSE" | jq -r '.jobId' 2>/dev/null)

if [ "$JOB_ID" != "null" ] && [ ! -z "$JOB_ID" ]; then
  echo ""
  echo "GitHub job queued with ID: $JOB_ID"
  echo "The operation will be tracked with this ID"
  echo ""
  
  # Check if we can get progress using the job ID as operation ID
  echo "Checking progress for GitHub job..."
  sleep 2
  curl -X GET "$API_BASE/projects/$PROJECT/progress?operationId=$JOB_ID" 2>/dev/null | jq '.' || echo "Progress not available yet"
fi

echo ""
echo "================================================"
echo "TEST COMPLETE"
echo "================================================"
echo ""
echo "Summary:"
echo "- Progress endpoint: GET /projects/{project}/progress"
echo "- Query params:"
echo "  - operationId: Get specific operation"
echo "  - active=true: Get only active operations"
echo "- Operations are tracked for:"
echo "  - Local ingestion (POST /projects/{project}/ingest/local)"
echo "  - GitHub ingestion (POST /projects/{project}/ingest/github)"
echo "  - Other async operations"
echo ""
echo "Progress tracking includes:"
echo "- operationId: Unique ID for the operation"
echo "- operation: Type of operation (local-ingest, github-ingest, etc)"
echo "- status: started, in_progress, completed, failed"
echo "- phase: Current phase description"
echo "- progress: Percentage (0-100)"
echo "- message: Current status message"
echo "- startedAt/updatedAt/completedAt: Timestamps"
echo ""
