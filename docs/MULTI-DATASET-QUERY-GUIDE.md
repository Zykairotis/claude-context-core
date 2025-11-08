# Multi-Dataset Query Guide for Claude Context API Server

## Overview
The Claude Context API Server supports querying across multiple datasets through several mechanisms:

1. **Project-level queries** - Searches all datasets within a project
2. **Global queries** - Searches across all projects and datasets  
3. **Cross-project dataset queries** - Searches specific dataset across all projects
4. **Multiple dataset selection** - Query specific datasets (enhancement needed)

## Current Implementation

### 1. Query All Datasets in a Project
```javascript
// Query all datasets within "my-project"
const result = await queryProject(context, {
  project: "my-project",
  query: "search text",
  includeGlobal: true  // Include global datasets
});
```

### 2. Query All Projects and Datasets
```javascript
// Query across ALL projects and datasets
const result = await queryProject(context, {
  project: "all",  // Special keyword
  query: "search text",
  includeGlobal: true
});
```

### 3. Query Specific Dataset Across All Projects
```javascript
// Query "docs" dataset across all projects
const result = await queryProject(context, {
  project: "all",
  dataset: "docs",  // Narrows to specific dataset name
  query: "search text"
});
```

## Database Structure

### Projects and Datasets Relationship
```sql
-- Projects table
CREATE TABLE projects (
  id UUID PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT
);

-- Datasets belong to projects
CREATE TABLE datasets (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  name TEXT NOT NULL,
  type TEXT,
  UNIQUE(project_id, name)
);

-- Global datasets have NULL project_id
-- Project datasets have a project_id
```

### Vector Database Filtering
The Qdrant vector database stores metadata for filtering:
```json
{
  "projectId": "uuid",
  "datasetIds": ["uuid1", "uuid2", "uuid3"],
  "repo": "repo-name",
  "lang": "javascript",
  "pathPrefix": "/src"
}
```

## Enhanced Multi-Dataset Query Implementation

### New Endpoint: Query Multiple Specific Datasets
```typescript
// New function in src/api/query.ts
export async function queryMultipleDatasets(
  context: any,
  request: {
    datasets: Array<{
      project: string;
      dataset: string;
    }>;
    query: string;
    topK?: number;
    threshold?: number;
    includeMetadata?: boolean;
    rerank?: boolean;
  },
  onProgress?: ProgressCallback
): Promise<QueryResult> {
  const requestId = generateRequestId();
  const pool = context.getPostgresPool();
  
  if (!pool) {
    throw new Error('PostgreSQL pool not configured');
  }
  
  const client = await pool.connect();
  try {
    // Resolve all dataset IDs
    const datasetIds: string[] = [];
    
    for (const spec of request.datasets) {
      const query = spec.project === 'global' 
        ? 'SELECT id FROM claude_context.datasets WHERE project_id IS NULL AND name = $1'
        : `SELECT d.id FROM claude_context.datasets d 
           JOIN claude_context.projects p ON d.project_id = p.id 
           WHERE p.name = $1 AND d.name = $2`;
      
      const params = spec.project === 'global' 
        ? [spec.dataset]
        : [spec.project, spec.dataset];
      
      const result = await client.query(query, params);
      if (result.rows.length > 0) {
        datasetIds.push(result.rows[0].id);
      }
    }
    
    if (datasetIds.length === 0) {
      return { 
        requestId, 
        results: [], 
        metadata: makeEmptyMetadata() 
      };
    }
    
    onProgress?.('query', 20, `Querying ${datasetIds.length} datasets`);
    
    // Use existing vector search logic with multiple dataset IDs
    const vectorDb = context.getVectorDatabase();
    const embedding = context.getEmbedding();
    
    const queryVector = await embedding.embed(request.query);
    
    const filter = { datasetIds };
    
    const results = await vectorDb.search(
      queryVector,
      request.topK ?? 10,
      filter,
      request.threshold ?? 0.4
    );
    
    // Optional reranking
    if (request.rerank && context.getRerankerClient()) {
      const reranker = context.getRerankerClient();
      const rerankedResults = await reranker.rerank(
        request.query,
        results.map(r => r.document.content)
      );
      // Apply reranking scores...
    }
    
    return {
      requestId,
      results,
      metadata: {
        datasetsQueried: datasetIds.length,
        datasetNames: request.datasets
      }
    };
  } finally {
    client.release();
  }
}
```

## SQL Queries for Multi-Dataset Operations

### Get All Datasets Across Projects
```sql
-- Get all datasets with their project information
SELECT 
  d.id as dataset_id,
  d.name as dataset_name,
  d.type as dataset_type,
  p.name as project_name,
  p.id as project_id,
  COUNT(DISTINCT wc.id) as chunk_count
FROM claude_context.datasets d
LEFT JOIN claude_context.projects p ON d.project_id = p.id
LEFT JOIN claude_context.web_chunks wc ON wc.dataset_id = d.id
GROUP BY d.id, p.id
ORDER BY p.name, d.name;
```

