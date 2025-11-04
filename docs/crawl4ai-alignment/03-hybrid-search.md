# Todo 3: SPLADE Hybrid Search Integration

**Status:** ⏳ Not Started  
**Complexity:** Medium  
**Estimated Time:** 6-8 hours  
**Dependencies:** Todo 2 (Context.indexWebPages)

---

## Objective

Ensure SPLADE sparse vector generation works correctly for web content and integrates seamlessly with the hybrid search pipeline.

---

## SPLADE Service Architecture

**Service Location:** `services/splade-runner/`  
**Default Port:** 30004  
**Model:** naver/splade-cocondenser-ensembledistil

### API Endpoints

```python
# services/splade-runner/app/main.py

@app.post("/sparse")
async def compute_sparse(request: SparseRequest):
    """Single text -> sparse vector"""
    vector = model.encode(request.text)
    return {"sparse": {"indices": vector.indices, "values": vector.values}}

@app.post("/sparse/batch")
async def compute_sparse_batch(request: SparseBatchRequest):
    """Batch texts -> sparse vectors"""
    vectors = model.encode_batch(request.batch)
    return {"sparse_vectors": [{"indices": v.indices, "values": v.values} for v in vectors]}
```

---

## Client Integration

### SPLADE Client Configuration

```typescript
// src/utils/splade-client.ts

export class SpladeClient {
  private baseUrl: string;
  private enabled: boolean;
  private endpoints: string[];
  private timeout: number = 30000;
  
  constructor(baseUrl?: string, timeout?: number) {
    this.enabled = process.env.ENABLE_HYBRID_SEARCH === 'true';
    
    // Endpoint fallback chain
    this.endpoints = [
      baseUrl || process.env.SPLADE_URL,
      'http://splade-runner:8000',
      'http://host.docker.internal:30004',
      'http://localhost:30004'
    ].filter(Boolean);
    
    this.baseUrl = this.endpoints[0];
    this.timeout = timeout || this.timeout;
  }
  
  async computeSparseBatch(texts: string[]): Promise<SparseVector[]> {
    if (!this.enabled || texts.length === 0) {
      return texts.map(() => ({ indices: [], values: [] }));
    }
    
    const response = await this.requestWithFallback('/sparse/batch', {
      batch: texts
    });
    
    return response.sparse_vectors;
  }
}
```

---

## Web Content Considerations

### 1. Text Preprocessing

**Issue:** Web content often contains:
- HTML entities (`&nbsp;`, `&amp;`)
- Extra whitespace
- Unicode characters
- URLs and links

**Solution:** Normalize before SPLADE

```typescript
// src/context.ts

private normalizeWebContent(content: string): string {
  return content
    // Decode HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

private async processWebChunkBuffer(
  chunkBuffer: Array<{ chunk: CodeChunk; pageUrl: string }>,
  collectionName: string,
  projectContext: ProjectContext
): Promise<void> {
  const contents = chunkBuffer.map(item => 
    this.normalizeWebContent(item.chunk.content)
  );
  
  const [denseVectors, sparseVectors] = await Promise.all([
    this.embedding.embedBatch(contents),
    this.spladeClient?.computeSparseBatch(contents)
  ]);
  
  // Continue processing...
}
```

### 2. Code Block Handling

**Issue:** SPLADE may not be optimal for pure code

**Solution:** Adaptive weighting

```typescript
private getHybridWeightsForChunk(chunk: CodeChunk): {
  denseWeight: number;
  sparseWeight: number;
} {
  const isCode = chunk.metadata?.isCode || chunk.language !== 'text';
  
  if (isCode) {
    // Code benefits more from dense embeddings
    return {
      denseWeight: 0.75,
      sparseWeight: 0.25
    };
  } else {
    // Text benefits from sparse term matching
    return {
      denseWeight: 0.55,
      sparseWeight: 0.45
    };
  }
}
```

---

## Vector Storage Updates

### PostgreSQL Schema Addition

```sql
-- Add sparse vector storage
ALTER TABLE claude_context.vectors_web_content
ADD COLUMN sparse_indices INTEGER[],
ADD COLUMN sparse_values FLOAT[];

-- Index for sparse search
CREATE INDEX idx_sparse_gin ON claude_context.vectors_web_content
USING GIN (sparse_indices);
```

### Qdrant Named Vectors

```typescript
// src/vectordb/qdrant-vectordb.ts

async createHybridCollection(
  collectionName: string,
  dimension: number,
  description?: string
): Promise<void> {
  await this.client.createCollection(collectionName, {
    vectors: {
      dense: {
        size: dimension,
        distance: 'Cosine'
      },
      sparse: {
        modifier: 'idf',
        on_disk: false  // Keep sparse vectors in memory for speed
      }
    },
    // Sharding for scale
    shard_number: 2,
    // Replication for availability
    replication_factor: 1
  });
}
```

---

## Hybrid Query for Web Content

