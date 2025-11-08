# Cognee + Claude-Context Integration Guide
## Using Both Tools Perfectly Together

### Executive Summary
This guide shows how to use the refined Cognee MCP tools alongside Claude-Context, 
leveraging each system's strengths for optimal performance.

---

## 1. Quick Integration

### 1.1 Install Refined Tools

```javascript
// In mcp-server.js, after mcpServer creation:
const { registerCogneeToolsRefined } = require('./cognee-mcp-tools-refined');
const { z } = require('zod');

// Register refined Cognee tools
registerCogneeToolsRefined(mcpServer, z);

// Your existing Claude-Context tools remain unchanged
// They work alongside Cognee tools
```

### 1.2 Environment Configuration

```bash
# .env - Both systems configured
# Claude-Context
POSTGRES_CONNECTION_STRING=postgresql://postgres:password@localhost:5533/claude_context
VECTOR_DATABASE_PROVIDER=postgres
EMBEDDING_PROVIDER=auto
ENABLE_HYBRID_SEARCH=true

# Cognee
COGNEE_URL=http://localhost:8340
COGNEE_TOKEN=your-token  # Optional for local
COGNEE_PROJECT=default   # Current project context

# Performance settings
EMBEDDING_BATCH_SIZE=50
MAX_EMBEDDING_CONCURRENCY=2
COGNEE_TIMEOUT=30000
COGNEE_MAX_RETRIES=3
```

---

## 2. When to Use Which System

### 2.1 Use Claude-Context For:

**✅ Code Search & Analysis**
```javascript
// Fast hybrid search with reranking
await mcpServer.executeTool('claudeContext.search', {
  query: 'authentication middleware',
  project: 'my-app',
  dataset: 'backend',
  includeSymbols: true,
  useReranking: true
});
```

**✅ Real-time Code Indexing**
```javascript
// Incremental updates on file changes
await mcpServer.executeTool('claudeContext.index', {
  path: '/path/to/repo',
  project: 'my-app',
  watch: true
});
```

**✅ Symbol Extraction**
```javascript
// Extract functions, classes, types
await mcpServer.executeTool('claudeContext.symbols', {
  path: '/path/to/file.ts',
  includeReferences: true
});
```

### 2.2 Use Cognee For:

**✅ Document Processing**
```javascript
// PDFs, docs, web content → knowledge graph
await mcpServer.executeTool('cognee.add', {
  datasetName: 'research-papers',
  files: ['paper1.pdf', 'paper2.pdf'],
  urls: ['https://arxiv.org/abs/...']
});

await mcpServer.executeTool('cognee.cognify', {
  datasets: ['research-papers'],
  runInBackground: false  // Small set
});
```

**✅ Cross-Document Insights**
```javascript
// Find relationships across documents
await mcpServer.executeTool('cognee.search', {
  searchType: 'GRAPH_COMPLETION',
  query: 'How do these concepts relate?',
  datasets: ['research-papers']
});
```

**✅ Natural Language Q&A**
```javascript
// RAG-enhanced answers
await mcpServer.executeTool('cognee.search', {
  searchType: 'RAG_COMPLETION',
  query: 'Summarize the main findings',
  datasets: ['research-papers'],
  topK: 20
});
```

---

## 3. Combined Workflows

### 3.1 Full-Stack Documentation

```javascript
async function documentFullStack(projectPath) {
  // 1. Index code with Claude-Context (fast, incremental)
  await mcpServer.executeTool('claudeContext.index', {
    path: projectPath,
    project: 'fullstack-app',
    dataset: 'codebase'
  });
  
  // 2. Add docs to Cognee (knowledge graph)
  await mcpServer.executeTool('cognee.add', {
    datasetName: 'project-docs',
    files: [
      `${projectPath}/README.md`,
      `${projectPath}/docs/API.md`,
      `${projectPath}/docs/Architecture.md`
    ]
  });
  
  // 3. Build knowledge graph
  await mcpServer.executeTool('cognee.cognify', {
    datasets: ['project-docs'],
    runInBackground: false
  });
  
  // 4. Combined search
  const codeResults = await mcpServer.executeTool('claudeContext.search', {
    query: 'authentication flow',
    project: 'fullstack-app'
  });
  
  const docInsights = await mcpServer.executeTool('cognee.search', {
    searchType: 'RAG_COMPLETION',
    query: 'How does authentication work according to docs?',
    datasets: ['project-docs']
  });
  
  return { code: codeResults, documentation: docInsights };
}
```

