#!/bin/bash

echo "🔧 FIXING GitHub Dataset Indexing Issue"
echo "======================================="
echo ""

# 1. Clean up old collections
echo "1️⃣ Cleaning up old MD5-hash collections..."
curl -X DELETE "http://localhost:6333/collections/hybrid_code_chunks_6cad625e" 2>/dev/null
curl -X DELETE "http://localhost:6333/collections/hybrid_code_chunks_ea8707f8" 2>/dev/null
echo "   ✅ Old collections deleted"
echo ""

# 2. Check current state
echo "2️⃣ Current state check:"
echo "   PostgreSQL datasets:"
psql "postgresql://postgres:code-context-secure-password@localhost:5533/claude_context" -t -c "
    SELECT name FROM claude_context.datasets 
    WHERE name LIKE '%erplexity%' OR name LIKE '%github%'
" | sed 's/^/   - /'
echo ""

echo "   Qdrant collections:"
curl -s http://localhost:6333/collections 2>/dev/null | grep -o '"name":"[^"]*"' | cut -d'"' -f4 | sed 's/^/   - /'
echo ""

# 3. Clone the repository fresh
echo "3️⃣ Cloning GitHub repository..."
REPO_PATH="/tmp/Perplexity-claude-$(date +%s)"
git clone https://github.com/Zykairotis/Perplexity-claude.git "$REPO_PATH" 2>/dev/null
echo "   ✅ Repository cloned to $REPO_PATH"
echo ""

# 4. Create a Node.js script to call MCP server
echo "4️⃣ Creating indexing script..."
cat > /tmp/mcp-index-github.js << 'EOF'
const { spawn } = require('child_process');
const path = require('path');

// Get repo path from command line
const repoPath = process.argv[2];
if (!repoPath) {
    console.error('Usage: node mcp-index-github.js <repo-path>');
    process.exit(1);
}

console.log('Indexing via MCP server...');
console.log('Path:', repoPath);

// Spawn MCP server
const mcp = spawn('node', ['mcp-server.js'], {
    cwd: '/home/mewtwo/Zykairotis/claude-context-core',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
        ...process.env,
        POSTGRES_CONNECTION_STRING: 'postgresql://postgres:code-context-secure-password@localhost:5533/claude_context'
    }
});

// Handle MCP output
let buffer = '';
let initialized = false;

mcp.stdout.on('data', (data) => {
    buffer += data.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    
    for (const line of lines) {
        if (line.includes('[MCP] Server ready') || line.includes('Server initialized')) {
            initialized = true;
            
            // Send the index command
            const request = {
                jsonrpc: '2.0',
                method: 'tools/call',
                params: {
                    name: 'claudeContext_index',
                    arguments: {
                        path: repoPath,
                        project: 'AuMGFqLY-hypr-voice-ErNATJWC',
                        dataset: 'github-Perplexity-claude',
                        forceReindex: true
                    }
                },
                id: 1
            };
            
            mcp.stdin.write(JSON.stringify(request) + '\n');
        }
        
        // Log progress
        if (line.includes('Indexing') || line.includes('Processing') || line.includes('chunks')) {
            console.log('  ', line.substring(0, 80));
        }
        
        // Check for completion
        if (line.includes('"result":') && line.includes('"success":true')) {
            console.log('✅ Indexing completed successfully!');
            mcp.kill();
            process.exit(0);
        }
    }
});

mcp.stderr.on('data', (data) => {
    const msg = data.toString();
    if (!msg.includes('Warning') && !msg.includes('Deprecation')) {
        console.error('Error:', msg);
    }
});

// Timeout after 2 minutes
setTimeout(() => {
    console.log('⏱️ Timeout - killing MCP server');
    mcp.kill();
    process.exit(1);
}, 120000);
EOF

echo "5️⃣ Running indexing..."
cd /home/mewtwo/Zykairotis/claude-context-core
node /tmp/mcp-index-github.js "$REPO_PATH"

echo ""
echo "6️⃣ Verifying results..."
sleep 5

# Check dataset_collections table
echo "   Dataset collections:"
psql "postgresql://postgres:code-context-secure-password@localhost:5533/claude_context" -t -c "
    SELECT dc.collection_name, dc.point_count
    FROM claude_context.dataset_collections dc
    JOIN claude_context.datasets d ON dc.dataset_id = d.id
    WHERE d.name = 'github-Perplexity-claude'
" 2>/dev/null | sed 's/^/   /'

# Check Qdrant collections
echo ""
echo "   Qdrant collections with 'project_' prefix:"
curl -s http://localhost:6333/collections 2>/dev/null | grep -o '"name":"project_[^"]*"' | cut -d'"' -f4 | while read -r coll; do
    count=$(curl -s "http://localhost:6333/collections/$coll" 2>/dev/null | grep -o '"vectors_count":[0-9]*' | cut -d: -f2)
    echo "   - $coll: $count vectors"
done

echo ""
echo "✅ Fix complete! Now test your search to verify it returns results from the GitHub repo."
