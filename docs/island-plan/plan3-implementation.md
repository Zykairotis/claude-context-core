# Plan 3: Implementation & Migration

## 📋 Implementation Phases

### Phase 1: Database Schema Updates
### Phase 2: Collection Management
### Phase 3: Indexing Logic
### Phase 4: Query Logic
### Phase 5: Migration Tools
### Phase 6: API Updates

---

## Phase 1: Database Schema Updates

### Step 1.1: Create `dataset_collections` Table

**File:** `services/init-scripts/04-dataset-collections.sql`

```sql
-- Tracks Qdrant collections per dataset
CREATE TABLE IF NOT EXISTS claude_context.dataset_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  collection_name TEXT NOT NULL UNIQUE,
  vector_db_type TEXT NOT NULL DEFAULT 'qdrant',
  dimension INTEGER NOT NULL DEFAULT 768,
  is_hybrid BOOLEAN NOT NULL DEFAULT true,
  point_count BIGINT NOT NULL DEFAULT 0,
  last_indexed_at TIMESTAMPTZ,
  last_point_count_sync TIMESTAMPTZ,
  
  -- Human-readable metadata (cached for UI/debugging)
  project_name TEXT NOT NULL,
  dataset_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT one_collection_per_dataset UNIQUE(dataset_id)
);

CREATE INDEX IF NOT EXISTS dataset_collections_dataset_idx 
  ON dataset_collections(dataset_id);
  
CREATE INDEX IF NOT EXISTS dataset_collections_name_idx 
  ON dataset_collections(collection_name);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION claude_context.update_dataset_collections_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_dataset_collections_timestamp
    BEFORE UPDATE ON claude_context.dataset_collections
    FOR EACH ROW
    EXECUTE FUNCTION claude_context.update_dataset_collections_timestamp();
```

### Step 1.2: Update `datasets` Table (Optional Enhancements)

```sql
-- Add source metadata to datasets
ALTER TABLE claude_context.datasets 
ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'github' 
CHECK (source_type IN ('github', 'local', 'crawl'));

ALTER TABLE claude_context.datasets
ADD COLUMN IF NOT EXISTS source_metadata JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN datasets.source_type IS 
  'Type of content source: github, local, crawl';
  
COMMENT ON COLUMN datasets.source_metadata IS 
  'GitHub: {repo, branch, sha, url}, Local: {path, last_scan_at}, Crawl: {base_url, depth, max_pages}';

CREATE INDEX IF NOT EXISTS datasets_source_type_idx 
  ON datasets(source_type);

-- Add system project flag
ALTER TABLE claude_context.projects
ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT false;

COMMENT ON COLUMN projects.is_system IS 
  'System-level project (e.g., global). Cannot be deleted by users.';

-- Create global system project
INSERT INTO claude_context.projects (id, name, description, is_global, is_system)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'global',
  'System project for global datasets',
  true,
  true
) ON CONFLICT (id) DO NOTHING;
```

### Step 1.3: Migration Script

**File:** `scripts/migrate-collection-tracking.sh`

```bash
#!/bin/bash
set -e

echo "🔄 Migrating to collection tracking..."

# Run migration SQL
docker exec claude-context-postgres psql \
  -U postgres \
  -d claude_context \
  -f /docker-entrypoint-initdb.d/04-dataset-collections.sql

echo "✅ Migration complete!"
```

---

## Phase 2: Collection Management

### Step 2.1: Collection Name Generator

**File:** `src/utils/collection-names.ts`

