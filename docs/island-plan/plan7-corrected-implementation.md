# Plan 7: Corrected Implementation Path

> **Status:** UPDATED after Reality Check (Nov 5, 2025)
> 
> **Goal:** Align TypeScript core with Python implementation (NAME-based collections)

---

## 🎯 Key Decision: Follow Crawl4AI's Architecture

**After analysis, we should:**
- ✅ **Adopt NAME-based collections** (like Python ScopeManager)
- ✅ Keep it simple and debuggable
- ✅ Match existing working implementation
- ❌ Don't use UUID-based collections (adds complexity)

**Rationale:**
1. Crawl4AI service ALREADY implements this successfully
2. Name-based is simpler to debug and understand
3. Deterministic UUIDs (uuid5) from names gives both benefits
4. Less migration complexity

---

## 📋 Corrected Implementation Phases

### Phase 1: Port ScopeManager to TypeScript (Week 1, Days 1-2)

**Goal:** Create TypeScript equivalent of Python ScopeManager

**Files to create:**
- `src/utils/scope-manager.ts` - Core scope management
- `src/utils/scope-manager.spec.ts` - Unit tests

**Implementation:**
```typescript
// src/utils/scope-manager.ts
import { v5 as uuidv5 } from 'uuid';

export enum ScopeLevel {
  GLOBAL = 'global',
  PROJECT = 'project',
  LOCAL = 'local'
}

export class ScopeManager {
  private readonly DNS_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
  
  constructor(private defaultScope: ScopeLevel = ScopeLevel.LOCAL) {}
  
  resolveScope(
    project?: string,
    dataset?: string,
    requestedScope?: string
  ): ScopeLevel {
    if (requestedScope === 'global') return ScopeLevel.GLOBAL;
    
    if (project && dataset) {
      return requestedScope === 'project' ? ScopeLevel.PROJECT : ScopeLevel.LOCAL;
    } else if (project) {
      return ScopeLevel.PROJECT;
    } else {
      return ScopeLevel.GLOBAL;
    }
  }
  
  getCollectionName(
    project?: string,
    dataset?: string,
    scope?: ScopeLevel
  ): string {
    const resolvedScope = scope || this.resolveScope(project, dataset);
    
    if (resolvedScope === ScopeLevel.GLOBAL) {
      return 'global_knowledge';
    } else if (resolvedScope === ScopeLevel.PROJECT) {
      if (!project) throw new Error('Project required for project scope');
      return `project_${this.sanitizeName(project)}`;
    } else {
      if (!project || !dataset) {
        throw new Error('Project and dataset required for local scope');
      }
      return `project_${this.sanitizeName(project)}_dataset_${this.sanitizeName(dataset)}`;
    }
  }
  
  getProjectId(project?: string): string {
    if (!project) return uuidv5('default', this.DNS_NAMESPACE);
    return uuidv5(project, this.DNS_NAMESPACE);
  }
  
  getDatasetId(dataset?: string): string {
    if (!dataset) return uuidv5('default', this.DNS_NAMESPACE);
    return uuidv5(dataset, this.DNS_NAMESPACE);
  }
  
  private sanitizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }
}
```

**Tests to write:**
- Collection name generation for each scope
- Sanitization logic
- UUID generation consistency
- Error handling for missing params

**Verification:**
```bash
npm run test -- src/utils/scope-manager.spec.ts
```

---

### Phase 2: Add dataset_collections Table (Week 1, Day 3)

**Goal:** Track collection metadata in database

**Migration script:** `scripts/migrate-add-dataset-collections.sh`

