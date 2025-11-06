/**
 * Node Settings Types for Settings Panel
 * Each node type has specific configuration options
 */

// Base node settings that all types share
export interface BaseNodeSettings {
  label: string;
  description?: string;
}

// GitHub Repository Node Settings
export interface GitHubNodeSettings extends BaseNodeSettings {
  type: 'github';
  repo: string;                    // github.com/user/repo
  branch: string;                  // main, develop, etc.
  dataset?: string;                // Target dataset name
  scope?: 'global' | 'project' | 'local';
  token?: string;                  // GitHub API token (optional)
  fileFilters?: {
    include?: string[];            // ['*.ts', '*.tsx']
    exclude?: string[];            // ['node_modules/**', '*.test.ts']
  };
  autoReindex?: boolean;           // Auto re-index on changes
  webhookEnabled?: boolean;        // Enable webhook for updates
}

// Web Crawler Node Settings
export interface WebCrawlerNodeSettings extends BaseNodeSettings {
  type: 'webcrawler';
  startUrl: string;                // https://example.com
  maxPages: number;                // Max pages to crawl (default: 50)
  maxDepth: number;                // Crawl depth (default: 2)
  crawlType: 'single' | 'recursive' | 'sitemap';
  sameDomainOnly: boolean;         // Stay on same domain (default: true)
  extractCodeExamples: boolean;    // Extract code blocks (default: true)
  dataset?: string;                // Target dataset name
  scope?: 'global' | 'project' | 'local';
  urlPatterns?: {
    include?: string[];            // ['/docs/**', '/api/**']
    exclude?: string[];            // ['/admin/**', '/login']
  };
  rateLimit?: number;              // Requests per second (default: 5)
  timeout?: number;                // Request timeout in ms (default: 30000)
  waitStrategy?: 'domcontentloaded' | 'networkidle' | 'load';
  userAgent?: string;              // Custom user agent
  headers?: Record<string, string>; // Custom headers
}

// Vector Database Node Settings
export interface VectorDBNodeSettings extends BaseNodeSettings {
  type: 'vectordb';
  url: string;                     // http://localhost:6333
  collectionName: string;          // Collection/index name
  embeddingModel: string;          // text-embedding-3-small, etc.
  dimension: number;               // Embedding dimension (768, 1536, etc.)
  distanceMetric: 'cosine' | 'euclidean' | 'dot';
  apiKey?: string;                 // API key if required
  createIfNotExists: boolean;      // Auto-create collection
  hybridSearch?: boolean;          // Enable hybrid search
  sparseVectors?: boolean;         // Enable sparse vectors (SPLADE)
}

// Reranker Node Settings
export interface RerankerNodeSettings extends BaseNodeSettings {
  type: 'reranker';
  url: string;                     // http://localhost:30003
  model: string;                   // cross-encoder/ms-marco-MiniLM-L-6-v2
  topK: number;                    // Number of results to rerank (default: 10)
  scoreThreshold?: number;         // Min score threshold (0-1)
  batchSize?: number;              // Batch size for reranking
  timeout?: number;                // Request timeout in ms
}

// LLM Node Settings
export interface LLMNodeSettings extends BaseNodeSettings {
  type: 'llm';
  provider: 'openai' | 'anthropic' | 'groq' | 'minimax' | 'custom';
  apiBase: string;                 // https://api.openai.com/v1
  apiKey: string;                  // API key
  model: string;                   // gpt-4-turbo, claude-3-opus, etc.
  temperature: number;             // 0.0 - 2.0 (default: 0.7)
  maxTokens: number;               // Max output tokens (default: 2000)
  topP?: number;                   // Top-p sampling (default: 1.0)
  frequencyPenalty?: number;       // Frequency penalty (0-2)
  presencePenalty?: number;        // Presence penalty (0-2)
  systemPrompt?: string;           // System prompt/instructions
  stopSequences?: string[];        // Stop sequences
}

// Dashboard Node Settings
export interface DashboardNodeSettings extends BaseNodeSettings {
  type: 'dashboard';
  metrics: Array<'chunks' | 'queries' | 'latency' | 'tokens' | 'errors'>;
  refreshInterval: number;         // Refresh interval in ms (default: 5000)
  visualizationType: 'line-chart' | 'bar-chart' | 'pie-chart' | 'gauge' | 'table';
  timeRange: '1h' | '6h' | '24h' | '7d' | '30d' | 'all';
  aggregation?: 'avg' | 'sum' | 'min' | 'max' | 'count';
  filters?: {
    project?: string;
    dataset?: string;
    status?: string[];
  };
}

// Union type of all node settings
export type NodeSettings =
  | GitHubNodeSettings
  | WebCrawlerNodeSettings
  | VectorDBNodeSettings
  | RerankerNodeSettings
  | LLMNodeSettings
  | DashboardNodeSettings;

// Settings panel state
export interface SettingsPanelState {
  isOpen: boolean;
  nodeId: string | null;
  nodeType: NodeSettings['type'] | null;
  settings: NodeSettings | null;
  isDirty: boolean;
  errors: Record<string, string>;
}

// Validation rules
export interface ValidationRule {
  field: string;
  validate: (value: any) => boolean;
  message: string;
}

// Settings form field definition
export interface SettingsField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'checkbox' | 'textarea' | 'array' | 'object';
  description?: string;
  placeholder?: string;
  required?: boolean;
  default?: any;
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  step?: number;
  validation?: ValidationRule[];
  group?: string;  // Group related fields
  condition?: (settings: any) => boolean;  // Conditional rendering
}

