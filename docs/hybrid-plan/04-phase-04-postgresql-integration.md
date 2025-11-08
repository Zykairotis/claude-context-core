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
