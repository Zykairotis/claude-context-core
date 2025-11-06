import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Context } from '../../context';
import type { VectorDatabase } from '../../vectordb';
import type { Embedding } from '../../embedding';
import type { Pool, PoolClient } from 'pg';

describe('Context.indexWebPages', () => {
  let context: Context;
  let mockVectorDb: jest.Mocked<VectorDatabase>;
  let mockEmbedding: jest.Mocked<Embedding>;
  let mockPoolClient: jest.Mocked<PoolClient>;
  let mockPool: jest.Mocked<Pool>;

  beforeEach(() => {
    // Mock vector database
    mockVectorDb = {
      hasCollection: jest.fn(async () => false),
      createHybridCollection: jest.fn(async () => {}),
      createCollection: jest.fn(async () => {}),
      dropCollection: jest.fn(async () => {}),
      insertHybrid: jest.fn(async () => {}),
      insert: jest.fn(async () => {}),
      search: jest.fn(async () => []),
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
      connect: jest.fn(async () => mockPoolClient),
      query: jest.fn(async (sql: string) => {
        if (sql.includes('dataset_collections')) {
          return { rows: [{ id: 'collection-123' }] };
        }
        return { rows: [] };
      })
    } as any;

    // Create context with mocks
    context = new Context({
      vectorDatabase: mockVectorDb,
      embedding: mockEmbedding,
      postgresPool: mockPool
    });
  });

  it('should parse markdown sections correctly', async () => {
    const pages = [
      {
        url: 'https://example.com/docs',
        content: `
# Title

Some text here.

\`\`\`typescript
function hello() {
  console.log('hello');
}
\`\`\`

More text.
        `,
        title: 'Test Page'
      }
    ];

    const stats = await context.indexWebPages(pages, 'test-project', 'test-dataset');

    expect(stats.processedPages).toBe(1);
    expect(stats.totalChunks).toBeGreaterThan(0);
    expect(stats.status).toBe('completed');
  });

  it('should handle multiple pages', async () => {
    const pages = [
      {
        url: 'https://example.com/page1',
        content: '# Page 1\n\nContent here.',
        title: 'Page 1'
      },
      {
        url: 'https://example.com/page2',
        content: '# Page 2\n\nMore content.',
        title: 'Page 2'
      }
    ];

    const stats = await context.indexWebPages(pages, 'test-project', 'test-dataset');

    expect(stats.processedPages).toBe(2);
    expect(stats.totalChunks).toBeGreaterThan(0);
  });

  it('should extract domain from URL', async () => {
    const pages = [
      {
        url: 'https://react.dev/docs/hooks',
        content: '# React Hooks\n\nDocumentation here.'
      }
    ];

    const stats = await context.indexWebPages(pages, 'test-project', 'test-dataset');

    expect(stats.processedPages).toBe(1);
    // Should call either insert or insertHybrid depending on SPLADE availability
    expect(mockVectorDb.insert).toHaveBeenCalled();
  });

  it('should throw error if no PostgreSQL pool', async () => {
    const contextNoDB = new Context({
      vectorDatabase: mockVectorDb,
      embedding: mockEmbedding
    });

    const pages = [
      {
        url: 'https://example.com/docs',
        content: '# Title\n\nContent here.'
      }
    ];

    await expect(
      contextNoDB.indexWebPages(pages, 'test-project', 'test-dataset')
    ).rejects.toThrow('PostgreSQL pool required');
  });
});
