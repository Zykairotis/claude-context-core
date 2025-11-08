#!/bin/bash

# Simple demo of progress tracking API
# This shows how to track an operation's progress in real-time

API_BASE="http://localhost:3030"
PROJECT="demo-project"
DATASET="demo-dataset"

echo "========================================="
echo "PROGRESS TRACKING DEMO"
echo "========================================="
echo ""

# Step 1: Check API health
echo "1. Checking API server health..."
HEALTH=$(curl -s -X GET "$API_BASE/health")
if [ $? -eq 0 ]; then
    echo "✅ API server is healthy"
    echo "$HEALTH" | jq '.' 2>/dev/null || echo "$HEALTH"
else
    echo "❌ API server is not responding at $API_BASE"
    echo "Please ensure the API server is running:"
    echo "cd services && docker-compose up api-server"
    exit 1
fi
echo ""

# Step 2: Start a small local ingestion job
echo "2. Starting local ingestion job..."
echo "   Indexing: ./src/services/progress-tracker.ts"
echo ""

RESPONSE=$(curl -s -X POST "$API_BASE/projects/$PROJECT/ingest/local" \
  -H "Content-Type: application/json" \
  -d '{
    "path": "/home/mewtwo/Zykairotis/claude-context-core/services/api-server/src/services",
    "dataset": "'"$DATASET"'",
    "force": true
  }')

# Check if we got a response
if [ -z "$RESPONSE" ]; then
    echo "❌ No response from API. The server may be down."
    exit 1
fi

# Extract operation ID
OPERATION_ID=$(echo "$RESPONSE" | jq -r '.operationId' 2>/dev/null)

if [ "$OPERATION_ID" == "null" ] || [ -z "$OPERATION_ID" ]; then
    echo "Response:"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
    echo ""
    echo "⚠️ No operation ID returned. The job may have completed synchronously."
else
    echo "✅ Operation started with ID: $OPERATION_ID"
    echo ""
    
    # Step 3: Poll for progress
    echo "3. Monitoring progress..."
    echo "   Polling every second..."
    echo ""
    
    COMPLETED=false
    POLL_COUNT=0
    MAX_POLLS=30
    
    while [ "$COMPLETED" = false ] && [ $POLL_COUNT -lt $MAX_POLLS ]; do
        POLL_COUNT=$((POLL_COUNT + 1))
        
        # Get progress
        PROGRESS=$(curl -s -X GET "$API_BASE/projects/$PROJECT/progress?operationId=$OPERATION_ID")
        
        if [ ! -z "$PROGRESS" ]; then
            STATUS=$(echo "$PROGRESS" | jq -r '.status' 2>/dev/null)
            PHASE=$(echo "$PROGRESS" | jq -r '.phase' 2>/dev/null)
            PERCENT=$(echo "$PROGRESS" | jq -r '.progress' 2>/dev/null)
            MESSAGE=$(echo "$PROGRESS" | jq -r '.message' 2>/dev/null)
            
            # Display progress bar
            if [ "$PERCENT" != "null" ]; then
                BAR_LENGTH=30
                FILLED=$((PERCENT * BAR_LENGTH / 100))
                EMPTY=$((BAR_LENGTH - FILLED))
                
                printf "\r["
                printf "%0.s█" $(seq 1 $FILLED 2>/dev/null)
                printf "%0.s░" $(seq 1 $EMPTY 2>/dev/null)
                printf "] %3d%% - %s: %s" "$PERCENT" "$PHASE" "$MESSAGE"
            fi
            
            # Check if completed
            if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then
                COMPLETED=true
                echo ""
                echo ""
                if [ "$STATUS" = "completed" ]; then
                    echo "✅ Operation completed successfully!"
                else
                    ERROR=$(echo "$PROGRESS" | jq -r '.error' 2>/dev/null)
                    echo "❌ Operation failed: $ERROR"
                fi
                
                # Show final details
                echo ""
                echo "Final Status:"
                echo "$PROGRESS" | jq '.'
            fi
        fi
        
        if [ "$COMPLETED" = false ]; then
            sleep 1
        fi
    done
    
    if [ $POLL_COUNT -ge $MAX_POLLS ]; then
        echo ""
        echo "⚠️ Timeout: Operation is still running after 30 seconds"
    fi
fi

echo ""
echo "========================================="
echo ""

# Step 4: Show all operations for the project
echo "4. All operations for project '$PROJECT':"
curl -s -X GET "$API_BASE/projects/$PROJECT/progress" | jq '.operations[] | {operationId, operation, status, progress, phase}' 2>/dev/null

echo ""
echo "========================================="
echo "DEMO COMPLETE"
echo "========================================="
echo ""
echo "Try these commands to explore more:"
echo ""
echo "# Get all active operations across all projects:"
echo "curl -X GET $API_BASE/projects/all/progress?active=true | jq"
echo ""
echo "# Get specific operation details:"
echo "curl -X GET $API_BASE/projects/$PROJECT/progress?operationId=<ID> | jq"
echo ""
echo "# Monitor operations in real-time with watch:"
echo "watch -n 1 'curl -s $API_BASE/projects/all/progress?active=true | jq'"
echo ""
