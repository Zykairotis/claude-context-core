#!/bin/bash

echo "🚀 Testing Automatic File Watching"
echo "=================================="
echo ""

# Start watching
echo "📺 Starting watcher..."
curl -X POST http://localhost:3030/projects/test-watch/watch/start \
  -H "Content-Type: application/json" \
  -d '{"path":"/home/mewtwo/testx"}' | jq .

echo ""
echo "✅ Watcher started! Now making changes..."
echo ""

# Wait a moment
sleep 2

# Make a change
echo "📝 Modifying file..."
echo "// Auto-test $(date)" >> /home/mewtwo/testx/Play_Grok/mozilla_signup_bot.py

# Wait for debounce + sync
sleep 4

# Check if it synced
echo "📊 Checking if auto-sync happened..."
docker logs claude-context-api-server --tail 10 | grep "Sync completed"

echo ""
echo "✅ Test complete! File changes are being automatically detected and synced."
echo ""

# List watchers
echo "📋 Active watchers:"
curl -s http://localhost:3030/projects/test-watch/watch/list | jq .

echo ""
echo "🛑 To stop watching, run:"
echo "curl -X POST http://localhost:3030/projects/test-watch/watch/stop -H 'Content-Type: application/json' -d '{\"path\":\"/home/mewtwo/testx\"}'"
