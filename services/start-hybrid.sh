#!/usr/bin/env bash

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Claude-Context + Cognee Hybrid Startup            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Function to check if service is healthy
check_service() {
    local service=$1
    local max_wait=${2:-60}
    local waited=0
    
    echo -ne "${YELLOW}⏳ Waiting for ${service}...${NC}"
    
    while [ $waited -lt $max_wait ]; do
        if docker compose ps | grep -q "${service}.*healthy"; then
            echo -e "\r${GREEN}✅ ${service} is healthy${NC}                    "
            return 0
        fi
        sleep 2
        waited=$((waited + 2))
        echo -ne "\r${YELLOW}⏳ Waiting for ${service}... ${waited}s${NC}"
    done
    
    echo -e "\r${RED}❌ ${service} failed to start${NC}                    "
    return 1
}

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker first.${NC}"
    exit 1
fi

echo -e "${BLUE}📦 Step 1: Starting core infrastructure...${NC}"
echo ""

# Start core services
docker compose up -d postgres qdrant neo4j

# Wait for services to be healthy
check_service "claude-context-postgres" 60
check_service "claude-context-qdrant" 30
check_service "claude-context-neo4j" 60

echo ""
echo -e "${BLUE}📊 Step 2: Verifying database connections...${NC}"
echo ""

# Test PostgreSQL
if docker exec claude-context-postgres psql -U postgres -c "SELECT 1;" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ PostgreSQL connection successful${NC}"
else
    echo -e "${RED}❌ PostgreSQL connection failed${NC}"
    exit 1
fi

# Test Qdrant
if curl -sf http://localhost:6333/collections >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Qdrant connection successful${NC}"
else
    echo -e "${RED}❌ Qdrant connection failed${NC}"
    exit 1
fi

# Test Neo4j
if curl -sf http://localhost:7474 >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Neo4j connection successful${NC}"
else
    echo -e "${RED}❌ Neo4j connection failed${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}🧠 Step 3: Creating Cognee database...${NC}"
echo ""

# Create cognee_db if it doesn't exist
docker exec claude-context-postgres psql -U postgres -tc \
    "SELECT 1 FROM pg_database WHERE datname = 'cognee_db'" | grep -q 1 || \
docker exec claude-context-postgres psql -U postgres -c \
    "CREATE DATABASE cognee_db;" >/dev/null 2>&1

echo -e "${GREEN}✅ Cognee database ready${NC}"

echo ""
echo -e "${BLUE}🚀 Step 4: Building & Starting Cognee with Qdrant...${NC}"
echo ""

# Build Cognee with Qdrant adapter
echo -e "${YELLOW}📦 Building custom Cognee image with Qdrant adapter (using uv)...${NC}"
docker compose build cognee

# Start Cognee (from main docker-compose.yml)
echo -e "${YELLOW}🚀 Starting Cognee container...${NC}"
docker compose up -d cognee

# Wait for Cognee
echo -ne "${YELLOW}⏳ Waiting for Cognee to initialize...${NC}"
sleep 5

for i in {1..30}; do
    if curl -sf http://localhost:8340/health >/dev/null 2>&1; then
        echo -e "\r${GREEN}✅ Cognee is running${NC}                              "
        break
    fi
    sleep 2
    echo -ne "\r${YELLOW}⏳ Waiting for Cognee... ${i}0s${NC}"
done

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              🎉 Startup Complete! 🎉                   ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${BLUE}📊 Service Status:${NC}"
echo ""
echo -e "  ${GREEN}●${NC} PostgreSQL    → localhost:5533  (internal: postgres:5432)"
echo -e "  ${GREEN}●${NC} Qdrant        → localhost:6333  (internal: qdrant:6333)"
echo -e "  ${GREEN}●${NC} Neo4j Browser → http://localhost:7474"
echo -e "  ${GREEN}●${NC} Neo4j Bolt    → bolt://localhost:7687"
echo -e "  ${GREEN}●${NC} Cognee API    → http://localhost:8340"
echo ""

echo -e "${BLUE}🔧 Quick Tests:${NC}"
echo ""
echo -e "  # Test Cognee health"
echo -e "  ${YELLOW}curl http://localhost:8340/health${NC}"
echo ""
echo -e "  # Add data to Cognee"
echo -e "  ${YELLOW}curl -X POST http://localhost:8340/api/v1/add \\${NC}"
echo -e "  ${YELLOW}  -H 'Content-Type: application/json' \\${NC}"
echo -e "  ${YELLOW}  -H 'Authorization: Bearer local-development-only' \\${NC}"
echo -e "  ${YELLOW}  -d '{\"data\": \"Test data\"}'${NC}"
echo ""
echo -e "  # View Cognee logs"
echo -e "  ${YELLOW}docker logs -f cognee${NC}"
echo ""

echo -e "${BLUE}📚 Documentation:${NC}"
echo ""
echo -e "  • Hybrid Setup Guide: ${YELLOW}services/cognee/HYBRID-SETUP.md${NC}"
echo -e "  • Integration Plan:   ${YELLOW}docs/hybrid-plan/00-index.md${NC}"
echo -e "  • Database Analysis:  ${YELLOW}docs/hybrid-plan/16-database-state-analysis.md${NC}"
echo ""

echo -e "${BLUE}🛑 To stop all services:${NC}"
echo -e "  ${YELLOW}cd $SCRIPT_DIR && docker compose down${NC}"
echo ""
echo -e "${BLUE}🔄 To restart Cognee only:${NC}"
echo -e "  ${YELLOW}docker compose restart cognee${NC}"
echo ""
