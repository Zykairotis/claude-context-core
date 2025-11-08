# Phase 2: Database Schema Unification

## 🎯 Objective
Design and implement a unified database schema that accommodates both Claude-Context and Cognee data models while maintaining backward compatibility.

## 📊 Unified Schema Design

### Core Tables Structure

```sql
-- Unified chunks table (extends existing claude_context.chunks)
CREATE TABLE unified.chunks (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legacy_id TEXT UNIQUE, -- For backward compatibility
    
    -- Content fields
    content TEXT NOT NULL,
    summary TEXT, -- Cognee requirement
    chunk_type VARCHAR(50) DEFAULT 'text', -- text/code/mixed
    
    -- Vector fields
    dense_vector vector(768), -- Claude-Context embeddings
    sparse_vector vector(30522), -- SPLADE vectors
    embedding_model VARCHAR(100), -- gte/coderank/cognee
    
    -- Location metadata
    source_type VARCHAR(50), -- github/web/file/api
    source_url TEXT,
    relative_path TEXT,
    start_line INTEGER,
    end_line INTEGER,
    start_char INTEGER,
    end_char INTEGER,
    
    -- Project/Dataset management
    project_id UUID REFERENCES unified.projects(id),
    dataset_id UUID REFERENCES unified.datasets(id),
    cognee_dataset_id UUID, -- Cognee's dataset reference
    
    -- Language/Code metadata
    language VARCHAR(50),
    file_extension VARCHAR(20),
    is_code BOOLEAN DEFAULT FALSE,
    confidence FLOAT,
    
    -- Graph references
    graph_node_id TEXT, -- Neo4j node ID
    entity_refs JSONB DEFAULT '[]'::jsonb, -- Extracted entities
    
    -- Metadata and timestamps
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    indexed_at TIMESTAMPTZ,
    cognified_at TIMESTAMPTZ, -- When processed by Cognee
    
    -- Indexing
    INDEX idx_chunks_project_dataset (project_id, dataset_id),
    INDEX idx_chunks_source_type (source_type),
    INDEX idx_chunks_language (language),
    INDEX idx_chunks_created_at (created_at DESC),
    INDEX idx_chunks_graph_node (graph_node_id) WHERE graph_node_id IS NOT NULL
);

-- Compatibility view for Claude-Context
CREATE VIEW claude_context.chunks AS
SELECT 
    COALESCE(legacy_id, id::TEXT) as id,
    dense_vector as vector,
    content,
    relative_path,
    start_line,
    end_line,
    file_extension,
    project_id,
    dataset_id,
    source_type,
    metadata,
    created_at
FROM unified.chunks
WHERE project_id IS NOT NULL;

-- Compatibility view for Cognee
CREATE VIEW cognee.data_points AS
SELECT 
    id,
    content as text,
    summary,
    dense_vector as embedding,
    cognee_dataset_id as dataset_id,
    metadata,
    cognified_at as processed_at
FROM unified.chunks
WHERE cognee_dataset_id IS NOT NULL;
```

### Mapping Tables

```sql
-- Project/Dataset mapping between systems
CREATE TABLE unified.system_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claude_project_id UUID,
    claude_dataset_id UUID,
    cognee_dataset_id UUID,
    cognee_user_id UUID,
    sync_enabled BOOLEAN DEFAULT TRUE,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Entity mapping for graph integration
CREATE TABLE unified.entity_mapping (
    chunk_id UUID REFERENCES unified.chunks(id),
    entity_type VARCHAR(100),
    entity_name TEXT,
    entity_id TEXT, -- Neo4j node ID
    confidence FLOAT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (chunk_id, entity_id)
);
```

## 🔄 Migration Strategy

### Step 1: Create Unified Schema
```bash
#!/bin/bash
# Create unified schema
psql -h localhost -p 5533 -U postgres -d claude_context << EOF
CREATE SCHEMA IF NOT EXISTS unified;
CREATE SCHEMA IF NOT EXISTS cognee;
EOF
```

### Step 2: Migrate Existing Data
```python
import asyncpg
import uuid

async def migrate_claude_context_chunks():
    """Migrate existing Claude-Context chunks to unified schema."""
    conn = await asyncpg.connect(
        host="localhost",
        port=5533,
        user="postgres",
        password="code-context-secure-password",
        database="claude_context"
    )
    
    try:
        # Copy existing chunks with proper ID mapping
        await conn.execute("""
            INSERT INTO unified.chunks (
                legacy_id, content, dense_vector, 
                relative_path, start_line, end_line,
                file_extension, project_id, dataset_id,
                source_type, metadata, created_at
            )
            SELECT 
                id, content, vector,
                relative_path, start_line, end_line,
                file_extension, project_id, dataset_id,
                source_type, metadata, created_at
            FROM claude_context.chunks
            ON CONFLICT (legacy_id) DO NOTHING
        """)
        
        print("Migration completed successfully")
    finally:
        await conn.close()
```

## 🔌 API Compatibility Layer

### Claude-Context Adapter
```typescript
class UnifiedStorageAdapter {
    async insertChunk(chunk: LegacyChunk): Promise<void> {
        const unifiedChunk = {
            ...chunk,
            legacy_id: chunk.id,
            id: uuid.v4(),
            dense_vector: chunk.vector,
            chunk_type: chunk.is_code ? 'code' : 'text'
        };
        
        await this.pool.query(
            'INSERT INTO unified.chunks ... VALUES ...',
            unifiedChunk
        );
    }
    
    async queryChunks(params: QueryParams): Promise<Chunk[]> {
        // Query unified schema but return legacy format
        const results = await this.pool.query(
            'SELECT * FROM claude_context.chunks WHERE ...'
        );
        return results.rows;
    }
}
```

### Cognee Adapter
```python
class UnifiedDataStore:
    async def add_data_point(self, data_point: DataPoint):
        """Add Cognee data point to unified storage."""
        chunk = {
            'content': data_point.text,
            'summary': data_point.summary,
            'dense_vector': data_point.embedding,
            'cognee_dataset_id': data_point.dataset_id,
            'chunk_type': 'text',
            'cognified_at': datetime.now()
        }
        
        await self.conn.execute(
            "INSERT INTO unified.chunks ... VALUES ...",
            **chunk
        )
```

## 📊 Validation & Testing

### Data Integrity Checks
```sql
-- Verify migration completeness
SELECT 
    (SELECT COUNT(*) FROM claude_context.chunks) as original_count,
    (SELECT COUNT(*) FROM unified.chunks WHERE legacy_id IS NOT NULL) as migrated_count,
    (SELECT COUNT(*) FROM unified.chunks WHERE cognee_dataset_id IS NOT NULL) as cognee_count;

-- Check for orphaned records
SELECT COUNT(*) 
FROM unified.chunks 
WHERE project_id IS NULL 
  AND cognee_dataset_id IS NULL;
```

## 🎯 Success Criteria

- [ ] All existing chunks migrated without data loss
- [ ] Both systems can read/write through compatibility views
- [ ] No performance degradation (< 5% latency increase)
- [ ] Backward compatibility maintained
- [ ] Zero downtime migration

## 🚨 Rollback Plan

```sql
-- If migration fails, restore original tables
BEGIN;
    DROP VIEW IF EXISTS claude_context.chunks;
    ALTER TABLE claude_context.chunks_backup RENAME TO chunks;
    DROP SCHEMA unified CASCADE;
COMMIT;
```

---

**Status**: ⏳ Pending  
**Estimated Duration**: 5-6 days  
**Dependencies**: Phase 1 completion  
**Output**: Unified database schema with full backward compatibility