```typescript
import * as crypto from 'crypto';

export interface CollectionNameOptions {
  projectId: string;   // Full UUID from projects.id
  datasetId: string;   // Full UUID from datasets.id
}

/**
 * Generate standardized collection name
 * Format: proj_{PROJECT_ID}_{DATASET_ID}
 * This format is IMMUTABLE - survives renames
 */
export function generateCollectionName(options: CollectionNameOptions): string {
  const { projectId, datasetId } = options;
  
  // Extract first 8 chars of each UUID for brevity
  const projectShort = projectId.replace(/-/g, '').substring(0, 8);
  const datasetShort = datasetId.replace(/-/g, '').substring(0, 8);
  
  return `proj_${projectShort}_${datasetShort}`;
}

// No sanitization needed - using UUIDs directly

/**
 * Parse collection name back to UUIDs
 * Returns null if not in expected format
 */
export function parseCollectionName(collectionName: string): {
  projectIdShort: string;
  datasetIdShort: string;
} | null {
  // Expected format: proj_{8CHARS}_{8CHARS}
  const match = collectionName.match(/^proj_([a-f0-9]{8})_([a-f0-9]{8})$/);
  
  if (!match) {
    return null;
  }
  
  return {
    projectIdShort: match[1],
    datasetIdShort: match[2]
  };
}

/**
 * Check if collection name follows new convention
 */
export function isNewFormatCollection(collectionName: string): boolean {
  return collectionName.startsWith('proj_');
}

/**
 * Check if collection name follows old convention
 */
export function isLegacyCollection(collectionName: string): boolean {
  return collectionName.startsWith('hybrid_code_chunks_') || 
         collectionName.startsWith('code_chunks_');
}
```

### Step 2.2: Collection Manager

**File:** `src/utils/collection-manager.ts`