### Get Dataset Statistics Across Projects
```sql
-- Aggregate statistics for multiple datasets
WITH dataset_stats AS (
  SELECT 
    d.id,
    d.name,
    p.name as project_name,
    COUNT(DISTINCT wc.id) as postgres_chunks,
    COUNT(DISTINCT wp.id) as web_pages,
    MAX(wc.created_at) as last_indexed
  FROM claude_context.datasets d
  LEFT JOIN claude_context.projects p ON d.project_id = p.id
  LEFT JOIN claude_context.web_chunks wc ON wc.dataset_id = d.id
  LEFT JOIN claude_context.web_pages wp ON wp.dataset_id = d.id
  WHERE d.id = ANY($1::uuid[])  -- Pass array of dataset IDs
  GROUP BY d.id, p.name
)
SELECT * FROM dataset_stats;
```

### Query Chunks from Multiple Datasets
```sql
-- Get chunks from specific datasets
SELECT 
  wc.id,
  wc.content,
  wc.metadata,
  d.name as dataset_name,
  p.name as project_name
FROM claude_context.web_chunks wc
JOIN claude_context.datasets d ON wc.dataset_id = d.id
LEFT JOIN claude_context.projects p ON d.project_id = p.id
WHERE wc.dataset_id = ANY($1::uuid[])  -- Array of dataset IDs
  AND wc.content_hash IS NOT NULL
ORDER BY wc.created_at DESC
LIMIT 100;
```

## API Usage Examples

### REST API Endpoints

#### 1. Query Multiple Projects/Datasets
```bash
# Query multiple specific datasets
curl -X POST http://localhost:3030/api/query/multi \
  -H "Content-Type: application/json" \
  -d '{
    "datasets": [
      {"project": "frontend", "dataset": "docs"},
      {"project": "backend", "dataset": "api"},
      {"project": "global", "dataset": "knowledge"}
    ],
    "query": "authentication flow",
    "topK": 20,
    "rerank": true
  }'
```

#### 2. Query All Datasets Matching Pattern
```bash
# Query all datasets with name pattern
curl -X POST http://localhost:3030/api/query/pattern \
  -H "Content-Type: application/json" \
  -d '{
    "datasetPattern": "docs%",  
    "projectPattern": "%service%",
    "query": "error handling",
    "topK": 15
  }'
```

### JavaScript/TypeScript Client

```typescript
import { queryMultipleDatasets } from './api/query';

// Query specific datasets across different projects
const results = await queryMultipleDatasets(context, {
  datasets: [
    { project: 'web-app', dataset: 'frontend' },
    { project: 'api-server', dataset: 'backend' },
    { project: 'docs', dataset: 'guides' }
  ],
  query: 'user authentication',
  topK: 25,
  threshold: 0.5,
  rerank: true
});

// Process results
results.results.forEach(result => {
  console.log(`Score: ${result.score}`);
  console.log(`Dataset: ${result.document.metadata.datasetName}`);
  console.log(`Content: ${result.document.content}`);
});
```

## Performance Considerations

### 1. Indexing Strategy
- Create compound indexes for multi-dataset queries:
```sql
CREATE INDEX idx_datasets_project_name 
  ON claude_context.datasets(project_id, name);

CREATE INDEX idx_web_chunks_dataset_created 
  ON claude_context.web_chunks(dataset_id, created_at DESC);
```

### 2. Query Optimization
- Limit the number of datasets queried simultaneously (recommend < 10)
- Use dataset IDs directly when possible (avoid name lookups)
- Cache frequently accessed dataset ID mappings

### 3. Vector Database Optimization
- Ensure Qdrant has proper indexing on metadata fields
- Consider creating separate collections for different dataset types
- Use pre-filtering to reduce search space

## Monitoring Multi-Dataset Queries

### Add Telemetry
```typescript
// Track multi-dataset query performance
const telemetry = {
  requestId,
  datasetsQueried: datasetIds.length,
  queryDuration: performance.now() - startTime,
  resultsFound: results.length,
  vectorSearchTime: vectorSearchDuration,
  rerankTime: rerankDuration,
  timestamp: new Date().toISOString()
};

// Log to monitoring system
await logQueryTelemetry(telemetry);
```

### WebSocket Events for Real-time Monitoring
```typescript
// Broadcast multi-dataset query events
websocketManager.broadcast({
  type: 'multi-dataset-query',
  requestId,
  datasets: request.datasets,
  resultCount: results.length,
  duration: queryDuration
});
```

## Best Practices

1. **Dataset Naming Convention**
   - Use consistent naming across projects
   - Example: `docs`, `api`, `tests`, `config`

2. **Query Scope Management**
   - Start narrow, expand if needed
   - Use project-level queries before global queries

3. **Result Deduplication**
   - Check for duplicate content across datasets
   - Use content hashes for deduplication

4. **Access Control**
   - Implement dataset-level permissions
   - Track which users can query which datasets

5. **Caching Strategy**
   - Cache dataset ID lookups
   - Cache frequent query embeddings
   - Implement result caching for common queries
