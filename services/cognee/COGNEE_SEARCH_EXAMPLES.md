# Cognee Search API - Complete curl Examples

> Dataset: `crypto-depth-performance` (TypeScript performance optimization files)  
> Dataset ID: `37df7223-7647-57df-9ea1-1526ca3e3e8a`  
> API Endpoint: `http://localhost:8340`  
> Auth Token: `local-development-only`

---

## 📚 Table of Contents

1. [CHUNKS](#1-chunks---raw-text-chunks)
2. [SUMMARIES](#2-summaries---document-summaries)
3. [RAG_COMPLETION](#3-rag_completion---retrieval-augmented-generation)
4. [GRAPH_COMPLETION](#4-graph_completion---knowledge-graph-search)
5. [GRAPH_SUMMARY_COMPLETION](#5-graph_summary_completion---graph-based-summaries)
6. [GRAPH_COMPLETION_COT](#6-graph_completion_cot---chain-of-thought-reasoning)
7. [GRAPH_COMPLETION_CONTEXT_EXTENSION](#7-graph_completion_context_extension---extended-context)
8. [CODE](#8-code---code-specific-search)
9. [CYPHER](#9-cypher---graph-query-language)
10. [NATURAL_LANGUAGE](#10-natural_language---conversational-search)
11. [FEELING_LUCKY](#11-feeling_lucky---best-single-result)
12. [CHUNKS_LEXICAL](#12-chunks_lexical---keyword-based-search)
13. [TEMPORAL](#13-temporal---time-based-search)
14. [CODING_RULES](#14-coding_rules---code-standards-search)
15. [FEEDBACK](#15-feedback---provide-search-feedback)

---

## 1. CHUNKS - Raw Text Chunks

Returns raw text chunks from the documents, best for simple retrieval.

```bash
curl -X POST "http://localhost:8340/api/v1/search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer local-development-only" \
  -d '{
    "searchType": "CHUNKS",
    "query": "How does batch processing work?",
    "datasetIds": ["37df7223-7647-57df-9ea1-1526ca3e3e8a"],
    "topK": 5
  }' | jq .
```

**Use Case:** Quick text retrieval, documentation search, finding specific code snippets

---

## 2. SUMMARIES - Document Summaries

Returns summarized versions of relevant documents.

```bash
curl -X POST "http://localhost:8340/api/v1/search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer local-development-only" \
  -d '{
    "searchType": "SUMMARIES",
    "query": "What are the main optimization techniques?",
    "datasetIds": ["37df7223-7647-57df-9ea1-1526ca3e3e8a"],
    "topK": 3
  }' | jq .
```

**Use Case:** Overview of topics, high-level understanding, document digests

---

## 3. RAG_COMPLETION - Retrieval-Augmented Generation

Uses retrieved context to generate LLM completions.

```bash
curl -X POST "http://localhost:8340/api/v1/search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer local-development-only" \
  -d '{
    "searchType": "RAG_COMPLETION",
    "query": "Explain the memory pool implementation and its benefits",
    "datasetIds": ["37df7223-7647-57df-9ea1-1526ca3e3e8a"],
    "systemPrompt": "You are a senior software engineer explaining code to a junior developer.",
    "topK": 5
  }' | jq .
```

**Use Case:** Natural language answers, code explanations, contextual Q&A

---

## 4. GRAPH_COMPLETION - Knowledge Graph Search

Leverages the knowledge graph for entity and relationship-aware search.

```bash
curl -X POST "http://localhost:8340/api/v1/search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer local-development-only" \
  -d '{
    "searchType": "GRAPH_COMPLETION",
    "query": "What classes are related to performance monitoring?",
    "datasetIds": ["37df7223-7647-57df-9ea1-1526ca3e3e8a"],
    "systemPrompt": "Explain the relationships between code components.",
    "topK": 10
  }' | jq .
```

**Use Case:** Finding relationships, code architecture queries, entity connections

---

## 5. GRAPH_SUMMARY_COMPLETION - Graph-Based Summaries

Combines graph traversal with summarization.

```bash
curl -X POST "http://localhost:8340/api/v1/search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer local-development-only" \
  -d '{
    "searchType": "GRAPH_SUMMARY_COMPLETION",
    "query": "Summarize the cache optimization architecture",
    "datasetIds": ["37df7223-7647-57df-9ea1-1526ca3e3e8a"],
    "systemPrompt": "Provide a concise architectural summary.",
    "topK": 5
  }' | jq .
```

**Use Case:** Architecture overviews, component summaries, system design explanations

---

## 6. GRAPH_COMPLETION_COT - Chain-of-Thought Reasoning

Uses chain-of-thought prompting with graph context for complex reasoning.

```bash
curl -X POST "http://localhost:8340/api/v1/search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer local-development-only" \
  -d '{
    "searchType": "GRAPH_COMPLETION_COT",
    "query": "How would I implement a new caching strategy? Walk through the steps.",
    "datasetIds": ["37df7223-7647-57df-9ea1-1526ca3e3e8a"],
    "systemPrompt": "Think step-by-step and explain your reasoning.",
    "topK": 8
  }' | jq .
```

**Use Case:** Complex problem-solving, multi-step reasoning, detailed explanations

---

## 7. GRAPH_COMPLETION_CONTEXT_EXTENSION - Extended Context

Expands search context by traversing the graph more extensively.

```bash
curl -X POST "http://localhost:8340/api/v1/search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer local-development-only" \
  -d '{
    "searchType": "GRAPH_COMPLETION_CONTEXT_EXTENSION",
    "query": "What are all the components involved in garbage collection?",
    "datasetIds": ["37df7223-7647-57df-9ea1-1526ca3e3e8a"],
    "systemPrompt": "Provide comprehensive context about related components.",
    "topK": 15
  }' | jq .
```

**Use Case:** Deep dives, comprehensive analysis, finding indirect relationships

---

## 8. CODE - Code-Specific Search

Optimized for searching code with syntax awareness.

```bash
curl -X POST "http://localhost:8340/api/v1/search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer local-development-only" \
  -d '{
    "searchType": "CODE",
    "query": "function that handles memory allocation",
    "datasetIds": ["37df7223-7647-57df-9ea1-1526ca3e3e8a"],
    "topK": 10
  }' | jq .
```

**Use Case:** Finding specific functions, classes, methods, code patterns

---

## 9. CYPHER - Graph Query Language

Execute Cypher queries against the Neo4j knowledge graph.

```bash
curl -X POST "http://localhost:8340/api/v1/search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer local-development-only" \
  -d '{
    "searchType": "CYPHER",
    "query": "MATCH (n:Entity)-[r]->(m:Entity) WHERE n.name CONTAINS \"Performance\" RETURN n.name, type(r), m.name LIMIT 10",
    "datasetIds": ["37df7223-7647-57df-9ea1-1526ca3e3e8a"]
  }' | jq .
```

**Use Case:** Advanced graph queries, custom pattern matching, data exploration

---

## 10. NATURAL_LANGUAGE - Conversational Search

Natural language interface for conversational queries.

```bash
curl -X POST "http://localhost:8340/api/v1/search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer local-development-only" \
  -d '{
    "searchType": "NATURAL_LANGUAGE",
    "query": "Can you tell me about the lock-free data structures and why they are useful?",
    "datasetIds": ["37df7223-7647-57df-9ea1-1526ca3e3e8a"],
    "systemPrompt": "You are a helpful coding assistant.",
    "topK": 5
  }' | jq .
```

**Use Case:** Conversational AI, chatbot interfaces, user-friendly queries

---

## 11. FEELING_LUCKY - Best Single Result

Returns the single most relevant result (like Google's "I'm Feeling Lucky").

```bash
curl -X POST "http://localhost:8340/api/v1/search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer local-development-only" \
  -d '{
    "searchType": "FEELING_LUCKY",
    "query": "SIMD operations implementation",
    "datasetIds": ["37df7223-7647-57df-9ea1-1526ca3e3e8a"],
    "topK": 1
  }' | jq .
```

**Use Case:** Quick lookups, when you want the best answer only

---

## 12. CHUNKS_LEXICAL - Keyword-Based Search

Traditional keyword/lexical search (non-semantic).

```bash
curl -X POST "http://localhost:8340/api/v1/search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer local-development-only" \
  -d '{
    "searchType": "CHUNKS_LEXICAL",
    "query": "RedBlackTree insert delete",
    "datasetIds": ["37df7223-7647-57df-9ea1-1526ca3e3e8a"],
    "topK": 5
  }' | jq .
```

**Use Case:** Exact keyword matching, technical term search, when semantics aren't needed

---

## 13. TEMPORAL - Time-Based Search

Search with temporal/time-aware context (for time-series data).

```bash
curl -X POST "http://localhost:8340/api/v1/search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer local-development-only" \
  -d '{
    "searchType": "TEMPORAL",
    "query": "performance metrics over time",
    "datasetIds": ["37df7223-7647-57df-9ea1-1526ca3e3e8a"],
    "topK": 5
  }' | jq .
```

**Use Case:** Time-series analysis, historical data queries, temporal patterns

---

## 14. CODING_RULES - Code Standards Search

Search for coding rules, best practices, and standards.

```bash
curl -X POST "http://localhost:8340/api/v1/search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer local-development-only" \
  -d '{
    "searchType": "CODING_RULES",
    "query": "What are the best practices for memory management?",
    "datasetIds": ["37df7223-7647-57df-9ea1-1526ca3e3e8a"],
    "systemPrompt": "List coding standards and best practices.",
    "topK": 5
  }' | jq .
```

**Use Case:** Code reviews, style guides, best practices queries

---

## 15. FEEDBACK - Provide Search Feedback

Submit feedback on search results (for improvement).

```bash
curl -X POST "http://localhost:8340/api/v1/search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer local-development-only" \
  -d '{
    "searchType": "FEEDBACK",
    "query": "Previous search was helpful/not helpful",
    "datasetIds": ["37df7223-7647-57df-9ea1-1526ca3e3e8a"],
    "topK": 1
  }' | jq .
```

**Use Case:** Training the system, improving search quality, user feedback loops

---

## 🎯 Advanced Search Options

### Filter by Node Name (Targeted Search)

```bash
curl -X POST "http://localhost:8340/api/v1/search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer local-development-only" \
  -d '{
    "searchType": "GRAPH_COMPLETION",
    "query": "optimization techniques",
    "datasetIds": ["37df7223-7647-57df-9ea1-1526ca3e3e8a"],
    "nodeName": ["BatchProcessing", "MemoryPool"],
    "topK": 5
  }' | jq .
```

### Get Context Only (No LLM Call)

Useful for debugging or seeing what context Cognee would send to the LLM:

```bash
curl -X POST "http://localhost:8340/api/v1/search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer local-development-only" \
  -d '{
    "searchType": "GRAPH_COMPLETION",
    "query": "memory optimization",
    "datasetIds": ["37df7223-7647-57df-9ea1-1526ca3e3e8a"],
    "onlyContext": true,
    "topK": 5
  }' | jq .
```

### Combined Context (Unified Response)

```bash
curl -X POST "http://localhost:8340/api/v1/search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer local-development-only" \
  -d '{
    "searchType": "RAG_COMPLETION",
    "query": "performance bottlenecks",
    "datasetIds": ["37df7223-7647-57df-9ea1-1526ca3e3e8a"],
    "useCombinedContext": true,
    "topK": 10
  }' | jq .
```

---

## 📊 Search by Dataset Name

Instead of using `datasetIds`, you can use dataset names:

```bash
curl -X POST "http://localhost:8340/api/v1/search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer local-development-only" \
  -d '{
    "searchType": "CHUNKS",
    "query": "cache optimization",
    "datasets": ["crypto-depth-performance"],
    "topK": 5
  }' | jq .
```

---

## 🔧 Utility Commands

### Get Search History

```bash
curl -X GET "http://localhost:8340/api/v1/search" \
  -H "Authorization: Bearer local-development-only" | jq .
```

### List All Datasets

```bash
curl -X GET "http://localhost:8340/api/v1/datasets" \
  -H "Authorization: Bearer local-development-only" | jq .
```

### View Dataset Graph

```bash
curl -X GET "http://localhost:8340/api/v1/datasets/37df7223-7647-57df-9ea1-1526ca3e3e8a/graph" \
  -H "Authorization: Bearer local-development-only" | jq .
```

---

## 💡 Quick Tips

1. **CHUNKS** - Fast, simple retrieval
2. **RAG_COMPLETION** - Best for natural language answers
3. **GRAPH_COMPLETION** - Best for relationships and architecture
4. **CODE** - Optimized for code search
5. **CYPHER** - Most powerful for complex graph queries
6. **FEELING_LUCKY** - When you want one best answer

---

## 🚀 Recommended Search Flow

1. Start with **CHUNKS** or **CODE** for quick results
2. Use **GRAPH_COMPLETION** to understand relationships
3. Use **RAG_COMPLETION** or **NATURAL_LANGUAGE** for explanations
4. Use **CYPHER** for advanced custom queries
5. Use **GRAPH_COMPLETION_COT** for complex reasoning

---

## 📝 Notes

- All searches support `topK` to limit results (default: 10)
- Use `systemPrompt` to customize LLM behavior for completion-based searches
- `onlyContext: true` returns the context without calling the LLM
- `nodeName` array filters results to specific node sets (defined during add)
- Increase `topK` for more comprehensive results (max: varies by type)

---

**Generated:** 2025-11-06  
**Dataset:** crypto-depth-performance (11 TypeScript files)  
**Status:** Fully indexed with Qdrant + Neo4j + PostgreSQL
