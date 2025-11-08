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
