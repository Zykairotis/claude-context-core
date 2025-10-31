import { Embedding, EmbeddingVector } from './base-embedding';

export type { EmbeddingVector } from './base-embedding';

export interface EmbeddingMonsterConfig {
  model: 'gte' | 'coderank';
  gtePort?: number;
  coderankPort?: number;
  maxTokens?: number;
  timeout?: number;
  retries?: number;
}

export interface EmbeddingResponse {
  embeddings?: number[][];
  model?: string;
  usage?: {
    prompt_tokens?: number;
    total_tokens?: number;
  };
}

export type DirectEmbeddingResponse = number[][];

export interface HealthResponse {
  status: 'ok' | 'error';
  model?: string;
  version?: string;
  timestamp?: string;
}

/**
 * EmbeddingMonster provider supporting both Stella (text) and CodeRankEmbed (code) models
 */
export class EmbeddingMonster extends Embedding {
  private dimension: number;
  protected maxTokens: number;
  private timeout: number;
  private retries: number;
  private baseUrl: string;

  constructor(private config: EmbeddingMonsterConfig) {
    super();
    
    this.config = {
      gtePort: 30001,
      coderankPort: 30002,
      maxTokens: 8192,
      timeout: 30000,
      retries: 3,
      ...config
    };

    // Set dimension based on model
    this.dimension = this.config.model === 'gte' ? 768 : 768;
    
    // Set token limits per model (GTE and CodeRank have no hard token limits)
    this.maxTokens = this.config.maxTokens || 8192;
    this.timeout = this.config.timeout || 30000;
    this.retries = this.config.retries || 3;

    // Set base URL based on model
    const port = this.config.model === 'gte' ? this.config.gtePort : this.config.coderankPort;
    this.baseUrl = `http://localhost:${port}`;
  }

  private getModelName(): string {
    return this.config.model === 'gte' ? 'gte-base-en-v1.5' : 'coderank';
  }

  private getEndpoint(): string {
    return `${this.baseUrl}/embed`;
  }

  private getHealthEndpoint(): string {
    return `${this.baseUrl}/health`;
  }

  private async makeRequest(url: string, body: any, method: string = 'POST'): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private async retryRequest<T>(requestFn: () => Promise<T>, operation: string): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= this.retries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error;
        const isLastAttempt = attempt === this.retries;

