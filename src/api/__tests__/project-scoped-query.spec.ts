import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { queryProject, ProjectQueryRequest } from '../query';
import { Context } from '../../context';
import type { VectorDatabase, VectorSearchResult } from '../../vectordb';
import type { Embedding } from '../../embedding';
import type { Pool, PoolClient } from 'pg';

/**
 * Phase 5: Project-scoped Query Logic Tests
 * 
 * These tests verify that queries use project-scoped collections from
 * dataset_collections table instead of searching all collections.
 */
describe('queryProject - Project-scoped Collections (Phase 5)', () => {
  let context: Context;
  let mockVectorDb: jest.Mocked<VectorDatabase>;
  let mockEmbedding: jest.Mocked<Embedding>;
  let mockPoolClient: jest.Mocked<PoolClient>;
  let mockPool: jest.Mocked<Pool>;

  const mockDocument = {
    id: 'chunk_123',
    vector: Array(768).fill(0.1),
    content: 'function authenticate(user) { return validateToken(user.token); }',
    relativePath: 'src/auth.ts',
    startLine: 10,
    endLine: 12,
    fileExtension: '.ts',
    projectId: 'project-abc',
    datasetId: 'dataset-xyz',
    sourceType: 'local',
    metadata: {
      chunkTitle: 'authenticate',
      symbol: { name: 'authenticate', kind: 'function' }
    }
  };

  beforeEach(() => {
    // Mock vector database
    mockVectorDb = {
      hasCollection: jest.fn(async () => true),
      createHybridCollection: jest.fn(async () => {}),
      createCollection: jest.fn(async () => {}),
      dropCollection: jest.fn(async () => {}),
      insertHybrid: jest.fn(async () => {}),
      insert: jest.fn(async () => {}),
      search: jest.fn(async () => [
        { document: mockDocument, score: 0.85 }
      ]),
      delete: jest.fn(async () => {}),
      deleteByDataset: jest.fn(async () => 0),
      query: jest.fn(async () => []),
      listCollections: jest.fn(async () => [
        'hybrid_code_chunks_legacy1',
        'hybrid_code_chunks_legacy2',
        'project_myapp_dataset_backend'
      ]),
      checkCollectionLimit: jest.fn(async () => true),
      getCollectionStats: jest.fn(async () => null),
      hybridSearch: jest.fn(async () => [])
    } as any;

    // Make the mock appear as QdrantVectorDatabase
    Object.defineProperty(mockVectorDb.constructor, 'name', {
      value: 'QdrantVectorDatabase',
      writable: false
    });

    // Mock embedding
    mockEmbedding = {
      detectDimension: jest.fn(async () => 768),
      embedBatch: jest.fn(async (texts: string[]) =>
        texts.map(text => ({ vector: Array(768).fill(0.1), dimension: 768 }))
      ),
      getProvider: jest.fn(() => 'test'),
      embed: jest.fn(async () => ({ vector: Array(768).fill(0.1), dimension: 768 }))
    } as any;

    // Mock PostgreSQL pool client
    mockPoolClient = {
      query: jest.fn(),
      release: jest.fn()
    } as any;

    // Mock pool
    mockPool = {
      connect: jest.fn(async () => mockPoolClient),
      query: jest.fn()
    } as any;

    // Context
    context = new Context({
      vectorDatabase: mockVectorDb,
      embedding: mockEmbedding,
      postgresPool: mockPool
    });
  });

  it('should use project-scoped collections from dataset_collections table', async () => {
    // Setup: Mock database responses for project-scoped query
    (mockPoolClient.query as jest.MockedFunction<any>).mockImplementation(async (sql: string) => {
      // Get or create project
      if (sql.includes('SELECT id, name FROM claude_context.projects WHERE name')) {
        return { rows: [{ id: 'project-abc', name: 'myapp' }] };
      }
      
      // Get accessible datasets
      if (sql.includes('SELECT DISTINCT d.id') && sql.includes('datasets d')) {
        return { rows: [{ id: 'dataset-xyz' }, { id: 'dataset-123' }] };
      }
      
      // Get collections for datasets (Phase 5 query)
      if (sql.includes('dataset_collections') && sql.includes('WHERE dataset_id IN')) {
        return {
          rows: [
            { collection_name: 'project_myapp_dataset_backend' },
            { collection_name: 'project_myapp_dataset_frontend' }
          ]
        };
      }
      
      return { rows: [] };
    });

    const request: ProjectQueryRequest = {
      project: 'myapp',
      query: 'authentication logic',
      codebasePath: '/path/to/code',
      topK: 5
    };

    const response = await queryProject(context, request);

    // Verify: Should query dataset_collections table
    const queryCalls = (mockPoolClient.query as jest.MockedFunction<any>).mock.calls;
    const datasetCollectionsQuery = queryCalls.find((call: any) =>
      call[0].includes('dataset_collections') && call[0].includes('WHERE dataset_id IN')
    );
    
    expect(datasetCollectionsQuery).toBeDefined();
    expect(datasetCollectionsQuery[1]).toEqual(['dataset-xyz', 'dataset-123']);

    // Verify: Results returned
    expect(response.results.length).toBeGreaterThan(0);
    expect(response.results[0].chunk).toContain('authenticate');
  });

  it('should fall back to legacy collection discovery when dataset_collections table does not exist', async () => {
    // Setup: Mock dataset_collections query to fail with "table does not exist" error
    (mockPoolClient.query as jest.MockedFunction<any>).mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT id, name FROM claude_context.projects WHERE name')) {
        return { rows: [{ id: 'project-abc', name: 'myapp' }] };
      }
      
      if (sql.includes('SELECT DISTINCT d.id') && sql.includes('datasets d')) {
        return { rows: [{ id: 'dataset-xyz' }] };
      }
      
      // Simulate table not existing (PostgreSQL error code 42P01)
      if (sql.includes('dataset_collections')) {
        const error: any = new Error('relation "claude_context.dataset_collections" does not exist');
        error.code = '42P01';
        throw error;
      }
      
      return { rows: [] };
    });

    const request: ProjectQueryRequest = {
      project: 'myapp',
      query: 'authentication',
      codebasePath: '/path/to/code',
      topK: 5
    };

    const response = await queryProject(context, request);

    // Verify: Should fall back to listCollections
    expect(mockVectorDb.listCollections).toHaveBeenCalled();

    // Verify: Still returns results from legacy collections
    expect(response.results.length).toBeGreaterThan(0);
  });

  it('should only search collections for accessible datasets', async () => {
    // Setup: User has access to dataset-xyz but not dataset-excluded
    (mockPoolClient.query as jest.MockedFunction<any>).mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT id, name FROM claude_context.projects WHERE name')) {
        return { rows: [{ id: 'project-abc', name: 'myapp' }] };
      }
      
      // Only dataset-xyz is accessible
      if (sql.includes('SELECT DISTINCT d.id') && sql.includes('datasets d')) {
        return { rows: [{ id: 'dataset-xyz' }] };
      }
      
      // dataset_collections has entries for both datasets
      if (sql.includes('dataset_collections') && sql.includes('WHERE dataset_id IN')) {
        return {
          rows: [
            { collection_name: 'project_myapp_dataset_backend' }
            // project_myapp_dataset_excluded is NOT returned because dataset-excluded wasn't in the IN clause
          ]
        };
      }
      
      return { rows: [] };
    });

    const request: ProjectQueryRequest = {
      project: 'myapp',
      query: 'search query',
      codebasePath: '/path/to/code',
      topK: 5
    };

    await queryProject(context, request);

    // Verify: Query included only accessible dataset ID
    const queryCalls = (mockPoolClient.query as jest.MockedFunction<any>).mock.calls;
    const datasetCollectionsQuery = queryCalls.find((call: any) =>
      call[0].includes('dataset_collections') && call[0].includes('WHERE dataset_id IN')
    );
    
    expect(datasetCollectionsQuery).toBeDefined();
    expect(datasetCollectionsQuery[1]).toEqual(['dataset-xyz']);
  });

  it('should handle "all projects" scope correctly', async () => {
    // Setup: Query across all projects
    (mockPoolClient.query as jest.MockedFunction<any>).mockImplementation(async (sql: string) => {
      // Get all dataset IDs
      if (sql.includes('SELECT DISTINCT id FROM claude_context.datasets')) {
        return { rows: [{ id: 'dataset-1' }, { id: 'dataset-2' }, { id: 'dataset-3' }] };
      }
      
      // Get collections for all datasets
      if (sql.includes('dataset_collections') && sql.includes('WHERE dataset_id IN')) {
        return {
          rows: [
            { collection_name: 'project_app1_dataset_backend' },
            { collection_name: 'project_app2_dataset_frontend' },
            { collection_name: 'project_app3_dataset_api' }
          ]
        };
      }
      
      return { rows: [] };
    });

    const request: ProjectQueryRequest = {
      project: 'all',
      query: 'search across all projects',
      codebasePath: '/path/to/code',
      topK: 5
    };

    await queryProject(context, request);

    // Verify: Queried all datasets
    const queryCalls = (mockPoolClient.query as jest.MockedFunction<any>).mock.calls;
    const datasetCollectionsQuery = queryCalls.find((call: any) =>
      call[0].includes('dataset_collections') && call[0].includes('WHERE dataset_id IN')
    );
    
    expect(datasetCollectionsQuery).toBeDefined();
    expect(datasetCollectionsQuery[1]).toEqual(['dataset-1', 'dataset-2', 'dataset-3']);
  });
});
