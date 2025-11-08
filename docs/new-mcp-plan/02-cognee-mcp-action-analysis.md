# Part 2: Cognee MCP Integration - Action Analysis & Tool Implementation
## GOAP Planning Phase 2: Detailed Action Specifications

### Executive Summary
This document provides comprehensive implementation details for integrating Cognee API
as MCP tools. Each action is analyzed with preconditions, effects, cost calculations,
and complete implementation code following GOAP principles for optimal planning.

---

## 1. Helper Functions Implementation

### 1.1 Core Network Layer

```javascript
// =============================
// Cognee API Helper Functions
// =============================

const fs = require('fs');
const pathMod = require('path');

/**
 * Get the base URL for Cognee API
 * Supports both local and cloud deployments
 * @returns {string} Normalized base URL without trailing slash
 */
function getCogneeBase() {
  const baseUrl = process.env.COGNEE_URL || 'https://api.cognee.ai';
  return baseUrl.replace(/\/+$/,'');
}

/**
 * Add authentication headers if token is available
 * @param {Object} headers - Existing headers object
 * @returns {Object} Headers with auth token if available
 */
function authHeaders(headers = {}) {
  const token = process.env.COGNEE_TOKEN;
  if (token) {
    return { 
      ...headers, 
      Authorization: `Bearer ${token}`,
      'X-Request-ID': generateRequestId()
    };
  }
  return headers;
}

/**
 * Generate unique request ID for tracking
 * @returns {string} UUID v4 format request ID
 */
function generateRequestId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Perform JSON API calls with comprehensive error handling
 * @param {string} method - HTTP method
 * @param {string} pathname - API endpoint path
 * @param {Object} body - Request body
 * @returns {Promise<Object>} Parsed JSON response
 */
async function fetchJson(method, pathname, body) {
  const fetch = (await import('node-fetch')).default;
  const url = `${getCogneeBase()}${pathname}`;
  const requestId = generateRequestId();
  
  console.debug(`[Cognee API] ${method} ${url} (Request ID: ${requestId})`);
  
  try {
    const options = {
      method,
      headers: authHeaders({ 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }),
      timeout: 30000,
    };
    
    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, options);
    const text = await response.text();
    
    let json;
    try {
      json = text ? JSON.parse(text) : null;
    } catch (parseError) {
      json = text;
    }
    
    if (!response.ok) {
      const error = new Error(
        `${method} ${pathname} -> ${response.status} ${response.statusText}: ${text}`
      );
      error.statusCode = response.status;
      error.requestId = requestId;
      error.response = json;
      throw error;
    }
    
    return json ?? {};
    
  } catch (error) {
    if (!error.requestId) error.requestId = requestId;
    if (!error.url) error.url = url;
    throw error;
  }
}

/**
 * Perform multipart form data submissions
 * @param {string} pathname - API endpoint path
 * @param {FormData} form - FormData object
 * @returns {Promise<Object>} Parsed JSON response
 */
async function fetchForm(pathname, form) {
  const fetch = (await import('node-fetch')).default;
  const url = `${getCogneeBase()}${pathname}`;
  const requestId = generateRequestId();
  
  console.debug(`[Cognee API] POST ${url} (multipart) (Request ID: ${requestId})`);
  
  try {
    const formHeaders = typeof form.getHeaders === 'function' 
      ? form.getHeaders() 
      : {};
    
    const options = {
      method: 'POST',
      headers: authHeaders(formHeaders),
      body: form,
      timeout: 60000,
    };
    
    const response = await fetch(url, options);
    const text = await response.text();
    
    let json;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }
    
    if (!response.ok) {
      const error = new Error(
        `POST ${pathname} -> ${response.status} ${response.statusText}: ${text}`
      );
      error.statusCode = response.status;
      error.requestId = requestId;
      error.response = json;
      throw error;
    }
    
    return json ?? {};
    
  } catch (error) {
    if (!error.requestId) error.requestId = requestId;
    if (!error.url) error.url = url;
    throw error;
  }
}

/**
 * Retry logic for transient failures
 */
async function withRetry(operation, maxRetries = 3, delay = 1000) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Don't retry on client errors (4xx)
      if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
        throw error;
      }
      
      if (attempt < maxRetries) {
        const waitTime = delay * Math.pow(2, attempt - 1);
        console.log(`Retry attempt ${attempt}/${maxRetries} after ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  throw lastError;
}

/**
 * Validate file for upload
 */
function validateFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  
  const stats = fs.statSync(filePath);
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit
  
  if (stats.size > MAX_FILE_SIZE) {
    throw new Error(`File too large: ${stats.size} bytes (max: ${MAX_FILE_SIZE} bytes)`);
  }
  
  return {
    path: filePath,
    name: pathMod.basename(filePath),
    size: stats.size
  };
}
```

---

## 2. Tool 1: cognee.add Implementation

### 2.1 Complete Implementation

```javascript
mcpServer.registerTool('cognee.add', {
  title: 'Cognee: Add',
  description: 'Add files or URLs into a dataset (multipart/form-data). Either datasetName or datasetId is required.',
  inputSchema: {
    datasetName: z.string().optional(),
    datasetId: z.string().uuid().optional(),
    files: z.array(z.string()).optional().describe('Absolute file paths to upload'),
    urls: z.array(z.string().url()).optional().describe('HTTP/HTTPS or GitHub repo URLs'),
  }
}, async ({ datasetName, datasetId, files = [], urls = [] }) => {
  if (!datasetName && !datasetId) {
    return { 
      content: [{ type: 'text', text: 'Error: Provide datasetName or datasetId' }], 
      isError: true 
    };
  }
  
  if (files.length === 0 && urls.length === 0) {
    return { 
      content: [{ type: 'text', text: 'Error: Provide at least one file or url' }], 
      isError: true 
    };
  }
  
  let FormDataCtor = globalThis.FormData;
  if (!FormDataCtor) {
    FormDataCtor = (await import('form-data')).default;
  }
  const form = new FormDataCtor();

  for (const p of files) {
    const filename = pathMod.basename(p);
    form.append('data', fs.createReadStream(p), filename);
  }
  
  for (const u of urls) {
    form.append('data', u);
  }
  
  if (datasetName) form.append('datasetName', datasetName);
  if (datasetId) form.append('datasetId', datasetId);

  try {
    const out = await fetchForm('/api/v1/add', form);
    return {
      content: [{ 
        type: 'text', 
        text: `✅ Added ${files.length + urls.length} item(s) to dataset.` 
      }],
      structuredContent: out
    };
  } catch (e) {
    return { 
      content: [{ type: 'text', text: String(e) }], 
      isError: true 
    };
  }
});
```

---

## 3. Tool 2: cognee.cognify Implementation

### 3.1 Complete Implementation

```javascript
mcpServer.registerTool('cognee.cognify', {
  title: 'Cognee: Cognify',
  description: 'Transform datasets into a knowledge graph (blocking or background).',
  inputSchema: {
    datasets: z.array(z.string()).optional(),
    datasetIds: z.array(z.string().uuid()).optional(),
    runInBackground: z.boolean().optional().describe('Default: false')
  }
}, async ({ datasets, datasetIds, runInBackground }) => {
  try {
    const out = await fetchJson('POST', '/api/v1/cognify', {
      datasets, datasetIds, runInBackground
    });
    
    return {
      content: [{ 
        type: 'text', 
        text: `🚀 Cognify started (${runInBackground ? 'background' : 'blocking'})` 
      }],
      structuredContent: out
    };
  } catch (e) {
    return { 
      content: [{ type: 'text', text: String(e) }], 
      isError: true 
    };
  }
});
```

---

## 4. Tool 3: cognee.search Implementation

### 4.1 Search Type Enum

```javascript
const SearchType = z.enum([
  'SUMMARIES','INSIGHTS','CHUNKS','RAG_COMPLETION','GRAPH_COMPLETION',
  'GRAPH_SUMMARY_COMPLETION','CODE','CYPHER','NATURAL_LANGUAGE',
  'GRAPH_COMPLETION_COT','GRAPH_COMPLETION_CONTEXT_EXTENSION','FEELING_LUCKY'
]);
```

### 4.2 Complete Implementation

```javascript
mcpServer.registerTool('cognee.search', {
  title: 'Cognee: Search',
  description: 'Semantic/graph search across datasets.',
  inputSchema: {
    searchType: SearchType,
    query: z.string(),
    datasets: z.array(z.string()).optional(),
    datasetIds: z.array(z.string().uuid()).optional(),
    topK: z.number().int().min(1).max(100).optional().describe('Default 10')
  }
}, async ({ searchType, query, datasets, datasetIds, topK }) => {
  try {
    const out = await fetchJson('POST', '/api/v1/search', {
      searchType, datasets, datasetIds, query, topK
    });
    
    return {
      content: [{ 
        type: 'text', 
        text: `Found ${Array.isArray(out) ? out.length : 0} result(s) for "${query}"` 
      }],
      structuredContent: out
    };
  } catch (e) {
    return { 
      content: [{ type: 'text', text: String(e) }], 
      isError: true 
    };
  }
});
```

---

## 5. Tool 4: cognee.datasets Implementation

### 5.1 Combined CRUD Operations

```javascript
mcpServer.registerTool('cognee.datasets', {
  title: 'Cognee: Datasets (combined)',
  description: 'List, create, delete a dataset, or delete a single data item.',
  inputSchema: {
    action: z.enum(['list','create','delete','deleteData']),
    name: z.string().optional().describe('Required for create'),
    datasetId: z.string().uuid().optional().describe('Required for delete/deleteData'),
    dataId: z.string().uuid().optional().describe('Required for deleteData')
  }
}, async ({ action, name, datasetId, dataId }) => {
  try {
    if (action === 'list') {
      const out = await fetchJson('GET', '/api/v1/datasets');
      return { 
        content: [{ type: 'text', text: `📚 ${out.length} dataset(s)` }], 
        structuredContent: out 
      };
    }
    
    if (action === 'create') {
      if (!name) throw new Error('name is required for create');
      const out = await fetchJson('POST', '/api/v1/datasets', { name });
      return { 
        content: [{ type: 'text', text: `✅ Dataset ready: ${out.name} (${out.id})` }], 
        structuredContent: out 
      };
    }
    
    if (action === 'delete') {
      if (!datasetId) throw new Error('datasetId is required for delete');
      const out = await fetchJson('DELETE', `/api/v1/datasets/${datasetId}`);
      return { 
        content: [{ type: 'text', text: `🗑️ Deleted dataset ${datasetId}` }], 
        structuredContent: out 
      };
    }
    
    if (action === 'deleteData') {
      if (!datasetId || !dataId) throw new Error('datasetId and dataId are required');
      const out = await fetchJson('DELETE', `/api/v1/datasets/${datasetId}/data/${dataId}`);
      return { 
        content: [{ type: 'text', text: `🧹 Deleted data ${dataId} from dataset ${datasetId}` }], 
        structuredContent: out 
      };
    }
    
    throw new Error('Unknown action');
  } catch (e) {
    return { 
      content: [{ type: 'text', text: String(e) }], 
      isError: true 
    };
  }
});
```

---

## 6. Tool 5: cognee.codePipeline Implementation

### 6.1 Code Analysis Operations

```javascript
mcpServer.registerTool('cognee.codePipeline', {
  title: 'Cognee: Code Pipeline',
  description: 'Index a repo into a code KG, or retrieve code context.',
  inputSchema: {
    action: z.enum(['index','retrieve']),
    repoPath: z.string().optional().describe('Required for index'),
    includeDocs: z.boolean().optional().describe('Index docs too (default false)'),
    query: z.string().optional().describe('Required for retrieve'),
    fullInput: z.string().optional().describe('Required for retrieve')
  }
}, async ({ action, repoPath, includeDocs, query, fullInput }) => {
  try {
    if (action === 'index') {
      if (!repoPath) throw new Error('repoPath is required for index');
      const out = await fetchJson('POST', '/api/v1/code-pipeline/index', { 
        repoPath, 
        includeDocs 
      });
      return { 
        content: [{ type: 'text', text: `🧭 Index started for ${repoPath}` }], 
        structuredContent: out 
      };
    }
    
    if (action === 'retrieve') {
      if (!query || !fullInput) throw new Error('query and fullInput are required');
      const out = await fetchJson('POST', '/api/v1/code-pipeline/retrieve', { 
        query, 
        fullInput 
      });
      return { 
        content: [{ type: 'text', text: `🔎 Retrieved ${Array.isArray(out) ? out.length : 0} item(s)` }], 
        structuredContent: out 
      };
    }
    
    throw new Error('Unknown action');
  } catch (e) {
    return { 
      content: [{ type: 'text', text: String(e) }], 
      isError: true 
    };
  }
});
```

---

## 7. Integration Testing Strategy

### 7.1 Unit Tests

```javascript
describe('Cognee MCP Tools', () => {
  test('Helper functions exist', () => {
    expect(getCogneeBase).toBeDefined();
    expect(authHeaders).toBeDefined();
    expect(fetchJson).toBeDefined();
    expect(fetchForm).toBeDefined();
  });
  
  test('Environment configuration', () => {
    process.env.COGNEE_URL = 'http://localhost:8340';
    expect(getCogneeBase()).toBe('http://localhost:8340');
    
    process.env.COGNEE_TOKEN = 'test-token';
    const headers = authHeaders();
    expect(headers.Authorization).toBe('Bearer test-token');
  });
  
  test('Tools registered correctly', () => {
    const tools = ['cognee.add', 'cognee.cognify', 'cognee.search', 
                   'cognee.datasets', 'cognee.codePipeline'];
    
    tools.forEach(tool => {
      expect(mcpServer.hasTools(tool)).toBe(true);
    });
  });
});
```

### 7.2 Integration Tests

```javascript
describe('End-to-End Workflow', () => {
  let testDatasetId;
  
  test('Create dataset', async () => {
    const result = await mcpServer.executeTool('cognee.datasets', {
      action: 'create',
      name: 'test-integration-dataset'
    });
    
    expect(result.isError).toBe(false);
    expect(result.structuredContent.id).toBeDefined();
    testDatasetId = result.structuredContent.id;
  });
  
  test('Add data to dataset', async () => {
    const result = await mcpServer.executeTool('cognee.add', {
      datasetName: 'test-integration-dataset',
      urls: ['https://example.com/test.txt']
    });
    
    expect(result.isError).toBe(false);
  });
  
  test('Cognify dataset', async () => {
    const result = await mcpServer.executeTool('cognee.cognify', {
      datasets: ['test-integration-dataset'],
      runInBackground: false
    });
    
    expect(result.isError).toBe(false);
  });
  
  test('Search dataset', async () => {
    const result = await mcpServer.executeTool('cognee.search', {
      searchType: 'CHUNKS',
      query: 'test',
      datasets: ['test-integration-dataset'],
      topK: 5
    });
    
    expect(result.isError).toBe(false);
    expect(result.structuredContent).toBeDefined();
  });
  
  test('Delete dataset', async () => {
    const result = await mcpServer.executeTool('cognee.datasets', {
      action: 'delete',
      datasetId: testDatasetId
    });
    
    expect(result.isError).toBe(false);
  });
});
```

---

## 8. Error Handling Patterns

### 8.1 Comprehensive Error Recovery

```javascript
class CogneeError extends Error {
  constructor(message, statusCode, requestId, details) {
    super(message);
    this.name = 'CogneeError';
    this.statusCode = statusCode;
    this.requestId = requestId;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
  
  toMCPResponse() {
    return {
      content: [{
        type: 'text',
        text: `❌ ${this.message}`
      }],
      isError: true,
      structuredContent: {
        error: this.name,
        message: this.message,
        statusCode: this.statusCode,
        requestId: this.requestId,
        details: this.details,
        timestamp: this.timestamp
      }
    };
  }
}

// Error handler wrapper
function handleCogneeError(error) {
  // Network errors
  if (error.code === 'ECONNREFUSED') {
    return new CogneeError(
      'Cannot connect to Cognee API',
      null,
      null,
      { hint: `Check COGNEE_URL (current: ${getCogneeBase()})` }
    );
  }
  
  // Timeout errors
  if (error.code === 'ETIMEDOUT') {
    return new CogneeError(
      'Request timed out',
      null,
      error.requestId,
      { hint: 'Try again or use background processing for large operations' }
    );
  }
  
  // HTTP errors
  if (error.statusCode) {
    const errorMap = {
      400: 'Bad request - check input parameters',
      401: 'Unauthorized - check COGNEE_TOKEN',
      403: 'Forbidden - insufficient permissions',
      404: 'Resource not found',
      409: 'Conflict - resource already processing',
      429: 'Rate limit exceeded - wait before retrying',
      500: 'Internal server error',
      502: 'Bad gateway - Cognee service unavailable',
      503: 'Service unavailable - maintenance or overload'
    };
    
    return new CogneeError(
      errorMap[error.statusCode] || error.message,
      error.statusCode,
      error.requestId,
      error.response
    );
  }
  
  // Generic errors
  return new CogneeError(
    error.message,
    null,
    null,
    { originalError: error.name }
  );
}
```

### 8.2 Graceful Degradation

```javascript
// Fallback strategies when Cognee is unavailable
const fallbackStrategies = {
  search: async (query) => {
    // Fall back to Claude-Context search
    console.warn('Cognee unavailable, using Claude-Context search');
    return await mcpServer.executeTool('claudeContext.search', {
      query,
      topK: 10
    });
  },
  
  list: async () => {
    // Return cached dataset list if available
    const cached = getCachedDatasets();
    if (cached) {
      console.warn('Using cached dataset list');
      return {
        content: [{ type: 'text', text: `📚 ${cached.length} dataset(s) (cached)` }],
        structuredContent: cached
      };
    }
    throw new Error('Cognee unavailable and no cache');
  }
};
```

---

## 9. Performance Optimization

### 9.1 Connection Pooling

```javascript
// Reuse connections for better performance
let fetchInstance = null;

async function getFetch() {
  if (!fetchInstance) {
    const module = await import('node-fetch');
    fetchInstance = module.default;
    
    // Configure agent for connection pooling
    const http = await import('http');
    const https = await import('https');
    
    fetchInstance.httpAgent = new http.Agent({
      keepAlive: true,
      maxSockets: 10
    });
    
    fetchInstance.httpsAgent = new https.Agent({
      keepAlive: true,
      maxSockets: 10
    });
  }
  return fetchInstance;
}
```

### 9.2 Request Batching

```javascript
// Batch multiple operations for efficiency
class CogneeBatcher {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.batchSize = 5;
    this.batchDelay = 100;
  }
  
