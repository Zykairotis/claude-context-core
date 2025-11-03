#!/bin/bash
set -e

echo "🚀 Starting Real-time Glass Cockpit..."
echo ""

# Check if we're in the services directory
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Error: Must run from services/ directory"
    exit 1
fi

# Build API server if needed
if [ ! -d "api-server/node_modules" ]; then
    echo "📦 Installing API server dependencies..."
    cd api-server
    npm install
    npm run build
    cd ..
fi

# Start services
echo "🐳 Starting Docker services..."
docker-compose up -d postgres qdrant crawl4ai api-server

echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 5

# Check health
echo ""
echo "🏥 Health checks:"
echo ""

# Postgres
if docker-compose ps postgres | grep -q "Up"; then
    echo "✅ Postgres (port 5533) - Running"
else
    echo "❌ Postgres - Failed"
fi

# Qdrant
if docker-compose ps qdrant | grep -q "Up"; then
    echo "✅ Qdrant (port 6333) - Running"
else
    echo "❌ Qdrant - Failed"
fi

# Crawl4AI
if docker-compose ps crawl4ai | grep -q "Up"; then
    echo "✅ Crawl4AI (port 7070) - Running"
else
    echo "❌ Crawl4AI - Failed"
fi

# API Server
if curl -sf http://localhost:3030/health > /dev/null 2>&1; then
    echo "✅ API Server (port 3030) - Running"
else
    echo "❌ API Server - Failed"
fi

echo ""
echo "📊 Service URLs:"
echo "   API Server:  http://localhost:3030"
echo "   Postgres:    postgresql://localhost:5533/claude_context"
echo "   Qdrant:      http://localhost:6333/dashboard"
echo "   Crawl4AI:    http://localhost:7070"
echo ""
echo "🎨 Start the UI:"
echo "   cd ../ui && npm run dev"
echo ""
echo "📝 View logs:"
echo "   docker-compose logs -f api-server"
echo ""
echo "🛑 Stop services:"
echo "   docker-compose down"
echo ""
echo "✨ Glass Cockpit is ready!"