```sql
-- Create dataset_collections table
CREATE TABLE IF NOT EXISTS claude_context.dataset_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID NOT NULL REFERENCES claude_context.datasets(id) ON DELETE CASCADE,
  collection_name TEXT NOT NULL UNIQUE,
  
  -- Collection metadata
  vector_db_type TEXT NOT NULL DEFAULT 'qdrant',
  dimension INTEGER NOT NULL DEFAULT 768,
  is_hybrid BOOLEAN NOT NULL DEFAULT true,
  point_count BIGINT NOT NULL DEFAULT 0,
  
  -- Timestamps
  last_indexed_at TIMESTAMPTZ,
  last_point_count_sync TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT one_collection_per_dataset UNIQUE(dataset_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS dataset_collections_dataset_idx 
  ON claude_context.dataset_collections(dataset_id);
  
CREATE INDEX IF NOT EXISTS dataset_collections_name_idx 
  ON claude_context.dataset_collections(collection_name);

-- Trigger for updated_at
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

**Verification:**
```bash
./scripts/migrate-add-dataset-collections.sh
psql -h localhost -U postgres -p 5533 -d claude_context -c \
  "\\d claude_context.dataset_collections"
```

---

### Phase 3: Add collection_name to indexed_files (Week 1, Day 3)

**Goal:** Link incremental sync to collections

**Migration script:** `scripts/migrate-add-collection-to-indexed-files.sh`

```sql
-- Add collection_name column
ALTER TABLE claude_context.indexed_files
ADD COLUMN IF NOT EXISTS collection_name TEXT;

-- Add foreign key constraint
ALTER TABLE claude_context.indexed_files
ADD CONSTRAINT fk_indexed_files_collection
  FOREIGN KEY (collection_name)
  REFERENCES claude_context.dataset_collections(collection_name)
  ON DELETE CASCADE;

-- Add index
CREATE INDEX IF NOT EXISTS idx_indexed_files_collection
  ON claude_context.indexed_files(collection_name);
```

**Backfill script:**
```typescript
// scripts/backfill-collection-names.ts
async function backfillCollectionNames(pool: Pool) {
  const scopeManager = new ScopeManager();
  
  // Get all indexed files without collection_name
  const result = await pool.query(`
    SELECT DISTINCT 
      if.project_id,
      if.dataset_id,
      p.name as project_name,
      d.name as dataset_name
    FROM claude_context.indexed_files if
    JOIN claude_context.datasets d ON if.dataset_id = d.id
    JOIN claude_context.projects p ON d.project_id = p.id
    WHERE if.collection_name IS NULL
  `);
  
  for (const row of result.rows) {
    const collectionName = scopeManager.getCollectionName(
      row.project_name,
      row.dataset_name
    );
    
    // Update indexed_files
    await pool.query(`
      UPDATE claude_context.indexed_files
      SET collection_name = $1
      WHERE project_id = $2 AND dataset_id = $3 AND collection_name IS NULL
    `, [collectionName, row.project_id, row.dataset_id]);
    
    console.log(`✓ Backfilled ${row.project_name}/${row.dataset_name}`);
  }
}
```

---

### Phase 4: Update Context.ts (Week 1, Days 4-5)

**Goal:** Replace MD5 hash-based naming with ScopeManager

**Changes to `/src/context.ts`:**

```typescript
import { ScopeManager, ScopeLevel } from './utils/scope-manager';

export class Context {
  private scopeManager: ScopeManager;
  
  constructor(config: ContextConfig) {
    // ... existing code
    this.scopeManager = new ScopeManager();
  }
  
  /**
   * Generate collection name (NEW - replaces getCollectionName)
   */
  private getCollectionNameScoped(
    project: string,
    dataset: string
  ): string {
    return this.scopeManager.getCollectionName(project, dataset);
  }
  
