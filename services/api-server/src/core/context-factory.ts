import { Pool } from 'pg';
import { config } from '../config';
import { loadCore, CoreModule } from './core-loader';

type CoreContext = any;

let contextInstance: CoreContext | null = null;
let coreModule: CoreModule | null = null;

function getCoreModule(): CoreModule {
  if (!coreModule) {
    coreModule = loadCore();
  }

  return coreModule;
}

function createEmbedding(): any {
  const core = getCoreModule();
  const provider = (process.env.EMBEDDING_PROVIDER || '').toLowerCase();

  if (provider === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      return new core.OpenAIEmbedding({
        apiKey,
        baseURL: process.env.OPENAI_BASE_URL
      });
    }
    console.warn('[ContextFactory] OPENAI_API_KEY not set, falling back to AutoEmbeddingMonster');
  }

  return new core.AutoEmbeddingMonster({
    gteHost: process.env.STELLA_HOST || 'localhost',
    coderankHost: process.env.CODERANK_HOST || 'localhost',
    gtePort: Number(process.env.STELLA_PORT ?? 30001),
    coderankPort: Number(process.env.CODERANK_PORT ?? 30002),
    concurrency: Number(process.env.EMBEDDING_CONCURRENCY ?? 16),
    batchSizePerRequest: Number(process.env.EMBEDDING_BATCH_SIZE_PER_REQUEST ?? 32)
  });
}

export function initializeContext(pool: Pool): CoreContext {
  if (contextInstance) {
    return contextInstance;
  }

  const core = getCoreModule();

  const vectorDatabase = new core.QdrantVectorDatabase({
    url: config.qdrantUrl || process.env.QDRANT_URL || 'http://localhost:6333'
  });

  const embedding = createEmbedding();

  contextInstance = new core.Context({
    vectorDatabase,
    embedding,
    postgresPool: pool
  });

  return contextInstance;
}

export function getCore(): CoreModule {
  return getCoreModule();
}
