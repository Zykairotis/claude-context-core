# Todo 5: Symbol Extraction for Web Content

**Status:** ⏳ Not Started  
**Complexity:** Medium  
**Estimated Time:** 6-8 hours  
**Dependencies:** Todo 2 (Context.indexWebPages)

---

## Objective

Extract symbol metadata (function names, class names, types) from code blocks in web documentation to enable symbol-level search.

---

## Symbol Extraction Architecture

### Current Implementation (GitHub)

```typescript
// src/splitter/ast-splitter.ts

const SYMBOL_EXTRACTORS: Record<string, {
  nameNode: string;
  paramNode: string;
  docNode: string;
}> = {
  typescript: {
    nameNode: 'identifier',
    paramNode: 'formal_parameters',
    docNode: 'comment'
  },
  python: {
    nameNode: 'identifier',
    paramNode: 'parameters',
    docNode: 'expression_statement'
  },
  // ... other languages
};

extractSymbolMetadata(node: Parser.SyntaxNode, language: string): SymbolMetadata {
  const kind = this.mapNodeTypeToKind(node.type);
  const name = this.extractSymbolName(node, language);
  
  return {
    kind,        // 'function' | 'class' | 'method' | etc.
    name,        // e.g., 'useState' | 'MyComponent'
    signature,   // Optional: full signature
    docstring    // Optional: extracted documentation
  };
}
```

---

## Adaptation for Web Content

### Challenge

Web documentation contains:
- **Inline code**: `` `useState()` ``
- **Code blocks**: ` ```typescript ... ``` `
- **Partial snippets**: Not always complete valid code
- **Multiple languages**: Mixed in single page

### Solution: Hybrid Approach

```typescript
// src/context.ts

private extractSymbolsFromWebChunk(chunk: CodeChunk): SymbolMetadata | undefined {
  // Only extract from code chunks
  if (!chunk.metadata?.isCode) {
    return undefined;
  }
  
  const language = chunk.metadata?.codeLanguage || chunk.language;
  
  // Try AST-based extraction first
  try {
    const symbols = this.codeSplitter.extractSymbols(chunk.content, language);
    if (symbols && symbols.length > 0) {
      return symbols[0];  // Use first/main symbol
    }
  } catch (error) {
    console.warn(`[Context] AST extraction failed for ${language}, using regex`);
  }
  
  // Fallback to regex-based extraction
  return this.extractSymbolsWithRegex(chunk.content, language);
}
```

---

## Regex-Based Fallback

### Pattern Detection

```typescript
private extractSymbolsWithRegex(
  code: string,
  language: string
): SymbolMetadata | undefined {
  
  const patterns = {
    typescript: {
      function: /(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
      class: /(?:export\s+)?class\s+(\w+)/,
      const: /(?:export\s+)?const\s+(\w+)\s*=/,
      interface: /(?:export\s+)?interface\s+(\w+)/,
      type: /(?:export\s+)?type\s+(\w+)/
    },
    javascript: {
      function: /(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
      class: /(?:export\s+)?class\s+(\w+)/,
      const: /(?:export\s+)?const\s+(\w+)\s*=/,
      arrow: /const\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/
    },
    python: {
      function: /def\s+(\w+)\s*\(/,
      class: /class\s+(\w+)/,
      async: /async\s+def\s+(\w+)\s*\(/
    },
    java: {
      method: /(?:public|private|protected)?\s*(?:static)?\s*\w+\s+(\w+)\s*\(/,
      class: /(?:public|private)?\s*class\s+(\w+)/
    }
  };
  
  const langPatterns = patterns[language] || patterns.javascript;
  
  for (const [kind, pattern] of Object.entries(langPatterns)) {
    const match = code.match(pattern);
    if (match) {
      return {
        kind: kind as SymbolMetadata['kind'],
        name: match[1],
        confidence: 'regex'  // Mark as regex-extracted
      };
    }
  }
  
  return undefined;
}
```

---

## Enhanced Metadata Schema

```typescript
export interface SymbolMetadata {
  kind: 'function' | 'class' | 'method' | 'interface' | 'type' | 'variable' | 'const' | 'enum' | 'struct' | 'trait' | 'module';
  name: string;
  signature?: string;
  docstring?: string;
  confidence?: 'ast' | 'regex';  // NEW: extraction method
  sourceType?: 'repository' | 'web';  // NEW: content origin
  sourceUrl?: string;  // NEW: for web content
}

// Update CodeChunk interface
export interface CodeChunk {
  content: string;
  relativePath: string;
  startLine: number;
  endLine: number;
  language: string;
  symbolName?: string;
  symbolKind?: string;
  symbolMetadata?: SymbolMetadata;  // NEW: full metadata
  metadata?: Record<string, any>;
}
```

---

## Storage Schema Updates

```sql
-- Add symbol metadata columns
ALTER TABLE claude_context.vectors_web_content
ADD COLUMN symbol_name TEXT,
ADD COLUMN symbol_kind TEXT,
ADD COLUMN symbol_signature TEXT,
ADD COLUMN symbol_confidence TEXT,
ADD COLUMN source_type TEXT DEFAULT 'web';

-- Index for symbol search
CREATE INDEX idx_web_symbols ON claude_context.vectors_web_content (symbol_name) 
WHERE symbol_name IS NOT NULL;

CREATE INDEX idx_web_symbol_kind ON claude_context.vectors_web_content (symbol_kind)
WHERE symbol_kind IS NOT NULL;
```

---

## Query Enhancement

### Symbol-Aware Search

