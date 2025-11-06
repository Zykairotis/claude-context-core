#!/usr/bin/env bash

set -euo pipefail

# Fix Mesh API - Drop old tables and recreate in correct schema
# Then rebuild and restart API server

POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-code-context-secure-password}

echo "🔧 Fixing Mesh API..."
echo ""

# Step 1: Drop tables from public schema
echo "1️⃣ Dropping old tables from public schema..."
PGPASSWORD=$POSTGRES_PASSWORD psql -h localhost -U postgres -p 5533 -d claude_context <<EOF
DROP TABLE IF EXISTS public.mesh_logs CASCADE;
DROP TABLE IF EXISTS public.mesh_edges CASCADE;
DROP TABLE IF EXISTS public.mesh_nodes CASCADE;
DROP FUNCTION IF EXISTS public.update_mesh_updated_at() CASCADE;
EOF

echo "✅ Old tables dropped"
echo ""

# Step 2: Create tables in claude_context schema
echo "2️⃣ Creating tables in claude_context schema..."
PGPASSWORD=$POSTGRES_PASSWORD psql -h localhost -U postgres -p 5533 -d claude_context \
  -f services/migrations/mesh_tables.sql

echo "✅ Tables created in claude_context schema"
echo ""

# Step 3: Rebuild TypeScript
echo "3️⃣ Rebuilding TypeScript..."
cd services/api-server
npm run build
cd ../..

echo "✅ TypeScript rebuilt"
echo ""

# Step 4: Rebuild Docker image
echo "4️⃣ Rebuilding Docker image..."
cd services
docker-compose build api-server

echo "✅ Docker image rebuilt"
echo ""

# Step 5: Restart API server with new image
echo "5️⃣ Restarting API server..."
docker-compose up -d api-server
cd ..

echo "✅ API server restarted"
echo ""

# Step 5: Wait a moment for server to start
echo "⏳ Waiting for API server to start..."
sleep 3

# Step 6: Test the endpoint
echo "5️⃣ Testing endpoint..."
response=$(curl -s http://localhost:3030/api/default)

if echo "$response" | grep -q "nodes"; then
  echo "✅ API endpoint working!"
  echo ""
  echo "Response:"
  echo "$response" | jq . 2>/dev/null || echo "$response"
else
  echo "⚠️  API endpoint returned unexpected response:"
  echo "$response"
fi

echo ""
echo "🎉 Mesh API fix complete!"
echo ""
echo "You can now test the UI at: http://localhost:40001"