```typescript
import { Pool } from 'pg';
import { VectorDatabase } from '../vectordb/types';
import { generateCollectionName } from './collection-names';

export interface CollectionInfo {
  id: string;
  datasetId: string;
  collectionName: string;
  vectorDbType: string;
  dimension: number;
  isHybrid: boolean;
  pointCount: number;
  lastIndexedAt?: Date;
}

export class CollectionManager {
  constructor(
    private pool: Pool,
    private vectorDb: VectorDatabase
  ) {}
  
  /**
   * Get or create collection for a dataset
   * WITH ERROR RECOVERY: Handles partial failures gracefully
   */
  async getOrCreateCollection(
    projectId: string,
    datasetId: string,
    projectName: string,
    datasetName: string,
    dimension: number = 768,
    isHybrid: boolean = true
  ): Promise<CollectionInfo> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Check if collection record exists
      const existing = await client.query(
        `SELECT * FROM claude_context.dataset_collections WHERE dataset_id = $1`,
        [datasetId]
      );
      
      if (existing.rows.length > 0) {
        await client.query('COMMIT');
        return this.rowToCollectionInfo(existing.rows[0]);
      }
      
      // Generate IMMUTABLE collection name using UUIDs
      const collectionName = generateCollectionName({ projectId, datasetId });
      const displayName = `${projectName} - ${datasetName}`;
      
      // Check if collection already exists in Qdrant (orphaned case)
      const collectionExists = await this.vectorDb.hasCollection(collectionName);
      
      if (!collectionExists) {
        // Create Qdrant collection
        try {
          if (isHybrid) {
            await this.vectorDb.createHybridCollection(collectionName, dimension);
          } else {
            await this.vectorDb.createCollection(collectionName, dimension);
          }
        } catch (qdrantError) {
          await client.query('ROLLBACK');
          throw new Error(`Failed to create Qdrant collection: ${qdrantError}`);
        }
      } else {
        console.warn(`[CollectionManager] ⚠️  Collection ${collectionName} exists in Qdrant but not in database - recovering`);
      }
      
      // Record in database
      const result = await client.query(
        `INSERT INTO claude_context.dataset_collections
         (dataset_id, collection_name, dimension, is_hybrid, vector_db_type,
          project_name, dataset_name, display_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [datasetId, collectionName, dimension, isHybrid, 'qdrant',
         projectName, datasetName, displayName]
      );
      
      await client.query('COMMIT');
      console.log(`[CollectionManager] ✅ Created collection: ${collectionName} (${displayName})`);
      
      return this.rowToCollectionInfo(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Get collection info for a dataset
   */
  async getCollectionForDataset(datasetId: string): Promise<CollectionInfo | null> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(
        `SELECT * FROM claude_context.dataset_collections WHERE dataset_id = $1`,
        [datasetId]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.rowToCollectionInfo(result.rows[0]);
    } finally {
      client.release();
    }
  }
  
  /**
   * Get collections for multiple datasets
   */
  async getCollectionsForDatasets(datasetIds: string[]): Promise<CollectionInfo[]> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(
        `SELECT * FROM claude_context.dataset_collections 
         WHERE dataset_id = ANY($1::uuid[])`,
        [datasetIds]
      );
      
      return result.rows.map(row => this.rowToCollectionInfo(row));
    } finally {
      client.release();
    }
  }
  
  /**
   * Update collection stats (point count, last indexed)
   */
  async updateCollectionStats(
    datasetId: string,
    pointCount: number
  ): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query(
        `UPDATE claude_context.dataset_collections
         SET point_count = $1, 
             last_indexed_at = NOW(),
             last_point_count_sync = NOW()
         WHERE dataset_id = $2`,
        [pointCount, datasetId]
      );
    } finally {
      client.release();
    }
  }
  
  /**
   * Sync point counts from Qdrant for all collections
   * Should be called periodically (e.g., every 5 minutes)
   */
  async syncAllPointCounts(): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(
        `SELECT dataset_id, collection_name FROM claude_context.dataset_collections`
      );
      
      for (const row of result.rows) {
        try {
          const stats = await this.vectorDb.getCollectionStats(row.collection_name);
          if (stats) {
            await this.updateCollectionStats(row.dataset_id, stats.entityCount);
          }
        } catch (error) {
          console.error(`[CollectionManager] Failed to sync point count for ${row.collection_name}:`, error);
        }
      }
    } finally {
      client.release();
    }
  }
  
  /**
   * Update cached names after project/dataset rename
   */
  async updateDisplayNames(
    datasetId: string,
    projectName: string,
    datasetName: string
  ): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query(
        `UPDATE claude_context.dataset_collections
         SET project_name = $1,
             dataset_name = $2,
             display_name = $1 || ' - ' || $2
         WHERE dataset_id = $3`,
        [projectName, datasetName, datasetId]
      );
    } finally {
      client.release();
    }
  }
  
  /**
   * Delete collection and its record
   */
  async deleteCollection(datasetId: string): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      // Get collection name
      const result = await client.query(
        `SELECT collection_name FROM claude_context.dataset_collections 
         WHERE dataset_id = $1`,
        [datasetId]
      );
      
      if (result.rows.length === 0) {
        return;
      }
      
      const collectionName = result.rows[0].collection_name;
      
      // Drop Qdrant collection
      await this.vectorDb.dropCollection(collectionName);
      
      // Delete record
      await client.query(
        `DELETE FROM claude_context.dataset_collections WHERE dataset_id = $1`,
        [datasetId]
      );
      
      console.log(`[CollectionManager] 🗑️  Deleted collection: ${collectionName}`);
    } finally {
      client.release();
    }
  }
  
  private rowToCollectionInfo(row: any): CollectionInfo {
    return {
      id: row.id,
      datasetId: row.dataset_id,
      collectionName: row.collection_name,
      vectorDbType: row.vector_db_type,
      dimension: row.dimension,
      isHybrid: row.is_hybrid,
      pointCount: parseInt(row.point_count, 10),
      lastIndexedAt: row.last_indexed_at ? new Date(row.last_indexed_at) : undefined,
      displayName: row.display_name,
      projectName: row.project_name,
      datasetName: row.dataset_name
    };
  }
}

// Export singleton instance
let collectionManagerInstance: CollectionManager | null = null;

