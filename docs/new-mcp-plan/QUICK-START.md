# 🚀 Cognee MCP Integration - Quick Start Guide

## Phase 00-01 Complete ✅

All foundational work is done. Cognee tools are integrated and ready to use!

---

## 🎯 What Was Implemented

### ✅ Environment Setup
All required environment variables configured in `.env`:
- `COGNEE_URL` - Service endpoint
- `COGNEE_TOKEN` - Authentication
- `COGNEE_PROJECT` - Default project
- `COGNEE_TIMEOUT` - Request timeout
- `COGNEE_MAX_RETRIES` - Retry attempts

### ✅ MCP Tools Available (5 total)

| Tool | Purpose | Status |
|------|---------|--------|
| `cognee.add` | Add files/URLs to datasets | ✅ Ready |
| `cognee.cognify` | Transform to knowledge graph | ✅ Ready |
| `cognee.search` | Query with 12 strategies | ✅ Ready |
| `cognee.datasets` | Manage datasets (CRUD) | ✅ Ready |
| `cognee.codePipeline` | Code repository analysis | ✅ Ready |

---

## 🏃 Quick Start

### 1. Verify Setup
```bash
node test-cognee-integration.js
```

**Expected Output**: 5/5 checks passed ✅

### 2. Start MCP Server
```bash
node mcp-server.js
```

### 3. Use the Tools

#### Example 1: Create Dataset & Add Data
```javascript
// Create dataset
cognee.datasets({
  action: 'create',
  name: 'my-docs'
})

// Add URLs
cognee.add({
  datasetName: 'my-docs',
  urls: [
    'https://docs.example.com/intro.md',
    'https://docs.example.com/api.md'
  ]
})

// Transform to knowledge graph
cognee.cognify({
  datasets: ['my-docs'],
  runInBackground: false
})
```

#### Example 2: Search Knowledge Graph
```javascript
// Semantic chunk search
cognee.search({
  searchType: 'CHUNKS',
  query: 'authentication flow',
  datasets: ['my-docs'],
  topK: 10
})

// RAG completion (LLM-enhanced)
cognee.search({
  searchType: 'RAG_COMPLETION',
  query: 'How do I implement OAuth?',
  datasets: ['my-docs']
})

// Graph-based search
cognee.search({
  searchType: 'GRAPH_COMPLETION',
  query: 'Explain the API architecture',
  datasets: ['my-docs']
})
```

#### Example 3: Code Repository Analysis
```javascript
// Index a repository
cognee.codePipeline({
  action: 'index',
  repoPath: '/path/to/repo',
  datasetName: 'my-codebase',
  includeDocs: true
})

// Retrieve code context
cognee.codePipeline({
  action: 'retrieve',
  query: 'authentication middleware',
  fullInput: 'I need to understand how authentication works in this codebase'
})
```

---

## 🔍 Available Search Types

| Search Type | Use Case |
|-------------|----------|
| `CHUNKS` | Raw semantic chunks |
| `CHUNKS_LEXICAL` | Keyword-based chunks |
| `INSIGHTS` | High-level insights |
| `SUMMARIES` | Document summaries |
| `RAG_COMPLETION` | LLM-enhanced answers |
| `GRAPH_COMPLETION` | Graph traversal answers |
| `GRAPH_SUMMARY_COMPLETION` | Graph-based summaries |
| `GRAPH_COMPLETION_COT` | Chain-of-thought reasoning |
| `GRAPH_COMPLETION_CONTEXT_EXTENSION` | Extended context |
| `CODE` | Code-specific search |
| `CYPHER` | Direct graph queries |
| `NATURAL_LANGUAGE` | Conversational queries |

---

## 🛠️ Tool Parameters

### cognee.add
```typescript
{
  datasetId?: string;          // UUID of existing dataset
  datasetName?: string;        // Name of dataset (creates if not exists)
  files?: string[];            // Absolute file paths
  urls?: string[];             // HTTP/HTTPS or GitHub URLs
  project?: string;            // Project scope (default: current)
}
```

### cognee.cognify
```typescript
{
  datasets?: string[];         // Dataset names
  datasetIds?: string[];       // Dataset UUIDs
  runInBackground?: boolean;   // Async processing (default: false)
  project?: string;            // Project scope
  graphModel?: string;         // Graph extraction model
}
```

### cognee.search
```typescript
{
  searchType: SearchType;      // One of 12 search strategies
  query: string;               // Natural language query
  datasets?: string[];         // Dataset names
  datasetIds?: string[];       // Dataset UUIDs
  topK?: number;              // Max results (1-100, default: 10)
  include?: string[];         // Shared datasets: ["shared/foo"]
  project?: string;           // Project scope
}
```

