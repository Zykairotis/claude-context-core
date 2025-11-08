# Database State Analysis & Mapping

## 🎯 Objective
Document the current state of Claude-Context and Cognee databases, identify overlaps, and create concrete mapping strategies for Phase 2 (Schema Unification).

## 📊 Current Claude-Context Database State

### PostgreSQL Schema: `claude_context`

Based on inspection from `scripts/db-inspect.sh --full`:

```
Database: claude_context (PostgreSQL 17.2)
Extensions: pgvector, pg_trgm, uuid-ossp, btree_gin
Schema: claude_context
```

#### Core Tables

**1. chunks** - Primary storage for code/web chunks
```sql
Columns:
- id (UUID, primary key)
- vector (vector - pgvector)
- content (TEXT)
- relative_path (TEXT)
- start_line (INTEGER)
- end_line (INTEGER)
- file_extension (TEXT)
- project_id (UUID, FK → projects)
- dataset_id (UUID, FK → datasets)
- web_page_id (UUID, FK → web_pages, nullable)
- source_type (TEXT: 'code', 'web', 'manual')
- repo (TEXT)
- branch (TEXT)
- sha (TEXT)
- lang (TEXT)
- symbol (JSONB)
- sparse_vector (JSONB)
- metadata (JSONB, default '{}')
- created_at (TIMESTAMPTZ)
- updated_at (TIMESTAMPTZ)

Indexes:
- chunks_pkey (PRIMARY KEY on id)
- idx_chunks_content_gin (GIN on content)
- idx_chunks_dataset_id
- idx_chunks_project_id
- idx_chunks_source_type
- idx_chunks_metadata_gin (GIN on metadata)
- idx_chunks_web_page_id
```

**2. projects** - Project containers
```sql
Columns:
- id (UUID, primary key)
- name (TEXT, unique, not null)
- codebase_path (TEXT, nullable)
- description (TEXT)
- owner_id (UUID, nullable)
- is_global (BOOLEAN, default false)
- metadata (JSONB, default '{}')
- created_at (TIMESTAMPTZ)
- updated_at (TIMESTAMPTZ)

Indexes:
- projects_pkey
- projects_name_key (UNIQUE)
- idx_projects_owner_id
```

**3. datasets** - Dataset organization
```sql
Columns:
- id (UUID, primary key)
- name (TEXT, not null)
- project_id (UUID, FK → projects)
- description (TEXT)
- is_global (BOOLEAN, default false)
- metadata (JSONB, default '{}')
- created_at (TIMESTAMPTZ)
- updated_at (TIMESTAMPTZ)

Indexes:
- datasets_pkey
- datasets_project_id_name_key (UNIQUE constraint)
- idx_datasets_project_id
```

**4. web_pages** - Web content storage
```sql
Columns:
- id (UUID, primary key)
- dataset_id (UUID, FK → datasets, not null)
- url (TEXT, not null)
- title (TEXT)
- content (TEXT)
- status (TEXT, default 'fetched')
- is_global (BOOLEAN, default false)
- metadata (JSONB, default '{}')
- crawled_at (TIMESTAMPTZ)
- created_at (TIMESTAMPTZ)
- updated_at (TIMESTAMPTZ)

Indexes:
- web_pages_pkey
- web_pages_dataset_id_url_key (UNIQUE)
- web_pages_dataset_idx
```

**5. collections_metadata** - Vector collection tracking
```sql
Columns:
- collection_name (TEXT, primary key)
- dimension (INTEGER, not null)
- has_dual_vectors (BOOLEAN, default false)
- entity_count (INTEGER, default 0)
- created_at (TIMESTAMPTZ)
- updated_at (TIMESTAMPTZ)

Indexes:
- collections_metadata_pkey
```

**6. vector_metadata** - Individual vector tracking
```sql
Columns:
- id (UUID, primary key)
- vector_id (TEXT, not null)
- collection_name (TEXT, not null)
- dimension (INTEGER, not null)
- indexed_at (TIMESTAMPTZ)
```

#### Supporting Tables

**7. web_provenance** - Web indexing history
**8. github_jobs** - GitHub indexing jobs
**9. mesh_nodes** - Distributed mesh tracking
**10. project_shares** - Project sharing
**11-15. pg_boss tables** - Job queue system

### Qdrant Collections

Current state:
```json
{
  "name": "hybrid_code_chunks_632d81f3",
  "points_count": 0,
  "vectors_count": 0
}
```

Configuration:
- Dense vector: 768 dimensions (GTE embeddings)
- Sparse vector: SPLADE support enabled
- Distance metric: Cosine
- Collection naming: `hybrid_code_chunks_{8-char-hash}`

---

## 🧠 Cognee Database Structure

### SQLAlchemy Models (from src/cognee)

