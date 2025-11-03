/**
 * Client for TEI (Text Embeddings Inference) reranker endpoint
 * Supports BAAI/bge-reranker-v2-m3 and similar cross-encoder models
 */

export interface RerankRequest {
  query: string;
  texts: string[];
}

export interface RerankResult {
  scores: number[];
}

export interface RerankScore {
  index: number;
  score: number;
}

export class RerankerClient {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl?: string, timeout: number = 30000) {
    this.baseUrl = baseUrl || process.env.RERANKER_URL || 'http://localhost:30003';
    this.timeout = timeout;
    console.log(`[RerankerClient] Initialized with endpoint: ${this.baseUrl}`);
  }

  /**
   * Rerank a list of texts against a query using cross-encoder
   * @param query The search query
   * @param texts Array of candidate texts to rerank
   * @returns Array of scores (same order as input texts)
   */
  async rerank(query: string, texts: string[]): Promise<number[]> {
    if (texts.length === 0) {
      return [];
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}/rerank`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          texts
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Reranker request failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      // TEI returns array of scores directly or wrapped in a scores field
      const scores = Array.isArray(result) ? result : result.scores;
      
      if (!Array.isArray(scores)) {
        throw new Error('Invalid reranker response format');
      }

      // Validate we got the right number of scores
      if (scores.length !== texts.length) {
        console.warn(`[RerankerClient] Score count mismatch: expected ${texts.length}, got ${scores.length}`);
      }

      return scores;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.error(`[RerankerClient] Rerank request timed out after ${this.timeout}ms`);
        throw new Error(`Reranker timeout after ${this.timeout}ms`);
      }
      
      console.error('[RerankerClient] Rerank request failed:', error);
      throw error;
    }
  }

  /**
   * Rerank and return sorted results with scores
   * @param query The search query
   * @param texts Array of candidate texts to rerank
   * @param topK Optional: return only top K results
   * @returns Array of {index, score} sorted by score descending
   */
  async rerankWithIndices(query: string, texts: string[], topK?: number): Promise<RerankScore[]> {
    const scores = await this.rerank(query, texts);
    
    const results: RerankScore[] = scores.map((score, index) => ({ index, score }));
    results.sort((a, b) => b.score - a.score);

    if (topK) {
      return results.slice(0, topK);
    }

    return results;
  }

  /**
   * Check if reranker is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.warn('[RerankerClient] Health check failed:', error);
      return false;
    }
  }
}