  /**
   * DEPRECATED: Old path-based naming
   * Keep for backward compatibility during migration
   */
  @deprecated('Use getCollectionNameScoped instead')
  public getCollectionName(codebasePath: string): string {
    // Keep old implementation for backward compat
    const isHybrid = this.getIsHybrid();
    const normalizedPath = path.resolve(codebasePath);
    const hash = crypto.createHash('md5').update(normalizedPath).digest('hex');
    const prefix = isHybrid ? 'hybrid_code_chunks' : 'code_chunks';
    return `${prefix}_${hash.substring(0, 8)}`;
  }
}
```

**Migration strategy:**
1. Keep old `getCollectionName` for existing codebases
2. Add new `getCollectionNameScoped` for new ingestions
3. Provide migration tool to convert old → new collections

---

### Phase 5: Implement deleteFileChunks (Week 2, Day 1)

**Goal:** Actually delete chunks from vector DB

**Update `/src/sync/incremental-sync.ts`:**

```typescript
async function deleteFileChunks(
    context: Context,
    filePath: string,
    project: string,
    dataset: string,
    collectionName: string
): Promise<number> {
    const vectorDb = context.getVectorDatabase();
    
    // Get file path filter (use relative path)
    const relPath = path.relative(context.getCodebasePath(), filePath);
    
    try {
        if (vectorDb.constructor.name === 'QdrantVectorDatabase') {
            // Use Qdrant filter API
            const deleted = await (vectorDb as any).deleteByFilter(
                collectionName,
                {
                    must: [
                        {
                            key: 'relative_path',
                            match: { value: relPath }
                        },
                        {
                            key: 'project_id',
                            match: { value: context.scopeManager.getProjectId(project) }
                        },
                        {
                            key: 'dataset_id',
                            match: { value: context.scopeManager.getDatasetId(dataset) }
                        }
                    ]
                }
            );
            
            console.log(`[IncrementalSync] 🗑️  Deleted ${deleted} chunks for ${relPath}`);
            return deleted;
        } else {
            console.warn('[IncrementalSync] ⚠️  Vector DB does not support filter-based deletion');
            return 0;
        }
    } catch (error) {
        console.error(`[IncrementalSync] ❌ Failed to delete chunks:`, error);
        return 0;
    }
}
```

**Add to QdrantVectorDatabase:**
```typescript
// src/vectordb/qdrant.ts
async deleteByFilter(
    collectionName: string,
    filter: any
): Promise<number> {
    const response = await this.client.delete(collectionName, {
        filter,
        wait: true
    });
    return response.operation_id ? 1 : 0; // Qdrant doesn't return count
}
```

---

### Phase 6: Update Query Logic (Week 2, Days 2-3)

**Goal:** Project-scoped queries, not search-all

**Update `/src/api/query.ts`:**

```typescript
// NEW: Get collections for specific project/dataset
async function getProjectCollections(
    pool: Pool,
    projectId?: string,
    datasetId?: string
): Promise<string[]> {
    if (datasetId) {
        // Single dataset
        const result = await pool.query(`
            SELECT collection_name 
            FROM claude_context.dataset_collections
            WHERE dataset_id = $1
        `, [datasetId]);
        return result.rows.map(r => r.collection_name);
    } else if (projectId) {
        // All datasets in project
        const result = await pool.query(`
            SELECT dc.collection_name
            FROM claude_context.dataset_collections dc
            JOIN claude_context.datasets d ON dc.dataset_id = d.id
            WHERE d.project_id = $1
        `, [projectId]);
        return result.rows.map(r => r.collection_name);
    } else {
        // Global: all collections
        return []; // Fall back to listing all
    }
}