**1. Data** (`data` table) - Core data storage
```python
Columns:
- id (UUID, primary key)
- name (STRING)
- extension (STRING)
- mime_type (STRING)
- original_extension (STRING, nullable)
- original_mime_type (STRING, nullable)
- loader_engine (STRING)
- raw_data_location (STRING)
- original_data_location (STRING)
- owner_id (UUID, indexed)
- tenant_id (UUID, indexed, nullable)
- content_hash (STRING)
- raw_content_hash (STRING)
- external_metadata (JSON)
- node_set (JSON, nullable)
- pipeline_status (MutableDict JSON)
- token_count (INTEGER)
- data_size (INTEGER, nullable)
- created_at (DATETIME with timezone)
- updated_at (DATETIME with timezone)

Relationships:
- datasets (many-to-many through DatasetData)
```

**2. Dataset** (`dataset` table) - Dataset organization
```python
Columns:
- id (UUID, primary key)
- name (STRING, not null)
- owner_id (UUID, nullable)
- permissions (JSON, default '{}')
- created_at (DATETIME with timezone)
- updated_at (DATETIME with timezone)

Relationships:
- data (many-to-many through DatasetData)
```

**3. DatasetData** - Junction table
```python
Columns:
- dataset_id (UUID, FK → dataset)
- data_id (UUID, FK → data)
```

**4. DocumentChunk** (conceptual model)
```python
From cognee/modules/chunking/models/DocumentChunk.py:
- chunk_id (str)
- text (str)
- word_count (int)
- document_id (UUID)
- chunk_index (int)
- cut_type (str: 'token_limit', 'paragraph', 'sentence')
```

**5. User** (`users` table) - User management
```python
Columns:
- id (UUID, primary key)
- email (STRING, unique)
- ...
```

### Cognee Vector Storage

Uses same backends but with different collection structure:
- **PostgreSQL**: For relational metadata
- **Qdrant**: For vector embeddings
- **Neo4j**: For knowledge graph (nodes/edges/relationships)

### Cognee Graph Models

From `cognee/shared/data_models.py`:
```python
class Node(BaseModel):
    id: str
    name: str
    type: str
    description: str

class Edge(BaseModel):
    source_node_id: str
    target_node_id: str
    relationship_name: str

class KnowledgeGraph(BaseModel):
    nodes: List[Node]
    edges: List[Edge]
```

---

## 🔄 Schema Mapping Strategy

### Phase 1: Identify Overlaps

| Claude-Context | Cognee | Mapping Strategy |
|----------------|--------|------------------|
| `chunks` table | `data` table + chunks in graph | **Unified**: `unified.chunks` |
| `projects` table | (implicit in permissions) | **Keep CC structure**, add Cognee fields |
| `datasets` table | `dataset` table | **Merge**: Similar purpose, combine schemas |
| `web_pages` table | `data` with mime_type | **Unified**: Add to `unified.chunks` with source_type |
| Vector in pgvector | Vector in Qdrant | **Dual**: Both for performance |
| `metadata` JSONB | `external_metadata` JSON | **Unified**: `metadata` with namespaces |

### Phase 2: Unified Schema Design

```sql
-- Unified chunks table (Phase 2 implementation)
CREATE TABLE unified.chunks (
    -- Core identity
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legacy_id TEXT,  -- Original ID from source system
    
    -- Content
    content TEXT NOT NULL,
    content_hash TEXT,
    chunk_index INTEGER,
    token_count INTEGER,
    word_count INTEGER,
    
    -- Vectors (dual support)
    dense_vector vector(768),  -- GTE/primary embedding
    sparse_vector JSONB,        -- SPLADE for hybrid search
    summary_vector vector(768), -- Optional: for dual-vector search
    
    -- Source information
    chunk_type TEXT CHECK (chunk_type IN ('code', 'text', 'web', 'manual')),
    source_type TEXT,  -- 'claude', 'cognee', 'manual'
    relative_path TEXT,
    start_line INTEGER,
    end_line INTEGER,
    
    -- File metadata
    file_extension TEXT,
    mime_type TEXT,
    language TEXT,
    
    -- Organization
    project_id UUID REFERENCES unified.projects(id),
    dataset_id UUID REFERENCES unified.datasets(id),
    owner_id UUID,
    tenant_id UUID,
    
    -- Code-specific (Claude-Context)
    symbol JSONB,
    repo TEXT,
    branch TEXT,
    sha TEXT,
    
    -- Cognee-specific
    loader_engine TEXT,
    pipeline_status JSONB,
    node_set JSONB,
    
    -- Universal metadata
    metadata JSONB DEFAULT '{}',  -- Namespaced: {claude: {...}, cognee: {...}}
    
    -- Provenance
    system_origin TEXT CHECK (system_origin IN ('claude', 'cognee', 'unified')),
    ingestion_method TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    indexed_at TIMESTAMPTZ,
    
    -- Search optimization
    search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED
);

-- Indexes for performance
CREATE INDEX idx_unified_chunks_vector ON unified.chunks 
  USING ivfflat (dense_vector vector_cosine_ops) WITH (lists = 100);

CREATE INDEX idx_unified_chunks_project_dataset ON unified.chunks 
  (project_id, dataset_id);

CREATE INDEX idx_unified_chunks_source_type ON unified.chunks 
  (source_type, system_origin);

CREATE INDEX idx_unified_chunks_metadata_gin ON unified.chunks 
  USING GIN (metadata);

CREATE INDEX idx_unified_chunks_search ON unified.chunks 
  USING GIN (search_vector);
```

