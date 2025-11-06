import { describe, it, expect, jest, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { Pool } from 'pg';
import { Context } from '../context';
import { QdrantVectorDatabase } from '../vectordb/qdrant';
import { AutoEmbeddingMonster } from '../embedding/auto-embedding-monster';
import type { ProjectQueryRequest } from '../api/query';

/**
 * Phase 7: Island Architecture Integration Tests
 * 
 * Tests the complete workflow:
 * - Phase 1: ScopeManager (collection naming)
 * - Phase 2: Database migrations (dataset_collections)
 * - Phase 3: Context.ts integration
 * - Phase 4: deleteFileChunks
 * - Phase 5: Project-scoped queries
 * - Phase 6: indexWebPages
 */
describe('Island Architecture - Full Integration', () => {
  let pool: Pool;
  let context: Context;
  let vectorDb: QdrantVectorDatabase;
  let embedding: AutoEmbeddingMonster;

  // Test configuration
  const TEST_PROJECT_1 = 'test-project-alpha';
  const TEST_PROJECT_2 = 'test-project-beta';
  const TEST_DATASET_1 = 'codebase-main';
  const TEST_DATASET_2 = 'docs-website';
  
  const POSTGRES_URL = process.env.POSTGRES_URL || 'postgresql://postgres:code-context-secure-password@localhost:5533/claude_context';
  const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
  const EMBEDDING_URL = process.env.EMBEDDING_URL || 'http://localhost:30001';

  beforeAll(async () => {
    // Initialize PostgreSQL connection
    pool = new Pool({
      connectionString: POSTGRES_URL,
      max: 5
    });

    // Initialize vector database
    vectorDb = new QdrantVectorDatabase(QDRANT_URL);

    // Initialize embedding service
    embedding = new AutoEmbeddingMonster({
      codeEmbedding: {
        provider: 'tei',
        url: EMBEDDING_URL,
        model: 'Alibaba-NLP/gte-large-en-v1.5'
      }
    });

    // Initialize context with all components
    context = new Context({
      vectorDatabase: vectorDb,
      embedding,
      postgresPool: pool
    });

    console.log('[Integration Test] Environment initialized');
  }, 30000);

  afterAll(async () => {
    // Cleanup: Drop test collections
    try {
      const testCollections = [
        `project_${TEST_PROJECT_1}_dataset_${TEST_DATASET_1}`,
        `project_${TEST_PROJECT_1}_dataset_${TEST_DATASET_2}`,
        `project_${TEST_PROJECT_2}_dataset_${TEST_DATASET_1}`
      ];

      for (const collectionName of testCollections) {
        try {
          if (await vectorDb.hasCollection(collectionName)) {
            await vectorDb.dropCollection(collectionName);
            console.log(`[Cleanup] Dropped collection: ${collectionName}`);
          }
        } catch (error) {
          console.warn(`[Cleanup] Failed to drop ${collectionName}:`, error);
        }
      }

      // Cleanup database records
      await pool.query(`
        DELETE FROM claude_context.dataset_collections 
        WHERE collection_name LIKE 'project_test_%'
      `);
      await pool.query(`
        DELETE FROM claude_context.datasets 
        WHERE name IN ($1, $2)
      `, [TEST_DATASET_1, TEST_DATASET_2]);
      await pool.query(`
        DELETE FROM claude_context.projects 
        WHERE name IN ($1, $2)
      `, [TEST_PROJECT_1, TEST_PROJECT_2]);

    } catch (error) {
      console.error('[Cleanup] Error:', error);
    }

    await pool.end();
    console.log('[Integration Test] Cleanup complete');
  }, 30000);

  describe('End-to-End Workflow: Create → Index → Query', () => {
    it('should complete full workflow with code indexing', async () => {
      // 1. Index web pages (Phase 6)
      const pages = [
        {
          url: 'https://docs.example.com/api',
          content: `
# API Documentation

## Authentication

Use Bearer tokens for authentication.

\`\`\`typescript
const headers = {
  'Authorization': 'Bearer ' + token
};
\`\`\`

## Rate Limiting

API is rate limited to 100 requests per minute.
          `,
          title: 'API Documentation'
        }
      ];

      const indexStats = await context.indexWebPages(
        pages,
        TEST_PROJECT_1,
        TEST_DATASET_2
      );

      expect(indexStats.processedPages).toBe(1);
      expect(indexStats.totalChunks).toBeGreaterThan(0);
      expect(indexStats.status).toBe('completed');

      console.log(`[Test] Indexed ${indexStats.totalChunks} chunks`);

      // 2. Verify collection created in database (Phase 2 + Phase 3)
      const collectionName = `project_${TEST_PROJECT_1}_dataset_${TEST_DATASET_2}`;
      const collectionResult = await pool.query(
        'SELECT * FROM claude_context.dataset_collections WHERE collection_name = $1',
        [collectionName]
      );

      expect(collectionResult.rows.length).toBe(1);
      expect(collectionResult.rows[0].point_count).toBeGreaterThan(0);

      // 3. Query the indexed content (Phase 5)
      const { queryProject } = await import('../api/query');
      
      const queryRequest: ProjectQueryRequest = {
        project: TEST_PROJECT_1,
        dataset: TEST_DATASET_2,
        query: 'authentication API',
        codebasePath: '/test',
        topK: 5
      };

      const queryResponse = await queryProject(context, queryRequest);

      expect(queryResponse.results.length).toBeGreaterThan(0);
      expect(queryResponse.results[0].chunk).toContain('authentication');
      
      console.log(`[Test] Query returned ${queryResponse.results.length} results`);

    }, 60000);

    it('should handle multiple datasets in same project', async () => {
      // Index to dataset 1
      const pages1 = [{
        url: 'https://example.com/guide1',
        content: '# Guide 1\n\nContent about React hooks.',
        title: 'Guide 1'
      }];

      await context.indexWebPages(pages1, TEST_PROJECT_1, TEST_DATASET_1);

      // Index to dataset 2
      const pages2 = [{
        url: 'https://example.com/guide2',
        content: '# Guide 2\n\nContent about Vue composition API.',
        title: 'Guide 2'
      }];

      await context.indexWebPages(pages2, TEST_PROJECT_1, TEST_DATASET_2);

      // Verify both collections exist
      const collection1 = `project_${TEST_PROJECT_1}_dataset_${TEST_DATASET_1}`;
      const collection2 = `project_${TEST_PROJECT_1}_dataset_${TEST_DATASET_2}`;

      expect(await vectorDb.hasCollection(collection1)).toBe(true);
      expect(await vectorDb.hasCollection(collection2)).toBe(true);

      // Query should search both datasets when querying project
      const { queryProject } = await import('../api/query');
      const response = await queryProject(context, {
        project: TEST_PROJECT_1,
        query: 'API guide',
        codebasePath: '/test',
        topK: 10
      });

      // Should get results from both datasets
      expect(response.results.length).toBeGreaterThan(0);

    }, 60000);
  });

  describe('Project Isolation', () => {
    it('should isolate data between projects', async () => {
      // Index to Project Alpha
      await context.indexWebPages(
        [{
          url: 'https://alpha.com/secret',
          content: '# Secret Alpha\n\nThis is alpha project secret data.',
          title: 'Alpha Secret'
        }],
        TEST_PROJECT_1,
        TEST_DATASET_1
      );

      // Index to Project Beta
      await context.indexWebPages(
        [{
          url: 'https://beta.com/secret',
          content: '# Secret Beta\n\nThis is beta project secret data.',
          title: 'Beta Secret'
        }],
        TEST_PROJECT_2,
        TEST_DATASET_1
      );

      // Query Project Alpha - should NOT see Beta data
      const { queryProject } = await import('../api/query');
      const alphaResponse = await queryProject(context, {
        project: TEST_PROJECT_1,
        query: 'secret data',
        codebasePath: '/test',
        topK: 10
      });

      const alphaResults = alphaResponse.results.map(r => r.chunk);
      expect(alphaResults.some(chunk => chunk.includes('alpha'))).toBe(true);
      expect(alphaResults.some(chunk => chunk.includes('beta'))).toBe(false);

      // Query Project Beta - should NOT see Alpha data
      const betaResponse = await queryProject(context, {
        project: TEST_PROJECT_2,
        query: 'secret data',
        codebasePath: '/test',
        topK: 10
      });

      const betaResults = betaResponse.results.map(r => r.chunk);
      expect(betaResults.some(chunk => chunk.includes('beta'))).toBe(true);
      expect(betaResults.some(chunk => chunk.includes('alpha'))).toBe(false);

      console.log('[Test] Project isolation verified');

    }, 60000);
  });

  describe('Collection Metadata Tracking', () => {
    it('should track collection metadata in database', async () => {
      const pages = [{
        url: 'https://test.com/page',
        content: '# Test Page\n\nTest content.',
        title: 'Test'
      }];

      const stats = await context.indexWebPages(
        pages,
        TEST_PROJECT_1,
        TEST_DATASET_1
      );

      // Check dataset_collections table
      const collectionName = `project_${TEST_PROJECT_1}_dataset_${TEST_DATASET_1}`;
      const result = await pool.query(
        `SELECT * FROM claude_context.dataset_collections WHERE collection_name = $1`,
        [collectionName]
      );

      expect(result.rows.length).toBe(1);
      const record = result.rows[0];
      
      expect(record.collection_name).toBe(collectionName);
      expect(record.vector_db_type).toBe('qdrant');
      expect(record.point_count).toBeGreaterThan(0);
      expect(record.last_indexed_at).toBeTruthy();
      expect(record.is_hybrid).toBe(true);

      console.log('[Test] Collection metadata:', {
        name: record.collection_name,
        points: record.point_count,
        indexed: record.last_indexed_at
      });

    }, 30000);

    it('should link collections to datasets', async () => {
      const collectionName = `project_${TEST_PROJECT_1}_dataset_${TEST_DATASET_1}`;

      // Query join between datasets and dataset_collections
      const result = await pool.query(`
        SELECT 
          d.name as dataset_name,
          p.name as project_name,
          dc.collection_name,
          dc.point_count
        FROM claude_context.dataset_collections dc
        JOIN claude_context.datasets d ON dc.dataset_id = d.id
        JOIN claude_context.projects p ON d.project_id = p.id
        WHERE dc.collection_name = $1
      `, [collectionName]);

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].project_name).toBe(TEST_PROJECT_1);
      expect(result.rows[0].dataset_name).toBe(TEST_DATASET_1);

    }, 30000);
  });

  describe('Collection Naming (ScopeManager)', () => {
    it('should generate deterministic collection names', () => {
      const scopeManager = context.getScopeManager();

      const name1 = scopeManager.getCollectionName(TEST_PROJECT_1, TEST_DATASET_1);
      const name2 = scopeManager.getCollectionName(TEST_PROJECT_1, TEST_DATASET_1);

      // Should be identical (deterministic)
      expect(name1).toBe(name2);

      // Should follow naming convention
      expect(name1).toBe(`project_${TEST_PROJECT_1}_dataset_${TEST_DATASET_1}`);

      console.log('[Test] Collection name:', name1);
    });

    it('should generate unique names for different projects/datasets', () => {
      const scopeManager = context.getScopeManager();

      const name1 = scopeManager.getCollectionName(TEST_PROJECT_1, TEST_DATASET_1);
      const name2 = scopeManager.getCollectionName(TEST_PROJECT_2, TEST_DATASET_1);
      const name3 = scopeManager.getCollectionName(TEST_PROJECT_1, TEST_DATASET_2);

      expect(name1).not.toBe(name2);
      expect(name1).not.toBe(name3);
      expect(name2).not.toBe(name3);
    });
  });

  describe('Query Performance', () => {
    it('should query only relevant collections', async () => {
      // Setup: Index to multiple datasets
      await context.indexWebPages(
        [{ url: 'https://test.com/1', content: '# Page 1', title: 'P1' }],
        TEST_PROJECT_1,
        TEST_DATASET_1
      );

      await context.indexWebPages(
        [{ url: 'https://test.com/2', content: '# Page 2', title: 'P2' }],
        TEST_PROJECT_1,
        TEST_DATASET_2
      );

      // Query specific dataset
      const { queryProject } = await import('../api/query');
      
      const startTime = Date.now();
      await queryProject(context, {
        project: TEST_PROJECT_1,
        dataset: TEST_DATASET_1,
        query: 'test query',
        codebasePath: '/test',
        topK: 5
      });
      const endTime = Date.now();

      const queryTime = endTime - startTime;
      console.log(`[Test] Query time: ${queryTime}ms`);

      // Should be reasonably fast (< 5 seconds for small dataset)
      expect(queryTime).toBeLessThan(5000);

    }, 30000);
  });

  describe('Error Handling', () => {
    it('should handle missing dataset gracefully', async () => {
      const { queryProject } = await import('../api/query');

      // Query non-existent dataset should not crash
      const response = await queryProject(context, {
        project: 'nonexistent-project',
        dataset: 'nonexistent-dataset',
        query: 'test',
        codebasePath: '/test',
        topK: 5
      });

      // Should return empty results, not throw error
      expect(response.results).toBeDefined();
      expect(Array.isArray(response.results)).toBe(true);

    }, 30000);

    it('should require PostgreSQL pool for web indexing', async () => {
      const contextNoDB = new Context({
        vectorDatabase: vectorDb,
        embedding
        // No PostgreSQL pool
      });

      await expect(
        contextNoDB.indexWebPages(
          [{ url: 'https://test.com', content: '# Test', title: 'Test' }],
          'project',
          'dataset'
        )
      ).rejects.toThrow('PostgreSQL pool required');

    }, 10000);
  });
});