### RRF (Reciprocal Rank Fusion)

```typescript
// src/api/query.ts

async function hybridSearchWeb(
  vectorDb: VectorDatabase,
  collectionName: string,
  denseVector: number[],
  sparseVector: SparseVector,
  options: SearchOptions
): Promise<VectorSearchResult[]> {
  
  // Execute both searches in parallel
  const [denseResults, sparseResults] = await Promise.all([
    vectorDb.search(collectionName, denseVector, {
      topK: options.topK * 2,  // Fetch more for fusion
      threshold: options.threshold,
      filter: options.filter
    }),
    (vectorDb as any).sparseSearch(collectionName, sparseVector, {
      topK: options.topK * 2,
      filter: options.filter
    })
  ]);
  
  // RRF fusion
  const k = 60;  // RRF constant
  const scoreMap = new Map<string, {
    document: VectorDocument;
    denseScore: number;
    sparseScore: number;
    rrfScore: number;
  }>();
  
  // Process dense results
  denseResults.forEach((result, rank) => {
    const id = result.document.id;
    scoreMap.set(id, {
      document: result.document,
      denseScore: result.score,
      sparseScore: 0,
      rrfScore: 1 / (k + rank + 1)
    });
  });
  
  // Process sparse results
  sparseResults.forEach((result, rank) => {
    const id = result.document.id;
    const existing = scoreMap.get(id);
    
    if (existing) {
      existing.sparseScore = result.score;
      existing.rrfScore += 1 / (k + rank + 1);
    } else {
      scoreMap.set(id, {
        document: result.document,
        denseScore: 0,
        sparseScore: result.score,
        rrfScore: 1 / (k + rank + 1)
      });
    }
  });
  
  // Sort by RRF score
  const fused = Array.from(scoreMap.values())
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .slice(0, options.topK);
  
  return fused.map(item => ({
    document: item.document,
    score: item.rrfScore,
    metadata: {
      denseScore: item.denseScore,
      sparseScore: item.sparseScore
    }
  }));
}
```

---

## Error Handling & Fallback

### Graceful Degradation

```typescript
// src/context.ts

private async processWebChunkBuffer(
  chunkBuffer: Array<{ chunk: CodeChunk; pageUrl: string }>,
  collectionName: string,
  projectContext: ProjectContext
): Promise<void> {
  const contents = chunkBuffer.map(item => 
    this.normalizeWebContent(item.chunk.content)
  );
  
  let sparseVectors: SparseVector[] | undefined;
  
  // Try SPLADE with fallback
  if (this.spladeClient?.isEnabled()) {
    try {
      sparseVectors = await this.spladeClient.computeSparseBatch(contents);
      console.log('[Context] ✅ SPLADE sparse vectors generated');
    } catch (error) {
      console.warn(
        '[Context] ⚠️  SPLADE failed, continuing with dense-only:',
        error
      );
      // Continue without sparse vectors
    }
  }
  
  // Always generate dense vectors
  const denseVectors = await this.embedding.embedBatch(contents);
  
  // Store with or without sparse
  if (sparseVectors && sparseVectors.length === contents.length) {
    await this.vectorDatabase.upsertBatch(collectionName, {
      documents: this.buildDocuments(chunkBuffer, projectContext),
      vectors: denseVectors.map(v => v.vector),
      sparseVectors
    });
  } else {
    await this.vectorDatabase.upsertBatch(collectionName, {
      documents: this.buildDocuments(chunkBuffer, projectContext),
      vectors: denseVectors.map(v => v.vector)
    });
  }
}
```

---

## Testing

### Integration Test

```typescript
// src/utils/__tests__/splade-client.spec.ts

describe('SpladeClient', () => {
  let client: SpladeClient;
  
  beforeEach(() => {
    process.env.ENABLE_HYBRID_SEARCH = 'true';
    process.env.SPLADE_URL = 'http://localhost:30004';
    client = new SpladeClient();
  });
  
  it('should compute sparse vectors for web content', async () => {
    const texts = [
      'JavaScript async/await tutorial',
      'React hooks documentation',
      'Python FastAPI web framework'
    ];
    
    const vectors = await client.computeSparseBatch(texts);
    
    expect(vectors).toHaveLength(3);
    vectors.forEach(v => {
      expect(v.indices).toBeInstanceOf(Array);
      expect(v.values).toBeInstanceOf(Array);
      expect(v.indices.length).toBeGreaterThan(0);
      expect(v.values.length).toBe(v.indices.length);
    });
  });
});
```

---

## Next Steps

Proceed to [04-reranking.md](./04-reranking.md) to implement cross-encoder reranking.

---

**Completion Criteria:**
- ✅ SPLADE client configured with fallback
- ✅ Sparse vectors generated for web content
- ✅ Hybrid query implements RRF fusion
- ✅ Graceful degradation on SPLADE failure
- ✅ Integration tests pass