### Phase 3: Compatibility Views

```sql
-- Claude-Context compatibility view
CREATE VIEW claude_context.chunks AS
SELECT 
    id,
    dense_vector as vector,
    content,
    relative_path,
    start_line,
    end_line,
    file_extension,
    project_id,
    dataset_id,
    chunk_type as source_type,
    repo,
    branch,
    sha,
    language as lang,
    symbol,
    sparse_vector,
    metadata,
    created_at,
    updated_at
FROM unified.chunks
WHERE system_origin IN ('claude', 'unified');

-- Cognee compatibility view
CREATE VIEW cognee.data AS
SELECT 
    id,
    relative_path as name,
    file_extension as extension,
    mime_type,
    NULL as original_extension,
    NULL as original_mime_type,
    loader_engine,
    NULL as raw_data_location,
    relative_path as original_data_location,
    owner_id,
    tenant_id,
    content_hash,
    content_hash as raw_content_hash,
    metadata as external_metadata,
    node_set,
    pipeline_status,
    token_count,
    NULL as data_size,
    created_at,
    updated_at
FROM unified.chunks
WHERE system_origin IN ('cognee', 'unified');
```

---

## 🔧 Migration Script Example

```python
#!/usr/bin/env python3
"""Migrate existing Claude-Context data to unified schema."""

import asyncpg
import asyncio
from tqdm import tqdm

async def migrate_claude_chunks():
    """Migrate Claude-Context chunks to unified schema."""
    
    # Connect to databases
    conn = await asyncpg.connect(
        host='localhost',
        port=5533,
        user='postgres',
        password='code-context-secure-password',
        database='claude_context'
    )
    
    try:
        # Get total count
        count = await conn.fetchval(
            "SELECT COUNT(*) FROM claude_context.chunks"
        )
        
        print(f"📦 Migrating {count} chunks from Claude-Context...")
        
        # Migrate in batches
        batch_size = 1000
        offset = 0
        
        with tqdm(total=count, desc="Chunks") as pbar:
            while offset < count:
                # Fetch batch
                chunks = await conn.fetch(f"""
                    SELECT * FROM claude_context.chunks
                    ORDER BY created_at
                    LIMIT {batch_size} OFFSET {offset}
                """)
                
                # Transform and insert
                for chunk in chunks:
                    await conn.execute("""
                        INSERT INTO unified.chunks (
                            id, legacy_id, content, dense_vector, sparse_vector,
                            chunk_type, source_type, relative_path, start_line, end_line,
                            file_extension, language, project_id, dataset_id,
                            symbol, repo, branch, sha, metadata,
                            system_origin, created_at, updated_at
                        ) VALUES (
                            $1, $2, $3, $4, $5, $6, 'claude', $7, $8, $9,
                            $10, $11, $12, $13, $14, $15, $16, $17, $18,
                            'claude', $19, $20
                        )
                        ON CONFLICT (id) DO NOTHING
                    """,
                        chunk['id'],
                        str(chunk['id']),  # legacy_id
                        chunk['content'],
                        chunk['vector'],
                        chunk['sparse_vector'],
                        chunk['source_type'],  # chunk_type
                        chunk['relative_path'],
                        chunk['start_line'],
                        chunk['end_line'],
                        chunk['file_extension'],
                        chunk['lang'],
                        chunk['project_id'],
                        chunk['dataset_id'],
                        chunk['symbol'],
                        chunk['repo'],
                        chunk['branch'],
                        chunk['sha'],
                        chunk['metadata'],
                        chunk['created_at'],
                        chunk['updated_at']
                    )
                
                offset += batch_size
                pbar.update(len(chunks))
        
        print("✅ Migration complete!")
        
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(migrate_claude_chunks())
```

---

## 📈 Next Steps

1. **Create unified schema** in Phase 2
2. **Migrate Claude-Context data** using migration scripts
3. **Set up Cognee** to use unified schema
4. **Test compatibility views** ensure both systems work
5. **Update ingestion pipelines** to write to unified schema
6. **Implement sync service** (Phase 7) for real-time updates

---

**Document Version**: 1.0.0  
**Last Updated**: December 2024  
**Related Phases**: 2 (Schema Unification), 7 (Sync Service), 12 (Migration Tools)
