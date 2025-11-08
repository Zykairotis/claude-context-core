#!/bin/bash

# Phase 07: Deployment Verification Script
# Verifies all Cognee MCP services are deployed and healthy

echo "════════════════════════════════════════════════════════════════"
echo "   🚀 Phase 07: Deployment Verification"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ -f "services/docker-compose.yml" ]; then
  echo -e "${GREEN}✅ Found services configuration${NC}"
else
  echo -e "${RED}❌ services/docker-compose.yml not found${NC}"
  echo "Please run from the claude-context-core directory"
  exit 1
fi

# Function to check if container is running
check_container() {
  local container=$1
  local service=$2
  
  if docker ps --format "table {{.Names}}" | grep -q "^$container$"; then
    echo -e "${GREEN}✅ $service is running${NC}"
    
    # Get container status details
    STATUS=$(docker inspect $container --format='{{.State.Status}}')
    HEALTH=$(docker inspect $container --format='{{.State.Health.Status}}' 2>/dev/null || echo "no healthcheck")
    UPTIME=$(docker inspect $container --format='{{.State.StartedAt}}')
    
    echo "   Status: $STATUS"
    if [ "$HEALTH" != "no healthcheck" ] && [ -n "$HEALTH" ]; then
      echo "   Health: $HEALTH"
    fi
    echo "   Started: $UPTIME"
    
    return 0
  else
    echo -e "${RED}❌ $service is not running${NC}"
    
    # Check if container exists but is stopped
    if docker ps -a --format "table {{.Names}}" | grep -q "^$container$"; then
      echo "   Container exists but is stopped"
      echo "   Run: docker-compose -f services/docker-compose.yml start $service"
    else
      echo "   Container does not exist"
      echo "   Run: docker-compose -f services/docker-compose.yml up -d $service"
    fi
    
    return 1
  fi
}

echo "📦 Checking Docker Services..."
echo "────────────────────────────────────────────────────"

# Check each service
SERVICES_OK=true

echo ""
echo "1. Database Services:"
echo ""

check_container "claude-context-postgres" "PostgreSQL" || SERVICES_OK=false
echo ""
check_container "claude-context-qdrant" "Qdrant" || SERVICES_OK=false
echo ""
check_container "claude-context-neo4j" "Neo4j" || SERVICES_OK=false

echo ""
echo "2. Application Services:"
echo ""

check_container "claude-context-crawl4ai" "Crawl4AI" || SERVICES_OK=false
echo ""
check_container "claude-context-splade" "SPLADE" || SERVICES_OK=false
echo ""
check_container "cognee" "Cognee" || SERVICES_OK=false

echo ""
echo "────────────────────────────────────────────────────"
echo "🔗 Checking Network Configuration..."
echo ""

# Check if network exists
if docker network ls | grep -q "services_claude-context-network"; then
  echo -e "${GREEN}✅ Docker network exists${NC}"
  
  # Count connected containers
  CONNECTED=$(docker network inspect services_claude-context-network --format='{{len .Containers}}' 2>/dev/null || echo "0")
  echo "   Connected containers: $CONNECTED"
else
  echo -e "${RED}❌ Docker network not found${NC}"
  echo "   Run: docker-compose -f services/docker-compose.yml up -d"
  SERVICES_OK=false
fi

echo ""
echo "────────────────────────────────────────────────────"
echo "🔍 Checking Service Endpoints..."
echo ""

# Check service ports
echo "Service Ports:"
echo "  • PostgreSQL: 5533"
echo "  • Qdrant: 6333"
echo "  • Neo4j: 7474 (HTTP), 7687 (Bolt)"
echo "  • Crawl4AI: 7070"
echo "  • SPLADE: 30004"
echo "  • Cognee: 8340"

echo ""
echo "────────────────────────────────────────────────────"
echo "🧪 Running Health Check..."
echo ""

# Run Node.js health check
if [ -f "test/cognee-health-check.js" ]; then
  node test/cognee-health-check.js
  HEALTH_STATUS=$?
else
  echo -e "${YELLOW}⚠️  Health check script not found${NC}"
  HEALTH_STATUS=1
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "   📊 DEPLOYMENT VERIFICATION SUMMARY"
echo "════════════════════════════════════════════════════════════════"
echo ""

if [ "$SERVICES_OK" = true ] && [ "$HEALTH_STATUS" -eq 0 ]; then
  echo -e "${GREEN}🎉 DEPLOYMENT VERIFIED SUCCESSFULLY!${NC}"
  echo ""
  echo "✨ All services are:"
  echo "  • Running in Docker"
  echo "  • Connected to network"
  echo "  • Responding to health checks"
  echo "  • Ready for use"
  echo ""
  echo "📚 Quick Commands:"
  echo "  • View logs: docker-compose -f services/docker-compose.yml logs -f"
  echo "  • Stop all: docker-compose -f services/docker-compose.yml stop"
  echo "  • Restart: docker-compose -f services/docker-compose.yml restart"
  echo "  • Status: docker-compose -f services/docker-compose.yml ps"
  
  exit 0
else
  echo -e "${RED}⚠️  DEPLOYMENT VERIFICATION FAILED${NC}"
  echo ""
  echo "Issues detected. To fix:"
  echo ""
  echo "1. Start all services:"
  echo "   cd services && docker-compose up -d"
  echo ""
  echo "2. Check logs for errors:"
  echo "   docker-compose logs -f [service-name]"
  echo ""
  echo "3. Verify environment files:"
  echo "   • services/cognee/.env"
  echo "   • .env.crawl4ai"
  echo ""
  echo "4. Check Docker resources:"
  echo "   docker system df"
  echo "   docker stats"
  
  exit 1
fi
