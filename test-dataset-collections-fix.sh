#!/bin/bash
# Test script to verify dataset_collections fix is working

echo "🧪 Testing dataset_collections automatic creation..."
echo

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if dist/ has the fix
echo "1️⃣  Checking if compiled code has the fix..."
if grep -q "getOrCreateCollectionRecord.*✅" dist/utils/collection-helpers.js 2>/dev/null; then
    echo -e "${GREEN}✅ Fix found in dist/utils/collection-helpers.js${NC}"
else
    echo -e "${RED}❌ Fix NOT found in dist/utils/collection-helpers.js${NC}"
    echo "Run: npm run build"
    exit 1
fi

if grep -q "getOrCreateCollectionRecord" dist/context.js 2>/dev/null; then
    echo -e "${GREEN}✅ getOrCreateCollectionRecord call found in dist/context.js${NC}"
else
    echo -e "${RED}❌ getOrCreateCollectionRecord call NOT found in dist/context.js${NC}"
    exit 1
fi

echo

# Check PostgreSQL pool configuration
echo "2️⃣  Checking PostgreSQL configuration..."
if [ -z "$POSTGRES_CONNECTION_STRING" ]; then
    echo -e "${YELLOW}⚠️  POSTGRES_CONNECTION_STRING not set${NC}"
    echo "This is OK if you set it in .env"
else
    echo -e "${GREEN}✅ POSTGRES_CONNECTION_STRING is set${NC}"
fi

echo

# Check if MCP server process is running
echo "3️⃣  Checking MCP server status..."
if pgrep -f "node.*mcp-server.js" > /dev/null; then
    echo -e "${GREEN}✅ MCP server is running${NC}"
    MCP_PID=$(pgrep -f "node.*mcp-server.js")
    echo "   PID: $MCP_PID"
    
    # Check when it was started
    START_TIME=$(ps -o lstart= -p $MCP_PID)
    echo "   Started: $START_TIME"
else
    echo -e "${YELLOW}⚠️  MCP server is not running${NC}"
    echo "Start it with: node mcp-server.js"
fi

echo

# Test database connection
echo "4️⃣  Testing database connection..."
if docker exec claude-context-postgres psql -U postgres -d claude_context -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PostgreSQL is accessible${NC}"
else
    echo -e "${RED}❌ Cannot connect to PostgreSQL${NC}"
    exit 1
fi

echo

# Check current dataset_collections state
echo "5️⃣  Checking dataset_collections table..."
COLLECTIONS_COUNT=$(docker exec claude-context-postgres psql -U postgres -d claude_context -t -c "SELECT COUNT(*) FROM claude_context.dataset_collections;" 2>/dev/null | tr -d ' ')

if [ "$COLLECTIONS_COUNT" -eq 0 ]; then
    echo -e "${YELLOW}⚠️  dataset_collections table is empty${NC}"
    echo "This will be populated after next indexing"
else
    echo -e "${GREEN}✅ dataset_collections has $COLLECTIONS_COUNT record(s)${NC}"
    docker exec claude-context-postgres psql -U postgres -d claude_context -c "SELECT d.name as dataset, dc.collection_name, dc.point_count FROM claude_context.datasets d JOIN claude_context.dataset_collections dc ON d.id = dc.dataset_id;"
fi

echo
echo "═══════════════════════════════════════════════════════"
echo -e "${GREEN}Next Steps:${NC}"
echo "1. Restart MCP server: killall -9 node && node mcp-server.js &"
echo "2. Index a test dataset in Windsurf"
echo "3. Check logs for: [getOrCreateCollectionRecord] ✅"
echo "4. Verify dataset_collections table is populated"
echo "═══════════════════════════════════════════════════════"
