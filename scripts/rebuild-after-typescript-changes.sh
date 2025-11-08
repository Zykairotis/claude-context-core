#!/bin/bash
# Script to properly rebuild everything after TypeScript changes
# Use this whenever you modify code in /src/
#
# This script ensures NO OLD CODE is used by:
# 1. Removing old dist/ directory
# 2. Fresh TypeScript compile
# 3. Removing old Docker images
# 4. Pruning Docker build cache
# 5. Fresh Docker build
# 6. Restarting all affected services

set -e  # Exit on error

YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🔨 Complete rebuild after TypeScript changes...${NC}"
echo -e "${RED}⚠️  This will remove old code and rebuild everything fresh${NC}"
echo ""

# Step 1: Remove old dist/
echo -e "${YELLOW}Step 1: Removing old dist/ directory...${NC}"
rm -rf dist/
echo -e "${GREEN}✅ Old dist/ removed${NC}"
echo ""

# Step 2: Rebuild TypeScript
echo -e "${YELLOW}Step 2: Fresh TypeScript compile...${NC}"
npx tsc --build tsconfig.build.json --force
echo -e "${GREEN}✅ Fresh TypeScript compiled${NC}"
echo ""

# Step 3: Stop and remove API Server container
echo -e "${YELLOW}Step 3: Stopping API Server...${NC}"
docker-compose -f services/docker-compose.yml stop api-server || true
docker rm claude-context-api-server 2>/dev/null || true
echo -e "${GREEN}✅ API Server stopped and removed${NC}"
echo ""

# Step 4: Remove old Docker image
echo -e "${YELLOW}Step 4: Removing old Docker images...${NC}"
docker rmi services-api-server:latest 2>/dev/null || echo "No old image to remove"
echo -e "${GREEN}✅ Old images removed${NC}"
echo ""

# Step 5: Prune Docker build cache
echo -e "${YELLOW}Step 5: Pruning Docker build cache...${NC}"
docker builder prune -f > /dev/null 2>&1
echo -e "${GREEN}✅ Build cache pruned${NC}"
echo ""

# Step 6: Rebuild API Server Docker image from scratch
echo -e "${YELLOW}Step 6: Rebuilding API Server Docker image (fresh)...${NC}"
docker-compose -f services/docker-compose.yml build api-server
echo -e "${GREEN}✅ Fresh Docker image built${NC}"
echo ""

# Step 7: Start API Server
echo -e "${YELLOW}Step 7: Starting API Server...${NC}"
docker-compose -f services/docker-compose.yml up -d api-server
echo -e "${GREEN}✅ API Server started${NC}"
echo ""

# Step 8: Kill MCP Server (will auto-restart)
echo -e "${YELLOW}Step 8: Restarting MCP Server...${NC}"
pkill -9 -f "node.*mcp-server.js" 2>/dev/null || echo "No MCP server processes found"
echo -e "${GREEN}✅ MCP Server will auto-restart${NC}"
echo ""

# Step 9: Wait for services to be ready
echo -e "${YELLOW}Step 9: Waiting for services to start...${NC}"
sleep 5

# Step 10: Verify everything
echo -e "${YELLOW}Step 10: Verifying services...${NC}"
echo ""

# Check API Server
if docker logs claude-context-api-server --tail 5 | grep -q "Ready to accept connections"; then
  echo -e "${GREEN}✅ API Server is ready${NC}"
else
  echo -e "${YELLOW}⚠️  API Server may still be starting...${NC}"
fi

# Check dist/ files on host
if [ -f "dist/utils/collection-helpers.js" ]; then
  HOST_DATE=$(stat -c %y dist/utils/collection-helpers.js 2>/dev/null || stat -f %Sm dist/utils/collection-helpers.js 2>/dev/null)
  echo -e "${GREEN}✅ Host dist/ files exist (${HOST_DATE})${NC}"
else
  echo -e "${RED}❌ dist/utils/collection-helpers.js not found on host${NC}"
fi

# Check dist/ files in container (critical!)
CONTAINER_DATE=$(docker exec claude-context-api-server stat -c %y /dist/utils/collection-helpers.js 2>/dev/null)
if [ ! -z "$CONTAINER_DATE" ]; then
  echo -e "${GREEN}✅ Container dist/ files exist (${CONTAINER_DATE})${NC}"
else
  echo -e "${RED}❌ dist/utils/collection-helpers.js not found in container${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Rebuild complete!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Test indexing a new directory"
echo "2. Check logs: ./scripts/view-logs.sh"
echo "3. Verify: claudeContext.listDatasets()"
echo ""
