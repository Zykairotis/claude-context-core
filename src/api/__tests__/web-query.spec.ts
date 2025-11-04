import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { queryWebContent, WebQueryRequest } from '../query';
import { Context } from '../../context';
import type { VectorDatabase, VectorSearchResult } from '../../vectordb';
import type { Embedding } from '../../embedding';
import type { Pool, PoolClient } from 'pg';

describe('queryWebContent', () => {
  let context: Context;
  let mockVectorDb: jest.Mocked<VectorDatabase>;
  let mockEmbedding: jest.Mocked<Embedding>;
  let mockPoolClient: jest.Mocked<PoolClient>;
  let mockPool: jest.Mocked<Pool>;

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
        {
          document: {
            id: 'web_abc123_0',
            vector: Array(1536).fill(0.1),
            content: 'React hooks are functions that let you use state in functional components',
            relativePath: 'https://react.dev/docs/hooks',
            startLine: 0,
            endLine: 0,
            fileExtension: '.md',
            projectId: 'project-123',
            datasetId: 'dataset-123',
            sourceType: 'web_page',
            metadata: {
              title: 'React Hooks',
              domain: 'react.dev',
              isCode: false
            }
          },
          score: 0.85
        }
      ]),
      delete: jest.fn(async () => {}),
      deleteByDataset: jest.fn(async () => 0),
      query: jest.fn(async () => []),
      listCollections: jest.fn(async () => []),
      checkCollectionLimit: jest.fn(async () => true),
      getCollectionStats: jest.fn(async () => null),
      hybridSearch: jest.fn(async () => [])
    } as any;

    // Mock embedding
    mockEmbedding = {
      detectDimension: jest.fn(async () => 1536),
      embedBatch: jest.fn(async (texts: string[]) =>
        texts.map(text => ({
          vector: Array(1536).fill(0.1),
          dimension: 1536
        }))
      ),
      getProvider: jest.fn(() => 'test'),
      embed: jest.fn(async () => ({
        vector: Array(1536).fill(0.1),
        dimension: 1536
      }))
    } as any;

    // Mock PostgreSQL pool client
    mockPoolClient = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('projects')) {
          return { rows: [{ id: 'project-123', name: 'test-project' }] };
        }
        if (sql.includes('datasets')) {
          return { rows: [{ id: 'dataset-123', name: 'test-dataset' }] };
        }
        return { rows: [] };
      }),
      release: jest.fn()
    } as any;

    // Mock PostgreSQL pool
    mockPool = {
      connect: jest.fn(async () => mockPoolClient)
    } as any;

    // Create context with mocks
    context = new Context({
      vectorDatabase: mockVectorDb,
      embedding: mockEmbedding,
      postgresPool: mockPool
    });
  });

  it('should query web content with dense search', async () => {
    process.env.ENABLE_HYBRID_SEARCH = 'false';

    const request: WebQueryRequest = {
      query: 'How to use React hooks?',
      project: 'test-project',
      topK: 10
    };

    const response = await queryWebContent(context, request);

    expect(response.requestId).toBeDefined();
    expect(response.results).toHaveLength(1);
    expect(response.results[0].chunk).toContain('React hooks');
    expect(response.metadata.retrievalMethod).toBe('dense');
    expect(mockVectorDb.search).toHaveBeenCalled();
  });

  it('should return empty results for non-existent dataset', async () => {
    // Create new mock for this test
    const testPoolClient = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('projects')) {
          return { rows: [{ id: 'project-123', name: 'test-project' }] };
        }
        if (sql.includes('datasets')) {
          return { rows: [] }; // No datasets
        }
        return { rows: [] };
      }),
      release: jest.fn()
    } as any;

    const testPool = {
      connect: jest.fn(async () => testPoolClient)
    } as any;

    const testContext = new Context({
      vectorDatabase: mockVectorDb,
      embedding: mockEmbedding,
      postgresPool: testPool
    });

    const request: WebQueryRequest = {
      query: 'test query',
      project: 'test-project',
      dataset: 'non-existent'
    };

    const response = await queryWebContent(testContext, request);

    expect(response.results).toHaveLength(0);
    expect(response.metadata.queriesExecuted).toBe(0);
  });

  it('should include score breakdown in results', async () => {
    const request: WebQueryRequest = {
      query: 'React hooks',
      project: 'test-project',
      topK: 10
    };

    const response = await queryWebContent(context, request);

    expect(response.results[0].scores).toBeDefined();
    expect(response.results[0].scores.vector).toBeDefined();
    expect(response.results[0].scores.final).toBeDefined();
  });

  it('should track timing metrics', async () => {
    const request: WebQueryRequest = {
      query: 'test query',
      project: 'test-project'
    };

    const response = await queryWebContent(context, request);

    expect(response.metadata.timingMs.embedding).toBeGreaterThanOrEqual(0);
    expect(response.metadata.timingMs.search).toBeGreaterThanOrEqual(0);
    expect(response.metadata.timingMs.total).toBeGreaterThanOrEqual(0);
  });

  it('should throw error if no PostgreSQL pool', async () => {
    const contextNoDB = new Context({
      vectorDatabase: mockVectorDb,
      embedding: mockEmbedding
    });

    const request: WebQueryRequest = {
      query: 'test query',
      project: 'test-project'
    };

    await expect(queryWebContent(contextNoDB, request)).rejects.toThrow(
      'PostgreSQL pool required'
    );
  });

  it('should handle specific dataset filtering', async () => {
    const request: WebQueryRequest = {
      query: 'React hooks',
      project: 'test-project',
      dataset: 'test-dataset',
      topK: 5
    };

    const response = await queryWebContent(context, request);

    expect(response.results).toBeDefined();
    expect(mockVectorDb.search).toHaveBeenCalledWith(
      expect.stringContaining('web_'),
      expect.any(Array),
      expect.objectContaining({
        topK: 5
      })
    );
  });
});