export function getCollectionManager(pool: Pool, vectorDb: VectorDatabase): CollectionManager {
  if (!collectionManagerInstance) {
    collectionManagerInstance = new CollectionManager(pool, vectorDb);
  }
  return collectionManagerInstance;
}
```

---

## Phase 3: Indexing Logic Updates

### Step 3.1: Update Context.indexWithProject()

**File:** `src/context.ts`

```typescript
// Update indexWithProject to use CollectionManager
async indexWithProject(
    codebasePath: string,
    projectName: string,
    datasetName: string,
    options?: {
        repo?: string;
        branch?: string;
        sha?: string;
        progressCallback?: (progress: any) => void;
        forceReindex?: boolean;
    }
): Promise<{ indexedFiles: number; totalChunks: number; status: string }> {
    console.log(`[Context] 🚀 Starting project-aware indexing: ${projectName}/${datasetName}`);

    // Resolve project context
    const projectContext = await this.resolveProject(projectName, datasetName);
    
    // Get or create collection via CollectionManager
    const collectionManager = new CollectionManager(this.postgresPool!, this.vectorDatabase);
    const collectionInfo = await collectionManager.getOrCreateCollection(
        projectContext.datasetId,
        projectName,
        datasetName,
        768,  // dimension
        true  // isHybrid
    );
    
    console.log(`[Context] 📦 Using collection: ${collectionInfo.collectionName}`);
    
    // Override getCollectionName to use the project-aware collection
    const originalGetCollectionName = this.getCollectionName.bind(this);
    this.getCollectionName = () => collectionInfo.collectionName;
    
    try {
        // Use existing indexing logic with overridden collection name
        return await this.indexCodebase(
            codebasePath,
            options?.progressCallback,
            options?.forceReindex
        );
    } finally {
        // Restore original method
        this.getCollectionName = originalGetCollectionName;
        
        // Update stats
        const stats = await this.vectorDatabase.getCollectionStats(collectionInfo.collectionName);
        if (stats) {
            await collectionManager.updateCollectionStats(
                projectContext.datasetId,
                stats.entityCount
            );
        }
    }
}
```

---

## Phase 4: Query Logic Updates

### Step 4.1: Update queryProject()

**File:** `src/api/query.ts`

```typescript
// Update queryProject to use project-scoped collections
export async function queryProject(
  context: Context,
  pool: Pool,
  request: QueryRequest,
  onProgress?: (phase: string, progress: number, message: string) => void
): Promise<QueryResponse> {
  const client = await pool.connect();
  
  try {
    // Step 1: Resolve project
    const project = await getOrCreateProject(client, request.project);
    
    // Step 2: Get accessible datasets
    const datasetIds = await getAccessibleDatasets(
      client,
      project.id,
      request.includeGlobal !== false
    );
    
    // Step 3: Get collections for these datasets
    const collectionManager = new CollectionManager(pool, context.getVectorDatabase());
    const collections = await collectionManager.getCollectionsForDatasets(datasetIds);
    
    console.log(`[QueryProject] Searching ${collections.length} collections for project "${request.project}"`);
    
    // Step 4: Generate query embedding
    const queryEmbedding = await context.getEmbedding().generateEmbedding(request.query);
    
    // Step 5: Search each collection
    const allResults = [];
    for (const collection of collections) {
      try {
        const results = await context.getVectorDatabase().search(
          collection.collectionName,
          queryEmbedding.vector,
          {
            limit: request.topK || 10,
            filter: {
              must: [
                { key: 'project_id', match: { value: project.id } }
              ]
            }
          }
        );
        
        allResults.push(...results);
      } catch (error) {
        console.warn(`[QueryProject] Error searching collection ${collection.collectionName}:`, error);
      }
    }
    
    // Step 6: Rank and deduplicate
    const rankedResults = rankResults(allResults);
    
    return {
      requestId: crypto.randomUUID(),
      results: rankedResults.slice(0, request.topK),
      metadata: {
        totalResults: rankedResults.length,
        collectionsSearched: collections.length,
        projectId: project.id
      }
    };
  } finally {
    client.release();
  }
}
```

---

## Phase 5: Migration Tools

### Step 5.1: Legacy Collection Migration Script

**File:** `scripts/migrate-legacy-collections.ts`

```typescript
/**
 * Migrate legacy collections to new naming convention
 * 
 * Strategy:
 * 1. Scan all Qdrant collections
 * 2. Identify legacy collections (hybrid_code_chunks_*)
 * 3. Extract project/dataset from payload
 * 4. Create dataset_collections record
 * 5. Optionally rename collection (requires re-indexing)
 */