        if (!isLastAttempt) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff, max 5s
          console.warn(
            `[EmbeddingMonster] ⚠️ ${operation} failed (attempt ${attempt}/${this.retries}), retrying in ${delay}ms:`,
            error instanceof Error ? error.message : error
          );
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.error(
            `[EmbeddingMonster] ❌ ${operation} failed after ${this.retries} attempts:`,
            error instanceof Error ? error.message : error
          );
        }
      }
    }

    throw lastError;
  }

  /**
   * Check health of the embedding service
   */
  async checkHealth(): Promise<HealthResponse> {
    try {
      const response = await this.makeRequest(this.getHealthEndpoint(), {}, 'GET');
      
      if (!response.ok) {
        throw new Error(`Health check failed with status ${response.status}`);
      }

      return await response.json() as HealthResponse;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Health check failed for ${this.config.model} service: ${errorMessage}`);
    }
  }

  private preprocessForCodeRank(text: string): string {
    if (this.config.model !== 'coderank') {
      return text;
    }

    // Add query prefix for code search if it looks like a query (not code)
    const isLikelyQuery = 
      !text.includes('\n') &&
      !text.includes('function') &&
      !text.includes('class') &&
      !text.includes('import') &&
      !text.includes('export') &&
      text.length < 200;

    if (isLikelyQuery) {
      return `Represent this query for searching relevant code: ${text}`;
    }

    return text;
  }

  async embed(text: string): Promise<EmbeddingVector> {
    const processedText = this.preprocessText(text);
    const finalText = this.preprocessForCodeRank(processedText);

    return this.retryRequest(async () => {
      console.log(
        `[EmbeddingMonster] 🎯 Generating embedding for ${this.config.model} model (text length: ${finalText.length})`
      );

      const requestBody = {
        inputs: [finalText],
        model: this.getModelName(),
      };

      const response = await this.makeRequest(this.getEndpoint(), requestBody);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json() as EmbeddingResponse | DirectEmbeddingResponse;

      // Handle both response formats: {embeddings: [...]} and direct array [...]
      let embeddings: number[][];
      if (Array.isArray(result)) {
        // Direct array response: [[...], [...]]
        embeddings = result;
      } else if (result && Array.isArray((result as EmbeddingResponse).embeddings)) {
        // Object response: {embeddings: [[...], [...]]}
        embeddings = (result as EmbeddingResponse).embeddings!;
      } else {
        throw new Error('Invalid response: missing embeddings');
      }

      const embedding = embeddings[0];

      if (embedding.length !== this.dimension) {
        console.warn(
          `[EmbeddingMonster] ⚠️ Unexpected embedding dimension: ${embedding.length}, expected: ${this.dimension}`
        );
        this.dimension = embedding.length;
      }

      console.log(
        `[EmbeddingMonster] ✅ Generated embedding for ${this.config.model} (dimension: ${embedding.length})`
      );

      return {
        vector: embedding,
        dimension: embedding.length
      };
    }, `embed(${this.config.model})`);
  }

  async embedBatch(texts: string[]): Promise<EmbeddingVector[]> {
    const processedTexts = this.preprocessTexts(texts);
    const finalTexts = processedTexts.map(text => this.preprocessForCodeRank(text));

    return this.retryRequest(async () => {
      console.log(
        `[EmbeddingMonster] 🎯 Generating batch embeddings for ${this.config.model} model (${texts.length} texts)`
      );

      const requestBody = {
        inputs: finalTexts,
        model: this.getModelName(),
      };

      const response = await this.makeRequest(this.getEndpoint(), requestBody);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json() as EmbeddingResponse | DirectEmbeddingResponse;

      // Handle both response formats: {embeddings: [...]} and direct array [...]
      let embeddings: number[][];
      if (Array.isArray(result)) {
        // Direct array response: [[...], [...]]
        embeddings = result;
      } else if (result && Array.isArray((result as EmbeddingResponse).embeddings)) {
        // Object response: {embeddings: [[...], [...]]}
        embeddings = (result as EmbeddingResponse).embeddings!;
      } else {
        throw new Error('Invalid response: missing or invalid embeddings array');
      }

      if (embeddings.length !== finalTexts.length) {
        throw new Error(
          `Embedding count mismatch: expected ${finalTexts.length}, got ${embeddings.length}`
        );
      }

      // Check first embedding dimension
      const firstEmbedding = embeddings[0];
      if (firstEmbedding.length !== this.dimension) {
        console.warn(
          `[EmbeddingMonster] ⚠️ Unexpected batch embedding dimension: ${firstEmbedding.length}, expected: ${this.dimension}`
        );
        this.dimension = firstEmbedding.length;
      }

      console.log(
        `[EmbeddingMonster] ✅ Generated ${embeddings.length} batch embeddings for ${this.config.model} (dimension: ${firstEmbedding.length})`
      );

      return embeddings.map((embedding): EmbeddingVector => ({
        vector: embedding,
        dimension: embedding.length
      }));
    }, `embedBatch(${this.config.model})`);
  }

  async detectDimension(testText: string = "test"): Promise<number> {
    console.log(`[EmbeddingMonster] 📏 Detecting dimension for ${this.config.model} model...`);
    
    try {
      const result = await this.embed(testText);
      const detectedDimension = result.dimension;
      console.log(`[EmbeddingMonster] ✅ Detected dimension: ${detectedDimension} for ${this.config.model}`);
      return detectedDimension;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[EmbeddingMonster] ❌ Failed to detect dimension for ${this.config.model}: ${errorMessage}`);
      throw new Error(`Failed to detect dimension for ${this.config.model}: ${errorMessage}`);
    }
  }

  getDimension(): number {
    return this.dimension;
  }

  getProvider(): string {
    return 'EmbeddingMonster';
  }

  getModel(): string {
    return this.config.model;
  }

  /**
   * Set model type (gte or coderank)
   */
  async setModel(model: 'gte' | 'coderank'): Promise<void> {
    if (this.config.model !== model) {
      this.config.model = model;
      this.dimension = 768;
      
      // Update base URL for new model
      const port = model === 'gte' ? this.config.gtePort : this.config.coderankPort;
      this.baseUrl = `http://localhost:${port}`;
      
      console.log(`[EmbeddingMonster] 🔄 Switched to ${model} model, dimension: ${this.dimension}`);
      
      // Verify the new service is healthy
      try {
        await this.checkHealth();
        console.log(`[EmbeddingMonster] ✅ ${model} service is healthy`);
      } catch (error) {
        console.warn(`[EmbeddingMonster] ⚠️ ${model} service health check failed:`, error);
      }
    }
  }

  /**
   * Set custom ports for the services
   */
  setPorts(gtePort?: number, coderankPort?: number): void {
    if (gtePort !== undefined) {
      this.config.gtePort = gtePort;
    }
    if (coderankPort !== undefined) {
      this.config.coderankPort = coderankPort;
    }
    
    // Update base URL if current model's port changed
    const currentPort = this.config.model === 'gte' ? this.config.gtePort : this.config.coderankPort;
    this.baseUrl = `http://localhost:${currentPort}`;
    
    console.log(`[EmbeddingMonster] 🔧 Updated ports - GTE: ${this.config.gtePort}, CodeRank: ${this.config.coderankPort}`);
  }

  /**
   * Set timeout for requests
   */
  setTimeout(timeout: number): void {
    this.timeout = timeout;
    console.log(`[EmbeddingMonster] ⏱️ Set timeout to ${timeout}ms`);
  }

  /**
   * Set retry count for failed requests
   */
  setRetries(retries: number): void {
    this.retries = retries;
    console.log(`[EmbeddingMonster] 🔄 Set retry count to ${retries}`);
  }

  /**
   * Get current configuration
   */
  getConfig(): EmbeddingMonsterConfig {
    return { ...this.config };
  }

  /**
   * Get supported models and their properties
   */
  static getSupportedModels(): Record<string, { dimension: number; description: string; defaultPort: number }> {
    return {
      'gte': {
        dimension: 768,
        description: 'GTE-1.5-base - Universal text embedding model with 8192 token context',
        defaultPort: 30001
      },
      'coderank': {
        dimension: 768,
        description: 'CodeRankEmbed - Code embedding model optimized for code search and retrieval',
        defaultPort: 30002
      }
    };
  }
}

