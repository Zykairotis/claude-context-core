import { Embedding, EmbeddingVector } from './base-embedding';
import { EmbeddingMonster, EmbeddingMonsterConfig } from './embed-monster-embedding';

/**
 * Configuration for parallel processing
 */
export interface AutoEmbeddingMonsterConfig extends Omit<EmbeddingMonsterConfig, 'model'> {
  concurrency?: number;
  batchSizePerRequest?: number;
  stellaBatchSize?: number;
}

/**
 * AutoEmbeddingMonster - Automatically switches between GTE and CodeRank models
 * based on file type for optimal embedding quality with parallel processing
 */
export class AutoEmbeddingMonster extends Embedding {
  private gteEmbedding: EmbeddingMonster;
  private coderankEmbedding: EmbeddingMonster;
  private currentModel: 'gte' | 'coderank' = 'gte';
  protected maxTokens: number = 8192;
  private concurrency: number;
  private batchSizePerRequest: number;
  private gteBatchSize: number;

  // File extensions for code files (use CodeRank)
  private static readonly CODE_EXTENSIONS = new Set([
    // JavaScript/TypeScript
    'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs',
    // Python
    'py', 'pyx', 'pyw', 'pyi',
    // Java/Kotlin/Scala
    'java', 'kt', 'kts', 'scala', 'sc',
    // C/C++/C#
    'c', 'cc', 'cpp', 'cxx', 'h', 'hpp', 'hxx', 'cs',
    // Go
    'go',
    // Rust
    'rs',
    // Ruby
    'rb', 'rake',
    // PHP
    'php', 'phtml',
    // Swift
    'swift',
    // Objective-C
    'm', 'mm',
    // Shell scripts
    'sh', 'bash', 'zsh', 'fish',
    // SQL
    'sql',
    // R
    'r',
    // Dart
    'dart',
    // Lua
    'lua',
    // Perl
    'pl', 'pm',
    // HTML/CSS (markup but often contains code)
    'html', 'htm', 'css', 'scss', 'sass', 'less',
    // Config files that are code-like
    'Dockerfile', 'dockerfile',
    'Makefile', 'makefile',
    'gradle', 'groovy',
    // Other
    'proto', 'thrift'
  ]);

  // File extensions for text/documentation files (use Stella)
  private static readonly TEXT_EXTENSIONS = new Set([
    'md', 'markdown', 'txt', 'text',
    'json', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf',
    'xml', 'svg',
    'rst', 'adoc', 'asciidoc',
    'tex', 'latex',
    'csv', 'tsv',
    'log'
  ]);

  constructor(config: AutoEmbeddingMonsterConfig) {
    super();

    // Set concurrency and batch size
    this.concurrency = config.concurrency || 16;
    this.batchSizePerRequest = Math.min(config.batchSizePerRequest || 32, 32); // Cap at 32 (CodeRank max)
    
    // GTE has 8192 token limit - can use full batch size (32 texts)
    // CodeRank can use larger batches (32 texts per request)
    this.gteBatchSize = config.batchSizePerRequest || 32; // Full batch size for GTE

    // Create both embedding instances
    this.gteEmbedding = new EmbeddingMonster({
      ...config,
      model: 'gte'
    });

    this.coderankEmbedding = new EmbeddingMonster({
      ...config,
      model: 'coderank'
    });

    console.log('[AutoEmbeddingMonster] ✅ Initialized with GTE and CodeRank models');
    console.log('[AutoEmbeddingMonster]   GTE-1.5-base: 768 dimensions for text/documentation (8192 token context)');
    console.log('[AutoEmbeddingMonster]   CodeRank: 768 dimensions for code files');
    console.log(`[AutoEmbeddingMonster]   Concurrency: ${this.concurrency} workers per model`);
    console.log(`[AutoEmbeddingMonster]   Batch size - GTE: ${this.gteBatchSize} texts/request, CodeRank: ${this.batchSizePerRequest} texts/request`);
  }