import { Pool } from 'pg';
import { QdrantClient } from '@qdrant/qdrant-js';
import { generateCollectionName } from '../src/utils/collection-names';

async function migrateLegacyCollections() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const qdrant = new QdrantClient({ url: process.env.QDRANT_URL });
  
  try {
    console.log('🔄 Scanning for legacy collections...');
    
    // Get all collections
    const collections = await qdrant.getCollections();
    const legacyCollections = collections.collections.filter(c => 
      c.name.startsWith('hybrid_code_chunks_') || c.name.startsWith('code_chunks_')
    );
    
    console.log(`Found ${legacyCollections.length} legacy collections`);
    
    for (const collection of legacyCollections) {
      console.log(`\n📦 Processing: ${collection.name}`);
      
      // Sample a point to extract project/dataset info
      const scroll = await qdrant.scroll(collection.name, { limit: 1 });
      
      if (scroll.points.length === 0) {
        console.log('  ⚠️  Empty collection, skipping');
        continue;
      }
      
      const payload = scroll.points[0].payload;
      const projectId = payload?.project_id;
      const datasetId = payload?.dataset_id;
      
      if (!projectId || !datasetId) {
        console.log('  ⚠️  Missing project/dataset IDs, skipping');
        continue;
      }
      
      // Get project and dataset names
      const result = await pool.query(`
        SELECT p.name as project_name, d.name as dataset_name
        FROM claude_context.datasets d
        JOIN claude_context.projects p ON d.project_id = p.id
        WHERE p.id = $1 AND d.id = $2
      `, [projectId, datasetId]);
      
      if (result.rows.length === 0) {
        console.log('  ⚠️  Project/Dataset not found in database, skipping');
        continue;
      }
      
      const { project_name, dataset_name } = result.rows[0];
      
      // Generate new collection name
      const newCollectionName = generateCollectionName({
        projectName: project_name,
        datasetName: dataset_name
      });
      
      console.log(`  📝 Would rename: ${collection.name} → ${newCollectionName}`);
      
      // Create dataset_collections record
      await pool.query(`
        INSERT INTO claude_context.dataset_collections
        (dataset_id, collection_name, dimension, is_hybrid, point_count)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (dataset_id) DO NOTHING
      `, [
        datasetId,
        collection.name,  // Keep old name for now
        768,
        collection.name.startsWith('hybrid_'),
        collection.points_count || 0
      ]);
      
      console.log(`  ✅ Recorded in dataset_collections`);
    }
    
    console.log('\n✅ Migration complete!');
    console.log('\n⚠️  Collections were NOT renamed. To rename, run with --rename flag');
  } finally {
    await pool.end();
  }
}

migrateLegacyCollections().catch(console.error);
```

---

## Phase 6: API Updates

### Step 6.1: Update Indexing Endpoints

**File:** `services/api-server/src/routes/projects.ts`

```typescript
// Update GitHub indexing endpoint
router.post('/:project/ingest/github', async (req, res) => {
  const { project } = req.params;
  const { repo, branch, dataset, scope, force } = req.body;
  
  // Use project-aware indexing
  const job = await queue.enqueue({
    type: 'github',
    projectName: project,
    datasetName: dataset || extractDatasetName(repo),
    repo,
    branch: branch || 'main',
    force: force || false
  });
  
  res.json({ jobId: job.id, status: 'queued' });
});

// Update local indexing endpoint
router.post('/:project/ingest/local', async (req, res) => {
  const { project } = req.params;
  const { path, dataset, force } = req.body;
  
  // Use project-aware indexing
  const result = await core.indexWithProject(
    context,
    path,
    project,
    dataset || path.split('/').pop(),
    { force: force || false }
  );
  
  res.json(result);
});
```

---

## Summary

**Phase 1:** ✅ Database schema ready  
**Phase 2:** ✅ Collection management utilities  
**Phase 3:** ✅ Indexing logic updated  
**Phase 4:** ✅ Query logic updated  
**Phase 5:** ✅ Migration tools ready  
**Phase 6:** ✅ API endpoints updated  

**Next:** Plan 4 - Testing Strategy
