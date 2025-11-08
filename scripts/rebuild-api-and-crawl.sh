#!/bin/bash
# Complete rebuild script for api-server and crawl4ai after code changes
# Ensures no old code, fresh builds, and proper verification

set -e  # Exit on error

echo "========================================="
echo "Complete API Server & Crawl4AI Rebuild"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PROJECT_ROOT="/home/mewtwo/Zykairotis/claude-context-core"
cd "$PROJECT_ROOT"

# Step 1: Stop services
echo -e "${YELLOW}[1/10] Stopping services...${NC}"
docker-compose -f services/docker-compose.yml stop api-server crawl4ai
echo -e "${GREEN}✅ Services stopped${NC}"
echo ""

# Step 2: Remove old compiled TypeScript
echo -e "${YELLOW}[2/10] Removing old compiled code...${NC}"
if [ -d "dist" ]; then
    echo "Removing dist/ directory..."
    rm -rf dist/
    echo -e "${GREEN}✅ Removed dist/${NC}"
else
    echo "dist/ does not exist (already clean)"
fi

if [ -d "services/api-server/dist" ]; then
    echo "Removing services/api-server/dist/ directory..."
    rm -rf services/api-server/dist/
    echo -e "${GREEN}✅ Removed services/api-server/dist/${NC}"
else
    echo "services/api-server/dist/ does not exist (already clean)"
fi
echo ""

# Step 3: Clean TypeScript build cache
echo -e "${YELLOW}[3/10] Cleaning TypeScript build cache...${NC}"
if [ -f "tsconfig.tsbuildinfo" ]; then
    rm -f tsconfig.tsbuildinfo
    echo -e "${GREEN}✅ Removed tsconfig.tsbuildinfo${NC}"
fi
if [ -f "tsconfig.build.tsbuildinfo" ]; then
    rm -f tsconfig.build.tsbuildinfo
    echo -e "${GREEN}✅ Removed tsconfig.build.tsbuildinfo${NC}"
fi
echo ""

# Step 4: Fresh TypeScript compilation
echo -e "${YELLOW}[4/10] Compiling TypeScript (fresh build)...${NC}"
npm run build
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ TypeScript compilation successful${NC}"
else
    echo -e "${RED}❌ TypeScript compilation failed${NC}"
    exit 1
fi
echo ""

# Step 5: Verify new dist/ files
echo -e "${YELLOW}[5/10] Verifying new dist/ files...${NC}"
if [ -d "dist" ]; then
    DIST_COUNT=$(find dist -name "*.js" | wc -l)
    echo "Found $DIST_COUNT JavaScript files in dist/"
    
    # Check key files
    if [ -f "dist/context.js" ]; then
        echo -e "${GREEN}✅ dist/context.js exists${NC}"
    else
        echo -e "${RED}❌ dist/context.js missing${NC}"
        exit 1
    fi
    
    if [ -f "dist/utils/collection-helpers.js" ]; then
        echo -e "${GREEN}✅ dist/utils/collection-helpers.js exists${NC}"
    else
        echo -e "${RED}❌ dist/utils/collection-helpers.js missing${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ dist/ directory not created${NC}"
    exit 1
fi
echo ""

# Step 6: Remove Docker images
echo -e "${YELLOW}[6/10] Removing old Docker images...${NC}"
echo "Removing api-server image..."
docker rmi -f services-api-server 2>/dev/null || echo "Image services-api-server not found (OK)"
docker rmi -f claude-context-api-server 2>/dev/null || echo "Image claude-context-api-server not found (OK)"
echo -e "${GREEN}✅ Old images removed${NC}"
echo ""

# Step 7: Prune Docker build cache
echo -e "${YELLOW}[7/10] Pruning Docker build cache...${NC}"
PRUNED=$(docker builder prune -f 2>&1 | grep "Total reclaimed" || echo "No cache to prune")
echo "$PRUNED"
echo -e "${GREEN}✅ Build cache pruned${NC}"
echo ""

# Step 8: Rebuild api-server (no cache)
echo -e "${YELLOW}[8/10] Rebuilding api-server (--no-cache)...${NC}"
docker-compose -f services/docker-compose.yml build --no-cache api-server
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ API server rebuilt successfully${NC}"
else
    echo -e "${RED}❌ API server rebuild failed${NC}"
    exit 1
fi
echo ""

# Step 9: Restart both services
echo -e "${YELLOW}[9/10] Restarting services...${NC}"
docker-compose -f services/docker-compose.yml up -d api-server crawl4ai
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Services restarted${NC}"
else
    echo -e "${RED}❌ Failed to restart services${NC}"
    exit 1
fi
echo ""

# Step 10: Wait for services to be healthy
echo -e "${YELLOW}[10/10] Waiting for services to be healthy...${NC}"
echo "Waiting 10 seconds for containers to start..."
sleep 10

# Check API server health
for i in {1..30}; do
    if docker exec claude-context-api-server wget --spider -q http://localhost:3030/health 2>/dev/null; then
        echo -e "${GREEN}✅ API server is healthy${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ API server health check timeout${NC}"
        docker logs claude-context-api-server --tail 20
        exit 1
    fi
    echo "Waiting for API server... ($i/30)"
    sleep 2
done