  /**
   * Detect if a file extension or content indicates a code file
   */
  private isCodeFile(filePath?: string, content?: string): boolean {
    if (filePath) {
      const ext = filePath.split('.').pop()?.toLowerCase();
      if (ext) {
        // Check if it's a known code extension
        if (AutoEmbeddingMonster.CODE_EXTENSIONS.has(ext)) {
          return true;
        }
        // Check if it's a known text extension
        if (AutoEmbeddingMonster.TEXT_EXTENSIONS.has(ext)) {
          return false;
        }
      }

      // Special case: files without extension but common code file names
      const fileName = filePath.split('/').pop()?.toLowerCase() || '';
      if (['dockerfile', 'makefile', 'rakefile', 'gemfile'].includes(fileName)) {
        return true;
      }
    }

    // If no file path, analyze content
    if (content) {
      // Heuristic: if content has common code patterns, treat as code
      const codePatterns = [
        /^(import|export|require|from|const|let|var|function|class|interface|type)\s/m,
        /^(def|class|import|from|if __name__)/m,
        /^(package|public|private|protected|class|interface|void|int|String)/m,
        /\{[\s\S]*\}/m, // Curly braces (common in many languages)
        /^\s*(\/\/|\/\*|\*|#|<!--)/m // Comments
      ];

      for (const pattern of codePatterns) {
        if (pattern.test(content)) {
          return true;
        }
      }
    }

    // Default to text (Stella) for unknown types
    return false;
  }

  /**
   * Get the appropriate model for a given file
   */
  private getModelForFile(filePath?: string, content?: string): 'gte' | 'coderank' {
    const isCode = this.isCodeFile(filePath, content);
    return isCode ? 'coderank' : 'gte';
  }

  /**
   * Get the appropriate embedding instance
   */
  private getEmbeddingInstance(model: 'gte' | 'coderank'): EmbeddingMonster {
    return model === 'gte' ? this.gteEmbedding : this.coderankEmbedding;
  }

  /**
   * Set context for next embedding (file path for detection)
   */
  setContext(filePath?: string): void {
    if (filePath) {
      this.currentModel = this.getModelForFile(filePath);
      console.log(`[AutoEmbeddingMonster] 🎯 Selected ${this.currentModel} model for: ${filePath}`);
    }
  }

  async embed(text: string, filePath?: string): Promise<EmbeddingVector> {
    const model = filePath ? this.getModelForFile(filePath, text) : this.currentModel;
    const embedding = this.getEmbeddingInstance(model);
    console.log(`[AutoEmbeddingMonster] 🔄 Using ${model} model for embedding`);
    return await embedding.embed(text);
  }

  async embedBatch(texts: string[], filePaths?: string[]): Promise<EmbeddingVector[]> {
    if (!filePaths || filePaths.length !== texts.length) {
      // No file paths provided, use current model for all with parallel processing
      console.log(`[AutoEmbeddingMonster] 📦 Batch embedding ${texts.length} texts with ${this.currentModel} model`);
      const embedding = this.getEmbeddingInstance(this.currentModel);
      const batchSize = this.currentModel === 'gte' ? this.gteBatchSize : this.batchSizePerRequest;
      return await this.processBatchWithConcurrency(embedding, texts, [], batchSize);
    }

    // Group texts by model
    const gteTexts: Array<{ text: string; index: number; filePath: string }> = [];
    const coderankTexts: Array<{ text: string; index: number; filePath: string }> = [];

    texts.forEach((text, index) => {
      const filePath = filePaths[index];
      const model = this.getModelForFile(filePath, text);
      
      if (model === 'gte') {
        gteTexts.push({ text, index, filePath });
      } else {
        coderankTexts.push({ text, index, filePath });
      }
    });

    console.log(`[AutoEmbeddingMonster] 📦 Batch embedding:`);
    console.log(`[AutoEmbeddingMonster]   GTE: ${gteTexts.length} chunks`);
    console.log(`[AutoEmbeddingMonster]   CodeRank: ${coderankTexts.length} chunks`);

    // Process both groups in parallel with their own concurrency pools
    const results: EmbeddingVector[] = new Array(texts.length);
    const promises: Promise<void>[] = [];

    if (gteTexts.length > 0) {
      const gtePromise = this.processBatchWithConcurrency(
        this.gteEmbedding,
        gteTexts.map(t => t.text),
        gteTexts.map(t => t.index),
        this.gteBatchSize // Use standard batch size for GTE (no token limits)
      ).then(embeddings => {
        embeddings.forEach((embedding, i) => {
          results[gteTexts[i].index] = embedding;
        });
      });
      promises.push(gtePromise);
    }

    if (coderankTexts.length > 0) {
      const coderankPromise = this.processBatchWithConcurrency(
        this.coderankEmbedding,
        coderankTexts.map(t => t.text),
        coderankTexts.map(t => t.index),
        this.batchSizePerRequest // Use standard batch size for CodeRank
      ).then(embeddings => {
        embeddings.forEach((embedding, i) => {
          results[coderankTexts[i].index] = embedding;
        });
      });
      promises.push(coderankPromise);
    }

    await Promise.all(promises);

    console.log(`[AutoEmbeddingMonster] ✅ Completed batch embedding of ${texts.length} texts`);
    return results;
  }

  /**
   * Process a large batch with controlled concurrency
   * @param embedding The embedding instance to use
   * @param texts The texts to embed
   * @param originalIndices The original indices of the texts
   * @param batchSize The number of texts per request (model-specific)
   */
  private async processBatchWithConcurrency(
    embedding: EmbeddingMonster,
    texts: string[],
    originalIndices: number[],
    batchSize: number = this.batchSizePerRequest
  ): Promise<EmbeddingVector[]> {
    if (texts.length === 0) {
      return [];
    }

    const model = embedding.getModel();
    const totalBatches = Math.ceil(texts.length / batchSize);

    console.log(`[AutoEmbeddingMonster] 🚀 Processing ${texts.length} chunks for ${model}`);
    console.log(`[AutoEmbeddingMonster]   Split into ${totalBatches} batches of ~${batchSize} chunks`);
    console.log(`[AutoEmbeddingMonster]   Using ${this.concurrency} parallel workers`);

    // Split into smaller batches
    const batches: string[][] = [];
    for (let i = 0; i < texts.length; i += batchSize) {
      batches.push(texts.slice(i, i + batchSize));
    }

    // Process batches with concurrency limit
    const results: EmbeddingVector[] = [];
    let completedBatches = 0;
    const startTime = Date.now();

    // Process batches in chunks with concurrency control
    for (let i = 0; i < batches.length; i += this.concurrency) {
      const batchGroup = batches.slice(i, i + this.concurrency);
      
      const batchPromises = batchGroup.map(async (batch) => {
        const batchResults = await embedding.embedBatch(batch);
        completedBatches++;
        
        // Progress logging
        if (completedBatches % 5 === 0 || completedBatches === totalBatches) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
          const throughput = (completedBatches * batchSize / parseFloat(elapsed)).toFixed(1);
          console.log(`[AutoEmbeddingMonster]   Progress: ${completedBatches}/${totalBatches} batches (${throughput} chunks/sec)`);
        }
        
        return batchResults;
      });

      const batchGroupResults = await Promise.all(batchPromises);
      results.push(...batchGroupResults.flat());
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    const throughput = (texts.length / parseFloat(totalTime)).toFixed(1);
    console.log(`[AutoEmbeddingMonster] ⚡ ${model}: ${texts.length} chunks in ${totalTime}s (${throughput} chunks/sec)`);

    return results;
  }

  getDimension(): number {
    // Return current model's dimension
    // Note: This is tricky because we have two models with different dimensions
    // For compatibility, we'll return the dimension of the current model
    return this.getEmbeddingInstance(this.currentModel).getDimension();
  }

  getProvider(): string {
    return 'AutoEmbeddingMonster';
  }

  getModel(): string {
    return `auto (gte/${this.gteEmbedding.getDimension()}d + coderank/${this.coderankEmbedding.getDimension()}d)`;
  }

  /**
   * Get both model instances for advanced usage
   */
  getModels(): { gte: EmbeddingMonster; coderank: EmbeddingMonster } {
    return {
      gte: this.gteEmbedding,
      coderank: this.coderankEmbedding
    };
  }

  /**
   * Health check both services
   */
  async checkHealth(): Promise<{ gte: boolean; coderank: boolean }> {
    const results = await Promise.allSettled([
      this.gteEmbedding.checkHealth(),
      this.coderankEmbedding.checkHealth()
    ]);

    return {
      gte: results[0].status === 'fulfilled',
      coderank: results[1].status === 'fulfilled'
    };
  }

  /**
   * Get file type statistics from a list of file paths
   */
  analyzeFiles(filePaths: string[]): { gte: number; coderank: number } {
    let gte = 0;
    let coderank = 0;

    for (const filePath of filePaths) {
      const model = this.getModelForFile(filePath);
      if (model === 'gte') {
        gte++;
      } else {
        coderank++;
      }
    }

    return { gte, coderank };
  }

  /**
   * Detect dimension (returns current model's dimension)
   */
  async detectDimension(testText?: string): Promise<number> {
    return this.getDimension();
  }
}

