# Todo 9: MCP Server Integration

**Status:** ⏳ Not Started  
**Complexity:** Medium  
**Estimated Time:** 6-8 hours  
**Dependencies:** Todo 8 (Crawl4AI Refactor)

---

## Objective

Update MCP server tools to use the unified Context.indexWebPages() pipeline instead of direct Crawl4AI storage.

---

## Current MCP Flow (❌ Broken)

```javascript
// mcp-server.js - Current implementation

mcpServer.registerTool(`${toolNamespace}.crawl`, async ({ url, project, dataset }) => {
  // Step 1: Trigger Crawl4AI (which does EVERYTHING)
  const crawlResponse = await fetch('http://localhost:7070/crawl', {
    method: 'POST',
    body: JSON.stringify({
      urls: [url],
      project,
      dataset,
      // Crawl4AI handles: crawl → chunk → embed → store
    })
  });
  
  // Step 2: Poll for completion
  const jobId = crawlResponse.progress_id;
  await pollCrawlProgress(jobId);
  
  // Step 3: Return result (data already stored by Crawl4AI)
  return { success: true };
});

// Separate ingestion tool (barely used)
mcpServer.registerTool(`${toolNamespace}.ingestCrawl`, async ({ pages, project, dataset }) => {
  // This just stores page metadata, not chunks
  await ingestCrawlPages(context, { pages, project, dataset });
});
```

---

## Target MCP Flow (✅ Unified)

```javascript
// mcp-server.js - New unified implementation

mcpServer.registerTool(`${toolNamespace}.crawl`, {
  title: 'Crawl and Index Web Pages',
  description: 'Crawl web pages and index them with full Context pipeline (hybrid search, reranking, symbols)',
  inputSchema: {
    url: z.string().url().describe('Starting URL to crawl'),
    project: z.string().describe('Project name for organization'),
    dataset: z.string().optional().describe('Dataset name (defaults to domain)'),
    maxPages: z.number().default(50).describe('Maximum pages to crawl'),
    maxDepth: z.number().default(1).describe('Maximum crawl depth'),
    forceReindex: z.boolean().default(false).describe('Force reindex even if content unchanged')
  }
}, async ({ url, project, dataset, maxPages, maxDepth, forceReindex }) => {
  
  const jobId = crypto.randomUUID();
  
  try {
    // Step 1: Call Crawl4AI to GET raw pages
    const crawlResponse = await fetch('http://localhost:7070/crawl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        urls: [url],
        max_pages: maxPages,
        max_depth: maxDepth,
        follow_links: true
      })
    });
    
    if (!crawlResponse.ok) {
      throw new Error(`Crawl failed: ${crawlResponse.status}`);
    }
    
    const { pages, status } = await crawlResponse.json();
    
    if (pages.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `⚠️ No pages crawled from ${url}`
        }]
      };
    }
    
    // Step 2: Use Context to process pages (chunking, embedding, storage)
    const datasetName = dataset || new URL(url).hostname.replace(/^www\./, '');
    
    const stats = await context.indexWebPages(
      pages.map(p => ({
        url: p.url,
        content: p.content,
        title: p.title,
        metadata: {
          lastModified: p.last_modified,
          etag: p.etag
        }
      })),
      project,
      datasetName,
      {
        forceReindex,
        progressCallback: (progress) => {
          console.log(`[${jobId}] ${progress.phase}: ${progress.percentage}%`);
        }
      }
    );
    
    // Step 3: Return comprehensive result
    return {
      content: [{
        type: 'text',
        text: `
✅ **Web Crawl Complete**

**Source:** ${url}
**Project:** ${project}
**Dataset:** ${datasetName}

**Results:**
- Pages crawled: ${pages.length}
- Chunks indexed: ${stats.totalChunks}
- Status: ${stats.status}

The content is now searchable with:
- Hybrid search (dense + sparse vectors)
- Cross-encoder reranking
- Symbol extraction for code examples
- Smart LLM query enhancement

