# Todo 6: Smart LLM Query Enhancement

**Status:** ⏳ Not Started  
**Complexity:** Medium  
**Estimated Time:** 6-8 hours  
**Dependencies:** Todo 4 (Reranking)

---

## Objective

Integrate LLM-powered query enhancement (multi-query, refinement, concept extraction) and answer synthesis for web content retrieval.

---

## LLM Client Architecture

**File:** `src/utils/llm-client.ts` (already exists)

**Supported APIs:**
- MiniMax
- Groq
- OpenAI-compatible endpoints

---

## Query Enhancement Strategies

### 1. Multi-Query Expansion

Generate 2-3 alternative phrasings to capture different ways users might express intent.

```typescript
// Original: "How to use React hooks?"
// Variations:
[
  "React hooks usage guide",
  "Tutorial for useState and useEffect",
  "Function component state management in React"
]
```

### 2. Query Refinement

Expand query while preserving core intent.

```typescript
// Original: "FastAPI async"
// Refined: "FastAPI asynchronous request handling and async/await patterns"
```

### 3. Concept Extraction

Extract key technical terms for better matching.

```typescript
// Query: "How do I handle authentication in Express?"
// Concepts: ["authentication", "Express", "middleware", "JWT", "sessions", "passport"]
```

---

## Integration with Web Query

```typescript
// src/api/smart-query.ts

export interface SmartWebQueryRequest {
  project: string;
  query: string;
  dataset?: string;
  topK?: number;
  
  // Enhancement options
  enhanceQuery?: boolean;
  strategies?: QueryEnhancementStrategy[];  // ['multi-query', 'refinement', 'concept-extraction']
  synthesizeAnswer?: boolean;
  answerType?: 'conversational' | 'structured';
}

export interface SmartWebQueryResponse {
  results: WebQueryResult[];
  enhancedQuery?: EnhancedQuery;
  smartAnswer?: SmartAnswer;
  metadata: QueryMetadata;
}

export async function smartQueryWeb(
  context: Context,
  request: SmartWebQueryRequest
): Promise<SmartWebQueryResponse> {
  
  const llmClient = new LLMClient({
    apiKey: process.env.LLM_API_KEY,
    baseUrl: process.env.LLM_API_BASE,
    model: process.env.MODEL_NAME
  });
  
  let enhancedQuery: EnhancedQuery | undefined;
  
  // Phase 1: Query Enhancement
  if (request.enhanceQuery) {
    enhancedQuery = await llmClient.enhanceQuery(
      request.query,
      request.strategies || ['refinement', 'concept-extraction']
    );
  }
  
  // Phase 2: Multi-Query Search
  const queriesToRun: string[] = [request.query];
  
  if (enhancedQuery) {
    if (enhancedQuery.refinedQuery) {
      queriesToRun.push(enhancedQuery.refinedQuery);
    }
    queriesToRun.push(...enhancedQuery.variations);
  }
  
  // Execute searches in parallel
  const allResults = await Promise.all(
    queriesToRun.map(q => 
      queryWebContent(context, {
        ...request,
        query: q,
        topK: request.topK || 10
      })
    )
  );
  
  // Phase 3: Merge and Deduplicate
  const merged = deduplicateResults(allResults.flat(), request.topK || 10);
  
  // Phase 4: Answer Synthesis
  let smartAnswer: SmartAnswer | undefined;
  
  if (request.synthesizeAnswer && merged.results.length > 0) {
    smartAnswer = await llmClient.synthesizeAnswer(
      request.query,
      merged.results.map(r => ({
        id: r.id,
        content: r.chunk,
        file: r.url,
        metadata: r.metadata
      })),
      request.answerType || 'conversational'
    );
  }
  
  return {
    results: merged.results,
    enhancedQuery,
    smartAnswer,
    metadata: {
      originalQuery: request.query,
      queriesExecuted: queriesToRun.length,
      synthesisApplied: !!smartAnswer
    }
  };
}
```

---

## Result Deduplication

```typescript
function deduplicateResults(
  results: WebQueryResult[],
  topK: number
): {
  results: WebQueryResult[];
  duplicatesRemoved: number;
} {
  const seen = new Set<string>();
  const unique: WebQueryResult[] = [];
  let duplicates = 0;
  
  // Sort by score first
  results.sort((a, b) => b.scores.final - a.scores.final);
  
  for (const result of results) {
    // Use content hash for deduplication
    const contentHash = crypto
      .createHash('sha256')
      .update(result.chunk)
      .digest('hex');
    
    if (!seen.has(contentHash)) {
      seen.add(contentHash);
      unique.push(result);
      
      if (unique.length >= topK) break;
    } else {
      duplicates++;
    }
  }
  
  return {
    results: unique,
    duplicatesRemoved: duplicates
  };
}
```

---

## Answer Synthesis

### Conversational Format

```typescript
const answer = await llmClient.synthesizeAnswer(
  'How to use React hooks?',
  chunks,
  'conversational'
);

// Example output:
{
  type: 'conversational',
  content: `
React Hooks let you use state and other React features in function components [chunk:abc123]. 

The most common hooks are:

1. **useState** [chunk:def456] - Manages component state
2. **useEffect** [chunk:ghi789] - Handles side effects

Here's a basic example [chunk:jkl012]:

\`\`\`typescript
const [count, setCount] = useState(0);
\`\`\`

For async operations, combine useState with useEffect [chunk:mno345]...
  `,
  chunkReferences: ['abc123', 'def456', 'ghi789', 'jkl012', 'mno345'],
  confidence: 0.92
}
```

### Structured Format

```typescript
const answer = await llmClient.synthesizeAnswer(
  'How to use React hooks?',
  chunks,
  'structured'
);

