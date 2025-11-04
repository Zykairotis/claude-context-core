# Todo 2: Implement Context.indexWebPages()

**Status:** ⏳ Not Started  
**Complexity:** High  
**Estimated Time:** 12-16 hours  
**Dependencies:** Todo 1 (Architecture Analysis)

---

## Objective

Implement `Context.indexWebPages()` method that processes web pages through the same pipeline as GitHub code, enabling hybrid search, reranking, and symbol extraction for web content.

---

## Method Signature

```typescript
// src/context.ts

export interface WebPageInput {
  url: string;              // Required: Page URL (used as identifier)
  content: string;          // Required: Markdown or text content
  title?: string;           // Optional: Page title
  domain?: string;          // Optional: Extract from URL if not provided
  language?: string;        // Optional: 'markdown' or language hint
  metadata?: Record<string, any>;  // Optional: Custom metadata
}

export interface WebPageIngestOptions {
  progressCallback?: (progress: {
    phase: string;
    current: number;
    total: number;
    percentage: number;
  }) => void;
  forceReindex?: boolean;
  contentHash?: string;     // Optional: For change detection
}

export interface WebPageIngestStats {
  processedPages: number;
  totalChunks: number;
  status: 'completed' | 'limit_reached';
  timestamp: Date;
}

/**
 * Index web pages into project-aware vector storage
 * Applies same pipeline as GitHub: AST chunking, SPLADE, reranking, symbols
 */
public async indexWebPages(
  pages: WebPageInput[],
  project: string,
  dataset: string,
  options?: WebPageIngestOptions
): Promise<WebPageIngestStats>
```

---

## Implementation

### Step 1: Project/Dataset Setup

```typescript
async indexWebPages(
  pages: WebPageInput[],
  project: string,
  dataset: string,
  options?: WebPageIngestOptions
): Promise<WebPageIngestStats> {
  const startTime = new Date();
  options?.progressCallback?.({
    phase: 'Initializing web ingestion',
    current: 0,
    total: pages.length,
    percentage: 0
  });

  // Ensure project and dataset exist
  const pool = this.postgresPool;
  if (!pool) {
    throw new Error('PostgreSQL pool required for project-aware indexing');
  }

  const client = await pool.connect();
  try {
    const projectData = await getOrCreateProject(client, project);
    const datasetData = await getOrCreateDataset(
      client, 
      projectData.id, 
      dataset,
      false // isGlobal
    );

    const projectContext: ProjectContext = {
      projectId: projectData.id,
      projectName: projectData.name,
      datasetId: datasetData.id,
      datasetName: datasetData.name
    };

    // Continue processing...
    return await this.processWebPages(
      pages,
      projectContext,
      options
    );
  } finally {
    client.release();
  }
}
```

---

### Step 2: Collection Preparation

```typescript
private async processWebPages(
  pages: WebPageInput[],
  projectContext: ProjectContext,
  options?: WebPageIngestOptions
): Promise<WebPageIngestStats> {
  
  // Use special collection for web content or unified collection
  const collectionName = this.getWebCollectionName(
    projectContext.projectName,
    projectContext.datasetName
  );
  
  // Prepare hybrid or regular collection
  const collectionExists = await this.vectorDatabase.hasCollection(collectionName);
  
  if (!collectionExists || options?.forceReindex) {
    options?.progressCallback?.({
      phase: 'Preparing vector collection',
      current: 0,
      total: pages.length,
      percentage: 5
    });
    
    if (collectionExists && options?.forceReindex) {
      await this.vectorDatabase.dropCollection(collectionName);
    }
    
    const dimension = await this.embedding.detectDimension();
    const isHybrid = this.getIsHybrid();
    
    if (isHybrid) {
      await this.vectorDatabase.createHybridCollection(
        collectionName,
        dimension,
        `Web content for ${projectContext.projectName}/${projectContext.datasetName}`
      );
    } else {
      await this.vectorDatabase.createCollection(
        collectionName,
        dimension,
        `Web content for ${projectContext.projectName}/${projectContext.datasetName}`
      );
    }
  }
  
  // Process pages in batches
  return await this.batchProcessPages(
    pages,
    collectionName,
    projectContext,
    options
  );
}
```

---

### Step 3: Page Chunking Strategy

