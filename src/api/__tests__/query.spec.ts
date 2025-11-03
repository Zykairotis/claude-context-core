import { describe, it, expect, jest } from '@jest/globals';
import { queryProject } from '../query';
import type { Context } from '../../context';

describe('queryProject', () => {
  it('filters search results to accessible datasets', async () => {
    const queryResponses: Array<{ sql: string; params?: any[] }> = [];

    const client = {
      query: jest.fn(async (sql: string, params?: any[]) => {
        queryResponses.push({ sql, params });

        if (sql.includes('SELECT id, name FROM claude_context.projects')) {
          return { rows: [{ id: 'proj-1', name: 'alpha' }] };
        }

        if (sql.includes('SELECT DISTINCT d.id')) {
          return { rows: [{ id: 'ds-1' }, { id: 'ds-2' }] };
        }

        if (sql.includes('SELECT id FROM claude_context.datasets')) {
          return { rows: [{ id: 'ds-1' }] };
        }

        return { rows: [] };
      }),
      release: jest.fn()
    };

    const pool = {
      connect: jest.fn(async () => client)
    };

    const searchMock = jest.fn(async (_collection: string, _vector: number[], _options: any) => ([
      {
        document: {
          id: 'chunk-1',
          content: 'console.log("hello")',
          relativePath: 'src/index.ts',
          startLine: 1,
          endLine: 3,
          fileExtension: '.ts',
          projectId: 'proj-1',
          datasetId: 'ds-1',
          repo: 'alpha-repo',
          lang: 'typescript',
          metadata: {}
        },
        score: 0.89
      }
    ]));

    const embedMock = jest.fn(async (_query: string) => ({ vector: [0.1, 0.2, 0.3] }));

    const context = {
      getPostgresPool: () => pool,
      getCollectionName: () => 'collection_alpha',
      getVectorDatabase: () => ({ search: searchMock }),
      getEmbedding: () => ({ embed: embedMock }),
      getSpladeClient: () => undefined,
      getRerankerClient: () => undefined
    } as unknown as Context;

    const response = await queryProject(context, {
      project: 'alpha',
      dataset: 'code',
      query: 'hello world',
      codebasePath: '/tmp/repo',
      repo: 'alpha-repo',
      topK: 5
    });

    expect(pool.connect).toHaveBeenCalled();
    expect(embedMock).toHaveBeenCalledWith('hello world');
    expect(searchMock).toHaveBeenCalledWith(
      'collection_alpha',
      [0.1, 0.2, 0.3],
      expect.objectContaining({
        topK: 5,
        filter: expect.objectContaining({
          projectId: 'proj-1',
          datasetIds: ['ds-1']
        })
      })
    );
    expect(response.results).toHaveLength(1);
    expect(response.results[0].scores.vector).toBeCloseTo(0.89);
  });

  it('returns empty array when dataset not accessible', async () => {
    const client = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('SELECT id, name FROM claude_context.projects')) {
          return { rows: [{ id: 'proj-1', name: 'alpha' }] };
        }
        if (sql.includes('SELECT DISTINCT d.id')) {
          return { rows: [] };
        }
        return { rows: [] };
      }),
      release: jest.fn()
    };

    const pool = {
      connect: jest.fn(async () => client)
    };

    const context = {
      getPostgresPool: () => pool,
      getCollectionName: () => 'collection_alpha',
      getVectorDatabase: () => ({ search: jest.fn() }),
      getEmbedding: () => ({ embed: jest.fn() }),
      getSpladeClient: () => undefined,
      getRerankerClient: () => undefined
    } as unknown as Context;
  
    const response = await queryProject(context, {
      project: 'alpha',
      query: 'foo',
      codebasePath: '/tmp/repo'
    });

    expect(response.results).toHaveLength(0);
  });

  it('falls back to searching available collections when the default is missing', async () => {
    const queryResponses: Array<{ sql: string; params?: any[] }> = [];

    const client = {
      query: jest.fn(async (sql: string, params?: any[]) => {
        queryResponses.push({ sql, params });

        if (sql.includes('SELECT id, name FROM claude_context.projects')) {
          return { rows: [{ id: 'proj-1', name: 'alpha' }] };
        }

        if (sql.includes('SELECT DISTINCT d.id')) {
          return { rows: [{ id: 'ds-1' }] };
        }

        if (sql.includes('SELECT id FROM claude_context.datasets')) {
          return { rows: [{ id: 'ds-1' }] };
        }

        return { rows: [] };
      }),
      release: jest.fn()
    };

    const pool = {
      connect: jest.fn(async () => client)
    };

    const searchMock = jest.fn(async (collectionName: string, _vector?: number[], _options?: any) => {
      if (collectionName === 'code_chunks_secondary') {
        return [
          {
            document: {
              id: 'chunk-secondary',
              content: 'secondary match',
              relativePath: 'src/feature.ts',
              startLine: 5,
              endLine: 15,
              fileExtension: '.ts',
              projectId: 'proj-1',
              datasetId: 'ds-1',
              repo: 'alpha-repo',
              lang: 'typescript',
              metadata: {}
            },
            score: 0.91
          }
        ];
      }

      return [];
    });

    const embedMock = jest.fn(async (_query: string) => ({ vector: [0.2, 0.4, 0.6] }));

    const hasCollectionMock = jest.fn(async (_collectionName: string) => false);
    const listCollectionsMock = jest.fn(async () => ['hybrid_code_chunks_primary', 'code_chunks_secondary']);

    const vectorDatabase = {
      search: searchMock,
      hasCollection: hasCollectionMock,
      listCollections: listCollectionsMock
    };

    const context = {
      getPostgresPool: () => pool,
      getCollectionName: () => 'missing_collection',
      getVectorDatabase: () => vectorDatabase,
      getEmbedding: () => ({ embed: embedMock }),
      getSpladeClient: () => undefined,
      getRerankerClient: () => undefined
    } as unknown as Context;

    const response = await queryProject(context, {
      project: 'alpha',
      dataset: 'code',
      query: 'secondary',
      codebasePath: '/tmp/repo',
      repo: 'alpha-repo',
      topK: 3
    });

    expect(hasCollectionMock).toHaveBeenCalledWith('missing_collection');
    expect(listCollectionsMock).toHaveBeenCalled();
    expect(searchMock).toHaveBeenCalledTimes(2);
    expect(searchMock).toHaveBeenCalledWith('code_chunks_secondary', [0.2, 0.4, 0.6], expect.any(Object));
    expect(response.results).toHaveLength(1);
    expect(response.results[0].chunk).toBe('secondary match');
  });
});
