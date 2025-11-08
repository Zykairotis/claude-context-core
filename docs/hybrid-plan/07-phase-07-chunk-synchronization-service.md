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
