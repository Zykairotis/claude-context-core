/**
 * Client for SPLADE sparse vector generation service
 * Generates sparse term vectors for hybrid search
 */

export interface SparseVector {
  indices: number[];
  values: number[];
}

export interface SpladeRequest {
  text: string;
  batch?: string[];
}

export interface SpladeResponse {
  sparse?: SparseVector;
  sparse_vectors?: SparseVector[];
}

export class SpladeClient {
  private baseUrl: string;
  private timeout: number;
  private enabled: boolean;
  private endpoints: string[];
  private currentEndpointIndex: number;
  private maxRetries: number;
  private retryDelay: number;

  constructor(baseUrl?: string, timeout: number = 30000) {
    this.timeout = timeout;
    this.enabled = process.env.ENABLE_HYBRID_SEARCH === 'true';
    const candidates: string[] = [];

    const addCandidate = (candidate?: string | null) => {
      if (!candidate) return;
      const trimmed = candidate.trim();
      if (!trimmed) return;
      if (!candidates.includes(trimmed)) {
        candidates.push(trimmed);
      }
    };

    addCandidate(baseUrl ?? process.env.SPLADE_URL ?? null);

    const fallbackList = process.env.SPLADE_FALLBACK_URLS?.split(',') ?? [];
    fallbackList.forEach(item => addCandidate(item));

    // Known endpoints for docker-compose and host environments
    addCandidate('http://splade-runner:8000');
    addCandidate('http://host.docker.internal:30004');
    addCandidate('http://localhost:30004');

    if (candidates.length === 0) {
      candidates.push('http://localhost:30004');
    }

    this.endpoints = candidates;
    this.currentEndpointIndex = 0;
    this.baseUrl = this.endpoints[this.currentEndpointIndex];

    const retriesEnv = Number(process.env.SPLADE_MAX_RETRIES);
    this.maxRetries = Number.isFinite(retriesEnv) && retriesEnv > 0
      ? Math.floor(retriesEnv)
      : 3;

    const retryDelayEnv = Number(process.env.SPLADE_RETRY_DELAY_MS);
    this.retryDelay = Number.isFinite(retryDelayEnv) && retryDelayEnv >= 250
      ? Math.floor(retryDelayEnv)
      : 1000;

    if (this.enabled) {
      console.log(`[SpladeClient] Initialized with endpoint candidates: ${this.endpoints.join(', ')} (retries=${this.maxRetries}, delay=${this.retryDelay}ms)`);
    }
  }

  /**
   * Check if SPLADE is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Compute sparse vector for a single text
   * @param text Input text to convert to sparse representation
   * @returns Sparse vector with indices and values
   */
  async computeSparse(text: string): Promise<SparseVector> {
    if (!this.enabled) {
      return { indices: [], values: [] };
    }

    try {
      const result = await this.requestWithFallback<SpladeResponse>('/sparse', { text });
      
      if (!result.sparse) {
        throw new Error('Invalid SPLADE response format: missing sparse field');
      }

      return result.sparse;
    } catch (error: any) {
      this.disableAfterFailure(error);

      if (error.name === 'AbortError') {
        console.error(`[SpladeClient] Request timed out after ${this.timeout}ms`);
        throw new Error(`SPLADE timeout after ${this.timeout}ms`);
      }
      
      console.error('[SpladeClient] Sparse computation failed:', error);
      throw error;
    }
  }

  /**
   * Compute sparse vectors for multiple texts in batch
   * @param texts Array of input texts
   * @returns Array of sparse vectors
   */
  async computeSparseBatch(texts: string[]): Promise<SparseVector[]> {
    if (!this.enabled || texts.length === 0) {
      return texts.map(() => ({ indices: [], values: [] }));
    }

    try {
      const result = await this.requestWithFallback<SpladeResponse>('/sparse/batch', { batch: texts }, this.timeout * 2);
      
      if (!result.sparse_vectors || !Array.isArray(result.sparse_vectors)) {
        throw new Error('Invalid SPLADE batch response format');
      }

      if (result.sparse_vectors.length !== texts.length) {
        console.warn(`[SpladeClient] Batch size mismatch: expected ${texts.length}, got ${result.sparse_vectors.length}`);
      }

      return result.sparse_vectors;
    } catch (error: any) {
      this.disableAfterFailure(error);

      if (error.name === 'AbortError') {
        console.error(`[SpladeClient] Batch request timed out after ${this.timeout * 2}ms`);
        throw new Error(`SPLADE batch timeout after ${this.timeout * 2}ms`);
      }
      
      console.error('[SpladeClient] Sparse batch computation failed:', error);
      throw error;
    }
  }

