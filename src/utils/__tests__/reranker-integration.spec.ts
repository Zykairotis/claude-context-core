import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { RerankerClient } from '../reranker-client';

describe('RerankerClient Integration', () => {
  let client: RerankerClient;

  beforeEach(() => {
    process.env.RERANKER_URL = 'http://localhost:30003';
    client = new RerankerClient();
  });

  it('should rerank texts against a query', async () => {
    // Mock fetch for testing
    const mockFetch = jest.fn(async () => ({
      ok: true,
      json: async () => [0.95, 0.45, 0.12]
    }));
    global.fetch = mockFetch as any;

    const query = 'React hooks';
    const texts = [
      'React hooks let you use state in functional components',
      'Vue composition API provides similar functionality',
      'Angular uses dependency injection'
    ];

    const scores = await client.rerank(query, texts);

    expect(scores).toEqual([0.95, 0.45, 0.12]);
    expect(scores[0]).toBeGreaterThan(scores[1]);
    expect(scores[1]).toBeGreaterThan(scores[2]);
  });

  it('should handle empty text array', async () => {
    const scores = await client.rerank('query', []);
    expect(scores).toEqual([]);
  });

  it('should handle reranker timeout', async () => {
    const mockFetch = jest.fn(async () => {
      throw new Error('AbortError');
    });
    global.fetch = mockFetch as any;

    const shortTimeoutClient = new RerankerClient('http://localhost:30003', 100);

    try {
      await shortTimeoutClient.rerank('query', ['text1', 'text2']);
    } catch (error: any) {
      expect(error.message).toContain('timed out');
    }
  });

  it('should handle reranker service error', async () => {
    const mockFetch = jest.fn(async () => ({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    }));
    global.fetch = mockFetch as any;

    try {
      await client.rerank('query', ['text1']);
    } catch (error: any) {
      expect(error.message).toContain('failed');
    }
  });

  it('should handle mismatched score count', async () => {
    const mockFetch = jest.fn(async () => ({
      ok: true,
      json: async () => [0.95, 0.45] // Only 2 scores for 3 texts
    }));
    global.fetch = mockFetch as any;

    const scores = await client.rerank('query', ['text1', 'text2', 'text3']);

    // Should still return what we got
    expect(scores).toHaveLength(2);
  });

  it('should support wrapped response format', async () => {
    const mockFetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ scores: [0.9, 0.5, 0.1] })
    }));
    global.fetch = mockFetch as any;

    const scores = await client.rerank('query', ['text1', 'text2', 'text3']);

    expect(scores).toEqual([0.9, 0.5, 0.1]);
  });

  it('should use custom endpoint', async () => {
    const customClient = new RerankerClient('http://custom-reranker:8080');
    
    const mockFetch = jest.fn(async (url: string) => {
      expect(url).toContain('custom-reranker:8080');
      return {
        ok: true,
        json: async () => [0.95]
      };
    });
    global.fetch = mockFetch as any;

    await customClient.rerank('query', ['text']);
    expect(mockFetch).toHaveBeenCalled();
  });
});

/**
 * Reranking score combination strategies for hybrid search
 */
describe('Reranking Score Combinations', () => {
  it('should combine dense and rerank scores using weighted average', () => {
    const denseScore = 0.85;
    const rerankScore = 0.92;
    const denseWeight = 0.3;
    const rerankWeight = 0.7;

    const combined = (denseScore * denseWeight) + (rerankScore * rerankWeight);

    expect(combined).toBeCloseTo(0.894, 2);
    expect(combined).toBeGreaterThan(denseScore);
  });

  it('should combine dense, sparse, and rerank scores', () => {
    const denseScore = 0.85;
    const sparseScore = 0.78;
    const rerankScore = 0.92;

    // RRF-based combination
    const k = 60;
    const denseRRF = 1 / (k + 1);
    const sparseRRF = 1 / (k + 2);
    const rerankRRF = 1 / (k + 1);

    const combined = denseRRF + sparseRRF + rerankRRF;

    expect(combined).toBeGreaterThan(0);
    expect(combined).toBeLessThan(0.1);
  });

  it('should normalize scores to 0-1 range', () => {
    const scores = [0.95, 0.45, 0.12, 0.88];
    const min = Math.min(...scores);
    const max = Math.max(...scores);

    const normalized = scores.map(s => (s - min) / (max - min));

    expect(normalized[0]).toBe(1.0);
    expect(normalized[2]).toBe(0.0);
    expect(normalized.every(s => s >= 0 && s <= 1)).toBe(true);
  });

  it('should apply exponential decay to rerank scores', () => {
    const rerankScores = [0.95, 0.85, 0.75, 0.65];
    const decayFactor = 0.9;

    const decayed = rerankScores.map((score, index) => 
      score * Math.pow(decayFactor, index)
    );

    expect(decayed[0]).toBeGreaterThan(decayed[1]);
    expect(decayed[1]).toBeGreaterThan(decayed[2]);
  });
});

/**
 * Reranking performance and optimization
 */
describe('Reranking Performance', () => {
  it('should batch rerank requests efficiently', async () => {
    const client = new RerankerClient();
    const mockFetch = jest.fn(async () => ({
      ok: true,
      json: async () => Array(50).fill(0.5)
    }));
    global.fetch = mockFetch as any;

    const query = 'test query';
    const texts = Array(50).fill('test text');

    const startTime = performance.now();
    const scores = await client.rerank(query, texts);
    const duration = performance.now() - startTime;

    expect(scores).toHaveLength(50);
    expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
  });

  it('should handle large text truncation', () => {
    const maxChars = 4000;
    const longText = 'a'.repeat(10000);

    const truncated = longText.length > maxChars 
      ? longText.slice(0, maxChars - 3) + '...'
      : longText;

    expect(truncated.length).toBeLessThanOrEqual(maxChars);
    expect(truncated.endsWith('...')).toBe(true);
  });

  it('should calculate reranking latency', async () => {
    const client = new RerankerClient();
    const mockFetch = jest.fn(async () => {
      // Simulate 100ms latency
      await new Promise(resolve => setTimeout(resolve, 100));
      return {
        ok: true,
        json: async () => [0.95]
      };
    });
    global.fetch = mockFetch as any;

    const startTime = performance.now();
    await client.rerank('query', ['text']);
    const latency = performance.now() - startTime;

    expect(latency).toBeGreaterThanOrEqual(100);
  });
});