Use \`claudeContext.search\` to query this content.
        `.trim()
      }],
      metadata: {
        jobId,
        project,
        dataset: datasetName,
        stats
      }
    };
    
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `❌ Crawl failed: ${error.message}`
      }],
      isError: true
    };
  }
});
```

---

## Smart Search Tool

```javascript
mcpServer.registerTool(`${toolNamespace}.smartSearch`, {
  title: 'Smart Web Search',
  description: 'Search web content with LLM query enhancement and answer synthesis',
  inputSchema: {
    query: z.string().describe('Search query'),
    project: z.string().describe('Project to search'),
    dataset: z.string().optional().describe('Specific dataset to search'),
    topK: z.number().default(10).describe('Number of results'),
    enhanceQuery: z.boolean().default(true).describe('Use LLM to enhance query'),
    synthesizeAnswer: z.boolean().default(true).describe('Generate smart answer'),
    answerType: z.enum(['conversational', 'structured']).default('conversational')
  }
}, async ({ query, project, dataset, topK, enhanceQuery, synthesizeAnswer, answerType }) => {
  
  const { ingestWebPages } = await import('./src/api/ingest.js');
  const { smartQueryWeb } = await import('./src/api/smart-query.js');
  
  try {
    const response = await smartQueryWeb(context, {
      query,
      project,
      dataset,
      topK,
      enhanceQuery,
      synthesizeAnswer,
      answerType,
      strategies: ['refinement', 'concept-extraction']
    });
    
    if (response.smartAnswer) {
      // Return synthesized answer
      return {
        content: [{
          type: 'text',
          text: `
# ${query}

${response.smartAnswer.content}

---

**Sources:** ${response.results.length} relevant chunks
**Confidence:** ${(response.smartAnswer.confidence * 100).toFixed(0)}%
          `.trim()
        }],
        metadata: {
          enhancedQuery: response.enhancedQuery,
          chunkReferences: response.smartAnswer.chunkReferences,
          resultsCount: response.results.length
        }
      };
    }
    
    // Fallback: return chunk list
    const resultText = response.results.map((r, i) => `
**${i + 1}. ${r.metadata?.title || r.url}**
*Relevance: ${(r.scores.final * 100).toFixed(1)}%*
*Source: ${r.url}*

${r.chunk.slice(0, 300)}...
    `.trim()).join('\n\n---\n\n');
    
    return {
      content: [{
        type: 'text',
        text: resultText
      }],
      metadata: {
        resultsCount: response.results.length
      }
    };
    
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `❌ Search failed: ${error.message}`
      }],
      isError: true
    };
  }
});
```

---

## Symbol Search Tool

```javascript
mcpServer.registerTool(`${toolNamespace}.searchSymbols`, {
  title: 'Search Code Symbols',
  description: 'Search for functions, classes, and types in web documentation',
  inputSchema: {
    symbolName: z.string().optional().describe('Exact symbol name'),
    symbolKind: z.enum(['function', 'class', 'method', 'interface', 'type']).optional(),
    query: z.string().optional().describe('Fuzzy search query'),
    project: z.string().describe('Project to search'),
    dataset: z.string().optional(),
    topK: z.number().default(20)
  }
}, async ({ symbolName, symbolKind, query, project, dataset, topK }) => {
  
  const { queryWebContent } = await import('./src/api/query.js');
  
  try {
    const results = await queryWebContent(context, {
      query: query || symbolName || '',
      project,
      dataset,
      topK,
      symbolName,
      symbolKind
    });
    
    const symbolText = results.map((r, i) => {
      const symbol = r.metadata?.symbolName ? `\`${r.metadata.symbolName}\`` : 'Unknown';
      const kind = r.metadata?.symbolKind || 'code';
      
      return `
**${i + 1}. ${symbol}** (*${kind}*)
*Source:* ${r.url}
*Relevance:* ${(r.scores.final * 100).toFixed(1)}%

\`\`\`${r.metadata?.codeLanguage || 'text'}
${r.chunk}
\`\`\`
      `.trim();
    }).join('\n\n---\n\n');
    
    return {
      content: [{
        type: 'text',
        text: symbolText || 'No symbols found'
      }],
      metadata: {
        resultsCount: results.length
      }
    };
    
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `❌ Symbol search failed: ${error.message}`
      }],
      isError: true
    };
  }
});
```

---

## Domain Analytics Tool

```javascript
mcpServer.registerTool(`${toolNamespace}.domainStats`, {
  title: 'Get Domain Statistics',
  description: 'View statistics for a specific domain in the project',
  inputSchema: {
    domain: z.string().describe('Domain name (e.g., react.dev)'),
    project: z.string().describe('Project name')
  }
}, async ({ domain, project }) => {
  
  const { getWebContentByDomain } = await import('./src/api/query.js');
  
  try {
    const stats = await getWebContentByDomain(context, project, domain);
    
    return {
      content: [{
        type: 'text',
        text: `
# Domain: ${domain}

**Project:** ${project}
**Total Pages:** ${stats.totalPages}
**Total Chunks:** ${stats.totalChunks}
**Avg Chunks/Page:** ${stats.avgChunksPerPage.toFixed(1)}
**Last Crawled:** ${stats.lastCrawled.toLocaleString()}
        `.trim()
      }],
      metadata: stats
    };
    
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `❌ Failed to get stats: ${error.message}`
      }],
      isError: true
    };
  }
});
```

---

## Incremental Re-crawl Tool

```javascript
mcpServer.registerTool(`${toolNamespace}.recrawl`, {
  title: 'Re-crawl and Update Pages',
  description: 'Re-crawl pages and update only those with changed content',
  inputSchema: {
    url: z.string().url().describe('Starting URL'),
    project: z.string(),
    dataset: z.string().optional(),
    maxPages: z.number().default(50)
  }
}, async ({ url, project, dataset, maxPages }) => {
  
  const { reindexChangedWebPages } = await import('./src/api/ingest.js');
  
  try {
    // Step 1: Crawl pages
    const crawlResponse = await fetch('http://localhost:7070/crawl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        urls: [url],
        max_pages: maxPages
      })
    });
    
    const { pages } = await crawlResponse.json();
    
    // Step 2: Incremental reindex (only changed pages)
    const datasetName = dataset || new URL(url).hostname.replace(/^www\./, '');
    
    const stats = await reindexChangedWebPages(
      context,
      project,
      datasetName,
      pages.map(p => ({
        url: p.url,
        content: p.content,
        title: p.title
      }))
    );
    
    return {
      content: [{
        type: 'text',
        text: `
✅ **Re-crawl Complete**

**Pages crawled:** ${pages.length}
**Unchanged:** ${stats.unchanged}
**Updated:** ${stats.updated}
**New:** ${stats.new}

Only changed content was re-indexed.
        `.trim()
      }],
      metadata: stats
    };
    
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `❌ Re-crawl failed: ${error.message}`
      }],
      isError: true
    };
  }
});
```

---

## Error Handling

```javascript
// Centralized error handler
async function handleCrawl4AIRequest(url, options) {
  const maxRetries = 3;
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        timeout: 60000  // 60 second timeout
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;  // Exponential backoff
        console.warn(`[Crawl4AI] Attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw new Error(`Crawl4AI request failed after ${maxRetries} attempts: ${lastError.message}`);
}
```

---

## Configuration

```bash
# .env
CRAWL4AI_URL=http://localhost:7070
CRAWL4AI_TIMEOUT_MS=60000
CRAWL4AI_MAX_RETRIES=3
```

---

## Testing

```javascript
// test/mcp-integration.test.js

describe('MCP Web Crawl Integration', () => {
  it('should crawl and index web pages', async () => {
    const result = await mcpServer.callTool('claudeContext.crawl', {
      url: 'https://example.com',
      project: 'test-project',
      maxPages: 1
    });
    
    expect(result.metadata.stats.processedPages).toBe(1);
    expect(result.metadata.stats.totalChunks).toBeGreaterThan(0);
  });
  
  it('should perform smart search', async () => {
    const result = await mcpServer.callTool('claudeContext.smartSearch', {
      query: 'example domain',
      project: 'test-project',
      enhanceQuery: true,
      synthesizeAnswer: true
    });
    
    expect(result.content[0].text).toContain('example');
    expect(result.metadata.resultsCount).toBeGreaterThan(0);
  });
});
```

---

## Next Steps

Proceed to [10-testing-strategy.md](./10-testing-strategy.md).

---

**Completion Criteria:**
- ✅ MCP tools use Context.indexWebPages()
- ✅ Smart search tool functional
- ✅ Symbol search tool working
- ✅ Error handling robust
- ✅ Integration tests pass