```typescript
private async chunkWebPage(page: WebPageInput): Promise<CodeChunk[]> {
  const chunks: CodeChunk[] = [];
  
  // Parse content to detect code blocks
  const sections = this.parseMarkdownSections(page.content);
  
  for (const section of sections) {
    if (section.type === 'code') {
      // Use AST splitter for code blocks
      const codeChunks = await this.codeSplitter.splitCode(
        section.content,
        section.language || 'text',
        {
          relativePath: page.url,
          startLine: section.startLine,
          metadata: {
            isCode: true,
            codeLanguage: section.language,
            sourceUrl: page.url,
            domain: page.domain || this.extractDomain(page.url),
            title: page.title
          }
        }
      );
      chunks.push(...codeChunks);
      
    } else if (section.type === 'text') {
      // Use character-based splitting for prose
      const textChunks = this.splitTextContent(section.content, {
        chunkSize: this.chunkSize,
        overlap: this.chunkOverlap,
        relativePath: page.url,
        startLine: section.startLine,
        metadata: {
          isCode: false,
          sourceUrl: page.url,
          domain: page.domain || this.extractDomain(page.url),
          title: page.title,
          sectionType: section.heading ? 'section' : 'paragraph'
        }
      });
      chunks.push(...textChunks);
    }
  }
  
  return chunks;
}

/**
 * Parse markdown into sections (code blocks vs text)
 */
private parseMarkdownSections(content: string): MarkdownSection[] {
  const sections: MarkdownSection[] = [];
  const lines = content.split('\n');
  
  let currentSection: MarkdownSection | null = null;
  let inCodeBlock = false;
  let codeLanguage = '';
  let lineNumber = 0;
  
  for (const line of lines) {
    lineNumber++;
    
    // Detect code fence start
    const codeFenceMatch = line.match(/^```(\w+)?/);
    if (codeFenceMatch && !inCodeBlock) {
      // Save current text section
      if (currentSection) {
        sections.push(currentSection);
      }
      
      // Start code section
      inCodeBlock = true;
      codeLanguage = codeFenceMatch[1] || 'text';
      currentSection = {
        type: 'code',
        content: '',
        language: codeLanguage,
        startLine: lineNumber + 1
      };
      continue;
    }
    
    // Detect code fence end
    if (line.match(/^```$/) && inCodeBlock) {
      if (currentSection) {
        sections.push(currentSection);
      }
      inCodeBlock = false;
      currentSection = null;
      continue;
    }
    
    // Accumulate content
    if (inCodeBlock) {
      if (currentSection) {
        currentSection.content += line + '\n';
      }
    } else {
      // Text section
      if (!currentSection || currentSection.type !== 'text') {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          type: 'text',
          content: '',
          startLine: lineNumber
        };
      }
      currentSection.content += line + '\n';
    }
  }
  
  // Push final section
  if (currentSection) {
    sections.push(currentSection);
  }
  
  return sections;
}
```

---

### Step 4: Batch Processing with SPLADE

```typescript
private async batchProcessPages(
  pages: WebPageInput[],
  collectionName: string,
  projectContext: ProjectContext,
  options?: WebPageIngestOptions
): Promise<WebPageIngestStats> {
  
  let processedPages = 0;
  let totalChunks = 0;
  const BATCH_SIZE = 50; // Process 50 chunks at a time
  let chunkBuffer: Array<{ chunk: CodeChunk; pageUrl: string }> = [];
  
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    
    options?.progressCallback?.({
      phase: `Processing page ${i + 1}/${pages.length}`,
      current: i + 1,
      total: pages.length,
      percentage: Math.round(((i + 1) / pages.length) * 80) // 0-80%
    });
    
    try {
      // Chunk the page
      const chunks = await this.chunkWebPage(page);
      
      // Add to buffer
      for (const chunk of chunks) {
        chunkBuffer.push({
          chunk,
          pageUrl: page.url
        });
      }
      
      // Process batch when buffer is full
      if (chunkBuffer.length >= BATCH_SIZE) {
        await this.processWebChunkBuffer(
          chunkBuffer,
          collectionName,
          projectContext
        );
        
        totalChunks += chunkBuffer.length;
        chunkBuffer = [];
      }
      
      processedPages++;
      
    } catch (error) {
      console.warn(`[Context] Failed to process page ${page.url}:`, error);
    }
  }
  
  // Process remaining chunks
  if (chunkBuffer.length > 0) {
    await this.processWebChunkBuffer(
      chunkBuffer,
      collectionName,
      projectContext
    );
    totalChunks += chunkBuffer.length;
  }
  
  options?.progressCallback?.({
    phase: 'Web ingestion complete',
    current: pages.length,
    total: pages.length,
    percentage: 100
  });
  
  return {
    processedPages,
    totalChunks,
    status: 'completed',
    timestamp: new Date()
  };
}
```

---

### Step 5: Chunk Buffer Processing (Embeddings + SPLADE)

```typescript
private async processWebChunkBuffer(
  chunkBuffer: Array<{ chunk: CodeChunk; pageUrl: string }>,
  collectionName: string,
  projectContext: ProjectContext
): Promise<void> {
  
  if (chunkBuffer.length === 0) return;
  
  const chunks = chunkBuffer.map(item => item.chunk);
  const contents = chunks.map(chunk => chunk.content);
  
  const isHybrid = this.getIsHybrid();
  
  console.log(
    `[Context] 🔄 Processing web batch: ${chunks.length} chunks ` +
    `(hybrid=${isHybrid})`
  );
  
  // Generate embeddings (dense + sparse in parallel)
  const [denseVectors, sparseVectors] = await Promise.all([
    this.embedding.embedBatch(contents),
    (isHybrid && this.spladeClient?.isEnabled())
      ? this.spladeClient.computeSparseBatch(contents).catch(error => {
          console.warn('[Context] SPLADE failed, using dense-only:', error);
          return undefined;
        })
      : Promise.resolve(undefined)
  ]);
  
  // Build documents for storage
  const documents: VectorDocument[] = chunks.map((chunk, index) => ({
    id: this.generateWebChunkId(chunkBuffer[index].pageUrl, index),
    content: chunk.content,
    relativePath: chunk.relativePath, // URL
    startLine: chunk.startLine || 0,
    endLine: chunk.endLine || 0,
    language: chunk.language || 'markdown',
    projectId: projectContext.projectId,
    datasetId: projectContext.datasetId,
    symbolName: chunk.symbolName,
    symbolKind: chunk.symbolKind,
    metadata: {
      ...chunk.metadata,
      sourceType: 'web',
      ingestedAt: new Date().toISOString()
    }
  }));
  
  // Upsert to vector database
  if (isHybrid && sparseVectors) {
    await this.vectorDatabase.upsertBatch(collectionName, {
      documents,
      vectors: denseVectors.map(v => v.vector),
      sparseVectors
    });
  } else {
    await this.vectorDatabase.upsertBatch(collectionName, {
      documents,
      vectors: denseVectors.map(v => v.vector)
    });
  }
  
  console.log(
    `[Context] ✅ Stored ${chunks.length} web chunks to ${collectionName}`
  );
}
```

---

### Step 6: Utility Methods

```typescript
/**
 * Generate unique ID for web chunk
 */
private generateWebChunkId(url: string, index: number): string {
  const urlHash = crypto
    .createHash('sha256')
    .update(url)
    .digest('hex')
    .slice(0, 16);
  return `web_${urlHash}_${index}`;
}

/**
 * Get collection name for web content
 */
private getWebCollectionName(project: string, dataset: string): string {
  const sanitized = `${project}_${dataset}`
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_');
  
  const isHybrid = this.getIsHybrid();
  return isHybrid 
    ? `hybrid_web_${sanitized}`
    : `web_${sanitized}`;
}

/**
 * Extract domain from URL
 */
private extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'unknown';
  }
}

/**
 * Split text content with overlap
 */
private splitTextContent(
  text: string,
  options: {
    chunkSize: number;
    overlap: number;
    relativePath: string;
    startLine: number;
    metadata?: Record<string, any>;
  }
): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  const { chunkSize, overlap, relativePath, startLine, metadata } = options;
  
  let start = 0;
  let chunkIndex = 0;
  
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const content = text.slice(start, end);
    
    chunks.push({
      content,
      relativePath,
      startLine: startLine + chunkIndex,
      endLine: startLine + chunkIndex,
      language: 'text',
      metadata
    });
    
    start += chunkSize - overlap;
    chunkIndex++;
  }
  
  return chunks;
}
```

---

## Integration with API Layer

Update `src/api/ingest.ts`:

```typescript
export interface WebPageIngestRequest {
  project: string;
  dataset: string;
  pages: WebPageInput[];
  onProgress?: (progress: {
    phase: string;
    current: number;
    total: number;
    percentage: number;
  }) => void;
}

export interface WebPageIngestResponse {
  jobId: string;
  status: 'completed' | 'failed';
  startedAt: Date;
  completedAt: Date;
  stats?: WebPageIngestStats;
  error?: string;
}

export async function ingestWebPages(
  context: Context,
  request: WebPageIngestRequest
): Promise<WebPageIngestResponse> {
  const jobId = crypto.randomUUID();
  const startedAt = new Date();

  try {
    const stats = await context.indexWebPages(
      request.pages,
      request.project,
      request.dataset,
      {
        progressCallback: request.onProgress
      }
    );

    return {
      jobId,
      status: 'completed',
      startedAt,
      completedAt: new Date(),
      stats
    };
  } catch (error: any) {
    return {
      jobId,
      status: 'failed',
      startedAt,
      completedAt: new Date(),
      error: error?.message || String(error)
    };
  }
}
```

---

## Testing Strategy

### Unit Tests

```typescript
// src/context/__tests__/web-ingestion.spec.ts

describe('Context.indexWebPages', () => {
  it('should chunk markdown with code blocks', async () => {
    const context = new Context({
      vectorDatabase: mockVectorDb,
      embedding: mockEmbedding,
      postgresPool: mockPool
    });
    
    const pages = [{
      url: 'https://example.com/docs',
      content: `
# Getting Started

Some text here.

\`\`\`typescript
function hello() {
  console.log('hello');
}
\`\`\`

More text.
      `,
      title: 'Getting Started'
    }];
    
    const stats = await context.indexWebPages(
      pages,
      'test-project',
      'test-dataset'
    );
    
    expect(stats.processedPages).toBe(1);
    expect(stats.totalChunks).toBeGreaterThan(0);
  });
});
```

---

## Next Steps

Proceed to [03-hybrid-search.md](./03-hybrid-search.md) to ensure SPLADE integration works correctly.

---

**Completion Criteria:**
- ✅ Method signature defined
- ✅ Markdown parsing handles code blocks
- ✅ AST splitting applied to code blocks
- ✅ Text chunks use character-based splitting
- ✅ Batch processing with SPLADE
- ✅ Project/dataset isolation
- ✅ Unit tests pass