// Example output:
{
  type: 'structured',
  content: `
# Summary

React Hooks enable state and lifecycle features in function components [chunk:abc123].

# Key Points

- **useState**: Declares state variables [chunk:def456]
- **useEffect**: Manages side effects [chunk:ghi789]
- **Custom Hooks**: Reusable stateful logic [chunk:jkl012]

# Code Snippets

## Basic useState Example [chunk:mno345]
\`\`\`typescript
const [count, setCount] = useState(0);
\`\`\`

## useEffect for Data Fetching [chunk:pqr678]
\`\`\`typescript
useEffect(() => {
  fetchData();
}, []);
\`\`\`

# Recommendations

- Always declare hooks at the top level [chunk:stu901]
- Use ESLint plugin for hooks rules [chunk:vwx234]
  `,
  chunkReferences: ['abc123', 'def456', ...],
  confidence: 0.95
}
```

---

## Configuration

```bash
# LLM API Configuration
LLM_API_KEY=your-api-key
LLM_API_BASE=https://api.groq.com/openai/v1  # or minimax, openai, etc.
MODEL_NAME=openai/gpt-oss-120b
LLM_MAX_TOKENS=16384
LLM_TEMPERATURE=0.2

# Query Enhancement
ENABLE_QUERY_ENHANCEMENT=true
DEFAULT_ENHANCEMENT_STRATEGIES=refinement,concept-extraction

# Answer Synthesis
ENABLE_ANSWER_SYNTHESIS=true
DEFAULT_ANSWER_TYPE=conversational
MAX_CONTEXT_CHUNKS=12
```

---

## Error Handling

```typescript
async function enhanceQueryWithFallback(
  llmClient: LLMClient,
  query: string,
  strategies: QueryEnhancementStrategy[]
): Promise<EnhancedQuery> {
  try {
    return await llmClient.enhanceQuery(query, strategies);
  } catch (error) {
    console.warn('[SmartQuery] Enhancement failed, using original query:', error);
    
    // Fallback: return original query
    return {
      originalQuery: query,
      variations: [],
      conceptTerms: [],
      strategiesApplied: []
    };
  }
}

async function synthesizeAnswerWithFallback(
  llmClient: LLMClient,
  query: string,
  chunks: SmartQueryContextChunk[]
): Promise<SmartAnswer | undefined> {
  try {
    return await llmClient.synthesizeAnswer(query, chunks, 'conversational');
  } catch (error) {
    console.warn('[SmartQuery] Synthesis failed:', error);
    return undefined;  // Return raw chunks instead
  }
}
```

---

## MCP Server Integration

```javascript
// mcp-server.js

mcpServer.registerTool(`${toolNamespace}.smartSearch`, {
  title: 'Smart Web Search with LLM',
  description: 'Search web content with query enhancement and answer synthesis',
  inputSchema: {
    url: z.string().url(),
    query: z.string(),
    project: z.string(),
    dataset: z.string().optional(),
    enhanceQuery: z.boolean().default(true),
    synthesizeAnswer: z.boolean().default(true),
    answerType: z.enum(['conversational', 'structured']).default('conversational')
  }
}, async ({ query, project, dataset, enhanceQuery, synthesizeAnswer, answerType }) => {
  
  const response = await smartQueryWeb(context, {
    query,
    project,
    dataset,
    enhanceQuery,
    synthesizeAnswer,
    answerType,
    strategies: ['refinement', 'concept-extraction'],
    topK: 10
  });
  
  if (response.smartAnswer) {
    return {
      content: [{
        type: 'text',
        text: `# Answer\n\n${response.smartAnswer.content}\n\n---\n\n# Source Chunks\n\n${response.results.length} relevant chunks found.`
      }],
      metadata: {
        enhancedQuery: response.enhancedQuery,
        chunkReferences: response.smartAnswer.chunkReferences
      }
    };
  }
  
  // Fallback: return chunk list
  return {
    content: [{
      type: 'text',
      text: response.results.map(r => 
        `**${r.metadata?.title || r.url}**\n${r.chunk.slice(0, 200)}...`
      ).join('\n\n---\n\n')
    }]
  };
});
```

---

## Testing

```typescript
// src/api/__tests__/smart-query.spec.ts

describe('Smart Web Query', () => {
  it('should enhance query and return better results', async () => {
    const mockLLM = new MockLLMClient();
    mockLLM.setEnhancement({
      refinedQuery: 'React hooks state management tutorial',
      variations: ['useState and useEffect guide'],
      conceptTerms: ['hooks', 'useState', 'useEffect', 'React']
    });
    
    const response = await smartQueryWeb(context, {
      project: 'react-docs',
      query: 'hooks',
      enhanceQuery: true
    });
    
    expect(response.enhancedQuery).toBeDefined();
    expect(response.results.length).toBeGreaterThan(0);
  });
  
  it('should synthesize conversational answer', async () => {
    const response = await smartQueryWeb(context, {
      project: 'react-docs',
      query: 'How to use useState?',
      synthesizeAnswer: true,
      answerType: 'conversational'
    });
    
    expect(response.smartAnswer).toBeDefined();
    expect(response.smartAnswer?.content).toContain('useState');
    expect(response.smartAnswer?.chunkReferences.length).toBeGreaterThan(0);
  });
});
```

---

## Next Steps

Proceed to [07-provenance.md](./07-provenance.md).

---

**Completion Criteria:**
- ✅ Query enhancement integrated
- ✅ Multi-query search works
- ✅ Answer synthesis functional
- ✅ MCP tools expose smart search
- ✅ Error handling robust
- ✅ Tests pass
