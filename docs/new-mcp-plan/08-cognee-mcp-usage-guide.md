# Part 8: Cognee MCP Integration - Complete Usage Guide & Documentation
## GOAP Planning Phase 8: Developer & User Documentation

### Executive Summary
This final document provides comprehensive usage guides, API documentation,
troubleshooting guides, and best practices for using the Cognee MCP integration.
It serves as the complete reference for developers and users.

---

## 1. Quick Start Guide

### 1.1 Installation

```bash
# Clone the repository
git clone https://github.com/your-org/claude-context-core.git
cd claude-context-core

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start with Docker Compose
docker-compose up -d

# Or run directly
npm start
```

### 1.2 Basic Configuration

```javascript
// Initialize MCP server with Cognee tools
const { McpServer } = require('@modelcontextprotocol/sdk');

// Load Cognee tool implementations
const cogneeTools = require('./cognee-tools');

// Create MCP server
const mcpServer = new McpServer({
  name: 'cognee-mcp',
  version: '1.0.0'
});

// Register all Cognee tools
for (const [name, config] of Object.entries(cogneeTools)) {
  mcpServer.registerTool(name, config.schema, config.handler);
}

// Start server
await mcpServer.connect(transport);
console.log('Cognee MCP server is running');
```

### 1.3 First Steps

```javascript
// Example 1: Create a dataset and add data
async function quickStart() {
  // Step 1: Create dataset
  const dataset = await mcpServer.executeTool('cognee.datasets', {
    action: 'create',
    name: 'my-first-dataset'
  });
  
  console.log(`Created dataset: ${dataset.structuredContent.id}`);
  
  // Step 2: Add files
  const addResult = await mcpServer.executeTool('cognee.add', {
    datasetName: 'my-first-dataset',
    files: ['/path/to/document.txt'],
    urls: ['https://example.com/article.html']
  });
  
  console.log(`Added ${addResult.structuredContent.items} items`);
  
  // Step 3: Process with cognify
  const cognifyResult = await mcpServer.executeTool('cognee.cognify', {
    datasets: ['my-first-dataset'],
    runInBackground: false
  });
  
  console.log('Processing complete:', cognifyResult.structuredContent.stats);
  
  // Step 4: Search
  const searchResult = await mcpServer.executeTool('cognee.search', {
    searchType: 'CHUNKS',
    query: 'important information',
    datasets: ['my-first-dataset'],
    topK: 10
  });
  
  console.log(`Found ${searchResult.structuredContent.length} results`);
}

quickStart().catch(console.error);
```

---

## 2. Tool API Reference

### 2.1 cognee.add

**Purpose**: Add files or URLs to a dataset for processing.

**Input Schema**:
```typescript
interface AddInput {
  datasetName?: string;  // Name of dataset (creates if not exists)
  datasetId?: string;    // UUID of existing dataset
  files?: string[];      // Array of absolute file paths
  urls?: string[];       // Array of HTTP/HTTPS or GitHub URLs
}
```

**Example**:
```javascript
// Add local files
const result = await mcpServer.executeTool('cognee.add', {
  datasetName: 'research-papers',
  files: [
    '/home/user/paper1.pdf',
    '/home/user/paper2.txt'
  ]
});

// Add web content
const result = await mcpServer.executeTool('cognee.add', {
  datasetName: 'web-articles',
  urls: [
    'https://arxiv.org/abs/2301.00234',
    'https://github.com/user/repo'
  ]
});

// Mixed content
const result = await mcpServer.executeTool('cognee.add', {
  datasetId: 'uuid-here',
  files: ['/path/to/local.txt'],
  urls: ['https://example.com/remote.html']
});
```

**Response**:
```javascript
{
  content: [{ 
    type: 'text', 
    text: '✅ Added 3 item(s) to dataset.' 
  }],
  structuredContent: {
    message: 'Data added successfully',
    items: 3,
    datasetId: 'uuid-here'
  }
}
```

### 2.2 cognee.cognify