  /**
   * Check if SPLADE service is available
   */
  async healthCheck(): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    try {
      const response = await this.executeWithFallback('GET', '/health', undefined, 5000);
      return !!response?.ok;
    } catch (error) {
      console.warn('[SpladeClient] Health check failed:', error);
      return false;
    }
  }

  /**
   * Perform a JSON POST request with automatic endpoint fallback
   */
  private async requestWithFallback<T>(path: string, payload: any, timeoutMs?: number): Promise<T> {
    const response = await this.executeWithFallback('POST', path, payload, timeoutMs);
    return await response.json() as T;
  }

  /**
   * Execute fetch with retries across configured endpoints
   */
  private async executeWithFallback(
    method: 'GET' | 'POST',
    path: string,
    payload?: any,
    timeoutMs?: number
  ): Promise<Response> {
    let lastError: any;
    const timeout = timeoutMs ?? (method === 'GET' ? 5000 : this.timeout);

    outer: for (let index = 0; index < this.endpoints.length; index++) {
      const endpoint = this.endpoints[index];

      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        const controller = new AbortController();
        const timer = timeout > 0 ? setTimeout(() => controller.abort(), timeout) : undefined;

        try {
          const response = await fetch(`${endpoint}${path}`, {
            method,
            headers: method === 'POST'
              ? { 'Content-Type': 'application/json' }
              : undefined,
            body: method === 'POST' && payload !== undefined ? JSON.stringify(payload) : undefined,
            signal: controller.signal
          });

          if (!response.ok) {
            const error = Object.assign(new Error(`SPLADE request failed: ${response.status} ${response.statusText}`), {
              status: response.status,
            });

            if (timer) {
              clearTimeout(timer);
            }

            throw error;
          }

          if (timer) {
            clearTimeout(timer);
          }

          if (index !== this.currentEndpointIndex) {
            this.currentEndpointIndex = index;
            this.baseUrl = endpoint;
            console.warn(`[SpladeClient] Switched to reachable endpoint: ${endpoint}`);
          }

          return response;
        } catch (error: any) {
          if (timer) {
            clearTimeout(timer);
          }

          lastError = error;

          const retryable = attempt < this.maxRetries && this.isRetryableError(error);
          if (retryable) {
            const delay = this.retryDelay * attempt;
            console.warn(`[SpladeClient] Retryable error on ${endpoint}${path} (attempt ${attempt}/${this.maxRetries}): ${error?.message || error}. Retrying in ${delay}ms`);
            await this.sleep(delay);
            continue;
          }

          if (this.shouldTryAlternateEndpoint(index, error)) {
            this.logEndpointFailure(endpoint, error);
            continue outer;
          }

          throw error;
        }
      }
    }

    throw lastError;
  }

  /**
   * Determine if we should try the next endpoint after a failure
   */
  private shouldTryAlternateEndpoint(index: number, reason: any): boolean {
    if (index >= this.endpoints.length - 1) {
      return false;
    }

    if (reason && typeof reason === 'object') {
      if (typeof reason.status === 'number') {
        return reason.status >= 500 || reason.status === 0;
      }

      const code = reason?.cause?.code ?? reason?.code;
      if (code && ['ECONNREFUSED', 'EHOSTUNREACH', 'ENOTFOUND', 'ECONNRESET', 'ETIMEDOUT'].includes(code)) {
        return true;
      }

      if (reason.name === 'AbortError') {
        return true;
      }

      const message = String(reason.message ?? '').toLowerCase();
      if (message.includes('fetch failed') || message.includes('network request failed')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Log endpoint failure detail before trying the next candidate
   */
  private logEndpointFailure(endpoint: string, detail: any): void {
    let description: string;

    if (typeof detail === 'string') {
      description = detail;
    } else if (typeof detail?.status === 'number') {
      description = `status ${detail.status}`;
    } else if (detail?.cause?.code) {
      description = detail.cause.code;
    } else if (detail?.code) {
      description = detail.code;
    } else if (detail?.message) {
      description = detail.message;
    } else {
      description = String(detail);
    }

    console.warn(`[SpladeClient] Endpoint ${endpoint} unavailable (${description}). Trying fallback...`);
  }

  private isRetryableError(reason: any): boolean {
    if (!reason) {
      return false;
    }

    if (typeof reason.status === 'number') {
      return reason.status === 408 || reason.status === 429 || reason.status >= 500;
    }

    const code = reason?.cause?.code ?? reason?.code;
    if (code && ['ECONNREFUSED', 'EHOSTUNREACH', 'ENOTFOUND', 'ECONNRESET', 'ETIMEDOUT'].includes(code)) {
      return true;
    }

    if (reason.name === 'AbortError') {
      return true;
    }

    const message = String(reason?.message ?? '').toLowerCase();
    return message.includes('fetch failed') || message.includes('network request failed');
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Disable SPLADE usage after repeated connection failures to avoid noisy retries
   */
  private disableAfterFailure(error: any): void {
    if (!this.enabled) {
      return;
    }

    const code = error?.cause?.code ?? error?.code;
    const shouldDisable = code && ['ECONNREFUSED', 'EHOSTUNREACH', 'ENOTFOUND'].includes(code);

    if (shouldDisable) {
      this.enabled = false;
      console.warn('[SpladeClient] Disabling hybrid search after connection failure. Falling back to dense-only mode.');
    }
  }
}
