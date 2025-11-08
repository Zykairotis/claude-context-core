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