**Purpose**: Transform datasets into knowledge graphs.

**Input Schema**:
```typescript
interface CognifyInput {
  datasets?: string[];      // Dataset names (owned by user)
  datasetIds?: string[];    // Dataset UUIDs (cross-user access)
  runInBackground?: boolean; // Async processing (default: false)
}
```

**Example**:
```javascript
// Blocking processing (wait for completion)
const result = await mcpServer.executeTool('cognee.cognify', {
  datasets: ['research-papers'],
  runInBackground: false
});

// Background processing (returns immediately)
const result = await mcpServer.executeTool('cognee.cognify', {
  datasetIds: ['uuid1', 'uuid2'],
  runInBackground: true
});

// Response includes pipeline_run_id for tracking
console.log('Pipeline ID:', result.structuredContent.pipeline_run_id);
```

**Response (Blocking)**:
```javascript
{
  structuredContent: {
    status: 'completed',
    stats: {
      entities_extracted: 156,
      relationships_found: 89,
      chunks_processed: 45,
      processing_time: 12500
    }
  }
}
```

### 2.3 cognee.search

**Purpose**: Search across datasets using various strategies.

**Input Schema**:
```typescript
interface SearchInput {
  searchType: SearchType;   // See enum below
  query: string;            // Natural language query
  datasets?: string[];      // Dataset names
  datasetIds?: string[];    // Dataset UUIDs
  topK?: number;           // Max results (1-100, default: 10)
}

enum SearchType {
  SUMMARIES,                // Document summaries
  INSIGHTS,                 // Extracted insights
  CHUNKS,                   // Semantic search
  RAG_COMPLETION,          // RAG-enhanced answers
  GRAPH_COMPLETION,        // Graph-based reasoning
  GRAPH_SUMMARY_COMPLETION, // Combined graph + summaries
  CODE,                    // Code search
  CYPHER,                  // Direct Cypher queries
  NATURAL_LANGUAGE,        // NL to graph query
  GRAPH_COMPLETION_COT,    // Chain-of-thought
  GRAPH_COMPLETION_CONTEXT_EXTENSION, // Extended context
  FEELING_LUCKY            // Auto-select best type
}
```

**Examples**:
```javascript
// Semantic search
const chunks = await mcpServer.executeTool('cognee.search', {
  searchType: 'CHUNKS',
  query: 'machine learning algorithms',
  datasets: ['research-papers'],
  topK: 20
});

// RAG-enhanced answer
const answer = await mcpServer.executeTool('cognee.search', {
  searchType: 'RAG_COMPLETION',
  query: 'What are the main findings?',
  datasets: ['research-papers']
});

// Graph-based reasoning
const graph = await mcpServer.executeTool('cognee.search', {
  searchType: 'GRAPH_COMPLETION',
  query: 'relationships between concepts',
  datasetIds: ['uuid1']
});

// Code search
const code = await mcpServer.executeTool('cognee.search', {
  searchType: 'CODE',
  query: 'authentication implementation',
  datasets: ['codebase']
});
```

### 2.4 cognee.datasets

**Purpose**: Manage datasets (CRUD operations).

**Input Schema**:
```typescript
interface DatasetInput {
  action: 'list' | 'create' | 'delete' | 'deleteData';
  name?: string;        // Required for create
  datasetId?: string;   // Required for delete/deleteData
  dataId?: string;      // Required for deleteData
}
```

**Examples**:
```javascript
// List all datasets
const list = await mcpServer.executeTool('cognee.datasets', {
  action: 'list'
});

// Create new dataset
const created = await mcpServer.executeTool('cognee.datasets', {
  action: 'create',
  name: 'new-dataset'
});

// Delete dataset
await mcpServer.executeTool('cognee.datasets', {
  action: 'delete',
  datasetId: 'uuid-here'
});

// Delete specific data item
await mcpServer.executeTool('cognee.datasets', {
  action: 'deleteData',
  datasetId: 'dataset-uuid',
  dataId: 'data-uuid'
});
```