// REPLACE: Old search-all logic
export async function queryCode(request: QueryRequest): Promise<QueryResponse> {
    // ... existing setup
    
    let candidateCollections: string[] = [];
    
    // NEW: Project-scoped collection lookup
    if (request.projectId || request.datasetId) {
        candidateCollections = await getProjectCollections(
            pool,
            request.projectId,
            request.datasetId
        );
        
        console.log(`[Query] 🔍 Searching ${candidateCollections.length} collections for project/dataset`);
    } else {
        // Fallback: list all (only if no project specified)
        const allCollections = await vectorDb.listCollections();
        candidateCollections = allCollections.filter(name => 
            name.startsWith('project_') || name.startsWith('global_')
        );
        
        console.log(`[Query] ⚠️  No project specified, searching all ${candidateCollections.length} collections`);
    }
    
    // ... rest of query logic
}
```

---

### Phase 7: Implement Context.indexWebPages (Week 2, Day 4)

**Goal:** Use ScopeManager for web content

**Update `/src/context.ts`:**

```typescript
async indexWebPages(
    pages: WebPage[],
    project: string,
    dataset: string,
    options?: IndexWebPagesOptions
): Promise<IndexWebPagesResult> {
    console.log(`[Context] 📄 Indexing ${pages.length} web pages for ${project}/${dataset}`);
    
    const collectionName = this.scopeManager.getCollectionName(project, dataset);
    const projectId = this.scopeManager.getProjectId(project);
    const datasetId = this.scopeManager.getDatasetId(dataset);
    
    // Parse markdown, extract code blocks
    const chunks: Chunk[] = [];
    
    for (const page of pages) {
        const pageChunks = await this.parseWebPage(page, {
            chunkSize: options?.chunkSize || 1000,
            chunkOverlap: options?.chunkOverlap || 200
        });
        
        chunks.push(...pageChunks.map(c => ({
            ...c,
            metadata: {
                ...c.metadata,
                project_id: projectId,
                dataset_id: datasetId,
                source_type: 'web',
                url: page.url
            }
        })));
    }
    
    // Generate embeddings
    const embeddings = await this.embeddingClient.embed(
        chunks.map(c => c.text)
    );
    
    // Store to vector DB
    const documents = chunks.map((chunk, i) => ({
        id: `${projectId}_${datasetId}_${chunk.url}_${i}`,
        vector: embeddings[i],
        content: chunk.text,
        metadata: chunk.metadata
    }));
    
    await this.vectorDatabase.insertHybrid(collectionName, documents);
    
    return {
        indexedPages: pages.length,
        totalChunks: chunks.length
    };
}
```

---

## 🧪 Testing Strategy

### Unit Tests
- ✅ ScopeManager collection naming
- ✅ UUID generation determinism
- ✅ Sanitization logic
- ✅ deleteFileChunks functionality

### Integration Tests
- ✅ Create dataset → creates collection record
- ✅ Index codebase → uses new naming
- ✅ Query scoped to project
- ✅ Incremental sync deletes old chunks

### Migration Tests
- ✅ Old collections still queryable
- ✅ New collections use correct naming
- ✅ Backfill script populates collection_name

---

## 📊 Success Metrics

1. **Collection Isolation**
   - ✅ Each dataset has one collection
   - ✅ Collections named: `project_{name}_dataset_{name}`
   - ✅ No MD5 hashes in new collections

2. **Query Performance**
   - ✅ Queries only search relevant collections
   - ✅ Project filter reduces search space by 80%+

3. **Incremental Sync**
   - ✅ deleteFileChunks actually removes chunks
   - ✅ Modified files don't leave orphans
   - ✅ collection_name tracked in indexed_files

4. **Backward Compatibility**
   - ✅ Old MD5-based collections still work
   - ✅ Migration tool converts old → new
   - ✅ No data loss during transition

---

## 🚀 Rollout Plan

### Week 1: Foundation
- Day 1-2: Port ScopeManager to TypeScript
- Day 3: Database migrations
- Day 4-5: Update Context.ts

### Week 2: Core Features
- Day 1: Implement deleteFileChunks
- Day 2-3: Update query logic
- Day 4: Implement indexWebPages

### Week 3: Migration & Polish
- Day 1-2: Write migration tools
- Day 3: Testing and bug fixes
- Day 4-5: Documentation and rollout

---

## ✅ Acceptance Criteria

- [ ] ScopeManager ported with 100% test coverage
- [ ] dataset_collections table created and populated
- [ ] indexed_files.collection_name added and backfilled
- [ ] Context.ts uses new naming for new ingestions
- [ ] deleteFileChunks removes chunks from correct collection
- [ ] Queries scoped to project/dataset
- [ ] indexWebPages uses ScopeManager
- [ ] Migration tool converts old collections
- [ ] All existing tests pass
- [ ] Documentation updated

---

## 📝 Notes

**Why Name-based over UUID-based?**
1. Crawl4AI already implements it successfully
2. Simpler to debug (human-readable)
3. Deterministic UUIDs (uuid5) give uniqueness
4. Less code to maintain
5. Easier migration path

**Backward Compatibility:**
- Keep old getCollectionName() for existing codebases
- Provide migration tool for users who want to upgrade
- No forced migration (opt-in)
