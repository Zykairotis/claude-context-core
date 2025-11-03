# Crawl4AI Service - Quick Start Guide

## ✅ Service Status

All services are now running and healthy:

```
✓ Postgres (port 5533)  - HEALTHY
✓ Qdrant  (port 6333)   - HEALTHY  
✓ Crawl4AI (port 7070)  - HEALTHY
```

## 🚀 Starting Services

```bash
cd /home/mewtwo/Zykairotis/claude-context-core/services

# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f crawl4ai
```

## 🔑 Configuration

1. **Set MiniMax API Key** (required for summaries):
```bash
nano /home/mewtwo/Zykairotis/claude-context-core/.env.crawl4ai

# Update this line:
MINIMAX_API_KEY=your-actual-key-here
```

2. **Restart after config change**:
```bash
docker-compose restart crawl4ai
```

## 🧪 Testing

### Test 1: Health Check
```bash
curl http://localhost:7070/health
# Expected: {"status":"ok"}
```

### Test 2: Chunking & Code Detection
```bash
docker exec claude-context-crawl4ai python -c "
from app.chunking import SmartChunker
chunker = SmartChunker()
text = '''def hello():
    print('Hello!')
    return 42'''
chunks = chunker.chunk_text(text, 'test.py')
print(f'✓ {len(chunks)} chunk(s) created')
print(f'✓ Code detected: {chunks[0].is_code}')
print(f'✓ Language: {chunks[0].language}')
print(f'✓ Model: {chunks[0].model_hint}')
"
```

### Test 3: Crawl a Page (via API)
```bash
curl -X POST http://localhost:7070/crawl \
  -H "Content-Type: application/json" \
  -d '{
    "urls": ["https://example.com"],
    "project": "test",
    "dataset": "demo",
    "mode": "single"
  }'

# Returns: {"progress_id": "...", "status": "running"}
```

### Test 4: Check Progress
```bash
# Replace PROGRESS_ID with actual ID from above
curl http://localhost:7070/progress/PROGRESS_ID
```

## 🔧 MCP Tools Available

Once configured in Claude Desktop:

### Crawling Tools
- `claudeContext.crawl` - Start crawl with chunking/summaries
- `claudeContext.crawlStatus` - Check progress
- `claudeContext.cancelCrawl` - Cancel running crawl

### Retrieval Tools
- `claudeContext.searchChunks` - Search with scope/code filters
- `claudeContext.getChunk` - Get specific chunk by ID
- `claudeContext.listScopes` - List available scopes

### Example Usage
```javascript
// In Claude Desktop with MCP configured
claudeContext.crawl({
  url: "https://fastapi.tiangolo.com/",
  project: "fastapi",
  dataset: "docs",
  scope: "local",
  mode: "recursive",
  maxDepth: 2
})
```

## 📊 What Happens During Crawl

```
Phase 1 (0-15%):   Auto-discovery (llms.txt, sitemaps)
Phase 2 (15-20%):  URL analysis
Phase 3 (20-60%):  Page crawling (browser-aware)
Phase 4 (60-70%):  Smart chunking (tree-sitter + overlap)
Phase 5 (70-80%):  AI summaries (MiniMax per chunk)
Phase 6 (80-92%):  Embeddings (GTE for text, CodeRank for code)
Phase 7 (92-98%):  Storage (Postgres + Qdrant)
Phase 8 (98-100%): Finalization
```

## 🐛 Troubleshooting

### Crawl4AI not starting
```bash
# Check logs
docker-compose logs crawl4ai

# Rebuild if needed
docker-compose build --no-cache crawl4ai
docker-compose up -d crawl4ai
```

### Qdrant unhealthy
```bash
# Check if it's actually responding
curl http://localhost:6333/

# Should return: {"title":"qdrant - vector search engine",...}
```

### Tree-sitter errors
```bash
# Verify installation
docker exec claude-context-crawl4ai python -c "import tree_sitter; print('OK')"
```

### MiniMax API issues
```bash
# Test API key
curl -X POST https://api.minimax.chat/v1/chat/completions \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"abab6.5s-chat","messages":[{"role":"user","content":"test"}]}'
```

## 📁 Important Files

- `app/main.py` - FastAPI endpoints
- `app/crawler.py` - Browser automation
- `app/chunking/` - Smart chunking system
- `app/storage/` - Postgres/Qdrant integration
- `app/services/crawling_service.py` - Main orchestrator
- `.env.crawl4ai` - Configuration (in repo root)

## 🔄 Restarting Services

```bash
# Restart all
docker-compose restart

# Restart just crawl4ai
docker-compose restart crawl4ai

# Restart with rebuild
docker-compose up --build -d crawl4ai
```

## 📈 Performance Expectations

- **Chunking**: ~100 chunks/sec
- **Code Detection**: <1ms per chunk (tree-sitter)
- **MiniMax Summaries**: ~10 chunks/sec
- **Embeddings**: ~40 chunks/sec
- **Overall**: ~5-10 seconds per page

## 🎯 Next Steps

1. ✅ Services running
2. ⏳ Add MiniMax API key to `.env.crawl4ai`
3. ⏳ Ensure EmbeddingMonster services running (ports 30001, 30002)
4. ⏳ Test with a real documentation site
5. ⏳ Configure MCP tools in Claude Desktop

## 📚 Full Documentation

See `IMPLEMENTATION_SUMMARY.md` for:
- Complete architecture details
- API reference
- MCP tool specifications
- Development guidelines