// GitHub node validation
export const githubValidationRules: ValidationRule[] = [
  {
    field: 'repo',
    validate: (value) => /^github\.com\/[\w-]+\/[\w-]+$/.test(value),
    message: 'Repository must be in format: github.com/owner/repo'
  },
  {
    field: 'branch',
    validate: (value) => value && value.length > 0,
    message: 'Branch is required'
  }
];

// Web crawler validation
export const webCrawlerValidationRules: ValidationRule[] = [
  {
    field: 'startUrl',
    validate: (value) => {
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    },
    message: 'Must be a valid URL'
  },
  {
    field: 'maxPages',
    validate: (value) => value > 0 && value <= 1000,
    message: 'Max pages must be between 1 and 1000'
  },
  {
    field: 'maxDepth',
    validate: (value) => value > 0 && value <= 10,
    message: 'Max depth must be between 1 and 10'
  }
];

// Vector DB validation
export const vectorDBValidationRules: ValidationRule[] = [
  {
    field: 'url',
    validate: (value) => {
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    },
    message: 'Must be a valid URL'
  },
  {
    field: 'collectionName',
    validate: (value) => value && value.length > 0,
    message: 'Collection name is required'
  },
  {
    field: 'dimension',
    validate: (value) => value > 0 && value <= 4096,
    message: 'Dimension must be between 1 and 4096'
  }
];

// LLM validation
export const llmValidationRules: ValidationRule[] = [
  {
    field: 'apiKey',
    validate: (value) => value && value.length > 0,
    message: 'API key is required'
  },
  {
    field: 'model',
    validate: (value) => value && value.length > 0,
    message: 'Model is required'
  },
  {
    field: 'temperature',
    validate: (value) => value >= 0 && value <= 2,
    message: 'Temperature must be between 0 and 2'
  },
  {
    field: 'maxTokens',
    validate: (value) => value > 0 && value <= 100000,
    message: 'Max tokens must be between 1 and 100000'
  }
];

// Get default settings for each node type
export const getDefaultSettings = (type: NodeSettings['type']): NodeSettings => {
  switch (type) {
    case 'github':
      return {
        type: 'github',
        label: 'GitHub Repository',
        repo: '',
        branch: 'main',
        scope: 'project',
        fileFilters: {
          include: ['*'],
          exclude: ['node_modules/**', '*.min.js', '*.map']
        },
        autoReindex: false,
        webhookEnabled: false
      };
    
    case 'webcrawler':
      return {
        type: 'webcrawler',
        label: 'Web Crawler',
        startUrl: '',
        maxPages: 50,
        maxDepth: 2,
        crawlType: 'recursive',
        sameDomainOnly: true,
        extractCodeExamples: true,
        scope: 'project',
        rateLimit: 5,
        timeout: 30000,
        waitStrategy: 'domcontentloaded'
      };
    
    case 'vectordb':
      return {
        type: 'vectordb',
        label: 'Vector Database',
        url: 'http://localhost:6333',
        collectionName: 'hybrid_code_chunks',
        embeddingModel: 'text-embedding-3-small',
        dimension: 768,
        distanceMetric: 'cosine',
        createIfNotExists: true,
        hybridSearch: true,
        sparseVectors: true
      };
    
    case 'reranker':
      return {
        type: 'reranker',
        label: 'Reranker',
        url: 'http://localhost:30003',
        model: 'cross-encoder/ms-marco-MiniLM-L-6-v2',
        topK: 10,
        scoreThreshold: 0.5,
        batchSize: 32,
        timeout: 10000
      };
    
    case 'llm':
      return {
        type: 'llm',
        label: 'LLM',
        provider: 'openai',
        apiBase: 'https://api.openai.com/v1',
        apiKey: '',
        model: 'gpt-4-turbo',
        temperature: 0.7,
        maxTokens: 2000,
        topP: 1.0,
        frequencyPenalty: 0,
        presencePenalty: 0
      };
    
    case 'dashboard':
      return {
        type: 'dashboard',
        label: 'Dashboard',
        metrics: ['chunks', 'queries', 'latency'],
        refreshInterval: 5000,
        visualizationType: 'line-chart',
        timeRange: '1h',
        aggregation: 'avg'
      };
    
    default:
      throw new Error(`Unknown node type: ${type}`);
  }
};

// Get validation rules for node type
export const getValidationRules = (type: NodeSettings['type']): ValidationRule[] => {
  switch (type) {
    case 'github':
      return githubValidationRules;
    case 'webcrawler':
      return webCrawlerValidationRules;
    case 'vectordb':
      return vectorDBValidationRules;
    case 'llm':
      return llmValidationRules;
    default:
      return [];
  }
};

// Validate settings
export const validateSettings = (settings: NodeSettings): Record<string, string> => {
  const errors: Record<string, string> = {};
  const rules = getValidationRules(settings.type);
  
  for (const rule of rules) {
    const value = (settings as any)[rule.field];
    if (!rule.validate(value)) {
      errors[rule.field] = rule.message;
    }
  }
  
  return errors;
};

// Settings panel actions
export type SettingsAction =
  | { type: 'OPEN'; nodeId: string; nodeType: NodeSettings['type']; settings: NodeSettings }
  | { type: 'CLOSE' }
  | { type: 'UPDATE_FIELD'; field: string; value: any }
  | { type: 'RESET' }
  | { type: 'SAVE' }
  | { type: 'SET_ERRORS'; errors: Record<string, string> };