### 2.5 cognee.codePipeline

**Purpose**: Index and retrieve code repositories.

**Input Schema**:
```typescript
interface CodePipelineInput {
  action: 'index' | 'retrieve';
  repoPath?: string;       // Required for index
  includeDocs?: boolean;   // Include documentation (default: false)
  query?: string;         // Required for retrieve
  fullInput?: string;     // Required for retrieve
}
```

**Examples**:
```javascript
// Index repository
const indexResult = await mcpServer.executeTool('cognee.codePipeline', {
  action: 'index',
  repoPath: '/path/to/repository',
  includeDocs: true
});

// Retrieve code context
const context = await mcpServer.executeTool('cognee.codePipeline', {
  action: 'retrieve',
  query: 'authentication flow',
  fullInput: 'Show me how authentication works'
});
```

---

## 3. Common Workflows

### 3.1 Document Processing Pipeline

```javascript
async function processDocuments(documents, topic) {
  const datasetName = `docs-${Date.now()}`;
  
  try {
    // 1. Create dataset
    console.log('Creating dataset...');
    await mcpServer.executeTool('cognee.datasets', {
      action: 'create',
      name: datasetName
    });
    
    // 2. Add documents
    console.log('Adding documents...');
    await mcpServer.executeTool('cognee.add', {
      datasetName,
      files: documents
    });
    
    // 3. Process into knowledge graph
    console.log('Building knowledge graph...');
    const cognifyResult = await mcpServer.executeTool('cognee.cognify', {
      datasets: [datasetName],
      runInBackground: false
    });
    
    console.log('Extracted:', cognifyResult.structuredContent.stats);
    
    // 4. Search for specific topic
    console.log(`Searching for: ${topic}`);
    const searchResult = await mcpServer.executeTool('cognee.search', {
      searchType: 'RAG_COMPLETION',
      query: topic,
      datasets: [datasetName]
    });
    
    return searchResult.structuredContent;
    
  } catch (error) {
    console.error('Pipeline failed:', error);
    
    // Cleanup on error
    try {
      const datasets = await mcpServer.executeTool('cognee.datasets', {
        action: 'list'
      });
      
      const dataset = datasets.structuredContent.find(
        d => d.name === datasetName
      );
      
      if (dataset) {
        await mcpServer.executeTool('cognee.datasets', {
          action: 'delete',
          datasetId: dataset.id
        });
      }
    } catch (cleanupError) {
      console.warn('Cleanup failed:', cleanupError);
    }
    
    throw error;
  }
}
```

### 3.2 Web Research Workflow

```javascript
async function webResearch(urls, questions) {
  const results = {};
  
  // Create research dataset
  const dataset = await mcpServer.executeTool('cognee.datasets', {
    action: 'create',
    name: 'web-research'
  });
  
  // Ingest web pages
  await mcpServer.executeTool('cognee.add', {
    datasetId: dataset.structuredContent.id,
    urls
  });
  
  // Process content
  await mcpServer.executeTool('cognee.cognify', {
    datasetIds: [dataset.structuredContent.id]
  });
  
  // Answer each question
  for (const question of questions) {
    const answer = await mcpServer.executeTool('cognee.search', {
      searchType: 'RAG_COMPLETION',
      query: question,
      datasetIds: [dataset.structuredContent.id]
    });
    
    results[question] = answer.structuredContent;
  }
  
  return results;
}
```

### 3.3 Code Analysis Workflow

