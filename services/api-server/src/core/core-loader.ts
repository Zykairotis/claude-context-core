import fs from 'fs';
import path from 'path';

export interface CoreModule {
  Context: new (config: any) => any;
  AutoEmbeddingMonster: new (config: any) => any;
  OpenAIEmbedding: new (config: any) => any;
  PostgresDualVectorDatabase: new (config: any) => any;
  QdrantVectorDatabase: new (config: any) => any;
  queryProject: (...args: any[]) => Promise<any>;
  smartQueryProject?: (...args: any[]) => Promise<any>;
  ingestGithubRepository: (...args: any[]) => Promise<any>;
  deleteGithubDataset: (...args: any[]) => Promise<any>;
  // Web content functions
  ingestWebPages?: (...args: any[]) => Promise<any>;
  indexWebPages?: (...args: any[]) => Promise<any>;
  deleteWebDataset?: (...args: any[]) => Promise<any>;
  deleteDataset?: (...args: any[]) => Promise<any>;
  queryWebContent?: (...args: any[]) => Promise<any>;
  smartQueryWebContent?: (...args: any[]) => Promise<any>;
  smartQueryWeb?: (...args: any[]) => Promise<any>;
}

let cachedModule: CoreModule | null = null;

export function loadCore(): CoreModule {
  if (cachedModule) {
    return cachedModule;
  }

  const candidates = [
    process.env.CORE_MODULE_PATH,
    path.resolve(process.cwd(), 'dist', 'core.js'),
    path.resolve(process.cwd(), '..', 'dist', 'core.js'),
    path.resolve(process.cwd(), '..', '..', 'dist', 'core.js'),
    path.resolve(__dirname, '..', '..', '..', '..', 'dist', 'core.js'),
    '/dist/core.js',
    '/dist/index.js'
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      if (!fs.existsSync(candidate)) {
        continue;
      }

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      cachedModule = require(candidate) as CoreModule;
      console.log(`[ContextFactory] Loaded claude-context core from ${candidate}`);
      return cachedModule;
    } catch (error) {
      console.warn(`[ContextFactory] Failed to load core from ${candidate}: ${(error as Error).message}`);
    }
  }

  throw new Error(
    'Unable to locate claude-context core dist. Set CORE_MODULE_PATH to the built index.js file.'
  );
}
