# Todo 7: Web-Specific Provenance Tracking

**Status:** ⏳ Not Started  
**Complexity:** Low  
**Estimated Time:** 3-4 hours  
**Dependencies:** Todo 2 (Context.indexWebPages)

---

## Objective

Track web-specific provenance metadata (URL, domain, crawl timestamp, content hash) to enable change detection and attribution.

---

## Provenance Data Model

### For GitHub (Existing)

```typescript
interface GitHubProvenance {
  repo: string;          // 'owner/repo'
  branch?: string;       // 'main', 'develop'
  sha?: string;          // commit hash
}
```

### For Web Content (New)

```typescript
interface WebProvenance {
  url: string;           // Full URL
  domain: string;        // Extracted domain
  crawledAt: Date;       // Timestamp
  contentHash: string;   // SHA-256 of content
  title?: string;        // Page title
  lastModified?: Date;   // From HTTP headers
  etag?: string;         // From HTTP headers
}
```

---

## Storage Schema

```sql
-- Add web provenance columns
ALTER TABLE claude_context.vectors_web_content
ADD COLUMN url TEXT NOT NULL,
ADD COLUMN domain TEXT NOT NULL,
ADD COLUMN crawled_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN content_hash TEXT,
ADD COLUMN page_title TEXT,
ADD COLUMN last_modified TIMESTAMPTZ,
ADD COLUMN etag TEXT;

-- Indexes for efficient lookups
CREATE INDEX idx_web_url ON claude_context.vectors_web_content (url);
CREATE INDEX idx_web_domain ON claude_context.vectors_web_content (domain);
CREATE INDEX idx_web_crawled_at ON claude_context.vectors_web_content (crawled_at);
CREATE INDEX idx_web_content_hash ON claude_context.vectors_web_content (content_hash);
```

---

## Provenance Capture

### During Ingestion

```typescript
// src/context.ts

private buildWebDocument(
  chunk: CodeChunk,
  pageUrl: string,
  page: WebPageInput,
  projectContext: ProjectContext
): VectorDocument {
  
  const contentHash = crypto
    .createHash('sha256')
    .update(page.content)
    .digest('hex');
  
  return {
    id: this.generateWebChunkId(pageUrl, chunkIndex),
    content: chunk.content,
    relativePath: pageUrl,  // URL as path
    startLine: chunk.startLine || 0,
    endLine: chunk.endLine || 0,
    language: chunk.language || 'markdown',
    projectId: projectContext.projectId,
    datasetId: projectContext.datasetId,
    
    // Provenance metadata
    metadata: {
      ...chunk.metadata,
      sourceType: 'web',
      url: pageUrl,
      domain: page.domain || this.extractDomain(pageUrl),
      crawledAt: new Date().toISOString(),
      contentHash,
      title: page.title,
      lastModified: page.metadata?.lastModified,
      etag: page.metadata?.etag
    }
  };
}
```

---

## Change Detection

### Content Hash Comparison

```typescript
// src/context.ts

export async function detectWebPageChanges(
  context: Context,
  project: string,
  dataset: string,
  url: string,
  newContent: string
): Promise<{
  hasChanged: boolean;
  previousHash?: string;
  newHash: string;
  lastCrawled?: Date;
}> {
  
  const pool = context.getPostgresPool();
  if (!pool) {
    throw new Error('PostgreSQL pool required');
  }
  
  const newHash = crypto
    .createHash('sha256')
    .update(newContent)
    .digest('hex');
  
  const client = await pool.connect();
  try {
    // Get most recent chunk for this URL
    const result = await client.query(`
      SELECT 
        content_hash,
        crawled_at,
        MAX(crawled_at) as last_crawled
      FROM claude_context.vectors_web_content
      WHERE url = $1
        AND project_id = (SELECT id FROM claude_context.projects WHERE name = $2)
        AND dataset_id = (SELECT id FROM claude_context.datasets WHERE name = $3)
      GROUP BY content_hash, crawled_at
      ORDER BY crawled_at DESC
      LIMIT 1
    `, [url, project, dataset]);
    
    if (result.rows.length === 0) {
      // New URL
      return {
        hasChanged: true,
        newHash,
        previousHash: undefined,
        lastCrawled: undefined
      };
    }
    
    const previousHash = result.rows[0].content_hash;
    const lastCrawled = result.rows[0].last_crawled;
    
    return {
      hasChanged: previousHash !== newHash,
      previousHash,
      newHash,
      lastCrawled
    };
  } finally {
    client.release();
  }
}
```

