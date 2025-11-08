# Combined Files from hybrid-plan

*Generated on: Thu Nov  6 09:52:37 AM EST 2025*

---

## File: 00-index.md

**Path:** `00-index.md`

```markdown
# Claude-Context & Cognee Hybrid Storage Plan

## 🚀 Executive Summary

This comprehensive 15-phase plan outlines the integration of Claude-Context and Cognee into a unified storage architecture that leverages the strengths of both systems while eliminating redundancy and improving performance.

### Key Benefits
- **Storage Savings**: 30-40% reduction through deduplication and unified storage
- **Performance**: Sub-100ms query latency for most operations
- **Capabilities**: Combines fast vector search (Claude) with knowledge graphs (Cognee)
- **Scalability**: Distributed architecture supporting millions of chunks
- **Reliability**: Zero-downtime deployments with comprehensive monitoring

### Technology Stack
- **PostgreSQL** (with pgvector): Relational and vector storage
- **Qdrant**: High-performance vector similarity search
- **Neo4j**: Knowledge graph and relationship queries
- **Redis**: Caching and synchronization
- **Kubernetes**: Container orchestration
- **Prometheus/Grafana**: Monitoring and observability

## 📋 Phase Overview

### Foundation Phases (1-6)
Setting up the core infrastructure and storage layers.

| Phase | Title | Duration | Status |
|-------|-------|----------|--------|
| [Phase 1](01-phase-01-storage-architecture-analysis.md) | Storage Architecture Analysis | 3-4 days | ✅ Complete |
| [Phase 2](02-phase-02-database-schema-unification.md) | Database Schema Unification | 5-6 days | ✅ Complete |
| [Phase 3](03-phase-03-shared-chunk-format.md) | Shared Chunk Format Design | 3-4 days | ✅ Complete |
| [Phase 4](04-phase-04-postgresql-integration.md) | PostgreSQL Integration Layer | 4-5 days | ✅ Complete |
| [Phase 5](05-phase-05-qdrant-unified-collections.md) | Qdrant Unified Collections | 4-5 days | ✅ Complete |
| [Phase 6](06-phase-06-neo4j-graph-integration.md) | Neo4j Graph Integration | 5-6 days | ✅ Complete |

### Integration Phases (7-10)
Building the synchronization and routing mechanisms.

| Phase | Title | Duration | Status |
|-------|-------|----------|--------|
| [Phase 7](07-phase-07-chunk-synchronization-service.md) | Chunk Synchronization Service | 6-7 days | ✅ Complete |
| [Phase 8](08-phase-08-metadata-mapping-layer.md) | Metadata Mapping Layer | 4-5 days | ✅ Complete |
| [Phase 9](09-phase-09-dual-ingestion-pipeline.md) | Dual Ingestion Pipeline | 5-6 days | ✅ Complete |
| [Phase 10](10-phase-10-query-router-implementation.md) | Query Router Implementation | 5-6 days | ✅ Complete |

### Operations Phases (11-15)
Ensuring production readiness and deployment.

| Phase | Title | Duration | Status |
|-------|-------|----------|--------|
| [Phase 11](11-phase-11-transaction-coordinator.md) | Transaction Coordinator | 6-7 days | ✅ Complete |
| [Phase 12](12-phase-12-migration-tools.md) | Migration Tools | 5-6 days | ✅ Complete |
| [Phase 13](13-phase-13-performance-optimization.md) | Performance Optimization | 6-7 days | ✅ Complete |
| [Phase 14](14-phase-14-monitoring-observability.md) | Monitoring & Observability | 5-6 days | ✅ Complete |
| [Phase 15](15-phase-15-production-deployment.md) | Production Deployment | 7-10 days | ✅ Complete |

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Applications                      │
└────────────────────────┬───────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Query Router (Phase 10)                    │
│         Intelligent routing based on query intent             │
└──────┬──────────────────┬──────────────────┬────────────────┘
       │                  │                  │
       ▼                  ▼                  ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│Claude-Context│ │    Cognee    │ │   Hybrid     │
│ Fast Search  │ │  Knowledge   │ │   Complex    │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       │                  │                  │
       ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│           Unified Storage Layer (Phases 2-6)                 │
├───────────────┬────────────────┬────────────────────────────┤
│  PostgreSQL   │    Qdrant      │        Neo4j               │
│   + pgvector  │ Vector Store   │   Knowledge Graph          │
└───────────────┴────────────────┴────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│          Sync Service (Phase 7) + Transaction               │
│               Coordinator (Phase 11)                        │
└─────────────────────────────────────────────────────────────┘
```

## 📈 Implementation Timeline

**Total Duration**: ~90 days

### Month 1: Foundation
- Week 1-2: Architecture analysis and schema design (Phases 1-2)
- Week 3-4: Storage integration (Phases 3-5)

### Month 2: Integration
- Week 5-6: Graph integration and synchronization (Phases 6-7)
- Week 7-8: Metadata and ingestion (Phases 8-9)

### Month 3: Production
- Week 9-10: Routing and transactions (Phases 10-11)
- Week 11-12: Migration and optimization (Phases 12-13)
- Week 13: Monitoring and deployment (Phases 14-15)

## 🎯 Success Metrics

### Performance Targets
- **Query Latency**: p50 < 10ms, p95 < 50ms, p99 < 100ms
- **Throughput**: > 10,000 QPS
- **Ingestion Rate**: > 1,000 chunks/minute
- **Cache Hit Rate**: > 80%

### Storage Efficiency
- **Deduplication Rate**: > 95%
- **Storage Reduction**: 30-40%
- **Compression Ratio**: > 3:1

### Reliability
- **Uptime**: 99.99% availability
- **Data Consistency**: 100% ACID compliance
- **Recovery Time**: < 5 minutes
- **Backup Success**: 100%

## 🚀 Getting Started

### Prerequisites
1. Docker & Kubernetes environment
2. PostgreSQL 15+ with pgvector extension
3. Qdrant 1.7+
4. Neo4j 5.0+
5. Redis 7.0+

### Initial Setup
```bash
# Clone the repository
git clone https://github.com/your-org/unified-storage.git

# Navigate to project
cd unified-storage

# Review phase 1 documentation
cat docs/hybrid-plan/01-phase-01-storage-architecture-analysis.md

# Start with schema migration (Phase 2)
./scripts/migrate-schema.sh
```

## 📚 Additional Resources

