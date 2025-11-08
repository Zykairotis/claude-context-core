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