### Incremental Re-crawling

```typescript
export async function reindexChangedWebPages(
  context: Context,
  project: string,
  dataset: string,
  pages: WebPageInput[]
): Promise<{
  unchanged: number;
  updated: number;
  new: number;
}> {
  
  const stats = { unchanged: 0, updated: 0, new: 0 };
  const pagesToIndex: WebPageInput[] = [];
  
  for (const page of pages) {
    const changeStatus = await detectWebPageChanges(
      context,
      project,
      dataset,
      page.url,
      page.content
    );
    
    if (!changeStatus.hasChanged) {
      stats.unchanged++;
      continue;
    }
    
    if (changeStatus.previousHash) {
      stats.updated++;
      // Delete old chunks before re-indexing
      await deleteWebPageChunks(context, project, dataset, page.url);
    } else {
      stats.new++;
    }
    
    pagesToIndex.push(page);
  }
  
  // Index only changed/new pages
  if (pagesToIndex.length > 0) {
    await context.indexWebPages(pagesToIndex, project, dataset);
  }
  
  return stats;
}
```

---

## Attribution in Results

### Enhanced Query Results

```typescript
export interface WebQueryResult {
  id: string;
  chunk: string;
  url: string;
  scores: {
    vector: number;
    sparse?: number;
    hybrid?: number;
    rerank?: number;
    final: number;
  };
  
  // Provenance info
  provenance: {
    domain: string;
    crawledAt: Date;
    title?: string;
    lastModified?: Date;
  };
  
  metadata: {
    title?: string;
    domain?: string;
    isCode?: boolean;
    symbolName?: string;
  };
}
```

### Display Format

```typescript
function formatWebResult(result: WebQueryResult): string {
  return `
**${result.provenance.title || result.url}**
*Source:* ${result.url}
*Domain:* ${result.provenance.domain}
*Crawled:* ${result.provenance.crawledAt.toLocaleDateString()}
*Relevance:* ${(result.scores.final * 100).toFixed(1)}%

${result.chunk}
  `.trim();
}
```

---

## Domain Analytics

```typescript
export async function getWebContentByDomain(
  context: Context,
  project: string,
  domain: string
): Promise<{
  totalPages: number;
  totalChunks: number;
  lastCrawled: Date;
  avgChunksPerPage: number;
}> {
  
  const pool = context.getPostgresPool();
  if (!pool) throw new Error('PostgreSQL pool required');
  
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT 
        COUNT(DISTINCT url) as total_pages,
        COUNT(*) as total_chunks,
        MAX(crawled_at) as last_crawled,
        AVG(chunks_per_page) as avg_chunks_per_page
      FROM (
        SELECT 
          url,
          COUNT(*) as chunks_per_page,
          crawled_at
        FROM claude_context.vectors_web_content
        WHERE domain = $1
          AND project_id = (SELECT id FROM claude_context.projects WHERE name = $2)
        GROUP BY url, crawled_at
      ) subquery
    `, [domain, project]);
    
    const row = result.rows[0];
    
    return {
      totalPages: parseInt(row.total_pages) || 0,
      totalChunks: parseInt(row.total_chunks) || 0,
      lastCrawled: row.last_crawled,
      avgChunksPerPage: parseFloat(row.avg_chunks_per_page) || 0
    };
  } finally {
    client.release();
  }
}
```

---

## Testing

```typescript
// src/api/__tests__/provenance.spec.ts

describe('Web Provenance', () => {
  it('should detect content changes', async () => {
    const page1 = {
      url: 'https://example.com/docs',
      content: 'Original content',
      title: 'Docs'
    };
    
    await context.indexWebPages([page1], 'test-project', 'test-dataset');
    
    // Same content - no change
    let change = await detectWebPageChanges(
      context,
      'test-project',
      'test-dataset',
      page1.url,
      'Original content'
    );
    expect(change.hasChanged).toBe(false);
    
    // Different content - has change
    change = await detectWebPageChanges(
      context,
      'test-project',
      'test-dataset',
      page1.url,
      'Updated content'
    );
    expect(change.hasChanged).toBe(true);
  });
});
```

---

## Next Steps

Proceed to [08-crawl4ai-refactor.md](./08-crawl4ai-refactor.md).

---

**Completion Criteria:**
- ✅ Provenance metadata captured
- ✅ Content hash change detection works
- ✅ Incremental re-crawling functional
- ✅ Attribution displayed in results
- ✅ Tests pass