### 3.2 Research + Implementation

```javascript
async function researchAndImplement(topic) {
  // 1. Research phase with Cognee
  await mcpServer.executeTool('cognee.add', {
    datasetName: 'research',
    urls: [
      'https://github.com/best-practices/auth',
      'https://owasp.org/authentication',
      'https://auth0.com/docs'
    ]
  });
  
  await mcpServer.executeTool('cognee.cognify', {
    datasets: ['research'],
    runInBackground: true  // Large dataset
  });
  
  // 2. Get insights
  const insights = await mcpServer.executeTool('cognee.search', {
    searchType: 'INSIGHTS',
    query: topic,
    datasets: ['research']
  });
  
  // 3. Find similar implementations in codebase
  const existingCode = await mcpServer.executeTool('claudeContext.search', {
    query: topic,
    project: 'my-app',
    includeSymbols: true
  });
  
  // 4. Generate implementation plan
  const plan = await mcpServer.executeTool('cognee.search', {
    searchType: 'RAG_COMPLETION',
    query: `Based on research, how should I implement ${topic}?`,
    datasets: ['research']
  });
  
  return { insights, existingCode, plan };
}
```

---

## 4. Dataset Sharing & Scoping

### 4.1 Project Isolation (Default)

```javascript
// Each project has isolated datasets
const projectA = 'frontend-app';
const projectB = 'backend-api';

// Create datasets in different projects
await mcpServer.executeTool('cognee.datasets', {
  action: 'create',
  name: 'components',
  project: projectA
});

await mcpServer.executeTool('cognee.datasets', {
  action: 'create',
  name: 'api-docs',
  project: projectB
});

// Search is scoped by default
await mcpServer.executeTool('cognee.search', {
  searchType: 'CHUNKS',
  query: 'button component',
  datasets: ['components'],
  project: projectA  // Only searches projectA's components
});
```

### 4.2 Cross-Project Sharing

```javascript
// Share dataset from projectA with projectB
await mcpServer.executeTool('cognee.datasets', {
  action: 'share',
  datasetName: 'components',
  project: projectA,
  granteeProject: projectB,
  permission: 'read'
});

// ProjectB can now include shared dataset
await mcpServer.executeTool('cognee.search', {
  searchType: 'CHUNKS',
  query: 'reusable components',
  datasets: ['api-docs'],  // Own dataset
  include: ['shared/components'],  // Shared from projectA
  project: projectB
});
```

### 4.3 Global Datasets

```javascript
// Create global dataset (accessible by all)
await mcpServer.executeTool('cognee.datasets', {
  action: 'create',
  name: 'company-guidelines',
  scope: 'global'
});

// Any project can search global datasets
await mcpServer.executeTool('cognee.search', {
  searchType: 'CHUNKS',
  query: 'coding standards',
  include: ['global/company-guidelines'],
  project: 'any-project'
});
```

---

## 5. Performance Optimization

### 5.1 Smart Processing Decisions

```javascript
class SmartProcessor {
  async process(files) {
    const codeFiles = files.filter(f => /\.(js|ts|py|java)$/.test(f));
    const docFiles = files.filter(f => /\.(md|pdf|txt)$/.test(f));
    
    // Use Claude-Context for code (faster, incremental)
    if (codeFiles.length > 0) {
      await mcpServer.executeTool('claudeContext.index', {
        files: codeFiles,
        project: 'my-app',
        dataset: 'code'
      });
    }
    
    // Use Cognee for documents (knowledge graph)
    if (docFiles.length > 0) {
      await mcpServer.executeTool('cognee.add', {
        datasetName: 'docs',
        files: docFiles
      });
      
      // Auto-select background mode based on size
      const useBackground = docFiles.length > 10;
      await mcpServer.executeTool('cognee.cognify', {
        datasets: ['docs'],
        runInBackground: useBackground
      });
    }
  }
}
```