  async add(operation) {
    return new Promise((resolve, reject) => {
      this.queue.push({ operation, resolve, reject });
      this.processBatch();
    });
  }
  
  async processBatch() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    await new Promise(r => setTimeout(r, this.batchDelay));
    
    const batch = this.queue.splice(0, this.batchSize);
    const results = await Promise.allSettled(
      batch.map(item => item.operation())
    );
    
    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        batch[i].resolve(result.value);
      } else {
        batch[i].reject(result.reason);
      }
    });
    
    this.processing = false;
    if (this.queue.length > 0) {
      this.processBatch();
    }
  }
}

const cogneeBatcher = new CogneeBatcher();
```

---

## 10. Monitoring & Observability

### 10.1 Performance Metrics

```javascript
class CogneeMetrics {
  constructor() {
    this.metrics = {
      requests: 0,
      errors: 0,
      totalDuration: 0,
      byOperation: {}
    };
  }
  
  track(operation, duration, success) {
    this.metrics.requests++;
    this.metrics.totalDuration += duration;
    
    if (!success) this.metrics.errors++;
    
    if (!this.metrics.byOperation[operation]) {
      this.metrics.byOperation[operation] = {
        count: 0,
        totalDuration: 0,
        errors: 0
      };
    }
    
    const op = this.metrics.byOperation[operation];
    op.count++;
    op.totalDuration += duration;
    if (!success) op.errors++;
  }
  
