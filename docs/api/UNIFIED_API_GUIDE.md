# Unified API Guide: Claude-Context + Cognee

> **Your API server now has BOTH systems integrated!** 🎉  
> **URL:** `http://localhost:3030`

---

## 🎯 Quick Start

### One API, Two Powerful Systems

```bash
# Claude-Context endpoints (existing)
http://localhost:3030/projects/*
http://localhost:3030/api/*

# Cognee endpoints (NEW!)
http://localhost:3030/cognee/*
```

**All Cognee endpoints are now proxied through your main API server!**

---

## 🔍 When to Use Which Endpoint

### Use `/projects/*` (Claude-Context) for:
- ✅ Fast code search
- ✅ Finding functions/classes
- ✅ Symbol lookup
- ✅ File navigation
- ✅ Hybrid search with reranking

### Use `/cognee/*` for:
- ✅ Understanding relationships
- ✅ Graph-based queries
- ✅ LLM-powered explanations
- ✅ Architecture questions
- ✅ Chain-of-thought reasoning

---

## 📚 Complete Cognee Endpoints

### 🏥 Health & Status

#### Check Cognee Health
```bash
GET http://localhost:3030/cognee/health

# Response
{
  "status": "healthy",
  "cognee": { ... },
  "apiUrl": "http://localhost:8340"
}
```

#### Detailed Health Check
```bash
GET http://localhost:3030/cognee/health/detailed
```

---

### 📦 Dataset Management

#### List All Datasets
```bash
GET http://localhost:3030/cognee/datasets

# Response: Array of datasets
[
  {
    "id": "37df7223-7647-57df-9ea1-1526ca3e3e8a",
    "name": "crypto-depth-performance",
    "created_at": "2025-11-06T...",
    ...
  }
]
```

#### Create Dataset
```bash
POST http://localhost:3030/cognee/datasets
Content-Type: application/json

{
  "name": "my-project",
  "description": "My awesome project"
}
```

#### Get Dataset Details
```bash
GET http://localhost:3030/cognee/datasets/{id}
```

#### Delete Dataset
```bash
DELETE http://localhost:3030/cognee/datasets/{id}
```

#### Get Dataset Knowledge Graph
```bash
GET http://localhost:3030/cognee/datasets/{id}/graph
```

---

### 📤 Add Data (Ingestion)

#### Add Files/URLs to Dataset
```bash
POST http://localhost:3030/cognee/add
Content-Type: application/json

{
  "data": ["https://example.com", "text content", ...],
  "datasetName": "my-project",
  "nodeSet": ["optional-group-name"]
}

# For file uploads, use multipart/form-data
```

---

### 🧠 Cognify (Build Knowledge Graph)

#### Process Dataset into Knowledge Graph
```bash
POST http://localhost:3030/cognee/cognify
Content-Type: application/json

{
  "datasetIds": ["37df7223-7647-57df-9ea1-1526ca3e3e8a"],
  "runInBackground": false,
  "customPrompt": ""
}

# This extracts entities, relationships, and builds the graph
```

---

### 🔍 Search (15 Types!)

#### Basic Search
```bash
POST http://localhost:3030/cognee/search
Content-Type: application/json

{
  "searchType": "CHUNKS",
  "query": "memory pool implementation",
  "datasetIds": ["37df7223-7647-57df-9ea1-1526ca3e3e8a"],
  "topK": 5
}
```

#### All Search Types:

1. **CHUNKS** - Raw text chunks
2. **SUMMARIES** - Document summaries
3. **RAG_COMPLETION** - LLM answers with context
4. **GRAPH_COMPLETION** - Graph-aware answers
5. **GRAPH_SUMMARY_COMPLETION** - Graph summaries
6. **GRAPH_COMPLETION_COT** - Chain-of-thought reasoning
7. **GRAPH_COMPLETION_CONTEXT_EXTENSION** - Extended context
8. **CODE** - Code-specific search
9. **CYPHER** - Direct Neo4j queries
10. **NATURAL_LANGUAGE** - Conversational
11. **FEELING_LUCKY** - Best single result
12. **CHUNKS_LEXICAL** - Keyword search
13. **TEMPORAL** - Time-based
14. **CODING_RULES** - Code standards
15. **FEEDBACK** - User feedback

