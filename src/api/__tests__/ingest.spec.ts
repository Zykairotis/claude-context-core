import { describe, it, expect, jest } from '@jest/globals';
import { ingestGithubRepository, ingestCrawlPages, deleteGithubDataset } from '../ingest';
import type { Context } from '../../context';

describe('ingestGithubRepository', () => {
  it('returns completed status when indexing succeeds', async () => {
    const indexMock = jest.fn(async () => ({
      indexedFiles: 3,
      totalChunks: 42,
      status: 'completed' as const
    }));

    const progressMock = jest.fn();

    const context = {
      indexWithProject: indexMock
    } as unknown as Context;

    const response = await ingestGithubRepository(context, {
      project: 'alpha',
      repo: 'alpha-repo',
      codebasePath: '/tmp/repo',
      branch: 'main',
      sha: 'deadbeef',
      onProgress: progressMock
    });

    const [callPath, callProject, callDataset, callOptions] = (indexMock as jest.Mock).mock.calls[0];
    expect(callPath).toBe('/tmp/repo');
    expect(callProject).toBe('alpha');
    expect(callDataset).toBe('alpha-repo');
    expect(callOptions).toEqual(expect.objectContaining({
      repo: 'alpha-repo',
      branch: 'main',
      sha: 'deadbeef',
      progressCallback: expect.any(Function),
      forceReindex: undefined
    }));

    expect(progressMock).not.toHaveBeenCalled(); // progressCallback bubbles through context
    expect(response.status).toBe('completed');
    expect(response.stats?.totalChunks).toBe(42);
  });

  it('returns failed status when indexing throws', async () => {
    const indexMock = jest.fn(async () => {
      throw new Error('boom');
    });

    const context = {
      indexWithProject: indexMock
    } as unknown as Context;

    const response = await ingestGithubRepository(context, {
      project: 'alpha',
      repo: 'alpha-repo',
      codebasePath: '/tmp/repo'
    });

    expect(response.status).toBe('failed');
    expect(response.error).toContain('boom');
  });
});

describe('ingestCrawlPages', () => {
  it('fails fast when no postgres pool configured', async () => {
    const context = {
      getPostgresPool: () => undefined
    } as unknown as Context;

    const response = await ingestCrawlPages(context, {
      project: 'alpha',
      dataset: 'web',
      pages: [{
        url: 'https://example.com/docs',
        markdownContent: '# Example'
      }]
    });

    expect(response.status).toBe('failed');
    expect(response.error).toMatch(/not configured/i);
  });

  it('upserts pages via upsert_web_page_v3', async () => {
    const queryMock = jest.fn(async (sql: string, params?: any[]) => {
      if (sql.startsWith('SELECT upsert_web_page_v3')) {
        return { rows: [{ id: 'page-123' }] };
      }
      return { rows: [] };
    });

    const client = {
      query: queryMock,
      release: jest.fn()
    };

    const pool = {
      connect: jest.fn(async () => client)
    };

    const context = {
      getPostgresPool: () => pool
    } as unknown as Context;

    const response = await ingestCrawlPages(context, {
      project: 'alpha',
      dataset: 'web',
      pages: [{
        url: 'https://example.com/docs',
        markdownContent: '# Example',
        htmlContent: '<h1>Example</h1>',
        title: 'Example',
        contentHash: 'hash'
      }]
    });

    expect(pool.connect).toHaveBeenCalled();
    expect(queryMock).toHaveBeenCalledWith('BEGIN');
    expect(queryMock).toHaveBeenCalledWith('COMMIT');
    expect(queryMock).toHaveBeenCalledWith(
      'SELECT upsert_web_page_v3($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) AS id',
      expect.any(Array)
    );
    expect(response.status).toBe('completed');
    expect(response.pageIds).toEqual(['page-123']);
  });
});

describe('deleteGithubDataset', () => {
  it('returns not_found when project does not exist', async () => {
    const client = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FROM claude_context.projects')) {
          return { rows: [] };
        }
        throw new Error('unexpected query');
      }),
      release: jest.fn()
    };

    const pool = {
      connect: jest.fn(async () => client)
    };

    const context = {
      getPostgresPool: () => pool,
      getVectorDatabase: () => ({
        listCollections: jest.fn(),
        deleteByDataset: jest.fn(async (_collection: string, _dataset: string) => 0)
      })
    } as unknown as Context;

    const response = await deleteGithubDataset(context, {
      project: 'missing',
      dataset: 'atlas'
    });

    expect(response.status).toBe('not_found');
    expect(response.message).toMatch(/project/i);
    expect(pool.connect).toHaveBeenCalled();
    expect(client.release).toHaveBeenCalled();
  });

  it('deletes dataset and associated vectors', async () => {
    const queryMock = jest.fn(async (sql: string, params?: any[]) => {
      if (sql.includes('FROM claude_context.projects')) {
        return { rows: [{ id: 'proj-123' }] };
      }

      if (sql.includes('FROM claude_context.datasets')) {
        return { rows: [{ id: 'dataset-456' }] };
      }

      if (sql.startsWith('DELETE FROM claude_context.datasets')) {
        expect(params).toEqual(['dataset-456']);
        return { rowCount: 1 };
      }

      throw new Error(`unexpected query ${sql}`);
    });

    const client = {
      query: queryMock,
      release: jest.fn()
    };

    const pool = {
      connect: jest.fn(async () => client)
    };

    const vectorDb = {
      listCollections: jest.fn(async () => ['hybrid_code_chunks_aaaa']),
      deleteByDataset: jest.fn(async (_collection: string, _dataset: string) => 7)
    };

    const context = {
      getPostgresPool: () => pool,
      getVectorDatabase: () => vectorDb
    } as unknown as Context;

    const response = await deleteGithubDataset(context, {
      project: 'alpha',
      dataset: 'atlas'
    });

    expect(response.status).toBe('deleted');
    expect(response.projectId).toBe('proj-123');
    expect(response.datasetId).toBe('dataset-456');
    expect(response.deletedVectors).toBe(7);
    expect(vectorDb.deleteByDataset).toHaveBeenCalledWith('hybrid_code_chunks_aaaa', 'dataset-456');
    expect(queryMock).toHaveBeenCalledWith('DELETE FROM claude_context.datasets WHERE id = $1', ['dataset-456']);
    expect(client.release).toHaveBeenCalled();
  });

  it('derives dataset name from repo when dataset omitted', async () => {
    const queryMock = jest.fn(async (sql: string) => {
      if (sql.includes('FROM claude_context.projects')) {
        return { rows: [{ id: 'proj-1' }] };
      }

      if (sql.includes('FROM claude_context.datasets')) {
        return { rows: [{ id: 'dataset-1' }] };
      }

      if (sql.startsWith('DELETE FROM claude_context.datasets')) {
        return { rowCount: 1 };
      }

      throw new Error('unexpected query');
    });

    const client = {
      query: queryMock,
      release: jest.fn()
    };

    const pool = {
      connect: jest.fn(async () => client)
    };

    const vectorDb = {
      listCollections: jest.fn(async () => []),
      deleteByDataset: jest.fn(async () => 0)
    };

    const context = {
      getPostgresPool: () => pool,
      getVectorDatabase: () => vectorDb
    } as unknown as Context;

    const response = await deleteGithubDataset(context, {
      project: 'alpha',
      repo: 'https://github.com/org/service.git'
    });

    expect(response.dataset).toBe('org-service');
    expect(response.status).toBe('deleted');
  });
});
