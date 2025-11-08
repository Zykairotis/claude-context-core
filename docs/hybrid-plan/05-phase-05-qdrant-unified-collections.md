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