#### Example: Get Explanation with Graph Context
```bash
POST http://localhost:3030/cognee/search
Content-Type: application/json

{
  "searchType": "GRAPH_COMPLETION",
  "query": "How does the MemoryPool relate to other components?",
  "datasetIds": ["37df7223-7647-57df-9ea1-1526ca3e3e8a"],
  "systemPrompt": "Explain relationships clearly.",
  "topK": 10
}
```

#### Example: Chain-of-Thought Reasoning
```bash
POST http://localhost:3030/cognee/search
Content-Type: application/json

{
  "searchType": "GRAPH_COMPLETION_COT",
  "query": "Walk me through how batch processing works step-by-step",
  "datasetIds": ["37df7223-7647-57df-9ea1-1526ca3e3e8a"],
  "systemPrompt": "Think step-by-step and explain your reasoning.",
  "topK": 8
}
```

#### Get Search History
```bash
GET http://localhost:3030/cognee/search
```

---

### 🗑️ Delete Data

```bash
POST http://localhost:3030/cognee/delete
Content-Type: application/json

{
  "datasetIds": ["dataset-id"],
  "datasets": ["dataset-name"]
}
```

---

### ♻️ Update Data

```bash
POST http://localhost:3030/cognee/update
Content-Type: application/json

{
  "data": [...],
  "datasetName": "my-project"
}
```

---

### ⚙️ Settings

#### Get Settings
```bash
GET http://localhost:3030/cognee/settings
```

#### Update Settings
```bash
PUT http://localhost:3030/cognee/settings
Content-Type: application/json

{
  "setting_key": "value"
}
```

---

### 🔄 Sync External Sources

```bash
POST http://localhost:3030/cognee/sync
Content-Type: application/json

{
  "datasetName": "my-project"
}
```

---

## 🚀 Convenience Endpoints (NEW!)

These are smart wrappers that make common tasks easier:

### Quick Search
Simple search with smart type detection:

```bash
POST http://localhost:3030/cognee/quick-search
Content-Type: application/json

{
  "query": "What is the MemoryPool class?",
  "datasetId": "37df7223-7647-57df-9ea1-1526ca3e3e8a",
  "type": "code"  // "code" | "architecture" | "explanation" | "question"
}

# Smart routing:
# - "code" → CODE search
# - "architecture" → GRAPH_COMPLETION
# - "explanation" → RAG_COMPLETION
# - "question" → NATURAL_LANGUAGE
```

### Explain Code
Get detailed explanations with chain-of-thought:

```bash
POST http://localhost:3030/cognee/explain-code
Content-Type: application/json

{
  "query": "Explain how the batch processing system works",
  "datasetId": "37df7223-7647-57df-9ea1-1526ca3e3e8a"
}

# Uses GRAPH_COMPLETION_COT with step-by-step reasoning
```

### Find Relationships
Discover component relationships:

```bash
POST http://localhost:3030/cognee/find-relationships
Content-Type: application/json

{
  "component": "MemoryPool",
  "datasetId": "37df7223-7647-57df-9ea1-1526ca3e3e8a"
}

# Returns all dependencies and relationships
```

---

## 🎯 Real-World Examples

### Example 1: Find Code (Claude-Context) + Understand (Cognee)

```bash
# Step 1: Find the code quickly
POST http://localhost:3030/projects/my-project/query
{
  "query": "MemoryPool allocate",
  "limit": 5
}

# Step 2: Understand what it does
POST http://localhost:3030/cognee/explain-code
{
  "query": "Explain the MemoryPool allocate method",
  "datasetId": "dataset-id"
}
```

---

### Example 2: Architecture Review

```bash
# Ask about architecture
POST http://localhost:3030/cognee/search
{
  "searchType": "GRAPH_COMPLETION",
  "query": "What are the main components of the performance optimization system?",
  "datasetIds": ["dataset-id"],
  "topK": 15
}
```