### cognee.datasets
```typescript
{
  action: 'list' | 'create' | 'delete' | 'deleteData' | 'share' | 'unshare';
  name?: string;              // Dataset name (for create)
  datasetId?: string;         // Dataset UUID
  datasetName?: string;       // Dataset name (alternative to ID)
  dataId?: string;            // Data item UUID (for deleteData)
  granteeProject?: string;    // Project to share with
  permission?: 'read' | 'write' | 'owner';  // Permission level
  project?: string;           // Project scope
  scope?: 'project' | 'global' | 'linked';  // Dataset scope
}
```

### cognee.codePipeline
```typescript
{
  action: 'index' | 'retrieve';
  repoPath?: string;          // Repository path (for index)
  includeDocs?: boolean;      // Include documentation (default: false)
  query?: string;             // Search query (for retrieve)
  fullInput?: string;         // Full question context (for retrieve)
  datasetName?: string;       // Dataset to index into
  project?: string;           // Project scope
}
```

---

## 🔄 Integration Workflows

### Workflow 1: Document Processing
```javascript
// 1. Create dataset
cognee.datasets({ action: 'create', name: 'docs' })

// 2. Add documents
cognee.add({ 
  datasetName: 'docs',
  urls: ['https://docs.site.com/']
})

// 3. Process into graph
cognee.cognify({ datasets: ['docs'] })

// 4. Search
cognee.search({ 
  searchType: 'RAG_COMPLETION',
  query: 'your question',
  datasets: ['docs']
})
```

### Workflow 2: Code Analysis
```javascript
// 1. Index codebase
cognee.codePipeline({
  action: 'index',
  repoPath: '/path/to/code',
  datasetName: 'my-code'
})

// 2. Retrieve context
cognee.codePipeline({
  action: 'retrieve',
  query: 'authentication',
  fullInput: 'How does auth work?'
})
```

### Workflow 3: Research Pipeline
```javascript
// 1. Multiple source ingestion
cognee.add({
  datasetName: 'research',
  urls: [
    'https://paper1.pdf',
    'https://paper2.pdf',
    'github:org/repo'
  ]
})

// 2. Build knowledge graph
cognee.cognify({
  datasets: ['research'],
  runInBackground: true
})

// 3. Query with different strategies
cognee.search({ searchType: 'INSIGHTS', query: 'main findings' })
cognee.search({ searchType: 'GRAPH_COMPLETION', query: 'relationships' })
cognee.search({ searchType: 'SUMMARIES', query: 'overview' })
```

---

## 🧠 Claude-Context vs Cognee

**When to use Claude-Context:**
- Fast hybrid code search (semantic + lexical)
- Project-scoped indexing
- Real-time incremental updates
- File-level provenance tracking

**When to use Cognee:**
- Knowledge graph generation
- Advanced search strategies (12 types)
- Cross-document relationship analysis
- LLM-enhanced completions

**Best Practice:** Use both together!
- Claude-Context for fast code navigation
- Cognee for deep semantic understanding

---

## 📊 Status Monitoring

### Check Service Health
```bash
curl http://localhost:8340/health
```

### List Datasets
```javascript
cognee.datasets({ action: 'list' })
```

### Check Processing Status
After `cognee.cognify({ runInBackground: true })`:
- Returns `pipeline_run_id`
- Monitor via logs or future status endpoint

---

## 🐛 Troubleshooting

### Issue: "Cognee service unreachable"
```bash
# Check if service is running
docker ps | grep cognee

# Start if not running
cd services/cognee
docker-compose up -d
```

### Issue: "Authentication failed"
Check `.env`:
```bash
COGNEE_TOKEN=local-development-only
```

### Issue: "Dataset not found"
List available datasets:
```javascript
cognee.datasets({ action: 'list' })
```

---

## 📚 Documentation Links

- [Phase 00-01 Complete](./PHASE-00-01-COMPLETE.md)
- [Full 8-Part Plan](./00-cognee-mcp-index.md)
- [State Assessment](./01-cognee-mcp-state-assessment.md)
- [Action Analysis](./02-cognee-mcp-action-analysis.md)

---

## ✨ What's Next?

### Phase 02: Action Analysis & Tool Implementation
- Enhanced error handling
- Request tracking & logging
- Performance optimization
- Comprehensive testing

### Phase 03: Plan Generation & Optimization
- GOAP planner implementation
- Workflow optimization
- Cost calculations
- Parallel execution

### Phase 04: Execution Monitoring
- OODA Loop implementation
- Telemetry collection
- Circuit breakers
- Anomaly detection

---

**🎉 You're all set! Start using Cognee tools now.**

*For issues or questions, see troubleshooting section above.*