### 5.2 Batch Operations

```javascript
// Batch file additions for performance
async function batchAddFiles(files, batchSize = 10) {
  const dataset = 'large-corpus';
  
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    
    await mcpServer.executeTool('cognee.add', {
      datasetName: dataset,
      files: batch
    });
    
    console.log(`Processed batch ${i / batchSize + 1} of ${Math.ceil(files.length / batchSize)}`);
  }
  
  // Process all at once in background
  await mcpServer.executeTool('cognee.cognify', {
    datasets: [dataset],
    runInBackground: true
  });
}
```

### 5.3 Caching Strategy

```javascript
class SearchCache {
  constructor() {
    this.cache = new Map();
    this.ttl = 5 * 60 * 1000; // 5 minutes
  }
  
  getCacheKey(tool, params) {
    return `${tool}:${JSON.stringify(params)}`;
  }
  
  async search(tool, params) {
    const key = this.getCacheKey(tool, params);
    const cached = this.cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < this.ttl) {
      console.log(`Cache hit for ${tool}`);
      return cached.result;
    }
    
    const result = await mcpServer.executeTool(tool, params);
    
    this.cache.set(key, {
      result,
      timestamp: Date.now()
    });
    
    return result;
  }
}

const cache = new SearchCache();

// Use cached search
const results = await cache.search('cognee.search', {
  searchType: 'CHUNKS',
  query: 'authentication',
  datasets: ['docs']
});
```

---

## 6. Database Integration

### 6.1 Setup Control Plane

```bash
# Run the schema migration
psql -h localhost -U postgres -p 5533 -d claude_context < docs/cognee-control-plane-schema.sql
```

### 6.2 Query Accessible Datasets

```sql
-- Get all datasets a project can access
SELECT * FROM get_accessible_datasets(
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::UUID,
  'read'::share_permission
);
```

### 6.3 Track Pipeline Status

```javascript
async function trackPipeline(pipelineId) {
  // Poll pipeline status
  const checkStatus = async () => {
    const result = await db.query(`
      SELECT status, stats, error_message, duration_ms
      FROM pipeline_runs
      WHERE id = $1
    `, [pipelineId]);
    
    return result.rows[0];
  };
  
  // Wait for completion
  let status;
  do {
    await new Promise(r => setTimeout(r, 2000));
    status = await checkStatus();
    console.log(`Pipeline ${status.status}: ${JSON.stringify(status.stats)}`);
  } while (status.status === 'running');
  
  return status;
}
```

---

## 7. Migration from Existing Systems

### 7.1 From Standalone Cognee

```javascript
// Before: Direct Cognee API
const formData = new FormData();
formData.append('datasetName', 'my-data');
formData.append('data', file);
await fetch('https://api.cognee.ai/api/v1/add', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer token' },
  body: formData
});

// After: MCP Tool with project context
await mcpServer.executeTool('cognee.add', {
  datasetName: 'my-data',
  files: [filePath],
  project: 'my-project'  // Added project scoping
});
```

### 7.2 From Basic Claude-Context

```javascript
// Before: No dataset organization
await claudeContext.index({ path: '/repo' });

// After: Project + dataset organization
await mcpServer.executeTool('claudeContext.index', {
  path: '/repo',
  project: 'my-app',
  dataset: 'backend'  // Logical grouping
});
```

---

## 8. Monitoring & Observability

### 8.1 Track Usage Metrics

```javascript
// Log all tool executions
mcpServer.on('tool:execute', async (event) => {
  await db.query(`
    INSERT INTO search_logs (project_id, search_type, query, latency_ms)
    VALUES ($1, $2, $3, $4)
  `, [
    getCurrentProject(),
    event.tool,
    event.params.query || event.params.action,
    event.duration
  ]);
});
```

### 8.2 Performance Dashboard