---

### Example 3: Debug Workflow

```bash
# 1. Find where error occurs (Claude-Context)
POST http://localhost:3030/projects/my-project/query
{
  "query": "error handling allocation",
  "limit": 10
}

# 2. Understand impact (Cognee)
POST http://localhost:3030/cognee/find-relationships
{
  "component": "allocate error handler",
  "datasetId": "dataset-id"
}

# 3. Get step-by-step fix guidance (Cognee)
POST http://localhost:3030/cognee/search
{
  "searchType": "GRAPH_COMPLETION_COT",
  "query": "How should I fix allocation errors? Walk through the steps.",
  "datasetIds": ["dataset-id"],
  "systemPrompt": "Provide step-by-step debugging guidance."
}
```

---

## 📊 Comparison Table

| Feature | Claude-Context (`/projects/*`) | Cognee (`/cognee/*`) |
|---------|-------------------------------|---------------------|
| **Speed** | ⚡⚡⚡ Very Fast | ⚡⚡ Fast |
| **Best For** | Finding code | Understanding code |
| **Search Type** | Semantic + Hybrid | Graph + LLM-powered |
| **Returns** | Code chunks | Explanations + relationships |
| **Use Case** | "Where is X?" | "How does X work?" |
| **Complexity** | Simple queries | Complex reasoning |

---

## 🎓 Cheat Sheet

### Quick Decision Flow:

```
Need to FIND something? 
  → /projects/* (Claude-Context)

Need to UNDERSTAND something? 
  → /cognee/* 

Need BOTH? 
  → Use both! They complement each other!
```

### Example Queries:

| What You Want | Endpoint | Query Example |
|---------------|----------|---------------|
| Find a function | `/projects/{id}/query` | "allocate function" |
| Understand architecture | `/cognee/search` (GRAPH_COMPLETION) | "Explain the cache architecture" |
| Quick code explanation | `/cognee/explain-code` | "What does MemoryPool do?" |
| Find relationships | `/cognee/find-relationships` | component: "MemoryPool" |
| Step-by-step reasoning | `/cognee/search` (COT) | "How to implement caching?" |

---

## 🛠️ Environment Variables

Add to your `.env`:

```bash
# Cognee Configuration (already set in config.ts defaults)
COGNEE_API_URL=http://localhost:8340
COGNEE_API_KEY=local-development-only
```

---

## 🚀 Getting Started

1. **Start your API server** (already running on port 3030)
2. **Index your code in both systems:**
   ```bash
   # Claude-Context (existing method)
   # Use your normal indexing

   # Cognee (run once)
   cd services/cognee
   python3 /tmp/upload_to_cognee.py
   python3 /tmp/cognify_dataset.py
   ```

3. **Use the unified API!**
   ```bash
   # Fast search
   curl http://localhost:3030/projects/my-project/query

   # Smart understanding
   curl http://localhost:3030/cognee/quick-search
   ```

---

## 📝 Tips & Best Practices

1. **Start with Claude-Context** for speed
2. **Switch to Cognee** when you need deeper understanding
3. **Use convenience endpoints** (`/quick-search`, `/explain-code`) for common tasks
4. **Index in both systems** for maximum benefit
5. **Chain queries** - Find with Claude-Context, understand with Cognee

---

## 🎉 You're Ready!

Your API server now provides **ONE unified interface** to access:
- ✅ Fast Claude-Context code search
- ✅ Smart Cognee graph reasoning
- ✅ 15 different search types
- ✅ Convenient shortcuts

**All from `http://localhost:3030`!**

---

## 📚 Additional Resources

- **Cognee Search Examples**: `/services/cognee/COGNEE_SEARCH_EXAMPLES.md`
- **Which System to Use**: `/docs/guides/WHICH_SYSTEM_TO_USE.md`
- **Database Integration**: `/docs/database/DATABASE_INTEGRATION_ANALYSIS.md`
- **API Endpoints**: `/docs/api/API-ENDPOINTS.md`

---

**Happy Coding! 🚀**