# Check Crawl4AI health
CRAWL_STATUS=$(docker ps --filter "name=claude-context-crawl4ai" --format "{{.Status}}")
if [[ $CRAWL_STATUS == *"Up"* ]]; then
    echo -e "${GREEN}✅ Crawl4AI is running${NC}"
else
    echo -e "${RED}❌ Crawl4AI is not running${NC}"
    docker logs claude-context-crawl4ai --tail 20
    exit 1
fi
echo ""

# Verification Section
echo "========================================="
echo "VERIFICATION"
echo "========================================="
echo ""

echo -e "${YELLOW}Checking file timestamps in API server container...${NC}"
API_CONTEXT_TIME=$(docker exec claude-context-api-server stat -c "%y" /app/dist/context.js 2>/dev/null | cut -d' ' -f1)
API_HELPERS_TIME=$(docker exec claude-context-api-server stat -c "%y" /app/dist/utils/collection-helpers.js 2>/dev/null | cut -d' ' -f1)
echo "API Server context.js:          $API_CONTEXT_TIME"
echo "API Server collection-helpers:  $API_HELPERS_TIME"

CURRENT_DATE=$(date +%Y-%m-%d)
if [[ $API_CONTEXT_TIME == $CURRENT_DATE* ]]; then
    echo -e "${GREEN}✅ API server files are fresh (today)${NC}"
else
    echo -e "${YELLOW}⚠️  API server files may be from cache${NC}"
fi
echo ""

echo -e "${YELLOW}Checking file timestamps in Crawl4AI container...${NC}"
CRAWL_HELPER_TIME=$(docker exec claude-context-crawl4ai stat -c "%y" /app/app/storage/dataset_collection_helper.py 2>/dev/null | cut -d' ' -f1)
CRAWL_SERVICE_TIME=$(docker exec claude-context-crawl4ai stat -c "%y" /app/app/services/crawling_service.py 2>/dev/null | cut -d' ' -f1)
echo "Crawl4AI helper:   $CRAWL_HELPER_TIME"
echo "Crawl4AI service:  $CRAWL_SERVICE_TIME"

if [[ $CRAWL_HELPER_TIME == $CURRENT_DATE* ]]; then
    echo -e "${GREEN}✅ Crawl4AI files are fresh (today)${NC}"
else
    echo -e "${YELLOW}⚠️  Crawl4AI files may be older (volume mounted)${NC}"
fi
echo ""

echo -e "${YELLOW}Verifying collection helper code presence...${NC}"
# Check API server
API_HELPER_COUNT=$(docker exec claude-context-api-server grep -c "getOrCreateCollectionRecord" /app/dist/context.js 2>/dev/null || echo "0")
echo "API Server - getOrCreateCollectionRecord calls: $API_HELPER_COUNT"

if [ "$API_HELPER_COUNT" -ge "1" ]; then
    echo -e "${GREEN}✅ Collection helper integrated in API server${NC}"
else
    echo -e "${RED}❌ Collection helper NOT found in API server${NC}"
fi

# Check Crawl4AI
CRAWL_HELPER_COUNT=$(docker exec claude-context-crawl4ai grep -c "create_or_update_collection_record" /app/app/services/crawling_service.py 2>/dev/null || echo "0")
echo "Crawl4AI - create_or_update_collection_record calls: $CRAWL_HELPER_COUNT"

if [ "$CRAWL_HELPER_COUNT" -ge "1" ]; then
    echo -e "${GREEN}✅ Collection helper integrated in Crawl4AI${NC}"
else
    echo -e "${RED}❌ Collection helper NOT found in Crawl4AI${NC}"
fi
echo ""

echo -e "${YELLOW}Checking environment variables...${NC}"
GITHUB_TOKEN_SET=$(docker exec claude-context-api-server sh -c 'if [ -n "$GITHUB_TOKEN" ]; then echo "SET"; else echo "NOT_SET"; fi' 2>/dev/null)
if [ "$GITHUB_TOKEN_SET" = "SET" ]; then
    GITHUB_TOKEN_PREVIEW=$(docker exec claude-context-api-server sh -c 'echo $GITHUB_TOKEN | cut -c1-10' 2>/dev/null)
    echo -e "${GREEN}✅ GITHUB_TOKEN is set: ${GITHUB_TOKEN_PREVIEW}...${NC}"
else
    echo -e "${RED}❌ GITHUB_TOKEN is NOT set${NC}"
    echo -e "${YELLOW}   Add to .env: GITHUB_TOKEN=your_github_token${NC}"
fi
echo ""

echo "========================================="
echo "REBUILD COMPLETE"
echo "========================================="
echo ""
echo "Summary:"
echo "  - Old dist/ removed and rebuilt"
echo "  - Docker images rebuilt (no cache)"
echo "  - API server: REBUILT"
echo "  - Crawl4AI: RESTARTED (volume mounted)"
echo "  - Collection helpers: VERIFIED"
echo ""
echo "Next steps:"
if [ "$GITHUB_TOKEN_SET" != "SET" ]; then
    echo "  1. Add GITHUB_TOKEN to .env file"
    echo "  2. Restart API server: docker-compose -f services/docker-compose.yml restart api-server"
fi
echo "  - Test GitHub ingest"
echo "  - Test crawl ingest"
echo "  - Verify dataset_collections table gets populated"
echo ""