```javascript
async function analyzeCodebase(repoPath, analysisQueries) {
  // Index the repository
  console.log(`Indexing ${repoPath}...`);
  const indexResult = await mcpServer.executeTool('cognee.codePipeline', {
    action: 'index',
    repoPath,
    includeDocs: true
  });
  
  console.log('Index complete:', indexResult.structuredContent);
  
  // Perform analysis
  const analyses = {};
  
  for (const query of analysisQueries) {
    const result = await mcpServer.executeTool('cognee.codePipeline', {
      action: 'retrieve',
      query: query.pattern,
      fullInput: query.question
    });
    
    analyses[query.name] = {
      question: query.question,
      findings: result.structuredContent
    };
  }
  
  return analyses;
}

// Example usage
const analysisQueries = [
  {
    name: 'security',
    pattern: 'authentication authorization security',
    question: 'What security measures are implemented?'
  },
  {
    name: 'architecture',
    pattern: 'class component module structure',
    question: 'Describe the architecture patterns used'
  },
  {
    name: 'testing',
    pattern: 'test spec describe it expect',
    question: 'What is the testing strategy?'
  }
];

const results = await analyzeCodebase('/path/to/repo', analysisQueries);
```

---

## 4. Troubleshooting Guide

### 4.1 Common Issues

**Issue: "COGNEE_URL not configured"**
```bash
# Solution: Set environment variable
export COGNEE_URL=http://localhost:8340
# Or in .env file
COGNEE_URL=http://localhost:8340
```

**Issue: "Authentication required for cloud API"**
```bash
# Solution: Set Cognee token
export COGNEE_TOKEN=your-bearer-token-here
```

**Issue: "Dataset not found"**
```javascript
// Solution: Check dataset exists first
const datasets = await mcpServer.executeTool('cognee.datasets', {
  action: 'list'
});

const exists = datasets.structuredContent.some(
  d => d.name === 'my-dataset'
);

if (!exists) {
  await mcpServer.executeTool('cognee.datasets', {
    action: 'create',
    name: 'my-dataset'
  });
}
```

**Issue: "Rate limit exceeded"**
```javascript
// Solution: Implement retry with backoff
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.statusCode === 429 && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000;
        console.log(`Rate limited. Waiting ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw error;
      }
    }
  }
}
```

### 4.2 Debugging Tips

```javascript
// Enable debug logging
process.env.DEBUG = 'cognee:*';

// Add request interceptor
const originalFetch = global.fetch;
global.fetch = async (...args) => {
  console.log('Request:', args[0], args[1]);
  const response = await originalFetch(...args);
  console.log('Response:', response.status);
  return response;
};

// Monitor tool execution
mcpServer.on('tool:execute', (event) => {
  console.log('Executing tool:', event.tool, event.params);
});

mcpServer.on('tool:complete', (event) => {
  console.log('Tool completed:', event.tool, event.duration);
});

mcpServer.on('tool:error', (event) => {
  console.error('Tool failed:', event.tool, event.error);
});
```

---

## 5. Best Practices

### 5.1 Performance Optimization

```javascript
// Batch operations when possible
const files = [/* many files */];
const batchSize = 10;

for (let i = 0; i < files.length; i += batchSize) {
  const batch = files.slice(i, i + batchSize);
  await mcpServer.executeTool('cognee.add', {
    datasetName: 'large-dataset',
    files: batch
  });
}

// Use background processing for large datasets
if (files.length > 100) {
  await mcpServer.executeTool('cognee.cognify', {
    datasets: ['large-dataset'],
    runInBackground: true
  });
}

// Cache search results
const searchCache = new Map();