```typescript
// src/api/query.ts

export interface WebQueryRequest {
  project: string;
  query: string;
  dataset?: string;
  topK?: number;
  
  // NEW: Symbol filters
  symbolName?: string;        // Exact match
  symbolKind?: string;        // Filter by kind
  symbolFuzzy?: string;       // Fuzzy symbol search
}

async function buildSymbolFilter(request: WebQueryRequest): Record<string, any> {
  const filter: Record<string, any> = {
    projectId: request.project,
    datasetIds: await getAccessibleDatasets(request.project)
  };
  
  if (request.symbolName) {
    filter.symbolName = request.symbolName;
  }
  
  if (request.symbolKind) {
    filter.symbolKind = request.symbolKind;
  }
  
  return filter;
}
```

### Smart Symbol Detection in Query

```typescript
// Detect if query mentions a symbol
function detectSymbolInQuery(query: string): {
  hasSymbol: boolean;
  symbolName?: string;
  symbolKind?: string;
} {
  // Detect function calls: "useState()" or "useState hook"
  const functionMatch = query.match(/(\w+)\s*\(\)|(\w+)\s+(?:function|hook|method)/i);
  if (functionMatch) {
    return {
      hasSymbol: true,
      symbolName: functionMatch[1] || functionMatch[2],
      symbolKind: 'function'
    };
  }
  
  // Detect classes: "MyComponent class" or "<MyComponent>"
  const classMatch = query.match(/(\w+)\s+(?:class|component)|<(\w+)>/i);
  if (classMatch) {
    return {
      hasSymbol: true,
      symbolName: classMatch[1] || classMatch[2],
      symbolKind: 'class'
    };
  }
  
  return { hasSymbol: false };
}
```

---

## Integration with Chunking

```typescript
// src/context.ts

private async chunkWebPage(page: WebPageInput): Promise<CodeChunk[]> {
  const chunks: CodeChunk[] = [];
  const sections = this.parseMarkdownSections(page.content);
  
  for (const section of sections) {
    if (section.type === 'code') {
      const codeChunks = await this.codeSplitter.splitCode(
        section.content,
        section.language || 'text',
        { relativePath: page.url }
      );
      
      // Extract symbols for each chunk
      for (const chunk of codeChunks) {
        const symbolMetadata = this.extractSymbolsFromWebChunk(chunk);
        
        if (symbolMetadata) {
          chunk.symbolName = symbolMetadata.name;
          chunk.symbolKind = symbolMetadata.kind;
          chunk.symbolMetadata = {
            ...symbolMetadata,
            sourceType: 'web',
            sourceUrl: page.url
          };
        }
      }
      
      chunks.push(...codeChunks);
    } else {
      // Text chunks don't have symbols
      chunks.push(...this.splitTextContent(section.content, {...}));
    }
  }
  
  return chunks;
}
```

---

## Example Use Cases

### 1. Find useState Documentation

```typescript
const results = await queryWebContent(context, {
  project: 'react-docs',
  query: 'useState hook',
  symbolName: 'useState',
  symbolKind: 'function',
  topK: 5
});

// Returns chunks containing useState() code examples
```

### 2. Search for Class Implementations

```typescript
const results = await queryWebContent(context, {
  project: 'python-docs',
  query: 'FastAPI application class',
  symbolKind: 'class',
  topK: 10
});
```

### 3. Browse by Symbol

```typescript
// Get all functions in dataset
const functions = await queryBySymbolKind(context, {
  project: 'javascript-docs',
  dataset: 'mdn',
  symbolKind: 'function'
});
```

---

## Testing

```typescript
// src/splitter/__tests__/symbol-extraction.spec.ts

describe('Web Symbol Extraction', () => {
  it('should extract function names from TypeScript', () => {
    const code = `
export function useState<S>(initialState: S): [S, Dispatch<SetStateAction<S>>] {
  // implementation
}
    `;
    
    const metadata = extractSymbolsWithRegex(code, 'typescript');
    
    expect(metadata).toEqual({
      kind: 'function',
      name: 'useState',
      confidence: 'regex'
    });
  });
  
  it('should handle incomplete code snippets', () => {
    const code = `const result = useState(0);`;
    
    const metadata = extractSymbolsWithRegex(code, 'typescript');
    
    expect(metadata).toEqual({
      kind: 'const',
      name: 'result',
      confidence: 'regex'
    });
  });
});
```

---

## Analytics

```typescript
// Track symbol extraction stats
interface SymbolExtractionStats {
  totalCodeChunks: number;
  symbolsExtracted: number;
  astExtractions: number;
  regexExtractions: number;
  failed: number;
  byLanguage: Record<string, {
    total: number;
    extracted: number;
  }>;
}

private trackSymbolExtraction(
  chunk: CodeChunk,
  metadata: SymbolMetadata | undefined
): void {
  const lang = chunk.language;
  
  if (!this.symbolStats.byLanguage[lang]) {
    this.symbolStats.byLanguage[lang] = { total: 0, extracted: 0 };
  }
  
  this.symbolStats.byLanguage[lang].total++;
  this.symbolStats.totalCodeChunks++;
  
  if (metadata) {
    this.symbolStats.byLanguage[lang].extracted++;
    this.symbolStats.symbolsExtracted++;
    
    if (metadata.confidence === 'ast') {
      this.symbolStats.astExtractions++;
    } else {
      this.symbolStats.regexExtractions++;
    }
  } else {
    this.symbolStats.failed++;
  }
}
```

---

## Next Steps

Proceed to [06-smart-query.md](./06-smart-query.md).

---

**Completion Criteria:**
- ✅ Symbol extraction works for code blocks
- ✅ Regex fallback handles partial snippets
- ✅ Metadata stored in database
- ✅ Symbol-aware queries functional
- ✅ Tests pass