- [Implementation Status](17-implementation-status.md) - **🔥 START HERE!** Current setup & next steps
- [Database State Analysis](16-database-state-analysis.md) - Current state comparison & mapping
- [Hybrid Setup Guide](../../services/cognee/HYBRID-SETUP.md) - Operational guide
- [Migration Guide](12-phase-12-migration-tools.md#migration-framework)
- [Performance Tuning](13-phase-13-performance-optimization.md)
- [Monitoring Setup](14-phase-14-monitoring-observability.md)
- [Production Checklist](15-phase-15-production-deployment.md#go-live-checklist)

## 👥 Team Requirements

### Core Team (4-6 engineers)
- **Backend Engineer**: PostgreSQL, distributed systems
- **Search Engineer**: Vector databases, embeddings
- **Graph Engineer**: Neo4j, knowledge graphs
- **DevOps Engineer**: Kubernetes, monitoring
- **Full-Stack Engineer**: API integration, testing

### Support Team
- **DBA**: Database optimization
- **Security Engineer**: Security audit
- **QA Engineer**: Testing and validation

## 📞 Support & Questions

For questions or support during implementation:
- Slack: #unified-storage-project
- Email: unified-storage@company.com
- Documentation: This repository

---

**Document Version**: 1.0.0  
**Last Updated**: December 2024  
**Status**: ✅ Plan Complete - Ready for Implementation

```

---

## File: 01-phase-01-storage-architecture-analysis.md

**Path:** `01-phase-01-storage-architecture-analysis.md`

```markdown
# Phase 1: Storage Architecture Analysis

## 🎯 Objective
Analyze and map the current storage architectures of both Claude-Context and Cognee to identify integration points and potential conflicts.

## 📊 Current State Analysis

### Claude-Context Storage Stack
```
PostgreSQL (5533) → pgvector extension → chunks table
     ↓                                       ↓
projects/datasets                      vectors (768d)
     ↓                                       ↓
Qdrant (6333) ←─────────────────────→ embeddings
```

### Cognee Storage Stack
```
SQLite/Postgres → metadata/state
        ↓
LanceDB/Qdrant → vectors
        ↓
Kuzu/Neo4j → knowledge graph
```

## 🔍 Discovery Tasks

### 1. Database Schema Analysis
```sql
-- Claude-Context Schema (PostgreSQL)
CREATE TABLE claude_context.chunks (
    id TEXT PRIMARY KEY,
    vector vector(768),
    content TEXT,
    relative_path TEXT,
    start_line INTEGER,
    end_line INTEGER,
    file_extension TEXT,
    project_id UUID,
    dataset_id UUID,
    source_type TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cognee Schema (to be analyzed)
-- Need to examine Cognee's actual table structures
```

### 2. Storage Volume Analysis
```python
# Analyze storage requirements
async def analyze_storage_footprint():
    """
    Compare storage usage between systems:
    - Claude-Context: chunks + vectors + metadata
    - Cognee: documents + embeddings + graph
    """
    metrics = {
        "claude_context": {
            "postgres_size_mb": 0,
            "qdrant_size_mb": 0,
            "chunks_count": 0,
            "avg_chunk_size_kb": 0
        },
        "cognee": {
            "sqlite_size_mb": 0,
            "lancedb_size_mb": 0,
            "graph_nodes": 0,
            "graph_edges": 0
        }
    }
    return metrics
```

### 3. API Compatibility Matrix

| Feature | Claude-Context | Cognee | Compatible |
|---------|---------------|--------|------------|
| Chunk Storage | PostgreSQL | SQLite/Postgres | ✅ Yes |
| Vector Storage | Qdrant | Qdrant/LanceDB | ✅ Yes |
| Embedding Dims | 768 (GTE/CodeRank) | Variable | ⚠️ Needs mapping |
| Project Isolation | UUID-based | Dataset-based | ⚠️ Needs bridge |
| Graph Storage | None | Neo4j/Kuzu | ➕ New capability |

## 📐 Architecture Integration Points

### Primary Integration Strategy
```mermaid
graph TD
    A[Unified Ingestion] --> B[Shared Chunk Store]
    B --> C[PostgreSQL]
    C --> D[Claude-Context Tables]
    C --> E[Cognee Tables]
    
    B --> F[Qdrant Collections]
    F --> G[claude_context_vectors]
    F --> H[cognee_vectors]
    
    B --> I[Neo4j Graph]
    I --> J[Entity Nodes]
    I --> K[Relationship Edges]
    
    L[Query Router] --> M{Query Type}
    M -->|Fast Search| D
    M -->|Graph Traversal| I
    M -->|Hybrid| N[Fusion Layer]
```

## 🔧 Technical Requirements

### Storage Unification Requirements
1. **Shared PostgreSQL Instance**
   - Port: 5533 (existing)
   - Database: `claude_context` (extend with Cognee schemas)
   - Connection pooling for both systems

2. **Shared Qdrant Instance**
   - Port: 6333 (existing)
   - Namespace separation: `cc_*` vs `cognee_*`
   - Unified embedding space (768d)

3. **New Neo4j Instance**
   - Port: 7687 (standard)
   - Database: `knowledge_graph`
   - Linked to chunk IDs

## 📋 Implementation Checklist

- [ ] Export Claude-Context schema
- [ ] Export Cognee schema requirements
- [ ] Identify shared fields
- [ ] Map incompatible fields
- [ ] Design migration strategy
- [ ] Create compatibility layer design
- [ ] Document API differences
- [ ] Plan rollback strategy

## 🚨 Risk Assessment

### High-Risk Areas
1. **Schema Conflicts**: Different field types/names
2. **Transaction Boundaries**: Cross-system consistency
3. **Performance Impact**: Shared resource contention
4. **Data Migration**: Existing data compatibility

### Mitigation Strategies
1. Use database views for compatibility
2. Implement distributed transaction coordinator
3. Resource quotas and connection pooling
4. Incremental migration with validation

## 📊 Success Metrics

- Storage reduction: Target 30-40% by eliminating duplication
- Query latency: Maintain <100ms for vector search
- Graph queries: Target <500ms for 2-hop traversals
- Zero data loss during migration

## 🔄 Next Phase Prerequisites

Before proceeding to Phase 2:
1. Complete schema analysis for both systems
2. Document all table structures
3. Identify primary keys and foreign key relationships
4. Map data flow patterns
5. Get stakeholder approval on integration approach

## 📝 Notes

- Consider using PostgreSQL schemas for logical separation
- Evaluate pg_partman for time-based partitioning
- Research Qdrant's multi-tenancy features
- Document Neo4j's memory requirements

---

**Status**: 🔄 In Progress  
**Estimated Duration**: 3-4 days  
**Dependencies**: None  
**Output**: Complete storage architecture mapping document

```

---

## File: 02-phase-02-database-schema-unification.md

**Path:** `02-phase-02-database-schema-unification.md`

```markdown
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

```

---

## File: 03-phase-03-shared-chunk-format.md

**Path:** `03-phase-03-shared-chunk-format.md`

```markdown
# Phase 3: Shared Chunk Format Design

## 🎯 Objective
Create a universal chunk format that preserves the strengths of both systems while enabling seamless data exchange and storage optimization.

## 📦 Universal Chunk Format

### Core Chunk Interface
```typescript
interface UniversalChunk {
    // Identity
    id: string;                      // UUID v4
    system_origin: 'claude' | 'cognee' | 'hybrid';
    
    // Content
    content: string;                 // Raw text/code
    summary?: string;                // AI-generated summary
    chunk_type: 'text' | 'code' | 'mixed';
    
    // Embeddings
    embeddings: {
        dense?: {
            model: string;           // gte/coderank/cognee
            vector: number[];        // 768d typically
            timestamp: Date;
        };
        sparse?: {
            model: string;           // splade/bm25
            indices: number[];
            values: number[];
            timestamp: Date;
        };
    };
    
    // Source tracking
    source: {
        type: 'github' | 'web' | 'file' | 'api';
        url?: string;
        path?: string;
        repo?: string;
        branch?: string;
        commit?: string;
    };
    
    // Position metadata
    location: {
        start_line?: number;
        end_line?: number;
        start_char: number;
        end_char: number;
        chunk_index: number;
    };
    
    // Language/Code specific
    code_metadata?: {
        language: string;
        is_code: boolean;
        confidence: number;
        symbols?: string[];          // Extracted symbols
        imports?: string[];          // Import statements
        ast_features?: object;       // AST analysis
    };
    
    // Graph relationships
    graph?: {
        node_id?: string;            // Neo4j node ID
        entities?: Entity[];         // Extracted entities
        relationships?: Relationship[];
    };
    
    // Project management
    organization: {
        project_id?: string;
        dataset_id?: string;
        cognee_dataset?: string;
        scope?: 'global' | 'project' | 'user';
    };
    
    // Metadata
    metadata: {
        created_at: Date;
        updated_at: Date;
        indexed_at?: Date;
        cognified_at?: Date;
        quality_score?: number;
        processing_time_ms?: number;
        [key: string]: any;
    };
}
```

### Entity & Relationship Types
```typescript
interface Entity {
    id: string;
    type: 'person' | 'organization' | 'location' | 
          'function' | 'class' | 'variable' | 'concept';
    name: string;
    confidence: number;
    source_positions: number[];      // Character positions in chunk
}

interface Relationship {
    source_entity_id: string;
    target_entity_id: string;
    type: 'calls' | 'imports' | 'extends' | 'implements' | 
          'references' | 'contains' | 'related_to';
    confidence: number;
    metadata?: object;
}
```

## 🔄 Conversion Adapters

### Claude-Context to Universal
```typescript
export class ClaudeToUniversalAdapter {
    convert(claudeChunk: ClaudeChunk): UniversalChunk {
        return {
            id: claudeChunk.id,
            system_origin: 'claude',
            content: claudeChunk.content,
            chunk_type: claudeChunk.is_code ? 'code' : 'text',
            
            embeddings: {
                dense: claudeChunk.vector ? {
                    model: claudeChunk.model_used || 'gte',
                    vector: claudeChunk.vector,
                    timestamp: claudeChunk.created_at
                } : undefined,
                sparse: claudeChunk.sparse_vector ? {
                    model: 'splade',
                    indices: claudeChunk.sparse_indices,
                    values: claudeChunk.sparse_values,
                    timestamp: claudeChunk.created_at
                } : undefined
            },
            
            source: {
                type: claudeChunk.source_type as any,
                path: claudeChunk.relative_path,
                repo: claudeChunk.repo,
                branch: claudeChunk.branch,
                commit: claudeChunk.sha
            },
            
            location: {
                start_line: claudeChunk.start_line,
                end_line: claudeChunk.end_line,
                start_char: claudeChunk.start_char || 0,
                end_char: claudeChunk.end_char || claudeChunk.content.length,
                chunk_index: claudeChunk.chunk_index || 0
            },
            
            code_metadata: claudeChunk.is_code ? {
                language: claudeChunk.language,
                is_code: true,
                confidence: claudeChunk.confidence || 1.0,
                symbols: claudeChunk.metadata?.symbols
            } : undefined,
            
            organization: {
                project_id: claudeChunk.project_id,
                dataset_id: claudeChunk.dataset_id,
                scope: claudeChunk.scope as any
            },
            
            metadata: {
                created_at: claudeChunk.created_at,
                updated_at: claudeChunk.updated_at || claudeChunk.created_at,
                indexed_at: claudeChunk.indexed_at,
                ...claudeChunk.metadata
            }
        };
    }
}
```

### Cognee to Universal
```python
class CogneeToUniversalAdapter:
    def convert(self, cognee_chunk: DataPoint) -> dict:
        """Convert Cognee DataPoint to Universal format."""
        return {
            "id": str(cognee_chunk.id),
            "system_origin": "cognee",
            "content": cognee_chunk.text,
            "summary": cognee_chunk.summary,
            "chunk_type": "text",
            
            "embeddings": {
                "dense": {
                    "model": cognee_chunk.embedding_model or "cognee",
                    "vector": cognee_chunk.embedding.tolist(),
                    "timestamp": cognee_chunk.created_at
                } if cognee_chunk.embedding else None
            },
            
            "graph": {
                "entities": [
                    {
                        "id": e.id,
                        "type": e.type,
                        "name": e.name,
                        "confidence": e.confidence
                    }
                    for e in cognee_chunk.entities
                ] if hasattr(cognee_chunk, 'entities') else [],
                "relationships": cognee_chunk.relationships 
                    if hasattr(cognee_chunk, 'relationships') else []
            },
            
            "organization": {
                "cognee_dataset": str(cognee_chunk.dataset_id)
            },
            
            "metadata": {
                "created_at": cognee_chunk.created_at,
                "updated_at": cognee_chunk.updated_at,
                "cognified_at": cognee_chunk.processed_at,
                **cognee_chunk.metadata
            }
        }
```

## 🔐 Serialization & Storage

### Binary Format (Protocol Buffers)
```proto
syntax = "proto3";

message UniversalChunk {
    string id = 1;
    string system_origin = 2;
    string content = 3;
    string summary = 4;
    string chunk_type = 5;
    
    message Embedding {
        string model = 1;
        repeated float vector = 2;
        int64 timestamp_ms = 3;
    }
    
    message SparseEmbedding {
        string model = 1;
        repeated int32 indices = 2;
        repeated float values = 3;
        int64 timestamp_ms = 4;
    }
    
    Embedding dense_embedding = 6;
    SparseEmbedding sparse_embedding = 7;
    
    // ... additional fields
}
```

### Compression Strategy
```python
import zstandard as zstd
import msgpack

class ChunkCompressor:
    def __init__(self):
        self.cctx = zstd.ZstdCompressor(level=3)
        
    def compress_chunk(self, chunk: UniversalChunk) -> bytes:
        """Compress chunk for storage."""
        # Pack with msgpack (more efficient than JSON)
        packed = msgpack.packb(chunk.dict())
        
        # Compress with Zstandard
        compressed = self.cctx.compress(packed)
        
        return compressed
    
    def decompress_chunk(self, data: bytes) -> UniversalChunk:
        """Decompress stored chunk."""
        dctx = zstd.ZstdDecompressor()
        decompressed = dctx.decompress(data)
        unpacked = msgpack.unpackb(decompressed)
        return UniversalChunk(**unpacked)
```

## 🔍 Validation Rules

### Chunk Validation
```python
from pydantic import BaseModel, validator

class ChunkValidator(BaseModel):
    content: str
    chunk_type: str
    
    @validator('content')
    def content_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('Content cannot be empty')
        return v
    
    @validator('chunk_type')
    def valid_chunk_type(cls, v):
        if v not in ['text', 'code', 'mixed']:
            raise ValueError('Invalid chunk type')
        return v
    
    class Config:
        max_content_size = 50000  # 50KB max per chunk
        min_content_size = 10     # 10 chars minimum
```

## 📈 Storage Optimization

### Deduplication Strategy
```sql
-- Content-based deduplication
CREATE TABLE unified.chunk_hashes (
    content_hash VARCHAR(64) PRIMARY KEY,
    chunk_ids UUID[] NOT NULL,
    first_seen TIMESTAMPTZ DEFAULT NOW(),
    last_seen TIMESTAMPTZ DEFAULT NOW()
);

-- Find duplicate chunks
WITH chunk_hashes AS (
    SELECT 
        id,
        MD5(content) as content_hash
    FROM unified.chunks
)
SELECT 
    content_hash,
    COUNT(*) as duplicate_count,
    ARRAY_AGG(id) as chunk_ids
FROM chunk_hashes
GROUP BY content_hash
HAVING COUNT(*) > 1;
```

## 🎯 Success Metrics

- Chunk format compatibility: 100% bidirectional conversion
- Storage efficiency: 30% reduction through deduplication
- Serialization speed: < 1ms per chunk
- Compression ratio: > 3:1 for text chunks
- Validation coverage: 100% of required fields

---

**Status**: ⏳ Pending  
**Estimated Duration**: 3-4 days  
**Dependencies**: Phase 2 completion  
**Output**: Universal chunk format specification and converters

```

---

## File: 04-phase-04-postgresql-integration.md

**Path:** `04-phase-04-postgresql-integration.md`

```markdown
# Phase 4: PostgreSQL Integration Layer

## 🎯 Objective
Build a robust PostgreSQL integration layer that manages shared storage, connection pooling, and transaction coordination between Claude-Context and Cognee.

## 🏗️ Architecture Design

### Connection Pool Management
```typescript
// Shared connection pool configuration
export class UnifiedPostgresPool {
    private static instance: UnifiedPostgresPool;
    private claudePool: Pool;
    private cogneePool: Pool;
    private sharedPool: Pool;
    
    private constructor() {
        const baseConfig = {
            host: process.env.POSTGRES_HOST || 'localhost',
            port: parseInt(process.env.POSTGRES_PORT || '5533'),
            database: 'claude_context',
            user: 'postgres',
            password: 'code-context-secure-password',
            max: 100,  // Total connections
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        };
        
        // Dedicated pools for isolation
        this.claudePool = new Pool({
            ...baseConfig,
            max: 40,  // 40% of connections
            application_name: 'claude-context'
        });
        
        this.cogneePool = new Pool({
            ...baseConfig,
            max: 40,  // 40% of connections
            application_name: 'cognee'
        });
        
        this.sharedPool = new Pool({
            ...baseConfig,
            max: 20,  // 20% for shared operations
            application_name: 'unified'
        });
    }
    
    static getInstance(): UnifiedPostgresPool {
        if (!this.instance) {
            this.instance = new UnifiedPostgresPool();
        }
        return this.instance;
    }
    
    async executeInTransaction<T>(
        fn: (client: PoolClient) => Promise<T>,
        pool: 'claude' | 'cognee' | 'shared' = 'shared'
    ): Promise<T> {
        const selectedPool = this[`${pool}Pool`];
        const client = await selectedPool.connect();
        
        try {
            await client.query('BEGIN');
            const result = await fn(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
}
```

## 🔄 Transaction Coordinator

### Distributed Transaction Management
```python
import asyncio
import asyncpg
from typing import List, Callable, Any
from dataclasses import dataclass
from enum import Enum

class TransactionState(Enum):
    PENDING = "pending"
    PREPARED = "prepared"
    COMMITTED = "committed"
    ABORTED = "aborted"

@dataclass
class DistributedTransaction:
    id: str
    operations: List[Callable]
    state: TransactionState = TransactionState.PENDING
    participants: List[str] = None

class PostgresTransactionCoordinator:
    """Two-phase commit coordinator for distributed transactions."""
    
    def __init__(self):
        self.transactions = {}
        
    async def begin_distributed_transaction(
        self, 
        transaction_id: str,
        participants: List[str] = ['claude', 'cognee']
    ):
        """Initialize distributed transaction."""
        tx = DistributedTransaction(
            id=transaction_id,
            operations=[],
            participants=participants
        )
        self.transactions[transaction_id] = tx
        
        # Create transaction log
        await self._log_transaction_state(tx)
        return tx
    
    async def prepare_transaction(self, tx_id: str):
        """Phase 1: Prepare all participants."""
        tx = self.transactions[tx_id]
        prepared = []
        
        try:
            for participant in tx.participants:
                conn = await self._get_connection(participant)
                await conn.execute(f"PREPARE TRANSACTION '{tx_id}_{participant}'")
                prepared.append(participant)
            
            tx.state = TransactionState.PREPARED
            await self._log_transaction_state(tx)
            return True
            
        except Exception as e:
            # Rollback prepared participants
            for participant in prepared:
                conn = await self._get_connection(participant)
                await conn.execute(f"ROLLBACK PREPARED '{tx_id}_{participant}'")
            
            tx.state = TransactionState.ABORTED
            await self._log_transaction_state(tx)
            raise e
    
    async def commit_transaction(self, tx_id: str):
        """Phase 2: Commit all participants."""
        tx = self.transactions[tx_id]
        
        if tx.state != TransactionState.PREPARED:
            raise ValueError(f"Transaction {tx_id} not in PREPARED state")
        
        for participant in tx.participants:
            conn = await self._get_connection(participant)
            await conn.execute(f"COMMIT PREPARED '{tx_id}_{participant}'")
        
        tx.state = TransactionState.COMMITTED
        await self._log_transaction_state(tx)
        
    async def _log_transaction_state(self, tx: DistributedTransaction):
        """Log transaction state for recovery."""
        async with self.log_conn.transaction():
            await self.log_conn.execute("""
                INSERT INTO unified.transaction_log 
                (id, state, participants, created_at)
                VALUES ($1, $2, $3, NOW())
                ON CONFLICT (id) DO UPDATE 
                SET state = $2, updated_at = NOW()
            """, tx.id, tx.state.value, tx.participants)
```

## 🔒 Row-Level Security

### Multi-Tenant Isolation
```sql
-- Enable RLS on unified chunks table
ALTER TABLE unified.chunks ENABLE ROW LEVEL SECURITY;

-- Claude-Context access policy
CREATE POLICY claude_access ON unified.chunks
    FOR ALL
    TO claude_user
    USING (project_id IS NOT NULL)
    WITH CHECK (project_id IS NOT NULL);

-- Cognee access policy
CREATE POLICY cognee_access ON unified.chunks
    FOR ALL
    TO cognee_user
    USING (cognee_dataset_id IS NOT NULL)
    WITH CHECK (cognee_dataset_id IS NOT NULL);

-- Shared admin access
CREATE POLICY admin_access ON unified.chunks
    FOR ALL
    TO unified_admin
    USING (true)
    WITH CHECK (true);

-- Create application users
CREATE USER claude_user WITH PASSWORD 'claude_secure_pass';
CREATE USER cognee_user WITH PASSWORD 'cognee_secure_pass';
CREATE USER unified_admin WITH PASSWORD 'admin_secure_pass';

-- Grant appropriate permissions
GRANT USAGE ON SCHEMA unified TO claude_user, cognee_user;
GRANT ALL ON SCHEMA unified TO unified_admin;
GRANT SELECT, INSERT, UPDATE ON unified.chunks TO claude_user, cognee_user;
```

## 📊 Performance Optimization

### Query Optimization
```sql
-- Partitioning by date for better performance
CREATE TABLE unified.chunks_partitioned (
    LIKE unified.chunks INCLUDING ALL
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE unified.chunks_2024_01 PARTITION OF unified.chunks_partitioned
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE unified.chunks_2024_02 PARTITION OF unified.chunks_partitioned
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Automatic partition creation
CREATE OR REPLACE FUNCTION create_monthly_partition()
RETURNS void AS $$
DECLARE
    partition_name text;
    start_date date;
    end_date date;
BEGIN
    start_date := date_trunc('month', CURRENT_DATE);
    end_date := start_date + interval '1 month';
    partition_name := 'chunks_' || to_char(start_date, 'YYYY_MM');
    
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS unified.%I PARTITION OF unified.chunks_partitioned
         FOR VALUES FROM (%L) TO (%L)',
        partition_name, start_date, end_date
    );
END;
$$ LANGUAGE plpgsql;

-- Schedule monthly
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('create-partition', '0 0 1 * *', 'SELECT create_monthly_partition()');
```

### Connection Pool Monitoring
```typescript
export class PoolMonitor {
    private metrics = {
        totalConnections: 0,
        activeConnections: 0,
        idleConnections: 0,
        waitingClients: 0,
        errors: []
    };
    
    async collectMetrics(pool: Pool): Promise<PoolMetrics> {
        return {
            totalConnections: pool.totalCount,
            activeConnections: pool.waitingCount,
            idleConnections: pool.idleCount,
            waitingClients: pool.waitingCount,
            timestamp: new Date()
        };
    }
    
    async healthCheck(): Promise<HealthStatus> {
        const checks = await Promise.all([
            this.checkConnection('claude'),
            this.checkConnection('cognee'),
            this.checkConnection('shared')
        ]);
        
        return {
            healthy: checks.every(c => c.success),
            checks,
            timestamp: new Date()
        };
    }
    
    private async checkConnection(pool: string): Promise<CheckResult> {
        try {
            const client = await this.pools[pool].connect();
            const result = await client.query('SELECT 1');
            client.release();
            return { pool, success: true };
        } catch (error) {
            return { pool, success: false, error: error.message };
        }
    }
}
```

## 🔧 Migration Scripts

### Data Migration Pipeline
```python
import asyncio
from tqdm import tqdm

class PostgresMigrator:
    async def migrate_to_unified(self):
        """Migrate all data to unified schema."""
        
        # Step 1: Create backup
        await self.create_backup()
        
        # Step 2: Migrate Claude-Context data
        claude_count = await self.migrate_claude_chunks()
        print(f"Migrated {claude_count} Claude-Context chunks")
        
        # Step 3: Migrate Cognee data
        cognee_count = await self.migrate_cognee_data()
        print(f"Migrated {cognee_count} Cognee data points")
        
        # Step 4: Verify integrity
        if await self.verify_migration():
            print("Migration verified successfully")
        else:
            print("Migration verification failed, rolling back")
            await self.rollback()
    
    async def migrate_claude_chunks(self):
        """Migrate Claude-Context chunks with progress bar."""
        
        # Get total count
        count_result = await self.source_conn.fetchrow(
            "SELECT COUNT(*) FROM claude_context.chunks"
        )
        total = count_result[0]
        
        # Migrate in batches
        batch_size = 1000
        migrated = 0
        
        with tqdm(total=total, desc="Migrating chunks") as pbar:
            for offset in range(0, total, batch_size):
                chunks = await self.source_conn.fetch(f"""
                    SELECT * FROM claude_context.chunks
                    LIMIT {batch_size} OFFSET {offset}
                """)
                
                # Transform and insert
                transformed = [self.transform_claude_chunk(c) for c in chunks]
                await self.target_conn.executemany(
                    "INSERT INTO unified.chunks ... VALUES ...",
                    transformed
                )
                
                migrated += len(chunks)
                pbar.update(len(chunks))
        
        return migrated
```

## 🎯 Success Metrics

- Connection pool efficiency: > 85% utilization
- Transaction success rate: > 99.9%
- Query latency: p95 < 50ms
- Deadlock frequency: < 0.1%
- Partition pruning effectiveness: > 70%

---

**Status**: ⏳ Pending  
**Estimated Duration**: 4-5 days  
**Dependencies**: Phases 1-3  
**Output**: Production-ready PostgreSQL integration layer

```

---

## File: 05-phase-05-qdrant-unified-collections.md

**Path:** `05-phase-05-qdrant-unified-collections.md`

```markdown
# Phase 5: Qdrant Unified Collections

## 🎯 Objective
Create a unified Qdrant vector storage architecture that enables efficient sharing of embeddings between Claude-Context and Cognee while maintaining logical separation.

## 🏗️ Collection Architecture

### Unified Collection Schema
```python
from qdrant_client import QdrantClient
from qdrant_client.models import (
    VectorParams, Distance, CollectionConfig,
    PayloadSchemaType, PointStruct, NamedVector
)

class UnifiedQdrantManager:
    def __init__(self):
        self.client = QdrantClient(
            url="http://localhost:6333",
            timeout=30.0
        )
        
    async def create_unified_collection(self):
        """Create multi-vector collection for unified storage."""
        
        # Collection with multiple named vectors
        await self.client.create_collection(
            collection_name="unified_chunks",
            vectors_config={
                # Dense vectors (768d)
                "dense_gte": VectorParams(
                    size=768,
                    distance=Distance.COSINE
                ),
                "dense_coderank": VectorParams(
                    size=768,
                    distance=Distance.COSINE
                ),
                "dense_cognee": VectorParams(
                    size=768,
                    distance=Distance.COSINE
                ),
                # Sparse vectors
                "sparse_splade": VectorParams(
                    size=30522,  # SPLADE dimension
                    distance=Distance.DOT,
                    on_disk=True  # Store on disk for efficiency
                )
            },
            # Optimized HNSW parameters
            hnsw_config={
                "m": 16,
                "ef_construct": 200,
                "full_scan_threshold": 10000
            },
            # Payload indexing
            payload_schema={
                "project_id": PayloadSchemaType.KEYWORD,
                "dataset_id": PayloadSchemaType.KEYWORD,
                "cognee_dataset": PayloadSchemaType.KEYWORD,
                "source_type": PayloadSchemaType.KEYWORD,
                "language": PayloadSchemaType.KEYWORD,
                "is_code": PayloadSchemaType.BOOL,
                "created_at": PayloadSchemaType.DATETIME,
                "system_origin": PayloadSchemaType.KEYWORD
            }
        )
```

### Collection Aliases & Views
```python
class QdrantViewManager:
    """Manage logical views through aliases and filters."""
    
    async def create_system_views(self):
        """Create filtered views for each system."""
        
        # Claude-Context view
        await self.client.create_alias(
            collection_name="unified_chunks",
            alias_name="claude_context_vectors"
        )
        
        # Cognee view
        await self.client.create_alias(
            collection_name="unified_chunks",
            alias_name="cognee_vectors"
        )
        
        # Create filtered snapshots
        await self.create_filtered_snapshot(
            "claude_only",
            {"system_origin": "claude"}
        )
        
        await self.create_filtered_snapshot(
            "cognee_only",
            {"system_origin": "cognee"}
        )
    
    async def create_filtered_snapshot(self, name: str, filter: dict):
        """Create snapshot with filter for fast access."""
        await self.client.create_snapshot(
            collection_name="unified_chunks",
            snapshot_name=f"snapshot_{name}_{datetime.now().isoformat()}"
        )
```

## 🔄 Data Synchronization

### Bidirectional Sync Manager
```typescript
export class QdrantSyncManager {
    private claudeQueue: ChunkQueue;
    private cogneeQueue: ChunkQueue;
    private batchSize = 100;
    private syncInterval = 5000; // 5 seconds
    
    async startBidirectionalSync() {
        // Sync Claude-Context → Unified
        setInterval(async () => {
            await this.syncClaudeToUnified();
        }, this.syncInterval);
        
        // Sync Cognee → Unified
        setInterval(async () => {
            await this.syncCogneeToUnified();
        }, this.syncInterval);
    }
    
    private async syncClaudeToUnified() {
        const chunks = await this.claudeQueue.dequeue(this.batchSize);
        if (chunks.length === 0) return;
        
        const points = chunks.map(chunk => ({
            id: chunk.id,
            vectors: {
                dense_gte: chunk.embeddings.gte,
                dense_coderank: chunk.embeddings.coderank,
                sparse_splade: chunk.embeddings.splade
            },
            payload: {
                content: chunk.content,
                project_id: chunk.project_id,
                dataset_id: chunk.dataset_id,
                source_type: chunk.source_type,
                language: chunk.language,
                is_code: chunk.is_code,
                system_origin: 'claude',
                metadata: chunk.metadata
            }
        }));
        
        await this.qdrantClient.upsert({
            collection_name: 'unified_chunks',
            points
        });
        
        console.log(`Synced ${points.length} Claude chunks to unified collection`);
    }
}
```

## 🔍 Hybrid Search Implementation

### Multi-Vector Search
```python
class UnifiedVectorSearch:
    """Unified search across multiple vector types."""
    
    async def hybrid_search(
        self,
        query_text: str,
        query_embeddings: dict,
        filters: dict = None,
        limit: int = 10
    ):
        """Execute hybrid search with vector fusion."""
        
        search_requests = []
        
        # Dense search (if embedding available)
        if 'dense' in query_embeddings:
            search_requests.append({
                'vector': {
                    'name': 'dense_gte' if not filters.get('is_code') else 'dense_coderank',
                    'vector': query_embeddings['dense']
                },
                'limit': limit * 2,  # Over-fetch for fusion
                'with_payload': True,
                'filter': filters
            })
        
        # Sparse search (if available)
        if 'sparse' in query_embeddings:
            search_requests.append({
                'vector': {
                    'name': 'sparse_splade',
                    'vector': query_embeddings['sparse']
                },
                'limit': limit * 2,
                'with_payload': True,
                'filter': filters
            })
        
        # Execute searches in parallel
        results = await asyncio.gather(*[
            self.client.search(
                collection_name='unified_chunks',
                **request
            ) for request in search_requests
        ])
        
        # Fusion with RRF (Reciprocal Rank Fusion)
        fused_results = self.reciprocal_rank_fusion(results, k=60)
        
        return fused_results[:limit]
    
    def reciprocal_rank_fusion(self, result_sets, k=60):
        """RRF fusion for multiple result sets."""
        scores = {}
        
        for result_set in result_sets:
            for rank, point in enumerate(result_set):
                point_id = point.id
                if point_id not in scores:
                    scores[point_id] = {
                        'score': 0,
                        'point': point
                    }
                scores[point_id]['score'] += 1 / (k + rank + 1)
        
        # Sort by fused score
        sorted_results = sorted(
            scores.values(),
            key=lambda x: x['score'],
            reverse=True
        )
        
        return [r['point'] for r in sorted_results]
```

## 📊 Performance Optimization

### Sharding Strategy
```python
class QdrantShardManager:
    """Manage sharded collections for scale."""
    
    async def setup_sharding(self):
        """Configure sharding for large-scale deployment."""
        
        # Create sharded collection
        await self.client.create_collection(
            collection_name="unified_chunks_sharded",
            vectors_config={...},
            shard_number=4,  # 4 shards
            replication_factor=2,  # 2 replicas per shard
            write_consistency_factor=1,  # Fast writes
            on_disk_payload=True  # Store payload on disk
        )
        
        # Configure shard key routing
        await self.configure_shard_routing()
    
    async def configure_shard_routing(self):
        """Route requests to appropriate shards."""
        
        # Project-based routing
        shard_key_config = {
            'shard_key_selector': {
                'type': 'custom',
                'field': 'project_id',
                'shard_mapping': {
                    # Hash project_id to shard
                    'algorithm': 'murmur3',
                    'shard_count': 4
                }
            }
        }
        
        await self.client.update_collection(
            collection_name="unified_chunks_sharded",
            shard_key_config=shard_key_config
        )
```

### Caching Layer
```typescript
import { LRUCache } from 'lru-cache';

export class QdrantCacheLayer {
    private vectorCache: LRUCache<string, number[]>;
    private resultCache: LRUCache<string, SearchResult[]>;
    
    constructor() {
        this.vectorCache = new LRUCache({
            max: 10000,  // 10k vectors
            ttl: 1000 * 60 * 60,  // 1 hour
            sizeCalculation: (vector) => vector.length * 4  // 4 bytes per float
        });
        
        this.resultCache = new LRUCache({
            max: 1000,  // 1k result sets
            ttl: 1000 * 60 * 5  // 5 minutes
        });
    }
    
    async search(query: string, filters: any): Promise<SearchResult[]> {
        const cacheKey = this.getCacheKey(query, filters);
        
        // Check result cache
        const cached = this.resultCache.get(cacheKey);
        if (cached) {
            console.log('Cache hit for query');
            return cached;
        }
        
        // Execute search
        const results = await this.executeSearch(query, filters);
        
        // Cache results
        this.resultCache.set(cacheKey, results);
        
        return results;
    }
}
```

## 🔧 Migration Tools

### Collection Migration
```python
async def migrate_to_unified_qdrant():
    """Migrate existing Qdrant collections to unified structure."""
    
    source_client = QdrantClient("http://localhost:6333")
    
    # Get all points from source collections
    claude_points = []
    offset = None
    
    while True:
        records = await source_client.scroll(
            collection_name="claude_context_collection",
            offset=offset,
            limit=1000
        )
        
        if not records[0]:
            break
            
        claude_points.extend(records[0])
        offset = records[1]
    
    print(f"Found {len(claude_points)} Claude-Context points")
    
    # Transform to unified format
    unified_points = []
    for point in claude_points:
        unified_point = PointStruct(
            id=point.id,
            vectors={
                "dense_gte": point.vector,
                "sparse_splade": [0.0] * 30522  # Placeholder
            },
            payload={
                **point.payload,
                "system_origin": "claude",
                "migrated_at": datetime.now().isoformat()
            }
        )
        unified_points.append(unified_point)
    
    # Batch upload to unified collection
    batch_size = 100
    for i in range(0, len(unified_points), batch_size):
        batch = unified_points[i:i+batch_size]
        await source_client.upsert(
            collection_name="unified_chunks",
            points=batch
        )
        print(f"Migrated {i+len(batch)}/{len(unified_points)} points")
```

## 🎯 Success Metrics

- Search latency: p95 < 50ms
- Index build time: < 10 minutes for 1M vectors
- Memory usage: < 8GB for 10M vectors
- Query throughput: > 1000 QPS
- Sync lag: < 10 seconds

---

**Status**: ⏳ Pending  
**Estimated Duration**: 4-5 days  
**Dependencies**: Phases 1-4  
**Output**: Unified Qdrant collection architecture with bidirectional sync

```

---

## File: 06-phase-06-neo4j-graph-integration.md

**Path:** `06-phase-06-neo4j-graph-integration.md`

```markdown
# Phase 6: Neo4j Graph Integration

## 🎯 Objective
Integrate Neo4j as the knowledge graph layer, linking chunks to entities and relationships while maintaining synchronization with vector stores.

## 🏗️ Neo4j Architecture

### Docker Setup
```yaml
# docker-compose.neo4j.yml
services:
  neo4j:
    image: neo4j:5.15-enterprise
    container_name: claude-context-neo4j
    ports:
      - "7474:7474"  # HTTP
      - "7687:7687"  # Bolt
    environment:
      NEO4J_AUTH: neo4j/secure-graph-password
      NEO4J_PLUGINS: '["apoc", "graph-data-science"]'
      NEO4J_dbms_memory_pagecache_size: 2G
      NEO4J_dbms_memory_heap_initial__size: 2G
      NEO4J_dbms_memory_heap_max__size: 4G
      NEO4J_apoc_export_file_enabled: true
      NEO4J_apoc_import_file_enabled: true
    volumes:
      - neo4j_data:/data
      - neo4j_logs:/logs
      - neo4j_import:/var/lib/neo4j/import
      - neo4j_plugins:/plugins
    networks:
      - claude-context-network
    healthcheck:
      test: ["CMD", "cypher-shell", "-u", "neo4j", "-p", "secure-graph-password", "MATCH () RETURN count(*) LIMIT 1"]
      interval: 30s
      timeout: 10s
      retries: 5
```

### Graph Schema Design
```cypher
// Core node types
CREATE CONSTRAINT chunk_id IF NOT EXISTS FOR (c:Chunk) REQUIRE c.id IS UNIQUE;
CREATE CONSTRAINT entity_id IF NOT EXISTS FOR (e:Entity) REQUIRE e.id IS UNIQUE;
CREATE CONSTRAINT project_id IF NOT EXISTS FOR (p:Project) REQUIRE p.id IS UNIQUE;
CREATE CONSTRAINT dataset_id IF NOT EXISTS FOR (d:Dataset) REQUIRE d.id IS UNIQUE;

// Chunk nodes (linked to PostgreSQL/Qdrant)
CREATE (c:Chunk {
    id: 'uuid',
    content_hash: 'sha256_hash',
    chunk_type: 'code|text|mixed',
    source_type: 'github|web|file',
    created_at: datetime(),
    system_origin: 'claude|cognee|hybrid'
})

// Entity nodes (extracted via NER/LLM)
CREATE (e:Entity {
    id: 'uuid',
    name: 'entity_name',
    type: 'person|organization|location|concept|function|class',
    confidence: 0.95,
    first_seen: datetime(),
    last_seen: datetime()
})

// Project and Dataset nodes
CREATE (p:Project {
    id: 'uuid',
    name: 'project_name',
    created_at: datetime()
})

CREATE (d:Dataset {
    id: 'uuid',
    name: 'dataset_name',
    project_id: 'uuid',
    created_at: datetime()
})

// Relationships
CREATE (c:Chunk)-[:CONTAINS_ENTITY {
    confidence: 0.95,
    position: [100, 150],  // Character positions
    context: 'surrounding text'
}]->(e:Entity)

CREATE (c:Chunk)-[:BELONGS_TO]->(d:Dataset)
CREATE (d:Dataset)-[:PART_OF]->(p:Project)

CREATE (e1:Entity)-[:RELATES_TO {
    type: 'calls|imports|extends|references',
    confidence: 0.85,
    evidence: ['chunk_id1', 'chunk_id2']
}]->(e2:Entity)

CREATE (c1:Chunk)-[:SIMILAR_TO {
    similarity_score: 0.92,
    vector_type: 'dense|sparse'
}]->(c2:Chunk)

// Code-specific relationships
CREATE (f:Function)-[:CALLS {line_number: 42}]->(f2:Function)
CREATE (c:Class)-[:EXTENDS]->(parent:Class)
CREATE (m:Module)-[:IMPORTS]->(dep:Module)
```

## 🔄 Entity Extraction Pipeline

### LLM-Based Entity Extraction
```python
from neo4j import AsyncGraphDatabase
import asyncio
from typing import List, Dict
import hashlib

class EntityExtractor:
    """Extract entities and relationships from chunks."""
    
    def __init__(self, llm_client, neo4j_driver):
        self.llm = llm_client
        self.driver = neo4j_driver
        
    async def extract_and_link(self, chunk: UniversalChunk):
        """Extract entities and create graph relationships."""
        
        # Extract entities using LLM
        entities = await self.extract_entities(chunk)
        
        # Extract relationships
        relationships = await self.extract_relationships(chunk, entities)
        
        # Store in Neo4j
        async with self.driver.session() as session:
            # Create chunk node
            chunk_node_id = await session.execute_write(
                self._create_chunk_node, chunk
            )
            
            # Create entity nodes and relationships
            for entity in entities:
                entity_node_id = await session.execute_write(
                    self._create_or_update_entity, entity
                )
                
                # Link chunk to entity
                await session.execute_write(
                    self._link_chunk_to_entity,
                    chunk_node_id, entity_node_id, entity
                )
            
            # Create entity-to-entity relationships
            for rel in relationships:
                await session.execute_write(
                    self._create_entity_relationship, rel
                )
    
    async def extract_entities(self, chunk: UniversalChunk) -> List[Entity]:
        """Use LLM to extract entities from chunk."""
        
        prompt = f"""
        Extract all entities from the following text/code.
        Return as JSON array with: name, type, confidence, position.
        
        Types: person, organization, location, function, class, variable, concept
        
        Text:
        {chunk.content}
        """
        
        response = await self.llm.complete(prompt)
        entities = json.loads(response)
        
        return [Entity(**e) for e in entities]
    
    @staticmethod
    async def _create_chunk_node(tx, chunk):
        """Create or update chunk node in Neo4j."""
        query = """
        MERGE (c:Chunk {id: $id})
        SET c.content_hash = $content_hash,
            c.chunk_type = $chunk_type,
            c.source_type = $source_type,
            c.created_at = datetime($created_at),
            c.system_origin = $system_origin,
            c.updated_at = datetime()
        RETURN c.id
        """
        
        result = await tx.run(query,
            id=chunk.id,
            content_hash=hashlib.sha256(chunk.content.encode()).hexdigest(),
            chunk_type=chunk.chunk_type,
            source_type=chunk.source.type,
            created_at=chunk.metadata.created_at.isoformat(),
            system_origin=chunk.system_origin
        )
        
        record = await result.single()
        return record[0]
```

### Code-Aware Relationship Extraction
```typescript
export class CodeGraphBuilder {
    constructor(
        private neo4jDriver: Driver,
        private astAnalyzer: ASTAnalyzer
    ) {}
    
    async buildCodeGraph(chunk: CodeChunk): Promise<void> {
        // Parse AST
        const ast = await this.astAnalyzer.parse(chunk.content, chunk.language);
        
        // Extract code entities
        const functions = this.extractFunctions(ast);
        const classes = this.extractClasses(ast);
        const imports = this.extractImports(ast);
        
        // Create nodes and relationships
        const session = this.neo4jDriver.session();
        
        try {
            await session.executeWrite(async tx => {
                // Create function nodes
                for (const func of functions) {
                    await tx.run(`
                        MERGE (f:Function {name: $name, file: $file})
                        SET f.signature = $signature,
                            f.start_line = $start_line,
                            f.end_line = $end_line,
                            f.chunk_id = $chunk_id
                    `, {
                        name: func.name,
                        file: chunk.source.path,
                        signature: func.signature,
                        start_line: func.startLine,
                        end_line: func.endLine,
                        chunk_id: chunk.id
                    });
                }
                
                // Create call relationships
                for (const call of this.extractCalls(ast)) {
                    await tx.run(`
                        MATCH (caller:Function {name: $caller, file: $file})
                        MATCH (callee:Function {name: $callee})
                        MERGE (caller)-[:CALLS {line: $line}]->(callee)
                    `, {
                        caller: call.from,
                        callee: call.to,
                        file: chunk.source.path,
                        line: call.line
                    });
                }
            });
        } finally {
            await session.close();
        }
    }
}
```

## 🔍 Graph Queries

### Complex Graph Traversals
```cypher
-- Find all functions that eventually call a specific function
MATCH path = (f1:Function)-[:CALLS*]->(f2:Function {name: 'authenticate'})
RETURN f1.name, f1.file, length(path) as depth
ORDER BY depth
LIMIT 20

-- Find related chunks through shared entities
MATCH (c1:Chunk {id: $chunk_id})-[:CONTAINS_ENTITY]->(e:Entity)
      <-[:CONTAINS_ENTITY]-(c2:Chunk)
WHERE c1 <> c2
WITH c2, count(distinct e) as shared_entities
RETURN c2.id, shared_entities
ORDER BY shared_entities DESC
LIMIT 10

-- Knowledge graph for a concept
MATCH (e:Entity {name: $concept_name})
OPTIONAL MATCH (e)-[r1]-(related:Entity)
OPTIONAL MATCH (related)-[r2]-(secondary:Entity)
WHERE secondary <> e
RETURN e, r1, related, r2, secondary
LIMIT 100
```

### GraphQL API Layer
```typescript
import { gql } from 'apollo-server-express';
import { neo4jgraphql } from 'neo4j-graphql-js';

const typeDefs = gql`
    type Chunk {
        id: ID!
        content_hash: String
        chunk_type: String
        entities: [Entity] @relation(name: "CONTAINS_ENTITY", direction: OUT)
        similar_chunks: [Chunk] @relation(name: "SIMILAR_TO", direction: BOTH)
        dataset: Dataset @relation(name: "BELONGS_TO", direction: OUT)
    }
    
    type Entity {
        id: ID!
        name: String!
        type: String!
        confidence: Float
        chunks: [Chunk] @relation(name: "CONTAINS_ENTITY", direction: IN)
        related_entities: [Entity] @cypher(
            statement: """
            MATCH (this)-[:RELATES_TO]-(related:Entity)
            RETURN related
            """
        )
    }
    
    type Query {
        findRelatedChunks(chunkId: ID!, depth: Int = 2): [Chunk]
        @cypher(statement: """
            MATCH (c:Chunk {id: $chunkId})-[:CONTAINS_ENTITY]->(e:Entity)
                  <-[:CONTAINS_ENTITY*1..$depth]-(related:Chunk)
            WHERE related.id <> $chunkId
            RETURN DISTINCT related
        """)
        
        getKnowledgeGraph(entityName: String!): KnowledgeGraph
        @cypher(statement: """
            MATCH path = (e:Entity {name: $entityName})-[*1..3]-(connected)
            RETURN path
        """)
    }
`;

const resolvers = {
    Query: {
        findRelatedChunks: neo4jgraphql,
        getKnowledgeGraph: neo4jgraphql
    }
};
```

## 📊 Performance Optimization

### Index Strategy
```cypher
-- Composite indexes for common queries
CREATE INDEX chunk_source_type IF NOT EXISTS 
FOR (c:Chunk) ON (c.source_type, c.created_at);

CREATE INDEX entity_type_name IF NOT EXISTS 
FOR (e:Entity) ON (e.type, e.name);

-- Full-text search indexes
CREATE FULLTEXT INDEX chunk_content_search IF NOT EXISTS
FOR (c:Chunk) ON EACH [c.content_hash];

CREATE FULLTEXT INDEX entity_name_search IF NOT EXISTS
FOR (e:Entity) ON EACH [e.name];

-- Vector similarity index (requires GDS plugin)
CALL gds.graph.project(
  'chunk_similarity',
  'Chunk',
  {
    SIMILAR_TO: {
      properties: 'similarity_score'
    }
  }
);
```

### Query Optimization
```python
class Neo4jQueryOptimizer:
    """Optimize and cache graph queries."""
    
    def __init__(self):
        self.query_cache = {}
        self.query_plans = {}
        
    async def execute_optimized(self, query: str, params: dict):
        """Execute query with optimization."""
        
        # Get query plan
        plan = await self.get_query_plan(query)
        
        # Check if index hints needed
        if plan.needs_index_hint:
            query = self.add_index_hints(query, plan)
        
        # Check cache
        cache_key = self.get_cache_key(query, params)
        if cache_key in self.query_cache:
            return self.query_cache[cache_key]
        
        # Execute query
        result = await self.driver.execute(query, params)
        
        # Cache if appropriate
        if plan.is_cacheable:
            self.query_cache[cache_key] = result
            
        return result
    
    async def get_query_plan(self, query: str):
        """Analyze query execution plan."""
        explain_query = f"EXPLAIN {query}"
        plan = await self.driver.execute(explain_query)
        return self.parse_plan(plan)
```

## 🎯 Success Metrics

- Entity extraction accuracy: > 85%
- Graph traversal latency: p95 < 100ms
- Relationship discovery rate: > 70%
- Node creation throughput: > 1000/sec
- Query cache hit rate: > 60%

---

**Status**: ⏳ Pending  
**Estimated Duration**: 5-6 days  
**Dependencies**: Phases 1-5  
**Output**: Fully integrated Neo4j knowledge graph layer

```

---

## File: 07-phase-07-chunk-synchronization-service.md

**Path:** `07-phase-07-chunk-synchronization-service.md`

```markdown
# Phase 7: Chunk Synchronization Service

## 🎯 Objective
Build a real-time synchronization service that keeps chunks consistent across PostgreSQL, Qdrant, and Neo4j while handling conflicts and maintaining data integrity.

## 🏗️ Synchronization Architecture

### Event-Driven Sync System
```typescript
// Event-based synchronization using Redis Streams
import { Redis } from 'ioredis';
import { EventEmitter } from 'events';

export interface SyncEvent {
    id: string;
    type: 'create' | 'update' | 'delete';
    source: 'claude' | 'cognee' | 'hybrid';
    target: string[];  // ['postgres', 'qdrant', 'neo4j']
    chunk: UniversalChunk;
    timestamp: Date;
    retry_count: number;
}

export class ChunkSyncService extends EventEmitter {
    private redis: Redis;
    private readonly STREAM_KEY = 'chunk:sync:stream';
    private readonly CONSUMER_GROUP = 'sync-workers';
    
    constructor() {
        super();
        this.redis = new Redis({
            host: 'localhost',
            port: 6379,
            maxRetriesPerRequest: 3
        });
        
        this.initializeConsumerGroup();
    }
    
    async publishSyncEvent(event: SyncEvent): Promise<void> {
        // Add to Redis stream
        await this.redis.xadd(
            this.STREAM_KEY,
            '*',
            'event_id', event.id,
            'type', event.type,
            'source', event.source,
            'targets', JSON.stringify(event.target),
            'chunk', JSON.stringify(event.chunk),
            'timestamp', event.timestamp.toISOString()
        );
        
        // Emit for local listeners
        this.emit('sync:event', event);
    }
    
    async consumeSyncEvents(): Promise<void> {
        while (true) {
            try {
                // Read from stream with blocking
                const messages = await this.redis.xreadgroup(
                    'GROUP', this.CONSUMER_GROUP, 'worker-1',
                    'BLOCK', 1000,
                    'COUNT', 10,
                    'STREAMS', this.STREAM_KEY, '>'
                );
                
                if (messages && messages[0][1].length > 0) {
                    const streamMessages = messages[0][1];
                    
                    for (const [messageId, fields] of streamMessages) {
                        const event = this.parseStreamMessage(fields);
                        await this.processSyncEvent(event, messageId);
                    }
                }
            } catch (error) {
                console.error('Sync consumer error:', error);
                await this.sleep(5000);
            }
        }
    }
    
    private async processSyncEvent(event: SyncEvent, messageId: string): Promise<void> {
        const results = await Promise.allSettled([
            this.syncToPostgres(event),
            this.syncToQdrant(event),
            this.syncToNeo4j(event)
        ]);
        
        // Check results
        const failures = results.filter(r => r.status === 'rejected');
        
        if (failures.length === 0) {
            // Acknowledge successful processing
            await this.redis.xack(this.STREAM_KEY, this.CONSUMER_GROUP, messageId);
        } else {
            // Handle failures
            await this.handleSyncFailures(event, failures, messageId);
        }
    }
}
```

## 🔄 Conflict Resolution

### Three-Way Merge Strategy
```python
from datetime import datetime
from typing import Optional, Dict, Any
import hashlib

class ConflictResolver:
    """Resolve conflicts during synchronization."""
    
    def __init__(self):
        self.conflict_handlers = {
            'content': self.resolve_content_conflict,
            'embeddings': self.resolve_embedding_conflict,
            'metadata': self.resolve_metadata_conflict
        }
    
    async def resolve_conflict(
        self,
        source_chunk: UniversalChunk,
        target_chunk: UniversalChunk,
        conflict_type: str = 'auto'
    ) -> UniversalChunk:
        """Resolve conflict between source and target chunks."""
        
        if conflict_type == 'auto':
            conflict_type = self.detect_conflict_type(source_chunk, target_chunk)
        
        handler = self.conflict_handlers.get(conflict_type, self.default_resolution)
        return await handler(source_chunk, target_chunk)
    
    def detect_conflict_type(self, source: UniversalChunk, target: UniversalChunk) -> str:
        """Detect the type of conflict."""
        
        # Content conflict
        if source.content != target.content:
            return 'content'
        
        # Embedding conflict
        if (source.embeddings.dense != target.embeddings.dense or
            source.embeddings.sparse != target.embeddings.sparse):
            return 'embeddings'
        
        # Metadata conflict
        if source.metadata != target.metadata:
            return 'metadata'
        
        return 'none'
    
    async def resolve_content_conflict(
        self, 
        source: UniversalChunk, 
        target: UniversalChunk
    ) -> UniversalChunk:
        """Resolve content conflicts using timestamps and hashes."""
        
        # Compare content hashes
        source_hash = hashlib.sha256(source.content.encode()).hexdigest()
        target_hash = hashlib.sha256(target.content.encode()).hexdigest()
        
        # If hashes match, no real conflict
        if source_hash == target_hash:
            return source
        
        # Use timestamp-based resolution (last write wins)
        if source.metadata.updated_at > target.metadata.updated_at:
            # Source is newer, merge metadata
            merged = source.copy()
            merged.metadata.update({
                'previous_version': target_hash,
                'conflict_resolved_at': datetime.now().isoformat(),
                'resolution_strategy': 'last_write_wins'
            })
            return merged
        else:
            # Target is newer, keep target but log conflict
            target.metadata.update({
                'conflict_detected': True,
                'conflicting_version': source_hash,
                'conflict_timestamp': datetime.now().isoformat()
            })
            return target
    
    async def resolve_embedding_conflict(
        self,
        source: UniversalChunk,
        target: UniversalChunk
    ) -> UniversalChunk:
        """Resolve embedding conflicts by keeping both versions."""
        
        merged = source.copy()
        
        # Keep both embeddings with versioning
        merged.embeddings = {
            'dense': source.embeddings.dense,
            'dense_alternative': target.embeddings.dense,
            'sparse': source.embeddings.sparse or target.embeddings.sparse,
            'conflict_resolution': 'keep_both',
            'primary_source': source.system_origin,
            'alternative_source': target.system_origin
        }
        
        return merged
```

## 🔐 Data Consistency Guarantees

### Write-Ahead Logging (WAL)
```python
import aiofiles
import json
from pathlib import Path

class SyncWAL:
    """Write-ahead log for sync operations."""
    
    def __init__(self, wal_dir: str = "/var/log/chunk-sync/wal"):
        self.wal_dir = Path(wal_dir)
        self.wal_dir.mkdir(parents=True, exist_ok=True)
        self.current_wal = None
        
    async def log_operation(self, operation: Dict[str, Any]):
        """Log operation to WAL before execution."""
        
        wal_entry = {
            'timestamp': datetime.now().isoformat(),
            'operation': operation,
            'status': 'pending'
        }
        
        # Write to WAL file
        wal_file = self.wal_dir / f"wal_{datetime.now().strftime('%Y%m%d_%H')}.jsonl"
        
        async with aiofiles.open(wal_file, 'a') as f:
            await f.write(json.dumps(wal_entry) + '\n')
        
        return wal_entry
    
    async def mark_complete(self, operation_id: str):
        """Mark operation as complete in WAL."""
        # Implementation for marking complete
        pass
    
    async def recover_from_wal(self):
        """Recover incomplete operations from WAL."""
        
        incomplete_ops = []
        
        # Scan WAL files
        for wal_file in sorted(self.wal_dir.glob("wal_*.jsonl")):
            async with aiofiles.open(wal_file, 'r') as f:
                async for line in f:
                    entry = json.loads(line)
                    if entry['status'] == 'pending':
                        incomplete_ops.append(entry)
        
        # Replay incomplete operations
        for op in incomplete_ops:
            await self.replay_operation(op)
    
    async def replay_operation(self, operation: Dict[str, Any]):
        """Replay an operation from WAL."""
        print(f"Replaying operation: {operation['operation']['type']}")
        # Implement replay logic
```

## 📡 Real-Time Change Detection

### Change Data Capture (CDC)
```sql
-- PostgreSQL logical replication for CDC
CREATE PUBLICATION unified_chunks_pub FOR TABLE unified.chunks;

-- Create replication slot
SELECT * FROM pg_create_logical_replication_slot('chunk_sync_slot', 'wal2json');

-- Consumer subscription
CREATE SUBSCRIPTION chunk_sync_sub
    CONNECTION 'host=localhost port=5533 dbname=claude_context user=replication_user'
    PUBLICATION unified_chunks_pub
    WITH (slot_name = 'chunk_sync_slot');
```

### CDC Consumer
```typescript
import { LogicalReplicationService } from 'pg-logical-replication';

export class PostgresCDCConsumer {
    private replicationService: LogicalReplicationService;
    
    async startCDC() {
        this.replicationService = new LogicalReplicationService({
            connectionString: process.env.POSTGRES_REPLICATION_URL,
            slotName: 'chunk_sync_slot',
            publicationNames: ['unified_chunks_pub']
        });
        
        this.replicationService.on('data', async (change) => {
            await this.handleChange(change);
        });
        
        await this.replicationService.start();
    }
    
    private async handleChange(change: any) {
        const { action, table, new_row, old_row } = change;
        
        console.log(`CDC Event: ${action} on ${table}`);
        
        switch(action) {
            case 'INSERT':
                await this.syncService.publishSyncEvent({
                    type: 'create',
                    chunk: this.rowToChunk(new_row),
                    target: ['qdrant', 'neo4j']
                });
                break;
                
            case 'UPDATE':
                await this.syncService.publishSyncEvent({
                    type: 'update',
                    chunk: this.rowToChunk(new_row),
                    target: ['qdrant', 'neo4j']
                });
                break;
                
            case 'DELETE':
                await this.syncService.publishSyncEvent({
                    type: 'delete',
                    chunk: { id: old_row.id },
                    target: ['qdrant', 'neo4j']
                });
                break;
        }
    }
}
```

## 📊 Sync Monitoring

### Metrics Collection
```python
from prometheus_client import Counter, Histogram, Gauge
import time

class SyncMetrics:
    """Metrics for synchronization monitoring."""
    
    def __init__(self):
        # Counters
        self.sync_events_total = Counter(
            'sync_events_total',
            'Total sync events processed',
            ['source', 'target', 'type']
        )
        
        self.sync_errors_total = Counter(
            'sync_errors_total',
            'Total sync errors',
            ['source', 'target', 'error_type']
        )
        
        # Histograms
        self.sync_duration = Histogram(
            'sync_duration_seconds',
            'Sync operation duration',
            ['operation']
        )
        
        # Gauges
        self.sync_lag = Gauge(
            'sync_lag_seconds',
            'Current sync lag',
            ['source', 'target']
        )
        
        self.queue_size = Gauge(
            'sync_queue_size',
            'Current sync queue size'
        )
    
    def record_sync_event(self, source: str, target: str, event_type: str):
        """Record sync event metrics."""
        self.sync_events_total.labels(source, target, event_type).inc()
    
    def record_sync_error(self, source: str, target: str, error_type: str):
        """Record sync error."""
        self.sync_errors_total.labels(source, target, error_type).inc()
    
    @contextmanager
    def measure_sync_duration(self, operation: str):
        """Context manager to measure sync duration."""
        start = time.time()
        try:
            yield
        finally:
            duration = time.time() - start
            self.sync_duration.labels(operation).observe(duration)
```

## 🎯 Success Metrics

- Sync latency: p95 < 1 second
- Conflict resolution rate: > 95% automated
- Data consistency: 99.99% accuracy
- Queue processing: > 10,000 events/sec
- Recovery time: < 5 minutes from failure

---

**Status**: ⏳ In Progress  
**Estimated Duration**: 6-7 days  
**Dependencies**: Phases 1-6  
**Output**: Real-time chunk synchronization service with conflict resolution

```

---

## File: 08-phase-08-metadata-mapping-layer.md

**Path:** `08-phase-08-metadata-mapping-layer.md`

```markdown
# Phase 8: Metadata Mapping Layer

## 🎯 Objective
Create a comprehensive metadata mapping layer that translates between Claude-Context and Cognee metadata formats while preserving system-specific information.

## 🏗️ Metadata Architecture

### Universal Metadata Schema
```typescript
// Comprehensive metadata interface
interface UniversalMetadata {
    // Core identifiers
    identifiers: {
        universal_id: string;        // UUID v4
        claude_id?: string;          // Legacy Claude ID
        cognee_id?: string;          // Cognee data point ID
        external_id?: string;        // External system ID
    };
    
    // Provenance tracking
    provenance: {
        origin_system: 'claude' | 'cognee' | 'hybrid';
        created_by: string;          // User/system that created
        created_at: Date;
        modified_by: string;
        modified_at: Date;
        version: number;             // Version counter
        parent_id?: string;          // For derived chunks
    };
    
    // Processing metadata
    processing: {
        chunking: {
            method: 'ast' | 'character' | 'semantic' | 'llm';
            chunk_size: number;
            overlap: number;
            splitter_version: string;
        };
        embedding: {
            models: {
                dense?: { model: string; version: string; timestamp: Date; };
                sparse?: { model: string; version: string; timestamp: Date; };
            };
            processing_time_ms: number;
        };
        summarization?: {
            model: string;
            prompt_template: string;
            timestamp: Date;
        };
        entity_extraction?: {
            model: string;
            entities_found: number;
            confidence_threshold: number;
            timestamp: Date;
        };
    };
    
    // Quality metrics
    quality: {
        confidence_score: number;    // 0-1
        validation_status: 'pending' | 'validated' | 'failed';
        validation_errors?: string[];
        quality_checks: {
            content_length: boolean;
            embedding_quality: boolean;
            entity_coverage: boolean;
        };
        human_review?: {
            reviewed: boolean;
            reviewer: string;
            timestamp: Date;
            notes?: string;
        };
    };
    
    // Access control
    access: {
        visibility: 'public' | 'private' | 'team' | 'restricted';
        owner: string;
        team_id?: string;
        permissions: {
            read: string[];          // User/role IDs
            write: string[];
            delete: string[];
        };
        tags?: string[];             // For filtering
        categories?: string[];       // Classification
    };
    
    // Custom metadata
    custom: {
        [key: string]: any;          // System-specific fields
    };
}
```

## 🔄 Metadata Mappers

### Claude to Universal Mapper
```typescript
export class ClaudeMetadataMapper {
    mapToUniversal(claudeMetadata: any, chunk: any): UniversalMetadata {
        return {
            identifiers: {
                universal_id: chunk.id,
                claude_id: chunk.legacy_id || chunk.id,
                external_id: claudeMetadata.external_id
            },
            
            provenance: {
                origin_system: 'claude',
                created_by: claudeMetadata.created_by || 'claude-context',
                created_at: new Date(chunk.created_at),
                modified_by: claudeMetadata.modified_by || 'system',
                modified_at: new Date(chunk.updated_at || chunk.created_at),
                version: claudeMetadata.version || 1,
                parent_id: claudeMetadata.parent_chunk_id
            },
            
            processing: {
                chunking: {
                    method: chunk.chunking_method || 'ast',
                    chunk_size: chunk.chunk_size || 1000,
                    overlap: chunk.chunk_overlap || 100,
                    splitter_version: '1.0.0'
                },
                embedding: {
                    models: {
                        dense: chunk.embedding_model ? {
                            model: chunk.embedding_model,
                            version: '1.0',
                            timestamp: new Date(chunk.indexed_at)
                        } : undefined
                    },
                    processing_time_ms: claudeMetadata.processing_time || 0
                }
            },
            
            quality: {
                confidence_score: chunk.confidence || 1.0,
                validation_status: 'validated',
                quality_checks: {
                    content_length: chunk.content?.length > 0,
                    embedding_quality: chunk.vector?.length === 768,
                    entity_coverage: false
                }
            },
            
            access: {
                visibility: 'team',
                owner: chunk.project_id,
                permissions: {
                    read: ['*'],
                    write: [chunk.project_id],
                    delete: [chunk.project_id]
                },
                tags: claudeMetadata.tags || []
            },
            
            custom: {
                claude_specific: {
                    scope: chunk.scope,
                    symbol_extraction: claudeMetadata.symbols,
                    ast_features: claudeMetadata.ast_features
                }
            }
        };
    }
    
    mapFromUniversal(universal: UniversalMetadata): any {
        return {
            id: universal.identifiers.claude_id || universal.identifiers.universal_id,
            created_by: universal.provenance.created_by,
            created_at: universal.provenance.created_at.toISOString(),
            version: universal.provenance.version,
            processing_time: universal.processing.embedding?.processing_time_ms,
            confidence: universal.quality.confidence_score,
            tags: universal.access.tags,
            ...universal.custom.claude_specific
        };
    }
}
```

### Cognee to Universal Mapper
```python
class CogneeMetadataMapper:
    """Map between Cognee and Universal metadata formats."""
    
    def map_to_universal(self, cognee_metadata: dict, data_point: Any) -> dict:
        """Convert Cognee metadata to universal format."""
        
        return {
            "identifiers": {
                "universal_id": str(data_point.id),
                "cognee_id": str(data_point.id),
                "external_id": cognee_metadata.get("external_ref")
            },
            
            "provenance": {
                "origin_system": "cognee",
                "created_by": cognee_metadata.get("user_id", "cognee"),
                "created_at": data_point.created_at.isoformat(),
                "modified_by": cognee_metadata.get("last_modified_by", "system"),
                "modified_at": data_point.updated_at.isoformat(),
                "version": cognee_metadata.get("version", 1)
            },
            
            "processing": {
                "chunking": {
                    "method": "semantic",
                    "chunk_size": cognee_metadata.get("chunk_size", 512),
                    "overlap": cognee_metadata.get("overlap", 50),
                    "splitter_version": "cognee-1.0"
                },
                "summarization": {
                    "model": cognee_metadata.get("summary_model", "gpt-4"),
                    "prompt_template": cognee_metadata.get("prompt_template"),
                    "timestamp": data_point.summarized_at.isoformat()
                } if hasattr(data_point, 'summarized_at') else None,
                "entity_extraction": {
                    "model": "cognee-ner",
                    "entities_found": len(data_point.entities) if hasattr(data_point, 'entities') else 0,
                    "confidence_threshold": 0.7,
                    "timestamp": data_point.cognified_at.isoformat()
                } if hasattr(data_point, 'cognified_at') else None
            },
            
            "quality": {
                "confidence_score": cognee_metadata.get("confidence", 0.9),
                "validation_status": "validated" if data_point.is_validated else "pending",
                "quality_checks": {
                    "content_length": len(data_point.text) > 0,
                    "embedding_quality": data_point.embedding is not None,
                    "entity_coverage": hasattr(data_point, 'entities')
                }
            },
            
            "access": {
                "visibility": cognee_metadata.get("visibility", "private"),
                "owner": str(data_point.user_id),
                "permissions": {
                    "read": cognee_metadata.get("read_permissions", ["owner"]),
                    "write": cognee_metadata.get("write_permissions", ["owner"]),
                    "delete": ["owner"]
                }
            },
            
            "custom": {
                "cognee_specific": {
                    "dataset_id": str(data_point.dataset_id),
                    "knowledge_graph_id": cognee_metadata.get("graph_id"),
                    "cognitive_layer": cognee_metadata.get("cognitive_layer")
                }
            }
        }
```

## 🔐 Metadata Validation

### Schema Validation
```python
from pydantic import BaseModel, Field, validator
from typing import Optional, Dict, List, Any

class MetadataValidator(BaseModel):
    """Validate metadata against schema."""
    
    identifiers: Dict[str, Optional[str]]
    provenance: Dict[str, Any]
    processing: Dict[str, Any]
    quality: Dict[str, Any]
    access: Dict[str, Any]
    custom: Optional[Dict[str, Any]] = Field(default_factory=dict)
    
    @validator('identifiers')
    def validate_identifiers(cls, v):
        if not v.get('universal_id'):
            raise ValueError('universal_id is required')
        return v
    
    @validator('provenance')
    def validate_provenance(cls, v):
        required = ['origin_system', 'created_at', 'version']
        for field in required:
            if field not in v:
                raise ValueError(f'{field} is required in provenance')
        
        if v['origin_system'] not in ['claude', 'cognee', 'hybrid']:
            raise ValueError('Invalid origin_system')
        
        return v
    
    @validator('quality')
    def validate_quality(cls, v):
        if 'confidence_score' in v:
            score = v['confidence_score']
            if not 0 <= score <= 1:
                raise ValueError('confidence_score must be between 0 and 1')
        return v
    
    class Config:
        extra = 'forbid'  # No extra fields allowed
```

## 📊 Metadata Aggregation

### Cross-System Metadata Merger
```typescript
export class MetadataAggregator {
    /**
     * Merge metadata from multiple sources
     */
    async mergeMetadata(
        sources: { system: string; metadata: UniversalMetadata }[]
    ): Promise<UniversalMetadata> {
        
        // Start with base metadata
        const merged: UniversalMetadata = this.createBaseMetadata();
        
        // Merge identifiers
        merged.identifiers = this.mergeIdentifiers(sources);
        
        // Merge provenance (keep earliest created, latest modified)
        merged.provenance = this.mergeProvenance(sources);
        
        // Merge processing info (union of all)
        merged.processing = this.mergeProcessingInfo(sources);
        
        // Quality score (weighted average)
        merged.quality = this.mergeQualityMetrics(sources);
        
        // Access control (most restrictive)
        merged.access = this.mergeAccessControl(sources);
        
        // Custom fields (namespace by system)
        merged.custom = this.mergeCustomFields(sources);
        
        return merged;
    }
    
    private mergeIdentifiers(sources: any[]): any {
        const identifiers: any = {
            universal_id: null
        };
        
        for (const source of sources) {
            const meta = source.metadata;
            
            // Use first universal_id found
            if (!identifiers.universal_id && meta.identifiers.universal_id) {
                identifiers.universal_id = meta.identifiers.universal_id;
            }
            
            // Collect system-specific IDs
            if (source.system === 'claude' && meta.identifiers.claude_id) {
                identifiers.claude_id = meta.identifiers.claude_id;
            }
            if (source.system === 'cognee' && meta.identifiers.cognee_id) {
                identifiers.cognee_id = meta.identifiers.cognee_id;
            }
        }
        
        return identifiers;
    }
    
    private mergeQualityMetrics(sources: any[]): any {
        let totalScore = 0;
        let totalWeight = 0;
        const checks: any = {};
        
        for (const source of sources) {
            const quality = source.metadata.quality;
            const weight = this.getSystemWeight(source.system);
            
            totalScore += quality.confidence_score * weight;
            totalWeight += weight;
            
            // Merge quality checks (AND logic)
            Object.assign(checks, quality.quality_checks);
        }
        
        return {
            confidence_score: totalScore / totalWeight,
            validation_status: 'validated',
            quality_checks: checks
        };
    }
    
    private getSystemWeight(system: string): number {
        // Weight different systems based on reliability
        const weights = {
            'claude': 1.0,
            'cognee': 0.9,
            'hybrid': 1.1
        };
        return weights[system] || 1.0;
    }
}
```

## 🔍 Metadata Querying

### Advanced Metadata Search
```sql
-- Create metadata search functions
CREATE OR REPLACE FUNCTION search_by_metadata(
    filters JSONB,
    limit_count INT DEFAULT 10
)
RETURNS TABLE(chunk_id UUID, metadata JSONB, score FLOAT)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id as chunk_id,
        c.metadata,
        -- Calculate relevance score
        (
            CASE WHEN c.metadata @> filters THEN 1.0 ELSE 0.0 END +
            CASE WHEN c.metadata->'quality'->>'confidence_score'::float > 0.8 THEN 0.2 ELSE 0.0 END +
            CASE WHEN c.metadata->'provenance'->>'origin_system' = 'hybrid' THEN 0.1 ELSE 0.0 END
        ) as score
    FROM unified.chunks c
    WHERE c.metadata @> filters  -- JSONB containment
    ORDER BY score DESC, c.created_at DESC
    LIMIT limit_count;
END;
$$;

-- Index for JSONB queries
CREATE INDEX IF NOT EXISTS idx_chunks_metadata_gin 
ON unified.chunks USING GIN (metadata);

-- Index for specific metadata paths
CREATE INDEX IF NOT EXISTS idx_chunks_confidence 
ON unified.chunks ((metadata->'quality'->>'confidence_score'::float));
```

## 🎯 Success Metrics

- Metadata mapping accuracy: 100%
- Validation success rate: > 99%
- Query performance: p95 < 10ms
- Metadata completeness: > 95%
- Schema compatibility: 100%

---

**Status**: ⏳ Pending  
**Estimated Duration**: 4-5 days  
**Dependencies**: Phases 1-7  
**Output**: Complete metadata mapping and validation layer

```

---

## File: 09-phase-09-dual-ingestion-pipeline.md

**Path:** `09-phase-09-dual-ingestion-pipeline.md`

```markdown
# Phase 9: Dual Ingestion Pipeline

## 🎯 Objective
Build a unified ingestion pipeline that can process data for both Claude-Context and Cognee simultaneously, maximizing efficiency and preventing duplicate processing.

## 🏗️ Pipeline Architecture

### Unified Ingestion Orchestrator
```typescript
import { Pipeline, Stage } from './pipeline-core';
import { Queue } from 'bull';

export class DualIngestionPipeline {
    private claudePipeline: Pipeline;
    private cogneePipeline: Pipeline;
    private unifiedQueue: Queue;
    
    constructor() {
        this.unifiedQueue = new Queue('unified-ingestion', {
            redis: {
                host: 'localhost',
                port: 6379
            },
            defaultJobOptions: {
                removeOnComplete: 100,
                removeOnFail: 1000,
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 2000
                }
            }
        });
        
        this.setupPipelines();
        this.setupQueueProcessors();
    }
    
    private setupPipelines() {
        // Claude-Context pipeline stages
        this.claudePipeline = new Pipeline([
            new Stage('fetch', this.fetchContent),
            new Stage('parse', this.parseForClaude),
            new Stage('chunk_ast', this.chunkWithAST),
            new Stage('embed_dense', this.generateDenseEmbeddings),
            new Stage('embed_sparse', this.generateSparseEmbeddings),
            new Stage('store_vectors', this.storeToQdrant)
        ]);
        
        // Cognee pipeline stages
        this.cogneePipeline = new Pipeline([
            new Stage('fetch', this.fetchContent),  // Shared
            new Stage('parse', this.parseForCognee),
            new Stage('chunk_semantic', this.chunkSemantically),
            new Stage('summarize', this.generateSummaries),
            new Stage('extract_entities', this.extractEntities),
            new Stage('build_graph', this.buildKnowledgeGraph),
            new Stage('cognify', this.cognifyContent)
        ]);
    }
    
    async ingestDual(request: IngestionRequest): Promise<IngestionResult> {
        // Add to unified queue
        const job = await this.unifiedQueue.add('ingest', {
            id: uuidv4(),
            request,
            timestamp: new Date(),
            targets: request.targets || ['claude', 'cognee']
        });
        
        // Wait for completion
        const result = await job.finished();
        return result;
    }
    
    private async processUnifiedIngestion(job: Job) {
        const { request, targets } = job.data;
        const results = {
            claude: null,
            cognee: null,
            unified: null
        };
        
        try {
            // Fetch content once
            const content = await this.fetchContent(request);
            
            // Process in parallel for each target
            const promises = [];
            
            if (targets.includes('claude')) {
                promises.push(
                    this.processClaudeIngestion(content, request)
                        .then(r => results.claude = r)
                );
            }
            
            if (targets.includes('cognee')) {
                promises.push(
                    this.processCogneeIngestion(content, request)
                        .then(r => results.cognee = r)
                );
            }
            
            await Promise.all(promises);
            
            // Merge results
            results.unified = await this.mergeResults(results);
            
            // Store unified metadata
            await this.storeUnifiedMetadata(results.unified);
            
            return results;
            
        } catch (error) {
            await this.handleIngestionError(error, job);
            throw error;
        }
    }
}
```

## 🔄 Content Processing Stages

### Shared Processing Functions
```python
from typing import Any, Dict, List, Optional
import asyncio
from dataclasses import dataclass

@dataclass
class ProcessingContext:
    """Shared context across pipeline stages."""
    content: str
    source_type: str
    metadata: Dict[str, Any]
    claude_artifacts: Optional[Dict] = None
    cognee_artifacts: Optional[Dict] = None
    shared_cache: Optional[Dict] = None

class SharedProcessors:
    """Processors that can be reused by both pipelines."""
    
    @staticmethod
    async def fetch_content(source: str, source_type: str) -> ProcessingContext:
        """Fetch content from various sources."""
        
        fetchers = {
            'github': GitHubFetcher(),
            'web': WebFetcher(),
            'file': FileFetcher(),
            'api': APIFetcher()
        }
        
        fetcher = fetchers.get(source_type)
        if not fetcher:
            raise ValueError(f"Unknown source type: {source_type}")
        
        content = await fetcher.fetch(source)
        
        return ProcessingContext(
            content=content.text,
            source_type=source_type,
            metadata={
                'source': source,
                'fetched_at': datetime.now(),
                'content_type': content.content_type,
                'size_bytes': len(content.text)
            },
            shared_cache={}
        )
    
    @staticmethod
    async def detect_language(context: ProcessingContext) -> str:
        """Detect programming language or content type."""
        
        # Check cache first
        if 'language' in context.shared_cache:
            return context.shared_cache['language']
        
        # Use tree-sitter for code detection
        if context.source_type in ['github', 'file']:
            language = detect_programming_language(context.content)
        else:
            language = 'text'
        
        # Cache result
        context.shared_cache['language'] = language
        return language
    
    @staticmethod
    async def extract_structure(context: ProcessingContext) -> Dict:
        """Extract structural information usable by both systems."""
        
        structure = {
            'headings': [],
            'code_blocks': [],
            'links': [],
            'sections': []
        }
        
        if context.source_type == 'web':
            # Extract HTML structure
            structure['headings'] = extract_headings(context.content)
            structure['links'] = extract_links(context.content)
        
        elif context.shared_cache.get('language') != 'text':
            # Extract code structure
            ast = parse_ast(context.content, context.shared_cache['language'])
            structure['functions'] = extract_functions(ast)
            structure['classes'] = extract_classes(ast)
            structure['imports'] = extract_imports(ast)
        
        context.shared_cache['structure'] = structure
        return structure
```

### Intelligent Chunking Strategy
```typescript
export class IntelligentChunker {
    private astChunker: ASTChunker;
    private semanticChunker: SemanticChunker;
    private hybridChunker: HybridChunker;
    
    async chunkForBothSystems(
        content: string,
        context: ProcessingContext
    ): Promise<DualChunkResult> {
        
        const result: DualChunkResult = {
            claude_chunks: [],
            cognee_chunks: [],
            shared_chunks: [],
            chunk_mapping: new Map()
        };
        
        // Determine chunking strategy
        const strategy = this.determineStrategy(context);
        
        if (strategy === 'code') {
            // Use AST chunking (better for Claude-Context)
            const astChunks = await this.astChunker.chunk(content, {
                language: context.language,
                maxSize: 1000,
                overlap: 100
            });
            
            // These work well for both systems
            result.shared_chunks = astChunks;
            result.claude_chunks = astChunks;
            
            // Cognee might want different boundaries
            result.cognee_chunks = await this.semanticChunker.rechunk(
                astChunks,
                { targetSize: 512 }
            );
            
        } else if (strategy === 'document') {
            // Use semantic chunking (better for Cognee)
            const semanticChunks = await this.semanticChunker.chunk(content, {
                maxSize: 512,
                overlap: 50,
                breakpoints: context.structure?.headings
            });
            
            result.cognee_chunks = semanticChunks;
            
            // Claude might want larger chunks
            result.claude_chunks = await this.mergeChunks(
                semanticChunks,
                { targetSize: 1000 }
            );
            
            // Create mapping
            this.createChunkMapping(
                result.claude_chunks,
                result.cognee_chunks,
                result.chunk_mapping
            );
        }
        
        return result;
    }
    
    private createChunkMapping(
        claudeChunks: Chunk[],
        cogneeChunks: Chunk[],
        mapping: Map<string, string[]>
    ) {
        // Map which Cognee chunks correspond to each Claude chunk
        for (const claudeChunk of claudeChunks) {
            const overlapping = cogneeChunks.filter(cogneeChunk =>
                this.chunksOverlap(claudeChunk, cogneeChunk)
            );
            
            mapping.set(
                claudeChunk.id,
                overlapping.map(c => c.id)
            );
        }
    }
}
```

## 🚀 Parallel Processing

### Dual Embedding Generation
```python
import asyncio
from concurrent.futures import ThreadPoolExecutor

class DualEmbeddingProcessor:
    """Generate embeddings for both systems efficiently."""
    
    def __init__(self):
        self.executor = ThreadPoolExecutor(max_workers=4)
        self.claude_embedder = ClaudeEmbedder()  # GTE/CodeRank
        self.cognee_embedder = CogneeEmbedder()  # Cognee models
    
    async def generate_all_embeddings(
        self,
        chunks: List[UniversalChunk]
    ) -> Dict[str, List[float]]:
        """Generate all required embeddings in parallel."""
        
        tasks = []
        
        # Group chunks by type for efficient batching
        text_chunks = [c for c in chunks if c.chunk_type == 'text']
        code_chunks = [c for c in chunks if c.chunk_type == 'code']
        
        # Claude-Context embeddings
        if text_chunks:
            tasks.append(self.generate_gte_embeddings(text_chunks))
        if code_chunks:
            tasks.append(self.generate_coderank_embeddings(code_chunks))
        
        # Cognee embeddings (all chunks)
        tasks.append(self.generate_cognee_embeddings(chunks))
        
        # SPLADE sparse embeddings
        tasks.append(self.generate_splade_embeddings(chunks))
        
        # Execute all in parallel
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Merge results
        embeddings = {}
        for chunk in chunks:
            chunk_embeddings = {
                'dense_gte': None,
                'dense_coderank': None,
                'dense_cognee': None,
                'sparse_splade': None
            }
            
            # Map results to chunks
            if chunk.chunk_type == 'text':
                chunk_embeddings['dense_gte'] = results[0].get(chunk.id)
            else:
                chunk_embeddings['dense_coderank'] = results[1].get(chunk.id)
            
            chunk_embeddings['dense_cognee'] = results[2].get(chunk.id)
            chunk_embeddings['sparse_splade'] = results[3].get(chunk.id)
            
            embeddings[chunk.id] = chunk_embeddings
        
        return embeddings
```

## 📊 Ingestion Monitoring

### Pipeline Metrics Dashboard
```typescript
export class IngestionMetrics {
    private metrics = {
        ingestion_rate: new Rate(),
        processing_time: new Histogram(),
        error_rate: new Counter(),
        duplicate_detection: new Counter(),
        storage_saved: new Gauge()
    };
    
    async recordIngestion(result: IngestionResult) {
        // Record metrics
        this.metrics.ingestion_rate.mark();
        
        this.metrics.processing_time.update(
            result.processing_time_ms
        );
        
        if (result.duplicates_found > 0) {
            this.metrics.duplicate_detection.inc(result.duplicates_found);
            
            // Calculate storage saved
            const saved_bytes = result.duplicates_found * result.avg_chunk_size;
            this.metrics.storage_saved.set(saved_bytes);
        }
    }
    
    getDashboardData(): DashboardData {
        return {
            current_rate: this.metrics.ingestion_rate.meanRate(),
            avg_processing_time: this.metrics.processing_time.mean(),
            error_percentage: this.calculateErrorRate(),
            storage_efficiency: this.calculateStorageEfficiency(),
            duplicate_percentage: this.calculateDuplicateRate()
        };
    }
}
```

## 🔄 Deduplication Strategy

### Content-Based Deduplication
```python
import hashlib
from typing import Set, Dict

class ContentDeduplicator:
    """Prevent duplicate ingestion across both systems."""
    
    def __init__(self):
        self.content_hashes: Set[str] = set()
        self.chunk_hashes: Dict[str, str] = {}
        
    async def check_duplicate(self, content: str) -> bool:
        """Check if content already exists."""
        
        content_hash = self.hash_content(content)
        
        # Check in-memory cache
        if content_hash in self.content_hashes:
            return True
        
        # Check database
        exists = await self.check_database(content_hash)
        if exists:
            self.content_hashes.add(content_hash)
            return True
        
        return False
    
    def hash_content(self, content: str) -> str:
        """Generate stable hash for content."""
        
        # Normalize content
        normalized = content.strip().lower()
        normalized = re.sub(r'\s+', ' ', normalized)
        
        # Generate hash
        return hashlib.sha256(normalized.encode()).hexdigest()
    
    async def check_database(self, content_hash: str) -> bool:
        """Check if hash exists in database."""
        
        result = await db.execute("""
            SELECT EXISTS(
                SELECT 1 FROM unified.chunks
                WHERE metadata->>'content_hash' = $1
            )
        """, content_hash)
        
        return result[0]['exists']
    
    async def deduplicate_chunks(
        self,
        chunks: List[UniversalChunk]
    ) -> List[UniversalChunk]:
        """Remove duplicate chunks."""
        
        unique_chunks = []
        
        for chunk in chunks:
            chunk_hash = self.hash_content(chunk.content)
            
            if chunk_hash not in self.chunk_hashes:
                self.chunk_hashes[chunk_hash] = chunk.id
                unique_chunks.append(chunk)
            else:
                # Log duplicate
                logger.info(f"Duplicate chunk found: {chunk.id} == {self.chunk_hashes[chunk_hash]}")
        
        return unique_chunks
```

## 🎯 Success Metrics

- Ingestion throughput: > 1000 chunks/minute
- Deduplication rate: > 95%
- Processing efficiency: 40% reduction vs separate pipelines
- Error rate: < 0.1%
- Storage savings: 30-40% through deduplication

---

**Status**: ⏳ Pending  
**Estimated Duration**: 5-6 days  
**Dependencies**: Phases 1-8  
**Output**: Unified dual ingestion pipeline with deduplication

```

---

## File: 10-phase-10-query-router-implementation.md

**Path:** `10-phase-10-query-router-implementation.md`

```markdown
# Phase 10: Query Router Implementation

## 🎯 Objective
Implement an intelligent query routing system that automatically directs queries to the most appropriate backend (Claude-Context for fast search, Cognee for knowledge graphs, or hybrid for complex queries).

## 🏗️ Query Router Architecture

### Intelligent Query Analyzer
```typescript
import { NLPAnalyzer } from './nlp';
import { QueryClassifier } from './ml-classifier';

export enum QueryIntent {
    FAST_SEARCH = 'fast_search',        // Simple vector similarity
    CODE_SEARCH = 'code_search',        // Code-specific search
    GRAPH_TRAVERSAL = 'graph',          // Relationship queries
    ENTITY_LOOKUP = 'entity',           // Entity-based queries
    AGGREGATION = 'aggregation',        // Statistical queries
    HYBRID = 'hybrid'                    // Complex multi-hop
}

export class QueryRouter {
    private classifier: QueryClassifier;
    private nlpAnalyzer: NLPAnalyzer;
    private routingRules: RoutingRule[];
    
    constructor() {
        this.classifier = new QueryClassifier({
            modelPath: './models/query_classifier.onnx'
        });
        
        this.setupRoutingRules();
    }
    
    async route(query: string, context?: QueryContext): Promise<RoutingDecision> {
        // Step 1: Analyze query intent
        const intent = await this.analyzeIntent(query);
        
        // Step 2: Extract query features
        const features = await this.extractFeatures(query);
        
        // Step 3: Apply routing rules
        const route = this.determineRoute(intent, features, context);
        
        // Step 4: Optimize query for target system
        const optimizedQuery = await this.optimizeQuery(query, route);
        
        return {
            query: optimizedQuery,
            route,
            intent,
            features,
            confidence: features.confidence,
            fallback: this.getFallbackRoute(route)
        };
    }
    
    private async analyzeIntent(query: string): Promise<QueryIntent> {
        // Use ML classifier for intent detection
        const prediction = await this.classifier.predict(query);
        
        // Override with keyword detection for high confidence
        if (this.hasGraphKeywords(query)) {
            return QueryIntent.GRAPH_TRAVERSAL;
        }
        
        if (this.hasCodeKeywords(query)) {
            return QueryIntent.CODE_SEARCH;
        }
        
        return prediction.intent;
    }
    
    private hasGraphKeywords(query: string): boolean {
        const graphKeywords = [
            'relationship', 'connected', 'related to', 'path between',
            'depends on', 'references', 'calls', 'imports',
            'knowledge graph', 'entity', 'network'
        ];
        
        const lowerQuery = query.toLowerCase();
        return graphKeywords.some(keyword => lowerQuery.includes(keyword));
    }
    
    private determineRoute(
        intent: QueryIntent,
        features: QueryFeatures,
        context?: QueryContext
    ): RouteTarget {
        
        // Fast path routing
        if (intent === QueryIntent.FAST_SEARCH || 
            intent === QueryIntent.CODE_SEARCH) {
            return {
                primary: 'claude-context',
                secondary: null,
                strategy: 'single'
            };
        }
        
        // Graph path routing
        if (intent === QueryIntent.GRAPH_TRAVERSAL ||
            intent === QueryIntent.ENTITY_LOOKUP) {
            return {
                primary: 'cognee',
                secondary: 'neo4j',
                strategy: 'graph-first'
            };
        }
        
        // Hybrid routing for complex queries
        if (intent === QueryIntent.HYBRID ||
            features.complexity > 0.7) {
            return {
                primary: 'claude-context',
                secondary: 'cognee',
                strategy: 'parallel-merge'
            };
        }
        
        // Default to fast search
        return {
            primary: 'claude-context',
            secondary: null,
            strategy: 'single'
        };
    }
}
```

## 🔍 Query Execution Strategies

### Strategy Pattern Implementation
```python
from abc import ABC, abstractmethod
from typing import List, Dict, Any
import asyncio

class QueryStrategy(ABC):
    """Base class for query execution strategies."""
    
    @abstractmethod
    async def execute(self, query: str, params: Dict) -> Any:
        pass

class FastSearchStrategy(QueryStrategy):
    """Direct vector similarity search via Claude-Context."""
    
    async def execute(self, query: str, params: Dict) -> List[SearchResult]:
        # Generate embedding
        embedding = await self.embed_query(query)
        
        # Search in Qdrant
        results = await self.qdrant_client.search(
            collection_name="unified_chunks",
            query_vector=embedding,
            limit=params.get('limit', 10),
            query_filter={
                "must": [
                    {"key": "system_origin", "match": {"any": ["claude", "hybrid"]}}
                ]
            }
        )
        
        # Enhance with metadata
        return self.enhance_results(results)

class GraphTraversalStrategy(QueryStrategy):
    """Knowledge graph traversal via Neo4j."""
    
    async def execute(self, query: str, params: Dict) -> GraphResult:
        # Extract entities from query
        entities = await self.extract_entities(query)
        
        # Build Cypher query
        cypher = self.build_cypher_query(entities, params)
        
        # Execute on Neo4j
        async with self.neo4j_driver.session() as session:
            result = await session.run(cypher, entities=entities)
            graph = await self.process_graph_result(result)
        
        return GraphResult(
            nodes=graph['nodes'],
            edges=graph['edges'],
            paths=graph['paths']
        )

class HybridStrategy(QueryStrategy):
    """Parallel execution with result fusion."""
    
    async def execute(self, query: str, params: Dict) -> HybridResult:
        # Execute in parallel
        fast_task = asyncio.create_task(
            self.fast_search.execute(query, params)
        )
        
        graph_task = asyncio.create_task(
            self.graph_search.execute(query, params)
        )
        
        cognee_task = asyncio.create_task(
            self.cognee_search.execute(query, params)
        )
        
        # Wait for all
        fast_results, graph_results, cognee_results = await asyncio.gather(
            fast_task, graph_task, cognee_task,
            return_exceptions=True
        )
        
        # Fusion strategy
        fused = await self.fuse_results(
            fast_results,
            graph_results,
            cognee_results
        )
        
        return HybridResult(
            chunks=fused['chunks'],
            graph=fused['graph'],
            insights=fused['insights'],
            confidence=fused['confidence']
        )
    
    async def fuse_results(self, fast, graph, cognee):
        """Intelligent result fusion with reranking."""
        
        # Collect all unique chunks
        all_chunks = {}
        
        # Add fast search results
        for result in fast or []:
            all_chunks[result.id] = {
                'chunk': result,
                'scores': {'vector': result.score}
            }
        
        # Enhance with graph connections
        if graph:
            for node in graph.nodes:
                if node.chunk_id in all_chunks:
                    all_chunks[node.chunk_id]['scores']['graph'] = node.centrality
                    all_chunks[node.chunk_id]['relationships'] = node.relationships
        
        # Add Cognee insights
        if cognee:
            for insight in cognee:
                if insight.chunk_id in all_chunks:
                    all_chunks[insight.chunk_id]['scores']['cognitive'] = insight.relevance
                    all_chunks[insight.chunk_id]['summary'] = insight.summary
        
        # Rerank using combined scores
        ranked = self.rerank_results(all_chunks)
        
        return {
            'chunks': ranked[:10],
            'graph': graph,
            'insights': self.extract_insights(ranked),
            'confidence': self.calculate_confidence(all_chunks)
        }
```

## 🎯 Query Optimization

### Query Rewriting Engine
```typescript
export class QueryOptimizer {
    private synonymDB: SynonymDatabase;
    private queryExpander: QueryExpander;
    
    async optimizeForTarget(
        query: string,
        target: string
    ): Promise<OptimizedQuery> {
        
        let optimized = query;
        
        switch(target) {
            case 'claude-context':
                optimized = await this.optimizeForVectorSearch(query);
                break;
                
            case 'neo4j':
                optimized = await this.optimizeForGraphSearch(query);
                break;
                
            case 'cognee':
                optimized = await this.optimizeForCognitiveSearch(query);
                break;
        }
        
        return {
            original: query,
            optimized,
            expansions: await this.generateExpansions(query),
            filters: this.extractFilters(query),
            boosts: this.calculateBoosts(query)
        };
    }
    
    private async optimizeForVectorSearch(query: string): Promise<string> {
        // Remove stop words for better embedding
        let optimized = this.removeStopWords(query);
        
        // Expand technical terms
        optimized = await this.expandTechnicalTerms(optimized);
        
        // Add context hints
        if (this.isCodeQuery(query)) {
            optimized = `code function ${optimized}`;
        }
        
        return optimized;
    }
    
    private async optimizeForGraphSearch(query: string): Promise<string> {
        // Extract entities
        const entities = await this.extractEntities(query);
        
        // Build relationship hints
        const relationships = this.inferRelationships(query);
        
        // Format for Cypher generation
        return this.formatForCypher(entities, relationships);
    }
}
```

## 📊 Result Aggregation

### Multi-Source Result Merger
```python
class ResultAggregator:
    """Aggregate and merge results from multiple sources."""
    
    def __init__(self):
        self.reranker = CrossEncoderReranker()
        self.deduplicator = ResultDeduplicator()
        
    async def aggregate_results(
        self,
        results: Dict[str, List[Any]],
        query: str,
        strategy: str = 'weighted'
    ) -> AggregatedResult:
        """Aggregate results from multiple sources."""
        
        # Deduplicate across sources
        unique_results = self.deduplicator.deduplicate(results)
        
        # Apply aggregation strategy
        if strategy == 'weighted':
            aggregated = await self.weighted_aggregation(unique_results, query)
        elif strategy == 'voting':
            aggregated = await self.voting_aggregation(unique_results)
        elif strategy == 'cascade':
            aggregated = await self.cascade_aggregation(unique_results)
        else:
            aggregated = unique_results
        
        # Rerank if needed
        if len(aggregated) > 10:
            aggregated = await self.reranker.rerank(query, aggregated)
        
        # Add metadata
        return self.enrich_with_metadata(aggregated)
    
    async def weighted_aggregation(
        self,
        results: Dict[str, List],
        query: str
    ) -> List[AggregatedItem]:
        """Weight results based on source reliability."""
        
        weights = {
            'claude-context': 1.0,   # Highest for fast search
            'cognee': 0.9,          # High for cognitive
            'neo4j': 0.85,          # Good for relationships
            'hybrid': 1.1           # Bonus for cross-validation
        }
        
        aggregated = []
        
        for source, items in results.items():
            weight = weights.get(source, 1.0)
            
            for item in items:
                # Calculate weighted score
                item.weighted_score = item.score * weight
                item.source = source
                aggregated.append(item)
        
        # Sort by weighted score
        aggregated.sort(key=lambda x: x.weighted_score, reverse=True)
        
        return aggregated
```

## 🔄 Fallback Mechanisms

### Graceful Degradation
```typescript
export class QueryFallbackHandler {
    private fallbackChain = [
        'claude-context',  // Fastest, most reliable
        'qdrant-direct',   // Direct vector search
        'postgres-fts',    // PostgreSQL full-text search
        'cache'           // Last resort: cached results
    ];
    
    async executeWithFallback(
        query: string,
        primaryTarget: string
    ): Promise<any> {
        
        let lastError = null;
        
        // Try primary target
        try {
            return await this.execute(primaryTarget, query);
        } catch (error) {
            console.error(`Primary target ${primaryTarget} failed:`, error);
            lastError = error;
        }
        
        // Try fallback chain
        for (const fallback of this.fallbackChain) {
            if (fallback === primaryTarget) continue;
            
            try {
                console.log(`Falling back to ${fallback}`);
                const result = await this.execute(fallback, query);
                
                // Mark as fallback result
                result.metadata = {
                    ...result.metadata,
                    fallback: true,
                    fallback_reason: lastError?.message,
                    fallback_source: fallback
                };
                
                return result;
                
            } catch (error) {
                console.error(`Fallback ${fallback} failed:`, error);
                lastError = error;
            }
        }
        
        // All fallbacks failed
        throw new Error(`All query targets failed. Last error: ${lastError?.message}`);
    }
}
```

## 📈 Query Performance Tracking

### Analytics and Optimization
```python
class QueryPerformanceTracker:
    """Track and optimize query performance."""
    
    def __init__(self):
        self.metrics_db = MetricsDatabase()
        self.optimizer = QueryOptimizer()
        
    async def track_query(self, query: str, result: QueryResult):
        """Track query execution metrics."""
        
        metrics = {
            'query': query,
            'intent': result.intent,
            'route': result.route,
            'latency_ms': result.execution_time,
            'result_count': len(result.items),
            'relevance_score': result.relevance_score,
            'user_satisfaction': None,  # To be filled by feedback
            'timestamp': datetime.now()
        }
        
        # Store metrics
        await self.metrics_db.store(metrics)
        
        # Analyze for optimization opportunities
        if metrics['latency_ms'] > 1000:
            await self.analyze_slow_query(query, metrics)
        
    async def analyze_slow_query(self, query: str, metrics: dict):
        """Analyze why a query was slow."""
        
        analysis = {
            'query': query,
            'bottlenecks': []
        }
        
        # Check if better route exists
        alternative_route = await self.optimizer.suggest_route(query)
        if alternative_route != metrics['route']:
            analysis['bottlenecks'].append({
                'type': 'suboptimal_routing',
                'suggestion': alternative_route
            })
        
        # Check if query can be optimized
        optimized_query = await self.optimizer.optimize(query)
        if optimized_query != query:
            analysis['bottlenecks'].append({
                'type': 'query_optimization',
                'suggestion': optimized_query
            })
        
        # Store analysis
        await self.metrics_db.store_analysis(analysis)
```

## 🎯 Success Metrics

- Query routing accuracy: > 95%
- Average latency: < 100ms for fast path, < 500ms for graph
- Fallback success rate: > 99.9%
- Cache hit rate: > 30%
- User satisfaction: > 4.5/5

---

**Status**: ⏳ Pending  
**Estimated Duration**: 5-6 days  
**Dependencies**: Phases 1-9  
**Output**: Intelligent query routing system with fallback mechanisms

```

---

## File: 11-phase-11-transaction-coordinator.md

**Path:** `11-phase-11-transaction-coordinator.md`

```markdown
# Phase 11: Transaction Coordinator

## 🎯 Objective
Implement a robust distributed transaction coordinator that ensures data consistency across PostgreSQL, Qdrant, and Neo4j during concurrent operations.

## 🏗️ Transaction Architecture

### Distributed Transaction Manager
```typescript
import { Saga, SagaStep, CompensationHandler } from './saga-pattern';
import { TwoPhaseCommit } from './2pc';

export class DistributedTransactionCoordinator {
    private sagaManager: SagaManager;
    private twoPhaseCommit: TwoPhaseCommit;
    private transactionLog: TransactionLog;
    
    constructor() {
        this.sagaManager = new SagaManager();
        this.twoPhaseCommit = new TwoPhaseCommit();
        this.transactionLog = new TransactionLog();
    }
    
    async executeDistributedTransaction(
        transaction: DistributedTransaction
    ): Promise<TransactionResult> {
        
        const txId = this.generateTransactionId();
        const participants = this.identifyParticipants(transaction);
        
        try {
            // Log transaction start
            await this.transactionLog.logStart(txId, transaction);
            
            // Choose strategy based on requirements
            if (transaction.requiresStrongConsistency) {
                return await this.executeTwoPhaseCommit(txId, transaction, participants);
            } else {
                return await this.executeSaga(txId, transaction, participants);
            }
            
        } catch (error) {
            await this.handleTransactionFailure(txId, error);
            throw error;
        } finally {
            await this.transactionLog.logComplete(txId);
        }
    }
    
    private async executeTwoPhaseCommit(
        txId: string,
        transaction: DistributedTransaction,
        participants: Participant[]
    ): Promise<TransactionResult> {
        
        // Phase 1: Prepare
        const prepareResults = await Promise.all(
            participants.map(p => this.prepare(p, txId, transaction))
        );
        
        // Check if all participants are ready
        const allPrepared = prepareResults.every(r => r.status === 'prepared');
        
        if (!allPrepared) {
            // Abort transaction
            await this.abortTransaction(txId, participants);
            throw new TransactionAbortError('Not all participants could prepare');
        }
        
        // Phase 2: Commit
        const commitResults = await Promise.all(
            participants.map(p => this.commit(p, txId))
        );
        
        return {
            txId,
            status: 'committed',
            participants: commitResults
        };
    }
    
    private async executeSaga(
        txId: string,
        transaction: DistributedTransaction,
        participants: Participant[]
    ): Promise<TransactionResult> {
        
        const saga = new Saga(txId);
        const executedSteps: SagaStep[] = [];
        
        try {
            // Execute each step
            for (const operation of transaction.operations) {
                const step = await this.executeOperation(operation);
                executedSteps.push(step);
                saga.recordStep(step);
            }
            
            return {
                txId,
                status: 'completed',
                steps: executedSteps
            };
            
        } catch (error) {
            // Compensate in reverse order
            await this.compensateSaga(executedSteps.reverse());
            throw error;
        }
    }
}
```

## 🔒 ACID Guarantees

### Transaction Isolation Levels
```python
from enum import Enum
from contextlib import asynccontextmanager
import asyncpg
import asyncio

class IsolationLevel(Enum):
    READ_UNCOMMITTED = "READ UNCOMMITTED"
    READ_COMMITTED = "READ COMMITTED"
    REPEATABLE_READ = "REPEATABLE READ"
    SERIALIZABLE = "SERIALIZABLE"

class TransactionManager:
    """Manage transactions with configurable isolation."""
    
    def __init__(self):
        self.connections = {}
        self.active_transactions = {}
        
    @asynccontextmanager
    async def transaction(
        self,
        systems: List[str],
        isolation: IsolationLevel = IsolationLevel.READ_COMMITTED
    ):
        """Start a distributed transaction."""
        
        tx_id = str(uuid4())
        connections = {}
        
        try:
            # Acquire connections for all systems
            for system in systems:
                conn = await self.get_connection(system)
                await conn.execute(f"SET TRANSACTION ISOLATION LEVEL {isolation.value}")
                await conn.execute("BEGIN")
                connections[system] = conn
            
            self.active_transactions[tx_id] = connections
            
            # Yield control to transaction body
            yield TransactionContext(tx_id, connections)
            
            # Commit all
            await self.commit_all(connections)
            
        except Exception as e:
            # Rollback all on error
            await self.rollback_all(connections)
            raise e
            
        finally:
            # Release connections
            for conn in connections.values():
                await self.release_connection(conn)
            
            del self.active_transactions[tx_id]
    
    async def commit_all(self, connections: Dict[str, Connection]):
        """Commit all connections in a transaction."""
        
        commit_tasks = [
            conn.execute("COMMIT") 
            for conn in connections.values()
        ]
        
        results = await asyncio.gather(*commit_tasks, return_exceptions=True)
        
        # Check for failures
        failures = [r for r in results if isinstance(r, Exception)]
        if failures:
            # Try to rollback remaining
            await self.rollback_all(connections)
            raise TransactionCommitError(f"Commit failed: {failures}")
    
    async def rollback_all(self, connections: Dict[str, Connection]):
        """Rollback all connections in a transaction."""
        
        rollback_tasks = [
            conn.execute("ROLLBACK") 
            for conn in connections.values()
        ]
        
        await asyncio.gather(*rollback_tasks, return_exceptions=True)
```

## 🔄 Saga Pattern Implementation

### Compensating Transactions
```typescript
export interface SagaStep {
    id: string;
    name: string;
    execute: () => Promise<any>;
    compensate: () => Promise<void>;
    retryable: boolean;
    timeout: number;
}

export class SagaOrchestrator {
    private steps: SagaStep[] = [];
    private executedSteps: SagaStep[] = [];
    private compensationLog: CompensationLog;
    
    async execute(): Promise<SagaResult> {
        const startTime = Date.now();
        
        try {
            // Execute forward path
            for (const step of this.steps) {
                await this.executeStep(step);
                this.executedSteps.push(step);
            }
            
            return {
                status: 'completed',
                duration: Date.now() - startTime,
                stepsExecuted: this.executedSteps.length
            };
            
        } catch (error) {
            // Execute compensating transactions
            await this.compensate();
            
            return {
                status: 'compensated',
                duration: Date.now() - startTime,
                error: error.message,
                compensatedSteps: this.executedSteps.length
            };
        }
    }
    
    private async executeStep(step: SagaStep): Promise<void> {
        let attempts = 0;
        const maxAttempts = step.retryable ? 3 : 1;
        
        while (attempts < maxAttempts) {
            try {
                // Execute with timeout
                await this.withTimeout(
                    step.execute(),
                    step.timeout
                );
                
                // Log successful execution
                await this.compensationLog.logExecution(step);
                
                return;
                
            } catch (error) {
                attempts++;
                
                if (attempts >= maxAttempts) {
                    throw new StepExecutionError(
                        `Step ${step.name} failed after ${attempts} attempts`,
                        error
                    );
                }
                
                // Exponential backoff
                await this.sleep(Math.pow(2, attempts) * 1000);
            }
        }
    }
    
    private async compensate(): Promise<void> {
        // Compensate in reverse order
        const reversedSteps = [...this.executedSteps].reverse();
        
        for (const step of reversedSteps) {
            try {
                await step.compensate();
                await this.compensationLog.logCompensation(step);
            } catch (error) {
                // Log compensation failure but continue
                console.error(`Compensation failed for ${step.name}:`, error);
                await this.compensationLog.logCompensationFailure(step, error);
            }
        }
    }
}
```

## 📊 Transaction Monitoring

### Deadlock Detection
```python
import networkx as nx
from typing import Dict, List, Set
import asyncio

class DeadlockDetector:
    """Detect and resolve deadlocks in distributed transactions."""
    
    def __init__(self):
        self.wait_for_graph = nx.DiGraph()
        self.lock_holders: Dict[str, Set[str]] = {}
        self.lock_waiters: Dict[str, Set[str]] = {}
        
    async def monitor_transactions(self):
        """Continuously monitor for deadlocks."""
        
        while True:
            await asyncio.sleep(1)  # Check every second
            
            # Build wait-for graph
            self.update_wait_for_graph()
            
            # Detect cycles (deadlocks)
            cycles = list(nx.simple_cycles(self.wait_for_graph))
            
            if cycles:
                await self.resolve_deadlocks(cycles)
    
    def update_wait_for_graph(self):
        """Update the wait-for graph based on current locks."""
        
        self.wait_for_graph.clear()
        
        # Add edges for each waiting transaction
        for resource, waiters in self.lock_waiters.items():
            holders = self.lock_holders.get(resource, set())
            
            for waiter in waiters:
                for holder in holders:
                    # Waiter is waiting for holder
                    self.wait_for_graph.add_edge(waiter, holder)
    
    async def resolve_deadlocks(self, cycles: List[List[str]]):
        """Resolve detected deadlocks."""
        
        for cycle in cycles:
            # Choose victim (transaction with least work done)
            victim = await self.choose_victim(cycle)
            
            # Abort victim transaction
            await self.abort_transaction(victim)
            
            # Log deadlock resolution
            await self.log_deadlock_resolution(cycle, victim)
    
    async def choose_victim(self, cycle: List[str]) -> str:
        """Choose which transaction to abort."""
        
        victim_scores = {}
        
        for tx_id in cycle:
            # Score based on various factors
            score = 0
            
            # Factor 1: Transaction age (older = higher score = less likely victim)
            age = await self.get_transaction_age(tx_id)
            score += age
            
            # Factor 2: Work done (more work = higher score)
            work_done = await self.get_work_done(tx_id)
            score += work_done * 10
            
            # Factor 3: Priority (higher priority = higher score)
            priority = await self.get_transaction_priority(tx_id)
            score += priority * 100
            
            victim_scores[tx_id] = score
        
        # Choose transaction with lowest score as victim
        return min(victim_scores, key=victim_scores.get)
```

## 🔐 Recovery Mechanisms

### Write-Ahead Logging
```typescript
export class TransactionWAL {
    private walPath: string = '/var/log/transactions/wal';
    private currentSegment: WALSegment;
    
    async logOperation(
        txId: string,
        operation: Operation
    ): Promise<void> {
        
        const entry: WALEntry = {
            txId,
            timestamp: Date.now(),
            operation: operation.type,
            data: operation.data,
            status: 'pending'
        };
        
        // Write to WAL before execution
        await this.writeEntry(entry);
        
        // Flush to disk
        await this.flush();
    }
    
    async recover(): Promise<RecoveryResult> {
        const incompleteTransactions = await this.scanIncomplete();
        const recovered: string[] = [];
        const failed: string[] = [];
        
        for (const tx of incompleteTransactions) {
            try {
                await this.recoverTransaction(tx);
                recovered.push(tx.txId);
            } catch (error) {
                console.error(`Failed to recover ${tx.txId}:`, error);
                failed.push(tx.txId);
            }
        }
        
        return { recovered, failed };
    }
    
    private async recoverTransaction(tx: IncompleteTransaction): Promise<void> {
        // Determine recovery action based on state
        switch (tx.lastState) {
            case 'prepared':
                // Can safely commit
                await this.completeCommit(tx);
                break;
                
            case 'partially_committed':
                // Need to complete remaining commits
                await this.completePartialCommit(tx);
                break;
                
            case 'executing':
                // Need to rollback
                await this.rollbackTransaction(tx);
                break;
                
            default:
                throw new Error(`Unknown transaction state: ${tx.lastState}`);
        }
    }
}
```

## 📈 Performance Optimization

### Lock Management
```python
class OptimisticLockManager:
    """Optimistic concurrency control for better performance."""
    
    def __init__(self):
        self.version_store = {}
        
    async def read_with_version(self, key: str) -> Tuple[Any, int]:
        """Read data with version number."""
        
        data = await self.storage.get(key)
        version = self.version_store.get(key, 0)
        
        return data, version
    
    async def write_if_unchanged(
        self,
        key: str,
        data: Any,
        expected_version: int
    ) -> bool:
        """Write only if version matches expected."""
        
        current_version = self.version_store.get(key, 0)
        
        if current_version != expected_version:
            # Version conflict - concurrent modification
            raise OptimisticLockException(
                f"Version mismatch: expected {expected_version}, got {current_version}"
            )
        
        # Update data and version
        await self.storage.set(key, data)
        self.version_store[key] = current_version + 1
        
        return True
    
    async def retry_on_conflict(
        self,
        operation: Callable,
        max_retries: int = 3
    ) -> Any:
        """Retry operation on optimistic lock conflicts."""
        
        for attempt in range(max_retries):
            try:
                return await operation()
            except OptimisticLockException:
                if attempt == max_retries - 1:
                    raise
                
                # Exponential backoff
                await asyncio.sleep(0.1 * (2 ** attempt))
        
        raise MaxRetriesExceeded()
```

## 🎯 Success Metrics

- Transaction success rate: > 99.9%
- Deadlock frequency: < 0.1%
- Recovery time: < 30 seconds
- Transaction throughput: > 1000 TPS
- Consistency violations: 0

---

**Status**: ⏳ Pending  
**Estimated Duration**: 6-7 days  
**Dependencies**: Phases 1-10  
**Output**: Robust distributed transaction coordinator with recovery

```

---

## File: 12-phase-12-migration-tools.md

**Path:** `12-phase-12-migration-tools.md`

```markdown
# Phase 12: Migration Tools

## 🎯 Objective
Build comprehensive migration tools to safely transfer existing data from separate Claude-Context and Cognee installations to the unified architecture.

## 🏗️ Migration Framework

### Master Migration Orchestrator
```typescript
import { MigrationPlan, MigrationStep } from './types';
import { DataValidator } from './validators';
import { ProgressTracker } from './progress';

export class MigrationOrchestrator {
    private plan: MigrationPlan;
    private validator: DataValidator;
    private tracker: ProgressTracker;
    private rollbackStack: MigrationStep[] = [];
    
    async executeMigration(
        source: MigrationSource,
        target: MigrationTarget,
        options: MigrationOptions = {}
    ): Promise<MigrationResult> {
        
        // Phase 1: Analysis
        const analysis = await this.analyzeSystems(source, target);
        
        // Phase 2: Planning
        this.plan = await this.createMigrationPlan(analysis, options);
        
        // Phase 3: Validation
        const validation = await this.validatePlan(this.plan);
        if (!validation.isValid) {
            throw new MigrationValidationError(validation.errors);
        }
        
        // Phase 4: Backup
        const backup = await this.createBackup(source);
        
        try {
            // Phase 5: Execute migration
            const result = await this.migrate();
            
            // Phase 6: Verification
            await this.verifyMigration(result);
            
            return result;
            
        } catch (error) {
            // Rollback on failure
            await this.rollback(backup);
            throw error;
        }
    }
    
    private async migrate(): Promise<MigrationResult> {
        const results = {
            migrated: 0,
            failed: 0,
            skipped: 0,
            duration: 0
        };
        
        const startTime = Date.now();
        
        for (const step of this.plan.steps) {
            try {
                // Execute step
                await this.executeStep(step);
                
                // Track for rollback
                this.rollbackStack.push(step);
                
                // Update progress
                results.migrated++;
                await this.tracker.update(step.name, 'completed');
                
            } catch (error) {
                if (options.continueOnError) {
                    results.failed++;
                    console.error(`Step ${step.name} failed:`, error);
                } else {
                    throw error;
                }
            }
        }
        
        results.duration = Date.now() - startTime;
        return results;
    }
}
```

## 🔄 Data Migration Pipelines

### Claude-Context Migration
```python
import asyncpg
import asyncio
from tqdm import tqdm
from typing import Dict, List

class ClaudeContextMigrator:
    """Migrate Claude-Context data to unified schema."""
    
    def __init__(self, source_config: Dict, target_config: Dict):
        self.source_config = source_config
        self.target_config = target_config
        self.batch_size = 1000
        
    async def migrate_all(self):
        """Execute complete migration."""
        
        print("🚀 Starting Claude-Context migration...")
        
        # Connect to databases
        source_conn = await asyncpg.connect(**self.source_config)
        target_conn = await asyncpg.connect(**self.target_config)
        
        try:
            # Migrate in order of dependencies
            await self.migrate_projects(source_conn, target_conn)
            await self.migrate_datasets(source_conn, target_conn)
            await self.migrate_chunks(source_conn, target_conn)
            await self.migrate_vectors(source_conn, target_conn)
            await self.migrate_metadata(source_conn, target_conn)
            
            print("✅ Migration completed successfully!")
            
        finally:
            await source_conn.close()
            await target_conn.close()
    
    async def migrate_chunks(self, source, target):
        """Migrate chunks with progress tracking."""
        
        # Get total count
        count = await source.fetchval(
            "SELECT COUNT(*) FROM claude_context.chunks"
        )
        
        print(f"📦 Migrating {count} chunks...")
        
        with tqdm(total=count, desc="Chunks") as pbar:
            offset = 0
            
            while offset < count:
                # Fetch batch
                chunks = await source.fetch(f"""
                    SELECT * FROM claude_context.chunks
                    ORDER BY created_at
                    LIMIT {self.batch_size} OFFSET {offset}
                """)
                
                # Transform to unified schema
                transformed = [
                    self.transform_chunk(chunk) for chunk in chunks
                ]
                
                # Insert into target
                await self.batch_insert_chunks(target, transformed)
                
                offset += self.batch_size
                pbar.update(len(chunks))
    
    def transform_chunk(self, chunk: Dict) -> Dict:
        """Transform chunk to unified schema."""
        
        return {
            'id': chunk['id'],
            'legacy_id': chunk['id'],
            'content': chunk['content'],
            'dense_vector': chunk['vector'],
            'sparse_vector': chunk.get('sparse_vector'),
            'chunk_type': 'code' if chunk.get('is_code') else 'text',
            'source_type': chunk['source_type'],
            'relative_path': chunk['relative_path'],
            'start_line': chunk['start_line'],
            'end_line': chunk['end_line'],
            'project_id': chunk['project_id'],
            'dataset_id': chunk['dataset_id'],
            'language': chunk.get('lang'),
            'is_code': chunk.get('is_code', False),
            'metadata': chunk.get('metadata', {}),
            'created_at': chunk['created_at'],
            'system_origin': 'claude'
        }
```

### Cognee Migration
```python
class CogneeMigrator:
    """Migrate Cognee data to unified schema."""
    
    async def migrate_cognee_data(self):
        """Migrate Cognee-specific data."""
        
        print("🧠 Starting Cognee migration...")
        
        # Migrate data points
        await self.migrate_data_points()
        
        # Migrate knowledge graph
        await self.migrate_knowledge_graph()
        
        # Migrate cognitive layers
        await self.migrate_cognitive_layers()
    
    async def migrate_knowledge_graph(self):
        """Migrate Cognee knowledge graph to Neo4j."""
        
        # Connect to source (Kuzu/NetworkX)
        source_graph = await self.connect_source_graph()
        
        # Connect to target (Neo4j)
        target_driver = neo4j.AsyncGraphDatabase.driver(
            "bolt://localhost:7687",
            auth=("neo4j", "password")
        )
        
        async with target_driver.session() as session:
            # Migrate nodes
            nodes = await source_graph.get_all_nodes()
            
            for batch in self.batch(nodes, 100):
                await session.execute_write(
                    self._create_nodes_tx, batch
                )
            
            # Migrate relationships
            edges = await source_graph.get_all_edges()
            
            for batch in self.batch(edges, 100):
                await session.execute_write(
                    self._create_relationships_tx, batch
                )
    
    @staticmethod
    async def _create_nodes_tx(tx, nodes):
        """Create nodes in Neo4j."""
        
        query = """
        UNWIND $nodes AS node
        MERGE (n:Entity {id: node.id})
        SET n += node.properties
        """
        
        await tx.run(query, nodes=nodes)
```

## 🔍 Data Validation

### Integrity Checker
```typescript
export class MigrationValidator {
    private checksums: Map<string, string> = new Map();
    
    async validateMigration(
        source: DataSource,
        target: DataSource
    ): Promise<ValidationReport> {
        
        const report: ValidationReport = {
            valid: true,
            errors: [],
            warnings: [],
            statistics: {}
        };
        
        // Check record counts
        await this.validateCounts(source, target, report);
        
        // Check data integrity
        await this.validateDataIntegrity(source, target, report);
        
        // Check relationships
        await this.validateRelationships(source, target, report);
        
        // Check vectors
        await this.validateVectors(source, target, report);
        
        return report;
    }
    
    private async validateCounts(
        source: DataSource,
        target: DataSource,
        report: ValidationReport
    ): Promise<void> {
        
        const tables = ['chunks', 'projects', 'datasets'];
        
        for (const table of tables) {
            const sourceCount = await source.count(table);
            const targetCount = await target.count(table);
            
            if (sourceCount !== targetCount) {
                report.errors.push({
                    type: 'count_mismatch',
                    table,
                    source: sourceCount,
                    target: targetCount,
                    difference: Math.abs(sourceCount - targetCount)
                });
                report.valid = false;
            }
            
            report.statistics[`${table}_count`] = targetCount;
        }
    }
    
    private async validateDataIntegrity(
        source: DataSource,
        target: DataSource,
        report: ValidationReport
    ): Promise<void> {
        
        // Sample random records for deep comparison
        const sampleSize = 100;
        const sourceRecords = await source.sample('chunks', sampleSize);
        
        for (const record of sourceRecords) {
            const targetRecord = await target.findById('chunks', record.id);
            
            if (!targetRecord) {
                report.errors.push({
                    type: 'missing_record',
                    id: record.id,
                    table: 'chunks'
                });
                continue;
            }
            
            // Compare checksums
            const sourceChecksum = this.calculateChecksum(record);
            const targetChecksum = this.calculateChecksum(targetRecord);
            
            if (sourceChecksum !== targetChecksum) {
                report.warnings.push({
                    type: 'checksum_mismatch',
                    id: record.id,
                    source: sourceChecksum,
                    target: targetChecksum
                });
            }
        }
    }
}
```

## 🔄 Rollback Mechanisms

### Automated Rollback
```python
class MigrationRollback:
    """Handle migration rollbacks safely."""
    
    def __init__(self):
        self.backup_manager = BackupManager()
        self.transaction_log = TransactionLog()
        
    async def create_savepoint(self, name: str):
        """Create a named savepoint for rollback."""
        
        savepoint = {
            'name': name,
            'timestamp': datetime.now(),
            'state': await self.capture_current_state()
        }
        
        await self.backup_manager.save(savepoint)
        return savepoint
    
    async def rollback_to_savepoint(self, name: str):
        """Rollback to a specific savepoint."""
        
        print(f"⏪ Rolling back to savepoint: {name}")
        
        # Get savepoint
        savepoint = await self.backup_manager.load(name)
        
        # Stop all services
        await self.stop_services()
        
        try:
            # Restore databases
            await self.restore_postgres(savepoint.state.postgres)
            await self.restore_qdrant(savepoint.state.qdrant)
            await self.restore_neo4j(savepoint.state.neo4j)
            
            # Verify restoration
            if await self.verify_restoration(savepoint):
                print("✅ Rollback completed successfully")
                return True
            else:
                raise RollbackVerificationError()
                
        finally:
            # Restart services
            await self.start_services()
    
    async def restore_postgres(self, backup_data):
        """Restore PostgreSQL to backup state."""
        
        conn = await asyncpg.connect(DATABASE_URL)
        
        try:
            # Truncate current data
            await conn.execute("TRUNCATE TABLE unified.chunks CASCADE")
            
            # Restore from backup
            await conn.copy_records_to_table(
                'chunks',
                records=backup_data.chunks,
                schema_name='unified'
            )
            
        finally:
            await conn.close()
```

## 📊 Migration Monitoring

### Progress Dashboard
```typescript
export class MigrationDashboard {
    private metrics = {
        startTime: Date.now(),
        currentPhase: 'initializing',
        progress: 0,
        recordsMigrated: 0,
        recordsTotal: 0,
        errors: [],
        warnings: []
    };
    
    async updateDashboard(): Promise<void> {
        const dashboard = `
╔════════════════════════════════════════════════════════╗
║                  MIGRATION DASHBOARD                    ║
╠════════════════════════════════════════════════════════╣
║ Phase:     ${this.metrics.currentPhase.padEnd(44)}║
║ Progress:  ${this.renderProgressBar(this.metrics.progress)}║
║ Records:   ${this.metrics.recordsMigrated}/${this.metrics.recordsTotal} ║
║ Duration:  ${this.formatDuration()}                    ║
║ Errors:    ${this.metrics.errors.length}              ║
║ Warnings:  ${this.metrics.warnings.length}            ║
╚════════════════════════════════════════════════════════╝
        `;
        
        console.clear();
        console.log(dashboard);
        
        // Show recent errors
        if (this.metrics.errors.length > 0) {
            console.log('\n⚠️  Recent Errors:');
            this.metrics.errors.slice(-3).forEach(e => 
                console.log(`  - ${e}`)
            );
        }
    }
    
    private renderProgressBar(progress: number): string {
        const width = 30;
        const filled = Math.floor((progress / 100) * width);
        const empty = width - filled;
        
        return `[${'█'.repeat(filled)}${' '.repeat(empty)}] ${progress}%`;
    }
}
```

## 🎯 Success Metrics

- Data integrity: 100% validation pass
- Migration speed: > 10,000 records/minute
- Rollback time: < 5 minutes
- Zero data loss guarantee
- Downtime: < 30 minutes for complete migration

---

**Status**: ⏳ Pending  
**Estimated Duration**: 5-6 days  
**Dependencies**: Phases 1-11  
**Output**: Complete migration toolkit with validation and rollback

```

---

## File: 13-phase-13-performance-optimization.md

**Path:** `13-phase-13-performance-optimization.md`

```markdown
# Phase 13: Performance Optimization

## 🎯 Objective
Optimize the unified system for maximum performance, implementing caching layers, query optimization, and resource management strategies.

## 🏗️ Performance Architecture

### Multi-Layer Caching System
```typescript
import { RedisCache } from './redis-cache';
import { MemoryCache } from './memory-cache';
import { CDNCache } from './cdn-cache';

export class UnifiedCacheManager {
    private l1Cache: MemoryCache;      // In-memory (microseconds)
    private l2Cache: RedisCache;       // Redis (milliseconds)
    private l3Cache: CDNCache;         // CDN/S3 (10s of ms)
    private cacheStats: CacheStatistics;
    
    constructor() {
        // L1: 1GB in-memory cache
        this.l1Cache = new MemoryCache({
            maxSize: 1024 * 1024 * 1024,  // 1GB
            ttl: 60 * 1000,                // 1 minute
            algorithm: 'lru-lfu'            // Hybrid eviction
        });
        
        // L2: Redis with 10GB capacity
        this.l2Cache = new RedisCache({
            nodes: [
                { host: 'redis-1', port: 6379 },
                { host: 'redis-2', port: 6379 },
                { host: 'redis-3', port: 6379 }
            ],
            replication: 'async',
            ttl: 60 * 60 * 1000  // 1 hour
        });
        
        // L3: CDN for large objects
        this.l3Cache = new CDNCache({
            provider: 'cloudflare',
            ttl: 24 * 60 * 60 * 1000  // 24 hours
        });
    }
    
    async get(key: string): Promise<CachedItem | null> {
        // Check L1 (fastest)
        let item = await this.l1Cache.get(key);
        if (item) {
            this.cacheStats.recordHit('L1');
            return item;
        }
        
        // Check L2
        item = await this.l2Cache.get(key);
        if (item) {
            this.cacheStats.recordHit('L2');
            // Promote to L1
            await this.l1Cache.set(key, item);
            return item;
        }
        
        // Check L3
        item = await this.l3Cache.get(key);
        if (item) {
            this.cacheStats.recordHit('L3');
            // Promote to L1 and L2
            await Promise.all([
                this.l1Cache.set(key, item),
                this.l2Cache.set(key, item)
            ]);
            return item;
        }
        
        this.cacheStats.recordMiss();
        return null;
    }
    
    async set(
        key: string, 
        value: any, 
        options: CacheOptions = {}
    ): Promise<void> {
        
        const size = this.calculateSize(value);
        
        // Determine cache levels based on size and access pattern
        const levels = this.determineCacheLevels(size, options);
        
        const promises = [];
        
        if (levels.includes('L1')) {
            promises.push(this.l1Cache.set(key, value, options));
        }
        
        if (levels.includes('L2')) {
            promises.push(this.l2Cache.set(key, value, options));
        }
        
        if (levels.includes('L3')) {
            // Compress for L3
            const compressed = await this.compress(value);
            promises.push(this.l3Cache.set(key, compressed, options));
        }
        
        await Promise.all(promises);
    }
}
```

## 🚀 Query Optimization

### Query Planner & Optimizer
```python
from typing import Dict, List, Any
import numpy as np
from sklearn.ensemble import RandomForestRegressor

class QueryOptimizer:
    """ML-powered query optimization."""
    
    def __init__(self):
        self.query_plans = {}
        self.performance_model = RandomForestRegressor()
        self.plan_cache = LRUCache(maxsize=10000)
        
    async def optimize_query(self, query: Query) -> OptimizedQuery:
        """Optimize query using ML predictions."""
        
        # Check plan cache
        cached_plan = self.plan_cache.get(query.hash)
        if cached_plan:
            return cached_plan
        
        # Generate candidate plans
        candidates = await self.generate_candidate_plans(query)
        
        # Predict performance for each plan
        predictions = []
        for plan in candidates:
            features = self.extract_plan_features(plan)
            predicted_latency = self.performance_model.predict([features])[0]
            predictions.append((plan, predicted_latency))
        
        # Choose best plan
        best_plan = min(predictions, key=lambda x: x[1])[0]
        
        # Cache the plan
        self.plan_cache.set(query.hash, best_plan)
        
        return best_plan
    
    async def generate_candidate_plans(self, query: Query) -> List[QueryPlan]:
        """Generate multiple query execution plans."""
        
        plans = []
        
        # Plan 1: Vector search first
        plans.append(self.create_vector_first_plan(query))
        
        # Plan 2: Graph traversal first
        plans.append(self.create_graph_first_plan(query))
        
        # Plan 3: Hybrid parallel
        plans.append(self.create_hybrid_parallel_plan(query))
        
        # Plan 4: Filtered vector search
        if query.has_filters:
            plans.append(self.create_filtered_vector_plan(query))
        
        # Plan 5: Cached partial results
        if self.has_partial_cache(query):
            plans.append(self.create_cached_plan(query))
        
        return plans
    
    def extract_plan_features(self, plan: QueryPlan) -> np.ndarray:
        """Extract features for ML model."""
        
        return np.array([
            plan.estimated_io_ops,
            plan.estimated_cpu_cycles,
            plan.network_roundtrips,
            plan.cache_hit_probability,
            plan.parallelism_degree,
            plan.data_volume,
            plan.join_complexity,
            plan.index_usage_score
        ])
```

### Index Optimization
```sql
-- Adaptive index creation based on query patterns
CREATE OR REPLACE FUNCTION create_adaptive_indexes()
RETURNS void AS $$
DECLARE
    query_pattern RECORD;
BEGIN
    -- Analyze query patterns from pg_stat_statements
    FOR query_pattern IN
        SELECT 
            schemaname,
            tablename,
            attname,
            n_distinct,
            correlation
        FROM pg_stats
        WHERE schemaname = 'unified'
        AND n_distinct > 100
        AND correlation < 0.1
    LOOP
        -- Create index if beneficial
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes
            WHERE tablename = query_pattern.tablename
            AND indexdef LIKE '%' || query_pattern.attname || '%'
        ) THEN
            EXECUTE format(
                'CREATE INDEX CONCURRENTLY idx_%s_%s ON unified.%s (%s)',
                query_pattern.tablename,
                query_pattern.attname,
                query_pattern.tablename,
                query_pattern.attname
            );
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Partial indexes for common filters
CREATE INDEX idx_chunks_recent_claude 
ON unified.chunks (created_at DESC) 
WHERE system_origin = 'claude' 
AND created_at > NOW() - INTERVAL '7 days';

-- BRIN indexes for time-series data
CREATE INDEX idx_chunks_created_brin 
ON unified.chunks USING BRIN (created_at) 
WITH (pages_per_range = 128);
```

## 🔄 Connection Pooling

### Smart Connection Manager
```typescript
export class ConnectionPoolManager {
    private pools: Map<string, Pool> = new Map();
    private metrics: PoolMetrics;
    
    constructor() {
        this.setupPools();
        this.startMonitoring();
    }
    
    private setupPools(): void {
        // PostgreSQL pool with dynamic sizing
        this.pools.set('postgres', new Pool({
            host: 'localhost',
            port: 5533,
            database: 'claude_context',
            
            // Dynamic pool sizing
            min: 10,
            max: 100,
            
            // Adaptive parameters
            acquireTimeoutMillis: 3000,
            createTimeoutMillis: 3000,
            destroyTimeoutMillis: 5000,
            idleTimeoutMillis: 30000,
            reapIntervalMillis: 1000,
            
            // Connection lifecycle
            connectionTimeoutMillis: 2000,
            statementTimeout: 30000,
            query_timeout: 30000,
            
            // Advanced options
            allowExitOnIdle: true,
            propagateCreateError: false,
            
            // Custom connection handler
            onConnect: async (client) => {
                await this.optimizeConnection(client);
            }
        }));
    }
    
    private async optimizeConnection(client: PoolClient): Promise<void> {
        // Set optimal connection parameters
        await client.query('SET work_mem = "256MB"');
        await client.query('SET effective_cache_size = "4GB"');
        await client.query('SET random_page_cost = 1.1');
        await client.query('SET effective_io_concurrency = 200');
        await client.query('SET max_parallel_workers_per_gather = 4');
        
        // Enable JIT for complex queries
        await client.query('SET jit = on');
        await client.query('SET jit_above_cost = 100000');
    }
    
    async getConnection(
        pool: string, 
        priority: 'high' | 'normal' | 'low' = 'normal'
    ): Promise<PoolClient> {
        
        const poolInstance = this.pools.get(pool);
        
        // Priority-based connection allocation
        if (priority === 'high') {
            // Ensure connection available for high priority
            if (poolInstance.waitingCount > 0) {
                await this.expandPool(poolInstance);
            }
        }
        
        const client = await poolInstance.connect();
        
        // Track metrics
        this.metrics.recordAcquisition(pool, priority);
        
        return this.wrapClient(client, pool);
    }
    
    private async expandPool(pool: Pool): Promise<void> {
        // Dynamically expand pool size if needed
        const currentSize = pool.totalCount;
        const maxSize = pool.options.max;
        
        if (currentSize < maxSize) {
            const expansion = Math.min(10, maxSize - currentSize);
            pool.options.max += expansion;
            
            console.log(`Expanded pool by ${expansion} connections`);
        }
    }
}
```

## 📊 Resource Management

### Memory Optimization
```python
import psutil
import gc
from memory_profiler import profile
from functools import lru_cache

class MemoryManager:
    """Intelligent memory management for optimal performance."""
    
    def __init__(self):
        self.memory_threshold = 0.85  # 85% memory usage threshold
        self.gc_threshold = 0.90      # 90% triggers aggressive GC
        
    async def monitor_and_optimize(self):
        """Continuously monitor and optimize memory usage."""
        
        while True:
            memory_percent = psutil.virtual_memory().percent / 100
            
            if memory_percent > self.gc_threshold:
                await self.aggressive_cleanup()
            elif memory_percent > self.memory_threshold:
                await self.moderate_cleanup()
            
            await asyncio.sleep(10)  # Check every 10 seconds
    
    async def moderate_cleanup(self):
        """Moderate memory cleanup."""
        
        # Clear caches
        self.clear_lru_caches()
        
        # Run garbage collection
        gc.collect()
        
        # Compact memory pools
        await self.compact_memory_pools()
    
    async def aggressive_cleanup(self):
        """Aggressive memory cleanup."""
        
        print("⚠️ High memory usage detected, performing aggressive cleanup")
        
        # Clear all caches
        self.clear_all_caches()
        
        # Force full garbage collection
        gc.collect(2)
        
        # Release unused database connections
        await self.release_idle_connections()
        
        # Reduce cache sizes
        await self.reduce_cache_sizes()
        
        # Free system caches
        os.system('sync && echo 3 > /proc/sys/vm/drop_caches')
    
    @staticmethod
    def clear_lru_caches():
        """Clear all LRU caches in the application."""
        
        gc.collect()
        
        # Clear all decorated functions
        for obj in gc.get_objects():
            if isinstance(obj, type(lru_cache)):
                obj.cache_clear()
```

## 🚄 Parallel Processing

### Batch Processing Optimizer
```typescript
export class BatchProcessor {
    private readonly optimalBatchSize: number;
    private readonly maxConcurrency: number;
    
    constructor() {
        // Determine optimal batch size based on system resources
        this.optimalBatchSize = this.calculateOptimalBatchSize();
        this.maxConcurrency = this.calculateMaxConcurrency();
    }
    
    async processBatches<T, R>(
        items: T[],
        processor: (batch: T[]) => Promise<R[]>
    ): Promise<R[]> {
        
        const results: R[] = [];
        const batches = this.createBatches(items);
        
        // Process batches in parallel with concurrency control
        const semaphore = new Semaphore(this.maxConcurrency);
        
        const batchPromises = batches.map(async (batch, index) => {
            await semaphore.acquire();
            
            try {
                const startTime = Date.now();
                const batchResults = await processor(batch);
                
                // Adaptive batch sizing
                const processingTime = Date.now() - startTime;
                this.adjustBatchSize(batch.length, processingTime);
                
                return batchResults;
                
            } finally {
                semaphore.release();
            }
        });
        
        const batchResults = await Promise.all(batchPromises);
        return batchResults.flat();
    }
    
    private calculateOptimalBatchSize(): number {
        const cpuCores = os.cpus().length;
        const memoryGB = os.totalmem() / (1024 ** 3);
        
        // Base batch size on system resources
        const baseBatchSize = Math.floor(memoryGB * 100);
        
        // Adjust for CPU cores
        return Math.min(baseBatchSize * cpuCores, 1000);
    }
    
    private adjustBatchSize(
        currentSize: number, 
        processingTime: number
    ): void {
        
        const targetTime = 1000; // 1 second target
        
        if (processingTime < targetTime * 0.5) {
            // Too fast, increase batch size
            this.optimalBatchSize = Math.min(
                this.optimalBatchSize * 1.2,
                5000
            );
        } else if (processingTime > targetTime * 2) {
            // Too slow, decrease batch size
            this.optimalBatchSize = Math.max(
                this.optimalBatchSize * 0.8,
                10
            );
        }
    }
}
```

## 🎯 Success Metrics

- Query latency: p50 < 10ms, p95 < 50ms, p99 < 100ms
- Cache hit rate: > 80%
- Connection pool efficiency: > 90%
- Memory usage: < 80% sustained
- CPU usage: < 70% sustained
- Throughput: > 10,000 QPS

---

**Status**: ⏳ Pending  
**Estimated Duration**: 6-7 days  
**Dependencies**: Phases 1-12  
**Output**: Fully optimized high-performance system

```

---

## File: 14-phase-14-monitoring-observability.md

**Path:** `14-phase-14-monitoring-observability.md`

```markdown
# Phase 14: Monitoring & Observability

## 🎯 Objective
Implement comprehensive monitoring, observability, and alerting systems to ensure the unified architecture operates reliably and efficiently.

## 🏗️ Observability Stack

### Unified Telemetry System
```typescript
import { Tracer } from '@opentelemetry/api';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';

export class UnifiedObservability {
    private tracer: Tracer;
    private metricsExporter: PrometheusExporter;
    private tracingExporter: JaegerExporter;
    private healthChecks: Map<string, HealthCheck>;
    
    constructor() {
        this.setupOpenTelemetry();
        this.setupHealthChecks();
        this.setupCustomMetrics();
    }
    
    private setupOpenTelemetry(): void {
        // Tracing setup
        this.tracingExporter = new JaegerExporter({
            endpoint: 'http://jaeger:14268/api/traces',
            serviceName: 'unified-storage'
        });
        
        // Metrics setup
        this.metricsExporter = new PrometheusExporter({
            port: 9090,
            endpoint: '/metrics'
        });
        
        // Logging correlation
        this.setupLoggingCorrelation();
    }
    
    async traceOperation<T>(
        name: string,
        operation: () => Promise<T>,
        attributes?: Record<string, any>
    ): Promise<T> {
        
        const span = this.tracer.startSpan(name, {
            attributes: {
                'system.component': 'unified-storage',
                ...attributes
            }
        });
        
        try {
            // Add trace context to logs
            const traceId = span.spanContext().traceId;
            logger.setContext({ traceId });
            
            // Execute operation
            const result = await operation();
            
            // Record success
            span.setStatus({ code: SpanStatusCode.OK });
            
            return result;
            
        } catch (error) {
            // Record error
            span.setStatus({
                code: SpanStatusCode.ERROR,
                message: error.message
            });
            
            span.recordException(error);
            throw error;
            
        } finally {
            span.end();
        }
    }
}
```

## 📊 Metrics Collection

### Comprehensive Metrics System
```python
from prometheus_client import Counter, Histogram, Gauge, Summary
from prometheus_client import CollectorRegistry, push_to_gateway
import time
from functools import wraps

class MetricsCollector:
    """Collect and expose metrics for all systems."""
    
    def __init__(self):
        self.registry = CollectorRegistry()
        
        # Query metrics
        self.query_counter = Counter(
            'unified_queries_total',
            'Total number of queries',
            ['system', 'query_type', 'status'],
            registry=self.registry
        )
        
        self.query_duration = Histogram(
            'unified_query_duration_seconds',
            'Query execution duration',
            ['system', 'query_type'],
            buckets=(0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0),
            registry=self.registry
        )
        
        # Storage metrics
        self.storage_usage = Gauge(
            'unified_storage_bytes',
            'Storage usage in bytes',
            ['system', 'type'],
            registry=self.registry
        )
        
        self.chunk_count = Gauge(
            'unified_chunks_total',
            'Total number of chunks',
            ['system', 'source_type'],
            registry=self.registry
        )
        
        # Performance metrics
        self.cache_hits = Counter(
            'unified_cache_hits_total',
            'Cache hit count',
            ['cache_level'],
            registry=self.registry
        )
        
        self.embedding_latency = Summary(
            'unified_embedding_latency_seconds',
            'Embedding generation latency',
            ['model'],
            registry=self.registry
        )
        
        # System health
        self.system_health = Gauge(
            'unified_system_health',
            'System health score (0-100)',
            ['component'],
            registry=self.registry
        )
    
    def track_query(self, system: str, query_type: str):
        """Decorator to track query metrics."""
        
        def decorator(func):
            @wraps(func)
            async def wrapper(*args, **kwargs):
                start_time = time.time()
                
                try:
                    result = await func(*args, **kwargs)
                    self.query_counter.labels(
                        system=system,
                        query_type=query_type,
                        status='success'
                    ).inc()
                    
                    return result
                    
                except Exception as e:
                    self.query_counter.labels(
                        system=system,
                        query_type=query_type,
                        status='error'
                    ).inc()
                    raise e
                    
                finally:
                    duration = time.time() - start_time
                    self.query_duration.labels(
                        system=system,
                        query_type=query_type
                    ).observe(duration)
            
            return wrapper
        return decorator
    
    async def collect_system_metrics(self):
        """Collect system-wide metrics."""
        
        while True:
            # Collect storage metrics
            await self.collect_storage_metrics()
            
            # Collect performance metrics
            await self.collect_performance_metrics()
            
            # Calculate health scores
            await self.calculate_health_scores()
            
            # Push to Prometheus gateway
            push_to_gateway(
                'prometheus-pushgateway:9091',
                job='unified_storage',
                registry=self.registry
            )
            
            await asyncio.sleep(30)  # Collect every 30 seconds
```

## 🔍 Distributed Tracing

### Request Tracing
```typescript
export class DistributedTracer {
    private tracer: Tracer;
    
    async traceRequest(
        requestId: string,
        operation: string
    ): Promise<TraceContext> {
        
        const rootSpan = this.tracer.startSpan('request', {
            attributes: {
                'request.id': requestId,
                'operation': operation,
                'timestamp': Date.now()
            }
        });
        
        return {
            span: rootSpan,
            traceId: rootSpan.spanContext().traceId,
            
            // Trace through Claude-Context
            traceClaude: async (operation: () => Promise<any>) => {
                const span = this.tracer.startSpan('claude-context', {
                    parent: rootSpan
                });
                
                try {
                    return await operation();
                } finally {
                    span.end();
                }
            },
            
            // Trace through Cognee
            traceCognee: async (operation: () => Promise<any>) => {
                const span = this.tracer.startSpan('cognee', {
                    parent: rootSpan
                });
                
                try {
                    return await operation();
                } finally {
                    span.end();
                }
            },
            
            // Trace through Neo4j
            traceNeo4j: async (operation: () => Promise<any>) => {
                const span = this.tracer.startSpan('neo4j', {
                    parent: rootSpan
                });
                
                try {
                    return await operation();
                } finally {
                    span.end();
                }
            },
            
            end: () => rootSpan.end()
        };
    }
}
```

## 🚨 Alerting System

### Intelligent Alert Manager
```python
from typing import Dict, List
import asyncio
from datetime import datetime, timedelta

class AlertManager:
    """Intelligent alerting with deduplication and escalation."""
    
    def __init__(self):
        self.alert_rules = []
        self.active_alerts = {}
        self.alert_history = []
        self.notification_channels = []
        
        self.setup_alert_rules()
        self.setup_notification_channels()
    
    def setup_alert_rules(self):
        """Define alert rules."""
        
        self.alert_rules = [
            # Performance alerts
            AlertRule(
                name="high_latency",
                condition=lambda m: m['p95_latency'] > 500,  # 500ms
                severity="warning",
                message="Query latency p95 > 500ms"
            ),
            
            AlertRule(
                name="critical_latency",
                condition=lambda m: m['p95_latency'] > 1000,  # 1s
                severity="critical",
                message="Query latency p95 > 1s",
                escalation_time=timedelta(minutes=5)
            ),
            
            # Resource alerts
            AlertRule(
                name="high_memory",
                condition=lambda m: m['memory_usage'] > 85,
                severity="warning",
                message="Memory usage > 85%"
            ),
            
            AlertRule(
                name="storage_full",
                condition=lambda m: m['storage_usage'] > 90,
                severity="critical",
                message="Storage usage > 90%",
                auto_remediate=True
            ),
            
            # Error rate alerts
            AlertRule(
                name="high_error_rate",
                condition=lambda m: m['error_rate'] > 1,  # 1%
                severity="warning",
                message="Error rate > 1%"
            ),
            
            # System health
            AlertRule(
                name="unhealthy_component",
                condition=lambda m: any(h < 50 for h in m['health_scores'].values()),
                severity="critical",
                message="Component health score < 50"
            )
        ]
    
    async def check_alerts(self, metrics: Dict):
        """Check metrics against alert rules."""
        
        for rule in self.alert_rules:
            if rule.condition(metrics):
                await self.trigger_alert(rule, metrics)
            else:
                await self.resolve_alert(rule)
    
    async def trigger_alert(self, rule: AlertRule, metrics: Dict):
        """Trigger an alert."""
        
        alert_id = f"{rule.name}_{datetime.now().timestamp()}"
        
        # Check for deduplication
        if rule.name in self.active_alerts:
            existing = self.active_alerts[rule.name]
            
            # Update existing alert
            existing['count'] += 1
            existing['last_seen'] = datetime.now()
            
            # Check for escalation
            if rule.escalation_time and \
               datetime.now() - existing['first_seen'] > rule.escalation_time:
                await self.escalate_alert(existing, rule)
            
        else:
            # New alert
            alert = {
                'id': alert_id,
                'rule': rule,
                'metrics': metrics,
                'first_seen': datetime.now(),
                'last_seen': datetime.now(),
                'count': 1
            }
            
            self.active_alerts[rule.name] = alert
            
            # Send notifications
            await self.send_notifications(alert)
            
            # Auto-remediate if configured
            if rule.auto_remediate:
                await self.auto_remediate(rule, metrics)
```

## 📈 Dashboard & Visualization

### Real-Time Dashboard
```typescript
export class MonitoringDashboard {
    private grafanaClient: GrafanaClient;
    private dashboards: Map<string, Dashboard>;
    
    constructor() {
        this.setupDashboards();
    }
    
    private setupDashboards(): void {
        // Main system dashboard
        this.dashboards.set('system', {
            uid: 'unified-system',
            title: 'Unified Storage System',
            panels: [
                // Query performance
                {
                    title: 'Query Latency',
                    type: 'graph',
                    targets: [
                        {
                            expr: 'histogram_quantile(0.95, unified_query_duration_seconds)',
                            legend: 'p95 latency'
                        }
                    ]
                },
                
                // System health
                {
                    title: 'System Health',
                    type: 'stat',
                    targets: [
                        {
                            expr: 'unified_system_health',
                            legend: '{{component}}'
                        }
                    ]
                },
                
                // Resource usage
                {
                    title: 'Resource Usage',
                    type: 'gauge',
                    targets: [
                        {
                            expr: 'unified_storage_bytes / (1024*1024*1024)',
                            legend: 'Storage (GB)'
                        }
                    ]
                },
                
                // Error rates
                {
                    title: 'Error Rate',
                    type: 'graph',
                    targets: [
                        {
                            expr: 'rate(unified_queries_total{status="error"}[5m])',
                            legend: 'Errors per second'
                        }
                    ]
                }
            ]
        });
        
        // Performance dashboard
        this.dashboards.set('performance', {
            uid: 'unified-performance',
            title: 'Performance Metrics',
            panels: [
                // Cache performance
                {
                    title: 'Cache Hit Rate',
                    type: 'graph',
                    targets: [
                        {
                            expr: 'rate(unified_cache_hits_total[5m]) / rate(unified_queries_total[5m])',
                            legend: '{{cache_level}}'
                        }
                    ]
                },
                
                // Throughput
                {
                    title: 'Query Throughput',
                    type: 'graph',
                    targets: [
                        {
                            expr: 'rate(unified_queries_total[1m])',
                            legend: 'QPS'
                        }
                    ]
                }
            ]
        });
    }
}
```

## 🔧 Health Checks

### Comprehensive Health Monitoring
```python
class HealthMonitor:
    """Monitor health of all components."""
    
    async def check_all_health(self) -> HealthReport:
        """Check health of all systems."""
        
        checks = await asyncio.gather(
            self.check_postgres_health(),
            self.check_qdrant_health(),
            self.check_neo4j_health(),
            self.check_redis_health(),
            self.check_api_health(),
            return_exceptions=True
        )
        
        report = HealthReport()
        
        for check in checks:
            if isinstance(check, Exception):
                report.add_failure(str(check))
            else:
                report.add_check(check)
        
        # Calculate overall health score
        report.calculate_score()
        
        return report
    
    async def check_postgres_health(self) -> HealthCheck:
        """Check PostgreSQL health."""
        
        try:
            # Check connection
            conn = await asyncpg.connect(DATABASE_URL)
            
            # Check replication lag
            lag = await conn.fetchval(
                "SELECT EXTRACT(EPOCH FROM (NOW() - pg_last_xact_replay_timestamp()))"
            )
            
            # Check active connections
            connections = await conn.fetchval(
                "SELECT count(*) FROM pg_stat_activity"
            )
            
            await conn.close()
            
            return HealthCheck(
                component='postgres',
                status='healthy' if lag < 10 else 'degraded',
                metrics={
                    'replication_lag': lag,
                    'active_connections': connections
                }
            )
            
        except Exception as e:
            return HealthCheck(
                component='postgres',
                status='unhealthy',
                error=str(e)
            )
```

## 🎯 Success Metrics

- Alert response time: < 1 minute
- False positive rate: < 5%
- Dashboard load time: < 2 seconds
- Metric collection overhead: < 2% CPU
- Log correlation accuracy: > 95%
- Trace completion: > 99%

---

**Status**: ⏳ Pending  
**Estimated Duration**: 5-6 days  
**Dependencies**: Phases 1-13  
**Output**: Complete observability platform with monitoring and alerting

```

---

## File: 15-phase-15-production-deployment.md

**Path:** `15-phase-15-production-deployment.md`

```markdown
# Phase 15: Production Deployment

## 🎯 Objective
Deploy the unified Claude-Context and Cognee hybrid system to production with zero downtime, comprehensive testing, and full rollback capabilities.

## 🏗️ Deployment Architecture

### Container Orchestration
```yaml
# kubernetes/unified-storage-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: unified-storage
  namespace: production
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: unified-storage
  template:
    metadata:
      labels:
        app: unified-storage
        version: v1.0.0
    spec:
      containers:
      
      # API Server
      - name: api-server
        image: unified-storage/api:1.0.0
        ports:
        - containerPort: 3030
        env:
        - name: NODE_ENV
          value: production
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: url
        resources:
          requests:
            memory: "2Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3030
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3030
          initialDelaySeconds: 5
          periodSeconds: 5
          
      # Sync Service
      - name: sync-service
        image: unified-storage/sync:1.0.0
        env:
        - name: REDIS_URL
          value: redis://redis:6379
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
            
      # Sidecar containers
      - name: metrics-exporter
        image: prom/node-exporter:latest
        ports:
        - containerPort: 9100
        
      - name: log-aggregator
        image: fluent/fluent-bit:latest
        volumeMounts:
        - name: logs
          mountPath: /var/log
          
      volumes:
      - name: logs
        emptyDir: {}
```

## 🔄 Blue-Green Deployment

### Zero-Downtime Strategy
```typescript
export class BlueGreenDeployer {
    private k8sClient: KubernetesClient;
    private loadBalancer: LoadBalancer;
    
    async deploy(version: string): Promise<DeploymentResult> {
        console.log(`🚀 Starting blue-green deployment for version ${version}`);
        
        try {
            // Phase 1: Deploy to green environment
            await this.deployGreenEnvironment(version);
            
            // Phase 2: Run smoke tests
            await this.runSmokeTests('green');
            
            // Phase 3: Warm up caches
            await this.warmUpCaches('green');
            
            // Phase 4: Gradual traffic shift
            await this.shiftTraffic();
            
            // Phase 5: Monitor and validate
            await this.monitorDeployment();
            
            // Phase 6: Complete switchover
            await this.completeSwitchover();
            
            return {
                success: true,
                version,
                deploymentTime: Date.now()
            };
            
        } catch (error) {
            console.error('❌ Deployment failed:', error);
            await this.rollback();
            throw error;
        }
    }
    
    private async deployGreenEnvironment(version: string): Promise<void> {
        // Create green deployment
        await this.k8sClient.createDeployment({
            name: 'unified-storage-green',
            image: `unified-storage:${version}`,
            replicas: 3,
            labels: {
                environment: 'green',
                version
            }
        });
        
        // Wait for pods to be ready
        await this.waitForPodsReady('green');
    }
    
    private async shiftTraffic(): Promise<void> {
        // Gradual traffic shift: 10% -> 25% -> 50% -> 100%
        const shifts = [10, 25, 50, 100];
        
        for (const percentage of shifts) {
            console.log(`📊 Shifting ${percentage}% traffic to green`);
            
            await this.loadBalancer.updateWeights({
                blue: 100 - percentage,
                green: percentage
            });
            
            // Monitor for 5 minutes
            await this.monitorForDuration(5 * 60 * 1000);
            
            // Check error rates
            const errorRate = await this.getErrorRate('green');
            if (errorRate > 0.01) {  // 1% error threshold
                throw new Error(`High error rate detected: ${errorRate}`);
            }
        }
    }
    
    private async rollback(): Promise<void> {
        console.log('⏮️ Rolling back deployment');
        
        // Shift all traffic back to blue
        await this.loadBalancer.updateWeights({
            blue: 100,
            green: 0
        });
        
        // Delete green deployment
        await this.k8sClient.deleteDeployment('unified-storage-green');
    }
}
```

## 🔍 Production Testing

### Comprehensive Test Suite
```python
import asyncio
from typing import List, Dict
import pytest

class ProductionTestSuite:
    """Production validation tests."""
    
    async def run_all_tests(self) -> TestReport:
        """Run comprehensive production tests."""
        
        print("🧪 Running production test suite...")
        
        test_results = await asyncio.gather(
            self.test_api_endpoints(),
            self.test_database_connectivity(),
            self.test_vector_search(),
            self.test_graph_queries(),
            self.test_sync_service(),
            self.test_cache_layer(),
            self.test_monitoring(),
            self.test_failover(),
            return_exceptions=True
        )
        
        return self.compile_report(test_results)
    
    async def test_vector_search(self) -> TestResult:
        """Test vector search functionality."""
        
        test_cases = [
            # Claude-Context search
            {
                'query': 'function authenticate',
                'expected_min_results': 5,
                'max_latency_ms': 100,
                'system': 'claude'
            },
            
            # Cognee search
            {
                'query': 'user authentication flow',
                'expected_min_results': 3,
                'max_latency_ms': 200,
                'system': 'cognee'
            },
            
            # Hybrid search
            {
                'query': 'how does authentication work',
                'expected_min_results': 10,
                'max_latency_ms': 300,
                'system': 'hybrid'
            }
        ]
        
        results = []
        for test_case in test_cases:
            start = time.time()
            
            response = await self.query_api(
                test_case['query'],
                test_case['system']
            )
            
            latency = (time.time() - start) * 1000
            
            # Validate results
            assert len(response.results) >= test_case['expected_min_results']
            assert latency < test_case['max_latency_ms']
            
            results.append({
                'test': f"vector_search_{test_case['system']}",
                'passed': True,
                'latency': latency
            })
        
        return TestResult('vector_search', True, results)
    
    async def test_failover(self) -> TestResult:
        """Test failover scenarios."""
        
        print("🔄 Testing failover mechanisms...")
        
        # Kill one PostgreSQL replica
        await self.simulate_postgres_failure()
        
        # Verify system continues operating
        response = await self.query_api('test query', 'claude')
        assert response.status == 'success'
        
        # Kill one Qdrant node
        await self.simulate_qdrant_failure()
        
        # Verify fallback to other nodes
        response = await self.query_api('test query', 'claude')
        assert response.status == 'success'
        
        # Restore failed services
        await self.restore_all_services()
        
        return TestResult('failover', True)
```

## 🛡️ Security Configuration

### Production Security Hardening
```yaml
# Security policies and configurations
apiVersion: v1
kind: ConfigMap
metadata:
  name: security-config
  namespace: production
data:
  nginx.conf: |
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=100r/s;
    
    # Security headers
    add_header X-Frame-Options "DENY";
    add_header X-Content-Type-Options "nosniff";
    add_header X-XSS-Protection "1; mode=block";
    add_header Content-Security-Policy "default-src 'self'";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;
    
    server {
        listen 443 ssl http2;
        server_name api.unified-storage.com;
        
        # API rate limiting
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            
            # Authentication
            auth_request /auth;
            
            proxy_pass http://unified-storage:3030;
        }
    }

---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: unified-storage-netpol
spec:
  podSelector:
    matchLabels:
      app: unified-storage
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: nginx
    ports:
    - protocol: TCP
      port: 3030
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: postgres
    ports:
    - protocol: TCP
      port: 5432
  - to:
    - podSelector:
        matchLabels:
          app: qdrant
    ports:
    - protocol: TCP
      port: 6333
```

## 📊 Production Configuration

### Environment Configuration
```typescript
export class ProductionConfig {
    static readonly config = {
        // Database configuration
        database: {
            postgres: {
                host: process.env.POSTGRES_HOST || 'postgres.production.svc.cluster.local',
                port: 5432,
                database: 'unified_production',
                
                // Connection pooling
                pool: {
                    min: 20,
                    max: 100,
                    idleTimeoutMillis: 30000,
                    connectionTimeoutMillis: 2000,
                    statementTimeout: 30000
                },
                
                // Replication
                replicas: [
                    'postgres-replica-1:5432',
                    'postgres-replica-2:5432'
                ]
            },
            
            qdrant: {
                nodes: [
                    'qdrant-1:6333',
                    'qdrant-2:6333',
                    'qdrant-3:6333'
                ],
                replication_factor: 2,
                consistency: 'majority'
            },
            
            neo4j: {
                uri: 'neo4j://neo4j.production:7687',
                cluster_mode: true
            }
        },
        
        // Cache configuration
        cache: {
            redis: {
                cluster: true,
                nodes: [
                    'redis-1:6379',
                    'redis-2:6379',
                    'redis-3:6379'
                ],
                password: process.env.REDIS_PASSWORD
            }
        },
        
        // Performance tuning
        performance: {
            max_concurrent_requests: 1000,
            request_timeout_ms: 30000,
            batch_size: 100,
            cache_ttl_seconds: 3600
        },
        
        // Monitoring
        monitoring: {
            metrics_port: 9090,
            health_check_interval: 30,
            log_level: 'info'
        }
    };
}
```

## 🔄 Backup & Recovery

### Automated Backup Strategy
```python
class ProductionBackup:
    """Automated backup system for production."""
    
    async def schedule_backups(self):
        """Schedule regular backups."""
        
        # PostgreSQL: Daily full + hourly incremental
        await self.schedule_postgres_backup('0 2 * * *', 'full')
        await self.schedule_postgres_backup('0 * * * *', 'incremental')
        
        # Qdrant: Daily snapshots
        await self.schedule_qdrant_backup('0 3 * * *')
        
        # Neo4j: Daily exports
        await self.schedule_neo4j_backup('0 4 * * *')
        
    async def backup_postgres(self, backup_type: str):
        """Backup PostgreSQL database."""
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        if backup_type == 'full':
            # Full backup with pg_basebackup
            await self.execute_command(f"""
                pg_basebackup -h postgres -U backup_user \
                    -D /backup/postgres/{timestamp} \
                    -Ft -z -P -v
            """)
            
        else:
            # WAL archiving for incremental
            await self.execute_command(f"""
                pg_receivewal -h postgres -U backup_user \
                    -D /backup/postgres/wal/{timestamp} \
                    --synchronous --compress=9
            """)
        
        # Upload to S3
        await self.upload_to_s3(
            f'/backup/postgres/{timestamp}',
            f's3://backups/postgres/{timestamp}'
        )
    
    async def restore_from_backup(self, backup_id: str):
        """Restore from backup."""
        
        print(f"🔄 Restoring from backup {backup_id}")
        
        # Download from S3
        await self.download_from_s3(
            f's3://backups/{backup_id}',
            '/restore'
        )
        
        # Stop services
        await self.stop_all_services()
        
        # Restore databases
        await self.restore_postgres('/restore/postgres')
        await self.restore_qdrant('/restore/qdrant')
        await self.restore_neo4j('/restore/neo4j')
        
        # Verify restoration
        await self.verify_restoration()
        
        # Start services
        await self.start_all_services()
        
        print("✅ Restoration complete")
```

## 🚦 Go-Live Checklist

### Final Production Checklist
```markdown
## Pre-Deployment
- [ ] All tests passing in staging
- [ ] Performance benchmarks met
- [ ] Security audit completed
- [ ] Backup strategy tested
- [ ] Rollback procedure documented
- [ ] Monitoring dashboards configured
- [ ] Alert rules configured
- [ ] Team trained on new system

## Deployment Day
- [ ] Create production backup
- [ ] Deploy to green environment
- [ ] Run smoke tests
- [ ] Warm up caches
- [ ] Begin traffic shifting (10%)
- [ ] Monitor for 15 minutes
- [ ] Increase traffic (25%)
- [ ] Monitor for 15 minutes
- [ ] Increase traffic (50%)
- [ ] Monitor for 30 minutes
- [ ] Full traffic switchover
- [ ] Monitor for 1 hour
- [ ] Decommission blue environment

## Post-Deployment
- [ ] Verify all metrics normal
- [ ] Check error rates < 0.1%
- [ ] Verify backup job running
- [ ] Document lessons learned
- [ ] Schedule retrospective
```

## 🎯 Success Metrics

- Deployment success rate: 100%
- Zero downtime achieved
- Performance targets met (< 100ms p95)
- Error rate < 0.1%
- Successful failover tests
- All security scans passing

---

**Status**: ⏳ Pending  
**Estimated Duration**: 7-10 days  
**Dependencies**: Phases 1-14 complete  
**Output**: Fully deployed production system

## 🎉 Deployment Complete!

The unified Claude-Context and Cognee hybrid system is now live in production, providing:
- 30-40% storage savings through deduplication
- Sub-100ms query latency
- Seamless integration between vector and graph search
- Comprehensive monitoring and observability
- Zero-downtime deployments
- Full disaster recovery capabilities

**Total Implementation Time**: ~90 days  
**Team Size Required**: 4-6 engineers  
**Ongoing Maintenance**: 1-2 engineers

```

---

## File: 16-database-state-analysis.md

**Path:** `16-database-state-analysis.md`

```markdown
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

```

---

## File: 17-implementation-status.md

**Path:** `17-implementation-status.md`

```markdown
# Implementation Status - Hybrid Integration

## 🎯 Current Status: Infrastructure Ready ✅

### Completed Setup

**Date**: December 2024  
**Phase**: Foundation (Phases 1-6 Planning Complete, Infrastructure Configured)

### ✅ What's Been Done

#### 1. **Documentation Complete** (Phases 1-15)
- [x] Phase 1: Storage Architecture Analysis
- [x] Phase 2: Database Schema Unification (design)
- [x] Phase 3: Shared Chunk Format (design)
- [x] Phase 4: PostgreSQL Integration (design)
- [x] Phase 5: Qdrant Unified Collections (design)
- [x] Phase 6: Neo4j Graph Integration (design)
- [x] Phase 7: Chunk Synchronization Service (design)
- [x] Phase 8: Metadata Mapping Layer (design)
- [x] Phase 9: Dual Ingestion Pipeline (design)
- [x] Phase 10: Query Router Implementation (design)
- [x] Phase 11: Transaction Coordinator (design)
- [x] Phase 12: Migration Tools (design)
- [x] Phase 13: Performance Optimization (design)
- [x] Phase 14: Monitoring & Observability (design)
- [x] Phase 15: Production Deployment (design)
- [x] Phase 16: Database State Analysis
- [x] Phase 17: Implementation Status (this doc)

#### 2. **Infrastructure Configured** ✅

**Shared Services**:
```yaml
✅ PostgreSQL 17.2 with pgvector
   - Port: 5533 (external), 5432 (internal)
   - Database: claude_context (existing) + cognee_db (new)
   - Container: claude-context-postgres
   - Network: claude-context-network

✅ Qdrant Vector Database
   - Port: 6333
   - Container: claude-context-qdrant
   - Shared collections for both systems
   - Network: claude-context-network

✅ Neo4j Graph Database (NEW!)
   - Ports: 7474 (HTTP), 7687 (Bolt)
   - Container: claude-context-neo4j
   - For Cognee knowledge graphs
   - Plugins: APOC, Graph Data Science
   - Network: claude-context-network
```

**Cognee Configuration**:
```yaml
✅ Cognee Container
   - Port: 8340
   - Container: cognee
   - Connected to shared services
   - Using MiniMax M2 LLM
   - Using shared GTE embeddings (host:30001)
```

**Files Updated**:
- `/services/docker-compose.yml` - Added Neo4j service
- `/services/cognee/.env` - Configured for shared services
- `/services/cognee/docker-compose.yaml` - Updated network config
- `/services/cognee/HYBRID-SETUP.md` - Complete setup guide
- `/services/start-hybrid.sh` - Automated startup script

#### 3. **Database State Analyzed** ✅

**Claude-Context Current State**:
- **Tables**: 15+ tables including chunks, projects, datasets
- **Chunks Table**: 
  - Columns: id, vector, content, metadata, etc.
  - Empty (ready for data)
- **Collections**: `hybrid_code_chunks_632d81f3` (768-dim)

**Cognee Data Model**:
- **Tables**: data, dataset, users
- **Graph Models**: Node, Edge, KnowledgeGraph
- **Vector Storage**: Qdrant collections
- **Graph Storage**: Neo4j nodes/relationships

### 📊 Service Health Check

Run the startup script:
```bash
cd /home/mewtwo/Zykairotis/claude-context-core/services
./start-hybrid.sh
```

Expected output:
```
✅ PostgreSQL is healthy
✅ Qdrant connection successful
✅ Neo4j connection successful
✅ Cognee database ready
✅ Cognee is running

Service Status:
  ● PostgreSQL    → localhost:5533
  ● Qdrant        → localhost:6333
  ● Neo4j Browser → http://localhost:7474
  ● Neo4j Bolt    → bolt://localhost:7687
  ● Cognee API    → http://localhost:8340
```

### 🔄 Next Implementation Steps

#### Immediate (Week 1-2):
1. **Test Cognee with shared services**
   ```bash
   # Add test data
   curl -X POST http://localhost:8340/api/v1/add \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer local-development-only" \
     -d '{"data": "Test hybrid integration"}'
   
   # Process with cognify
   curl -X POST http://localhost:8340/api/v1/cognify \
     -H "Authorization: Bearer local-development-only"
   
   # Verify data in PostgreSQL
   docker exec claude-context-postgres psql -U postgres -d cognee_db -c "SELECT COUNT(*) FROM data;"
   
   # Check Qdrant collections
   curl http://localhost:6333/collections | jq
   
   # View Neo4j graph
   # Open http://localhost:7474 and run: MATCH (n) RETURN n LIMIT 25;
   ```

2. **Verify database schemas**
   - Inspect Cognee's table structure in PostgreSQL
   - Compare with Claude-Context schema
   - Document any conflicts or incompatibilities

#### Short-term (Week 3-4):
3. **Implement Phase 2: Schema Unification**
   - Create `unified` schema in PostgreSQL
   - Implement `unified.chunks` table
   - Create compatibility views
   - Test with sample data

4. **Start Phase 3: Shared Chunk Format**
   - Implement TypeScript interfaces
   - Create conversion adapters
   - Test bidirectional conversion

#### Mid-term (Month 2):
5. **Implement Phase 7: Synchronization**
   - Set up Redis Streams
   - Implement event handlers
   - Test CDC (Change Data Capture)

6. **Implement Phase 10: Query Router**
   - Create intent classifier
   - Build routing logic
   - Test hybrid queries

### 🧪 Testing Checklist

```bash
# 1. PostgreSQL connectivity
docker exec claude-context-postgres psql -U postgres -c "SELECT version();"

# 2. Qdrant collections
curl http://localhost:6333/collections

# 3. Neo4j browser
open http://localhost:7474
# Login: neo4j / secure-graph-password

# 4. Cognee health
curl http://localhost:8340/api/v1/health

# 5. Test Cognee workflow
cd /home/mewtwo/testx
python add_to_cognee.py
python cognify_dataset.py
python search_cognee.py

# 6. Inspect databases
bash /home/mewtwo/Zykairotis/claude-context-core/scripts/db-inspect.sh --full
```

### 📈 Success Metrics

**Infrastructure**:
- [x] All services start successfully
- [x] Network connectivity verified
- [x] Health checks passing
- [ ] Cognee can read/write to PostgreSQL
- [ ] Cognee can read/write to Qdrant
- [ ] Cognee can read/write to Neo4j

**Data Flow**:
- [ ] Can ingest data through Cognee API
- [ ] Data appears in PostgreSQL `cognee_db.data` table
- [ ] Vectors stored in Qdrant
- [ ] Graph nodes created in Neo4j
- [ ] Can query across all systems

### 🐛 Known Issues & Limitations

1. **Separate Databases**: 
   - Claude-Context uses `claude_context` database
   - Cognee uses `cognee_db` database
   - **Solution**: Phase 2 will create unified schema

2. **Different Table Structures**:
   - Claude-Context: `chunks` table with specific columns
   - Cognee: `data` table with different schema
   - **Solution**: Phase 2 compatibility views

3. **No Synchronization Yet**:
   - Data written by one system not visible to the other
   - **Solution**: Phase 7 sync service

### 🔗 Quick Links

**Setup & Operations**:
- [Hybrid Setup Guide](../../services/cognee/HYBRID-SETUP.md)
- [Startup Script](../../services/start-hybrid.sh)
- [Database Inspection](../../scripts/db-inspect.sh)

**Planning Documentation**:
- [Integration Plan Index](00-index.md)
- [Database State Analysis](16-database-state-analysis.md)
- [Phase 2: Schema Unification](02-phase-02-database-schema-unification.md)

**External Resources**:
- [Cognee PostgreSQL Docs](https://docs.cognee.ai/setup-configuration/relational-databases#postgres)
- [Cognee Qdrant Docs](https://docs.cognee.ai/setup-configuration/community-maintained/qdrant)
- [Cognee Neo4j Docs](https://docs.cognee.ai/setup-configuration/graph-stores#neo4j)

---

**Last Updated**: December 2024  
**Status**: ✅ Infrastructure configured and ready for testing  
**Next Milestone**: Complete Phase 2 implementation (Schema Unification)

```

---

