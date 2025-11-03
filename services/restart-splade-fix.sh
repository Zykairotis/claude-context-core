#!/bin/bash
# Restart script to apply SPLADE OOM fixes

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🔧 Applying SPLADE OOM fixes..."
echo ""

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose not found. Please install docker-compose first."
    exit 1
fi

# Check if running as root or has docker permissions
if ! docker ps &> /dev/null; then
    echo "❌ Cannot connect to Docker. Please ensure Docker is running and you have permissions."
    echo "   Try: sudo usermod -aG docker $USER (then log out and back in)"
    exit 1
fi

echo "📦 Step 1: Rebuilding SPLADE service with memory management..."
docker-compose build splade-runner

if [ $? -ne 0 ]; then
    echo "❌ Failed to rebuild SPLADE service"
    exit 1
fi

echo "✅ SPLADE service rebuilt successfully"
echo ""

echo "🔄 Step 2: Restarting services..."

# Option 1: Restart specific services (faster)
echo "   Restarting SPLADE runner..."
docker-compose restart splade-runner

echo "   Restarting API server..."
docker-compose restart api-server

echo "✅ Services restarted"
echo ""

echo "📊 Step 3: Checking service health..."
sleep 3

# Check SPLADE health
echo -n "   SPLADE service: "
if curl -s -f http://localhost:30004/health > /dev/null 2>&1; then
    echo "✅ Healthy"
else
    echo "⚠️  Not responding yet (may need more time to start)"
fi

# Check API server health  
echo -n "   API server: "
if curl -s -f http://localhost:3030/health > /dev/null 2>&1; then
    echo "✅ Healthy"
else
    echo "⚠️  Not responding yet (may need more time to start)"
fi

echo ""
echo "✅ SPLADE OOM fix applied successfully!"
echo ""
echo "📝 Configuration:"
echo "   - SPLADE Internal Batch Size: ${SPLADE_INTERNAL_BATCH_SIZE:-8 (default)}"
echo "   - Chunk Batch Size: ${CHUNK_BATCH_SIZE:-16 (default)}"
echo "   - Max Concurrent Batches: ${MAX_CONCURRENT_BATCHES:-1 (default)}"
echo ""
echo "💡 To tune for your GPU, create a .env file in this directory:"
echo "   echo 'SPLADE_INTERNAL_BATCH_SIZE=4' >> .env"
echo "   echo 'CHUNK_BATCH_SIZE=8' >> .env"
echo ""
echo "📖 See docs/SPLADE_OOM_FIX.md for detailed tuning guide"
echo ""
echo "🔍 Monitor GPU usage with: watch nvidia-smi"
echo "📋 View logs with: docker-compose logs -f splade-runner"