async function cachedSearch(query, dataset) {
  const key = `${query}:${dataset}`;
  
  if (searchCache.has(key)) {
    const cached = searchCache.get(key);
    if (Date.now() - cached.timestamp < 300000) { // 5 minutes
      return cached.result;
    }
  }
  
  const result = await mcpServer.executeTool('cognee.search', {
    searchType: 'CHUNKS',
    query,
    datasets: [dataset]
  });
  
  searchCache.set(key, {
    result,
    timestamp: Date.now()
  });
  
  return result;
}
```

### 5.2 Error Handling

```javascript
// Comprehensive error handling
class CogneeClient {
  async executeWithRetry(tool, params, options = {}) {
    const maxRetries = options.maxRetries || 3;
    const retryDelay = options.retryDelay || 1000;
    
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await mcpServer.executeTool(tool, params);
        
      } catch (error) {
        lastError = error;
        
        // Don't retry on client errors
        if (error.statusCode >= 400 && error.statusCode < 500) {
          throw error;
        }
        
        // Log retry attempt
        console.warn(
          `Attempt ${attempt}/${maxRetries} failed for ${tool}:`,
          error.message
        );
        
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, retryDelay * attempt));
        }
      }
    }
    
    throw lastError;
  }
  
  async safeExecute(tool, params) {
    try {
      return await this.executeWithRetry(tool, params);
      
    } catch (error) {
      // Handle specific errors
      if (error.statusCode === 404) {
        return { 
          isError: true, 
          error: 'Resource not found',
          suggestion: 'Check dataset/file exists' 
        };
      }
      
      if (error.statusCode === 429) {
        return { 
          isError: true, 
          error: 'Rate limited',
          suggestion: 'Reduce request frequency' 
        };
      }
      
      // Log unexpected errors
      console.error('Unexpected error:', error);
      
      return {
        isError: true,
        error: error.message,
        stack: error.stack
      };
    }
  }
}
```

### 5.3 Resource Management

```javascript
// Clean up resources
class ResourceManager {
  constructor() {
    this.resources = new Set();
  }
  
  async createDataset(name) {
    const result = await mcpServer.executeTool('cognee.datasets', {
      action: 'create',
      name
    });
    
    this.resources.add({
      type: 'dataset',
      id: result.structuredContent.id
    });
    
    return result;
  }
  
  async cleanup() {
    for (const resource of this.resources) {
      try {
        if (resource.type === 'dataset') {
          await mcpServer.executeTool('cognee.datasets', {
            action: 'delete',
            datasetId: resource.id
          });
        }
      } catch (error) {
        console.warn(`Failed to cleanup ${resource.type}:`, error);
      }
    }
    
    this.resources.clear();
  }
}

// Use with automatic cleanup
const manager = new ResourceManager();

try {
  const dataset = await manager.createDataset('temp-dataset');
  // ... use dataset ...
} finally {
  await manager.cleanup();
}
```

---

## 6. Migration Guide

### 6.1 From Standalone Cognee

```javascript
// Before (Direct Cognee API)
const response = await fetch('https://api.cognee.ai/api/v1/add', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer token' },
  body: formData
});

// After (MCP Integration)
const result = await mcpServer.executeTool('cognee.add', {
  datasetName: 'my-dataset',
  files: ['/path/to/file']
});
```

### 6.2 From Claude-Context

```javascript
// Before (Claude-Context only)
await claudeContext.index({
  path: '/path/to/code',
  project: 'my-project'
});

// After (With Cognee integration)
await mcpServer.executeTool('cognee.codePipeline', {
  action: 'index',
  repoPath: '/path/to/code',
  includeDocs: true
});
```

---

## Summary

This comprehensive guide provides:

1. **Quick start** instructions for immediate use
2. **Complete API reference** for all five tools
3. **Common workflows** with real examples
4. **Troubleshooting guide** for typical issues
5. **Best practices** for performance and reliability
6. **Migration guides** from other systems

The Cognee MCP integration is now fully documented and ready for
production use with all necessary guidance for developers and users.

---

## Appendix: Environment Variables Reference

```bash
# Required
COGNEE_URL=http://localhost:8340
POSTGRES_CONNECTION_STRING=postgresql://user:pass@host/db

# Optional
COGNEE_TOKEN=bearer-token
COGNEE_TIMEOUT=30000
COGNEE_MAX_RETRIES=3

# Database
VECTOR_DATABASE_PROVIDER=postgres
POSTGRES_MAX_CONNECTIONS=10

# Embedding
EMBEDDING_PROVIDER=auto
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_BATCH_SIZE=50

# Monitoring
MONITORING_ENABLED=true
METRICS_PORT=9090

# Security
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000
```

---

*End of Part 8: Complete Usage Guide & Documentation*
*End of Cognee MCP Integration Plan*
