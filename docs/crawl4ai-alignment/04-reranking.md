# Todo 4: Cross-Encoder Reranking

**Status:** ⏳ Not Started  
**Complexity:** Medium  
**Estimated Time:** 4-6 hours  
**Dependencies:** Todo 3 (SPLADE Integration)

---

## Objective

Integrate cross-encoder reranking to re-score web search results, improving relevance by 15-35% over vector similarity alone.

---

## Reranker Service Architecture

**Service:** TEI (Text Embeddings Inference)  
**Default Port:** 30003  
**Model:** BAAI/bge-reranker-v2-m3

### API Contract

```python
POST http://localhost:30003/rerank

Request:
{
  "query": "How to use React hooks?",
  "texts": [
    "React hooks let you use state...",
    "Vue composition API...",
    "Angular components..."
  ]
}

Response:
{
  "scores": [0.89, 0.12, 0.05]
}
```

---

## Client Implementation

```typescript
// src/utils/reranker-client.ts (already exists)

export class RerankerClient {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl?: string, timeout: number = 30000) {
    this.baseUrl = baseUrl || process.env.RERANKER_URL || 'http://localhost:30003';
    this.timeout = timeout;
  }

  async rerank(query: string, texts: string[]): Promise<number[]> {
    if (texts.length === 0) return [];

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/rerank`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, texts }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Reranker failed: ${response.status}`);
      }

      const result = await response.json();
      return Array.isArray(result) ? result : result.scores;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
```

---

## Integration with Web Query

### Update Query Pipeline

```typescript
// src/api/query.ts

export async function queryWebContent(
  context: Context,
  request: WebQueryRequest
): Promise<WebQueryResponse> {
  
  const rerankerClient = context.getRerankerClient();
  const rerankEnabled = process.env.ENABLE_RERANKING === 'true' && !!rerankerClient;
  
  // Phase 1: Retrieve candidates (hybrid search)
  const initialK = rerankEnabled 
    ? parseInt(process.env.RERANK_INITIAL_K || '150', 10)
    : request.topK || 10;
    
  const candidates = await hybridSearchWeb(
    context.getVectorDatabase(),
    collectionName,
    queryVector,
    sparseVector,
    { topK: initialK, filter: { projectId, datasetIds } }
  );
  
  if (!rerankEnabled || candidates.length === 0) {
    return { results: candidates.slice(0, request.topK || 10) };
  }
  
  // Phase 2: Rerank with cross-encoder
  const maxChars = parseInt(process.env.RERANK_TEXT_MAX_CHARS || '4000', 10);
  const candidateTexts = candidates.map(c => 
    buildRerankText(c.document, maxChars)
  );
  
  const rerankScores = await rerankerClient.rerank(request.query, candidateTexts);
  
  // Attach scores and resort
  const reranked = candidates.map((candidate, i) => ({
    ...candidate,
    rerankScore: rerankScores[i],
    finalScore: rerankScores[i]  // Replace hybrid score with rerank score
  }));
  
  reranked.sort((a, b) => b.finalScore - a.finalScore);
  
  const finalK = parseInt(process.env.RERANK_FINAL_K || '10', 10);
  return {
    results: reranked.slice(0, finalK),
    metadata: {
      retrievalMethod: 'hybrid+rerank',
      initialCandidates: initialK,
      rerankApplied: true
    }
  };
}
```

---

## Text Preparation for Reranking

### Build Context-Rich Text

```typescript
function buildRerankText(document: VectorDocument, maxChars: number): string {
  const parts: string[] = [];
  
  // Add document title/path
  if (document.metadata?.title) {
    parts.push(`Title: ${document.metadata.title}`);
  }
  
  if (document.relativePath) {
    parts.push(`URL: ${document.relativePath}`);
  }
  
  // Add content
  parts.push(document.content || '');
  
  // Combine and truncate
  const combined = parts.join('\n\n').trim();
  
  if (combined.length <= maxChars) {
    return combined;
  }
  
  // Truncate with ellipsis
  return combined.slice(0, maxChars - 3) + '...';
}
```

---

## Performance Optimization

### Batch Size Control

```typescript
// Reranking can be expensive, process in batches
const RERANK_BATCH_SIZE = 50;

async function rerankInBatches(
  rerankerClient: RerankerClient,
  query: string,
  texts: string[]
): Promise<number[]> {
  const allScores: number[] = [];
  
  for (let i = 0; i < texts.length; i += RERANK_BATCH_SIZE) {
    const batch = texts.slice(i, i + RERANK_BATCH_SIZE);
    const scores = await rerankerClient.rerank(query, batch);
    allScores.push(...scores);
  }
  
  return allScores;
}
```

---

## Score Breakdown

```typescript
export interface WebQueryResult {
  id: string;
  chunk: string;
  url: string;
  scores: {
    vector: number;       // Dense similarity
    sparse?: number;      // SPLADE score
    hybrid?: number;      // RRF fusion score
    rerank?: number;      // Cross-encoder score
    final: number;        // The score used for ranking
  };
  metadata: {
    title?: string;
    domain?: string;
  };
}
```

---

## Error Handling

```typescript
async function rerankWithFallback(
  rerankerClient: RerankerClient,
  query: string,
  candidates: SearchResult[]
): Promise<SearchResult[]> {
  try {
    const texts = candidates.map(c => buildRerankText(c.document, 4000));
    const scores = await rerankerClient.rerank(query, texts);
    
    return candidates.map((c, i) => ({
      ...c,
      rerankScore: scores[i],
      finalScore: scores[i]
    }));
  } catch (error) {
    console.warn('[Reranker] Failed, using hybrid scores:', error);
    
    // Fall back to hybrid scores
    return candidates.map(c => ({
      ...c,
      rerankScore: undefined,
      finalScore: c.score  // Use original hybrid score
    }));
  }
}
```

---

## Configuration

```bash
# Enable/disable
ENABLE_RERANKING=true

# Service endpoint
RERANKER_URL=http://localhost:30003

# Retrieval parameters
RERANK_INITIAL_K=150      # Fetch 150 candidates
RERANK_FINAL_K=10         # Return top 10 after rerank

# Text truncation
RERANK_TEXT_MAX_CHARS=4000
```

---

## Testing

```typescript
// src/utils/__tests__/reranker-client.spec.ts

describe('RerankerClient', () => {
  it('should rerank web search results', async () => {
    const client = new RerankerClient('http://localhost:30003');
    
    const query = 'React useState hook';
    const texts = [
      'React useState is a Hook that lets you add state to function components',
      'Vue has reactive state management',
      'Angular uses RxJS for state'
    ];
    
    const scores = await client.rerank(query, texts);
    
    expect(scores).toHaveLength(3);
    expect(scores[0]).toBeGreaterThan(scores[1]);
    expect(scores[0]).toBeGreaterThan(scores[2]);
  });
});
```

---

## Next Steps

Proceed to [05-symbol-extraction.md](./05-symbol-extraction.md).

---

**Completion Criteria:**
- ✅ Reranker client integrated
- ✅ Query pipeline uses reranking
- ✅ Score breakdown tracked
- ✅ Fallback on failure
- ✅ Tests pass