```javascript
async function getPerformanceMetrics() {
  const metrics = await db.query(`
    SELECT 
      search_type,
      COUNT(*) as count,
      AVG(latency_ms) as avg_latency,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95_latency,
      PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms) as p99_latency
    FROM search_logs
    WHERE created_at > NOW() - INTERVAL '1 hour'
    GROUP BY search_type
  `);
  
  return metrics.rows;
}
```

---

## 9. Best Practices

### 9.1 Tool Selection Matrix

| Use Case | Best Tool | Reason |
|----------|-----------|--------|
| Code search | Claude-Context | Optimized for code, symbols, hybrid search |
| Code analysis | Claude-Context | AST parsing, incremental updates |
| Document processing | Cognee | Knowledge graphs, entity extraction |
| Cross-doc insights | Cognee | Graph relationships |
| Q&A on docs | Cognee | RAG completion |
| Real-time indexing | Claude-Context | Watch mode, incremental |
| Batch processing | Cognee | Background pipelines |
| Web scraping | Cognee | Built-in web ingestion |

### 9.2 Performance Guidelines

- **Batch Size**: 10-50 files per request
- **Background Mode**: Use for >100 items or >10MB
- **Caching**: 5-minute TTL for search results
- **Parallel Queries**: Max 5 concurrent operations
- **Timeouts**: 30s for sync, 5min for async

### 9.3 Security Considerations

- Always validate file paths before processing
- Use project scoping for multi-tenant environments
- Implement rate limiting on search endpoints
- Sanitize queries to prevent injection
- Use RLS for database-level isolation

---

## 10. Example: Full Integration

```javascript
// Complete example using both systems optimally
async function processRepository(repoPath, projectName) {
  console.log(`Processing repository: ${repoPath}`);
  
  // 1. Setup project
  await mcpServer.executeTool('cognee.datasets', {
    action: 'create',
    name: 'codebase',
    project: projectName
  });
  
  await mcpServer.executeTool('cognee.datasets', {
    action: 'create',
    name: 'documentation',
    project: projectName
  });
  
  // 2. Index code with Claude-Context
  const codeFiles = await findFiles(repoPath, /\.(js|ts|py|java|go)$/);
  await mcpServer.executeTool('claudeContext.index', {
    path: repoPath,
    project: projectName,
    dataset: 'codebase'
  });
  
  // 3. Process docs with Cognee
  const docFiles = await findFiles(repoPath, /\.(md|txt|pdf)$/);
  if (docFiles.length > 0) {
    await mcpServer.executeTool('cognee.add', {
      datasetName: 'documentation',
      files: docFiles,
      project: projectName
    });
    
    await mcpServer.executeTool('cognee.cognify', {
      datasets: ['documentation'],
      project: projectName,
      runInBackground: docFiles.length > 20
    });
  }
  
  // 4. Create unified search interface
  const unifiedSearch = async (query) => {
    const [codeResults, docResults] = await Promise.all([
      // Fast code search
      mcpServer.executeTool('claudeContext.search', {
        query,
        project: projectName,
        dataset: 'codebase',
        topK: 10
      }),
      // Knowledge graph search
      mcpServer.executeTool('cognee.search', {
        searchType: 'RAG_COMPLETION',
        query,
        datasets: ['documentation'],
        project: projectName,
        topK: 5
      })
    ]);
    
    return {
      code: codeResults.structuredContent,
      documentation: docResults.structuredContent,
      timestamp: new Date().toISOString()
    };
  };
  
  // 5. Share with other projects if needed
  await mcpServer.executeTool('cognee.datasets', {
    action: 'share',
    datasetName: 'documentation',
    project: projectName,
    granteeProject: 'research-team',
    permission: 'read'
  });
  
  console.log(`✅ Repository processed successfully`);
  return { projectName, unifiedSearch };
}
```

---

## Summary

By using Claude-Context and Cognee together:

1. **Claude-Context** handles code search, symbols, and real-time indexing
2. **Cognee** handles documents, knowledge graphs, and cross-doc insights
3. **Project/dataset scoping** provides isolation and organization
4. **Sharing mechanisms** enable controlled cross-project access
5. **Smart routing** ensures optimal tool selection for each use case

This hybrid approach leverages the strengths of both systems for 
maximum performance and capability.