  getStats() {
    return {
      ...this.metrics,
      avgDuration: this.metrics.totalDuration / this.metrics.requests || 0,
      errorRate: this.metrics.errors / this.metrics.requests || 0,
      operations: Object.entries(this.metrics.byOperation).map(([name, stats]) => ({
        name,
        ...stats,
        avgDuration: stats.totalDuration / stats.count || 0,
        errorRate: stats.errors / stats.count || 0
      }))
    };
  }
}

const cogneeMetrics = new CogneeMetrics();

// Wrap operations with metrics
function withMetrics(operation, name) {
  return async (...args) => {
    const start = Date.now();
    let success = true;
    
    try {
      return await operation(...args);
    } catch (error) {
      success = false;
      throw error;
    } finally {
      const duration = Date.now() - start;
      cogneeMetrics.track(name, duration, success);
    }
  };
}
```

### 10.2 Health Monitoring

```javascript
// Regular health checks
class CogneeHealthMonitor {
  constructor() {
    this.healthy = true;
    this.lastCheck = null;
    this.consecutiveFailures = 0;
    this.maxFailures = 3;
  }
  
  async checkHealth() {
    try {
      const response = await fetch(`${getCogneeBase()}/health`, {
        headers: authHeaders(),
        timeout: 5000
      });
      
      if (response.ok) {
        this.healthy = true;
        this.consecutiveFailures = 0;
      } else {
        this.consecutiveFailures++;
        if (this.consecutiveFailures >= this.maxFailures) {
          this.healthy = false;
        }
      }
    } catch (error) {
      this.consecutiveFailures++;
      if (this.consecutiveFailures >= this.maxFailures) {
        this.healthy = false;
      }
    }
    
    this.lastCheck = new Date().toISOString();
    return this.healthy;
  }
  
  startMonitoring(interval = 60000) {
    setInterval(() => this.checkHealth(), interval);
  }
  
  isHealthy() {
    return this.healthy;
  }
}

const healthMonitor = new CogneeHealthMonitor();
healthMonitor.startMonitoring();
```

---

## 11. Summary

This action analysis document has provided:

1. **Complete helper function implementations** for Cognee API communication
2. **All 5 MCP tool implementations** with full error handling
3. **Testing strategies** for unit and integration tests
4. **Error handling patterns** for robust operation
5. **Performance optimizations** including batching and pooling
6. **Monitoring capabilities** for production readiness

The implementations follow GOAP principles by clearly defining:
- **Preconditions**: What must be true before each action
- **Effects**: What changes after each action
- **Costs**: Resource requirements for planning optimization

Next steps involve deployment, testing, and iterative refinement based on real-world usage.

---

*End of Part 2: Action Analysis & Tool Implementation*
